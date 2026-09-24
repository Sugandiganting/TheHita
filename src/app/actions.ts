'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  INTERUNIT_PAYABLE,
  INTERUNIT_RECEIVABLE,
  buildPayLines,
  buildQuickEntryLines,
  buildReceiveLines,
  buildTransferLines,
  checkBalance,
  checkPerUnitBalance,
  round,
  type DraftLine,
  type InterUnitAccounts,
  type MoneyLine,
} from '@/lib/accounting';

export type ActionState = { ok: boolean; message: string };

const empty: ActionState = { ok: false, message: '' };

/** Tanggal dari <input type="date"> diperlakukan sebagai tanggal UTC murni. */
function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function parseAmount(value: FormDataEntryValue | null): number {
  if (value == null) return 0;
  // Terima format "1.500.000" maupun "1500000".
  const cleaned = String(value).replace(/[^\d,-]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function fail(message: string): ActionState {
  return { ok: false, message };
}

function ok(message: string): ActionState {
  return { ok: true, message };
}

/* ------------------------------------------------------------------ */
/* Transaksi                                                           */
/* ------------------------------------------------------------------ */

const quickSchema = z.object({
  kind: z.enum(['INCOME', 'EXPENSE']),
  date: z.string().min(8),
  unitId: z.string().min(1, 'Unit usaha wajib dipilih'),
  categoryAccountId: z.string().min(1, 'Akun kategori wajib dipilih'),
  counterAccountId: z.string().min(1, 'Akun kas/bank wajib dipilih'),
  description: z.string().min(1, 'Keterangan wajib diisi'),
  reference: z.string().optional(),
});

/** Entri cepat: cukup pilih kategori & kas, jurnal double-entry dibuat otomatis. */
export async function createQuickEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = quickSchema.safeParse({
    kind: formData.get('kind'),
    date: formData.get('date'),
    unitId: formData.get('unitId'),
    categoryAccountId: formData.get('categoryAccountId'),
    counterAccountId: formData.get('counterAccountId'),
    description: formData.get('description'),
    reference: formData.get('reference') ?? '',
  });

  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const amount = parseAmount(formData.get('amount'));
  if (amount <= 0) return fail('Nominal harus lebih besar dari nol.');

  const data = parsed.data;
  const lines = buildQuickEntryLines({
    kind: data.kind,
    amount,
    unitId: data.unitId,
    categoryAccountId: data.categoryAccountId,
    counterAccountId: data.counterAccountId,
    memo: data.description,
  });

  const guard = await validateLines(lines);
  if (guard) return fail(guard);

  await prisma.journalEntry.create({
    data: {
      date: parseDate(data.date),
      unitId: data.unitId,
      description: data.description,
      reference: data.reference || null,
      source: 'QUICK',
      lines: { create: lines },
    },
  });

  revalidatePath('/transaksi');
  revalidatePath('/');
  revalidatePath('/laporan');
  revalidatePath('/peramalan');

  return ok(
    `${data.kind === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat.`,
  );
}

/** Jurnal manual multi-baris untuk transaksi yang lebih rumit. */
export async function createJournalEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = String(formData.get('date') ?? '');
  const unitId = String(formData.get('unitId') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const reference = String(formData.get('reference') ?? '').trim();

  if (!date) return fail('Tanggal wajib diisi.');
  if (!unitId) return fail('Unit usaha wajib dipilih.');
  if (!description) return fail('Keterangan wajib diisi.');

  const accountIds = formData.getAll('lineAccountId').map(String);
  const lineUnitIds = formData.getAll('lineUnitId').map(String);
  const debits = formData.getAll('lineDebit');
  const credits = formData.getAll('lineCredit');
  const memos = formData.getAll('lineMemo').map(String);

  const lines: DraftLine[] = [];
  for (let i = 0; i < accountIds.length; i++) {
    const accountId = accountIds[i];
    const debit = round(parseAmount(debits[i] ?? null));
    const credit = round(parseAmount(credits[i] ?? null));
    if (!accountId || (debit === 0 && credit === 0)) continue;
    if (debit > 0 && credit > 0) return fail(`Baris ${i + 1}: isi debit atau kredit saja, tidak keduanya.`);
    lines.push({ accountId, unitId: lineUnitIds[i] || unitId, debit, credit, memo: memos[i] || null });
  }

  if (lines.length < 2) return fail('Jurnal minimal terdiri dari 2 baris.');

  const balance = checkBalance(lines);
  if (!balance.balanced) {
    return fail(
      `Jurnal belum balance. Total debit Rp ${balance.totalDebit.toLocaleString('id-ID')}, ` +
        `total kredit Rp ${balance.totalCredit.toLocaleString('id-ID')} (selisih Rp ${Math.abs(balance.difference).toLocaleString('id-ID')}).`,
    );
  }

  const guard = await validateLines(lines);
  if (guard) return fail(guard);

  await prisma.journalEntry.create({
    data: {
      date: parseDate(date),
      unitId,
      description,
      reference: reference || null,
      source: 'MANUAL',
      lines: { create: lines },
    },
  });

  revalidatePath('/transaksi');
  revalidatePath('/');
  revalidatePath('/laporan');
  revalidatePath('/peramalan');

  return ok(`Jurnal tersimpan, ${lines.length} baris, total Rp ${balance.totalDebit.toLocaleString('id-ID')}.`);
}

/** Akun header tidak boleh diposting — ini yang menjaga COA tetap rapi. */
async function validateLines(lines: DraftLine[]): Promise<string | null> {
  const ids = [...new Set(lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, name: true, isHeader: true, active: true },
  });

  if (accounts.length !== ids.length) return 'Ada akun yang tidak ditemukan.';

  const header = accounts.find((a) => a.isHeader);
  if (header) return `Akun ${header.code} ${header.name} adalah akun induk dan tidak bisa dipakai posting.`;

  const inactive = accounts.find((a) => !a.active);
  if (inactive) return `Akun ${inactive.code} ${inactive.name} sudah non-aktif.`;

  return null;
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await prisma.journalEntry.delete({ where: { id } });
  revalidatePath('/transaksi');
  revalidatePath('/');
  revalidatePath('/laporan');
  revalidatePath('/peramalan');
}

/* ------------------------------------------------------------------ */
/* Master data                                                         */
/* ------------------------------------------------------------------ */

export async function saveAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '');
  const subtype = String(formData.get('subtype') ?? '').trim();
  const isCash = formData.get('isCash') === 'on';
  const isHeader = formData.get('isHeader') === 'on';
  const cashflowCategory = String(formData.get('cashflowCategory') ?? '').trim();

  if (!code) return fail('Nomor akun wajib diisi.');
  if (!name) return fail('Nama akun wajib diisi.');
  if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'].includes(type)) {
    return fail('Jenis akun tidak valid.');
  }
  if (isCash && type !== 'ASSET') return fail('Akun kas/bank harus berjenis Aset.');

  const payload = {
    code,
    name,
    type,
    subtype: subtype || null,
    isCash,
    isHeader,
    cashflowCategory: cashflowCategory || null,
  };

  const duplicate = await prisma.account.findUnique({ where: { code }, select: { id: true } });
  if (duplicate && duplicate.id !== id) return fail(`Nomor akun ${code} sudah dipakai.`);

  if (id) {
    await prisma.account.update({ where: { id }, data: payload });
  } else {
    await prisma.account.create({ data: payload });
  }

  revalidatePath('/coa');
  return ok(`Akun ${code} — ${name} tersimpan.`);
}

export async function toggleAccountActive(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const account = await prisma.account.findUnique({ where: { id }, select: { active: true } });
  if (!account) return;
  await prisma.account.update({ where: { id }, data: { active: !account.active } });
  revalidatePath('/coa');
}

export async function saveUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? 'HOTEL');
  const roomCount = Number(formData.get('roomCount') ?? 0) || 0;
  const openingCash = parseAmount(formData.get('openingCash'));
  const legacyPms = String(formData.get('legacyPms') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();

  if (!code) return fail('Kode unit wajib diisi.');
  if (!name) return fail('Nama unit wajib diisi.');

  const duplicate = await prisma.businessUnit.findUnique({ where: { code }, select: { id: true } });
  if (duplicate && duplicate.id !== id) return fail(`Kode unit ${code} sudah dipakai.`);

  const payload = {
    code,
    name,
    type,
    roomCount,
    openingCash,
    legacyPms: legacyPms || null,
    address: address || null,
  };

  if (id) {
    await prisma.businessUnit.update({ where: { id }, data: payload });
  } else {
    let group = await prisma.businessGroup.findFirst();
    if (!group) {
      group = await prisma.businessGroup.create({ data: { code: 'HITA', name: 'The Hita Hospitality Group' } });
    }
    await prisma.businessUnit.create({ data: { ...payload, groupId: group.id } });
  }

  revalidatePath('/unit');
  revalidatePath('/');
  return ok(`Unit ${name} tersimpan.`);
}

export async function toggleUnitActive(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const unit = await prisma.businessUnit.findUnique({ where: { id }, select: { active: true } });
  if (!unit) return;
  await prisma.businessUnit.update({ where: { id }, data: { active: !unit.active } });
  revalidatePath('/unit');
}

/* ------------------------------------------------------------------ */
/* Proyek                                                              */
/* ------------------------------------------------------------------ */

export async function saveProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const unitId = String(formData.get('unitId') ?? '');
  const status = String(formData.get('status') ?? 'PLANNED');
  const startDate = String(formData.get('startDate') ?? '');
  const endDate = String(formData.get('endDate') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const fundingType = String(formData.get('fundingType') ?? 'NONE');
  const fundingAmount = parseAmount(formData.get('fundingAmount'));
  const fundingDate = String(formData.get('fundingDate') ?? '');
  const loanRatePct = Number(formData.get('loanRatePct') ?? 0) || 0;
  const loanTenorMonths = Number(formData.get('loanTenorMonths') ?? 0) || 0;
  const upliftRevenueMonthly = parseAmount(formData.get('upliftRevenueMonthly'));
  const upliftExpenseMonthly = parseAmount(formData.get('upliftExpenseMonthly'));
  const upliftStartDate = String(formData.get('upliftStartDate') ?? '');

  if (!name) return fail('Nama proyek wajib diisi.');
  if (!unitId) return fail('Unit usaha wajib dipilih.');
  if (!startDate) return fail('Tanggal mulai wajib diisi.');
  if (fundingAmount > 0 && !fundingDate) return fail('Isi tanggal pencairan dana.');
  if (fundingType === 'LOAN' && fundingAmount > 0 && loanTenorMonths <= 0) {
    return fail('Isi tenor pinjaman (bulan) agar cicilan bisa dihitung.');
  }

  const payload = {
    name,
    unitId,
    status,
    startDate: parseDate(startDate),
    endDate: endDate ? parseDate(endDate) : null,
    description: description || null,
    fundingType,
    fundingAmount,
    fundingDate: fundingDate ? parseDate(fundingDate) : null,
    loanRatePct,
    loanTenorMonths,
    upliftRevenueMonthly,
    upliftExpenseMonthly,
    upliftStartDate: upliftStartDate ? parseDate(upliftStartDate) : null,
  };

  const project = id
    ? await prisma.project.update({ where: { id }, data: payload })
    : await prisma.project.create({ data: payload });

  revalidatePath('/proyek');
  revalidatePath(`/proyek/${project.id}`);
  revalidatePath('/peramalan');
  return ok(`Proyek "${name}" tersimpan.`);
}

export async function addCostItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = String(formData.get('projectId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const amount = parseAmount(formData.get('amount'));
  const plannedDate = String(formData.get('plannedDate') ?? '');
  const accountId = String(formData.get('accountId') ?? '');

  if (!projectId) return fail('Proyek tidak ditemukan.');
  if (!name) return fail('Nama item biaya wajib diisi.');
  if (amount <= 0) return fail('Nominal harus lebih besar dari nol.');
  if (!plannedDate) return fail('Jadwal pembayaran wajib diisi.');

  await prisma.projectCostItem.create({
    data: {
      projectId,
      name,
      amount,
      plannedDate: parseDate(plannedDate),
      accountId: accountId || null,
    },
  });

  revalidatePath(`/proyek/${projectId}`);
  revalidatePath('/peramalan');
  return ok(`Item "${name}" ditambahkan.`);
}

export async function toggleCostItemPaid(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const item = await prisma.projectCostItem.findUnique({ where: { id }, select: { paid: true, projectId: true } });
  if (!item) return;
  await prisma.projectCostItem.update({ where: { id }, data: { paid: !item.paid } });
  revalidatePath(`/proyek/${item.projectId}`);
  revalidatePath('/peramalan');
}

export async function deleteCostItem(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const item = await prisma.projectCostItem.findUnique({ where: { id }, select: { projectId: true } });
  if (!item) return;
  await prisma.projectCostItem.delete({ where: { id } });
  revalidatePath(`/proyek/${item.projectId}`);
  revalidatePath('/peramalan');
}

export async function deleteProject(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await prisma.project.delete({ where: { id } });
  revalidatePath('/proyek');
  revalidatePath('/peramalan');
}

/* ------------------------------------------------------------------ */
/* Kas & Bank                                                          */
/* ------------------------------------------------------------------ */

function revalidateCash(): void {
  revalidatePath('/kas');
  revalidatePath('/kas/transfer');
  revalidatePath('/kas/terima');
  revalidatePath('/kas/bayar');
  revalidatePath('/transaksi');
  revalidatePath('/');
  revalidatePath('/laporan');
  revalidatePath('/peramalan');
}

/**
 * Mengambil akun penghubung antar unit, membuatnya bila belum ada.
 * Database yang dibuat sebelum fitur Kas & Bank hadir tidak punya akun ini,
 * jadi dibuat otomatis daripada menggagalkan transaksi pengguna.
 */
async function getInterUnitAccounts(): Promise<InterUnitAccounts> {
  const [recv, pay] = await Promise.all([
    prisma.account.upsert({
      where: { code: INTERUNIT_RECEIVABLE },
      update: {},
      create: {
        code: INTERUNIT_RECEIVABLE,
        name: 'Piutang Antar Unit',
        type: 'ASSET',
        subtype: 'INTERUNIT',
        cashflowCategory: 'OPERATING',
        description: 'Dipakai otomatis saat satu cabang menalangi cabang lain.',
      },
      select: { id: true },
    }),
    prisma.account.upsert({
      where: { code: INTERUNIT_PAYABLE },
      update: {},
      create: {
        code: INTERUNIT_PAYABLE,
        name: 'Hutang Antar Unit',
        type: 'LIABILITY',
        subtype: 'INTERUNIT',
        cashflowCategory: 'OPERATING',
        description: 'Pasangan dari 1-2500. Dibuat otomatis saat uang berpindah antar cabang.',
      },
      select: { id: true },
    }),
  ]);

  return { receivableId: recv.id, payableId: pay.id };
}

/** Memastikan akun yang dipilih memang akun kas/bank yang aktif. */
async function assertCashAccount(id: string, label: string): Promise<string | null> {
  const account = await prisma.account.findUnique({
    where: { id },
    select: { code: true, name: true, isCash: true, active: true, isHeader: true },
  });
  if (!account) return `${label} tidak ditemukan.`;
  if (account.isHeader) return `${account.code} ${account.name} adalah akun induk dan tidak bisa dipakai.`;
  if (!account.isCash) return `${account.code} ${account.name} bukan akun kas/bank.`;
  if (!account.active) return `${account.code} ${account.name} sudah non-aktif.`;
  return null;
}

/** Pemeriksaan terakhir sebelum menyimpan: balance total dan balance tiap unit. */
async function guardCashEntry(lines: DraftLine[]): Promise<string | null> {
  const total = checkBalance(lines);
  if (!total.balanced) {
    return `Jurnal tidak seimbang (selisih Rp ${Math.abs(total.difference).toLocaleString('id-ID')}). Transaksi dibatalkan.`;
  }

  const timpang = checkPerUnitBalance(lines);
  if (timpang.length > 0) {
    return 'Jurnal tidak seimbang pada tingkat unit usaha. Transaksi dibatalkan agar laporan per cabang tetap benar.';
  }

  return validateLines(lines);
}

/** Transfer uang antar rekening milik grup. */
export async function createTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = String(formData.get('date') ?? '');
  const fromAccountId = String(formData.get('fromAccountId') ?? '');
  const fromUnitId = String(formData.get('fromUnitId') ?? '');
  const toAccountId = String(formData.get('toAccountId') ?? '');
  const toUnitId = String(formData.get('toUnitId') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const reference = String(formData.get('reference') ?? '').trim();
  const amount = parseAmount(formData.get('amount'));

  if (!date) return fail('Tanggal wajib diisi.');
  if (!fromAccountId || !fromUnitId) return fail('Rekening asal wajib dipilih.');
  if (!toAccountId || !toUnitId) return fail('Rekening tujuan wajib dipilih.');
  if (amount <= 0) return fail('Nominal harus lebih besar dari nol.');
  if (fromAccountId === toAccountId && fromUnitId === toUnitId) {
    return fail('Rekening asal dan tujuan tidak boleh sama.');
  }

  const bad = (await assertCashAccount(fromAccountId, 'Rekening asal')) ?? (await assertCashAccount(toAccountId, 'Rekening tujuan'));
  if (bad) return fail(bad);

  const interUnit = await getInterUnitAccounts();
  const memo = description || 'Transfer antar rekening';
  const lines = buildTransferLines({ amount, fromAccountId, fromUnitId, toAccountId, toUnitId, interUnit, memo });

  const guard = await guardCashEntry(lines);
  if (guard) return fail(guard);

  await prisma.journalEntry.create({
    data: {
      date: parseDate(date),
      unitId: fromUnitId,
      description: memo,
      reference: reference || null,
      source: 'TRANSFER',
      lines: { create: lines },
    },
  });

  revalidateCash();
  const lintas = fromUnitId !== toUnitId;
  return ok(
    `Transfer Rp ${amount.toLocaleString('id-ID')} tercatat.` +
      (lintas ? ' Karena berbeda cabang, sistem otomatis mencatat piutang dan hutang antar unit.' : ''),
  );
}

/** Baris rincian dari formulir uang masuk / uang keluar. */
function readMoneyLines(formData: FormData, fallbackUnitId: string): MoneyLine[] {
  const accountIds = formData.getAll('lineAccountId').map(String);
  const unitIds = formData.getAll('lineUnitId').map(String);
  const amounts = formData.getAll('lineAmount');
  const memos = formData.getAll('lineMemo').map(String);

  const out: MoneyLine[] = [];
  for (let i = 0; i < accountIds.length; i++) {
    const amount = parseAmount(amounts[i] ?? null);
    if (!accountIds[i] || amount <= 0) continue;
    out.push({ accountId: accountIds[i], unitId: unitIds[i] || fallbackUnitId, amount, memo: memos[i] || null });
  }
  return out;
}

async function saveMoneyEntry(
  kind: 'RECEIVE' | 'PAY',
  formData: FormData,
): Promise<ActionState> {
  const date = String(formData.get('date') ?? '');
  const cashAccountId = String(formData.get('cashAccountId') ?? '');
  const cashUnitId = String(formData.get('cashUnitId') ?? '');
  const counterparty = String(formData.get('counterparty') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const reference = String(formData.get('reference') ?? '').trim();

  const label = kind === 'RECEIVE' ? 'Rekening penerima' : 'Rekening pembayar';
  if (!date) return fail('Tanggal wajib diisi.');
  if (!cashAccountId || !cashUnitId) return fail(`${label} wajib dipilih.`);
  if (!description) return fail('Keterangan wajib diisi.');

  const bad = await assertCashAccount(cashAccountId, label);
  if (bad) return fail(bad);

  const lines = readMoneyLines(formData, cashUnitId);
  if (lines.length === 0) return fail('Isi minimal satu baris rincian dengan nominal di atas nol.');

  const interUnit = await getInterUnitAccounts();
  const built = kind === 'RECEIVE'
    ? buildReceiveLines({ cashAccountId, cashUnitId, lines, interUnit })
    : buildPayLines({ cashAccountId, cashUnitId, lines, interUnit });

  const guard = await guardCashEntry(built);
  if (guard) return fail(guard);

  const total = round(lines.reduce((s, l) => s + Math.abs(l.amount), 0));
  const fullDescription = counterparty
    ? `${description} — ${kind === 'RECEIVE' ? 'dari' : 'kepada'} ${counterparty}`
    : description;

  await prisma.journalEntry.create({
    data: {
      date: parseDate(date),
      unitId: cashUnitId,
      description: fullDescription,
      reference: reference || null,
      source: kind === 'RECEIVE' ? 'RECEIVE' : 'PAY',
      lines: { create: built },
    },
  });

  revalidateCash();
  const lintas = lines.some((l) => l.unitId !== cashUnitId);
  return ok(
    `${kind === 'RECEIVE' ? 'Uang masuk' : 'Uang keluar'} Rp ${total.toLocaleString('id-ID')} tercatat dalam ${lines.length} baris rincian.` +
      (lintas ? ' Baris milik cabang lain otomatis dijembatani akun antar unit.' : ''),
  );
}

export async function createReceiveMoney(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return saveMoneyEntry('RECEIVE', formData);
}

export async function createPayMoney(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return saveMoneyEntry('PAY', formData);
}
