'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { COA_TEMPLATE } from '@/lib/coa-template';
import { PMS_SOURCES, type PmsSource } from '@/lib/coa-legacy';
import { namaPenanggung, penanggungBeban } from '@/lib/beban-bersama';
import { periodeBerikutnya } from '@/lib/rab';
import { toPeriod } from '@/lib/period';
import { MUSIM_BAWAAN, NAMA_BULAN } from '@/lib/musim';
import { MAKS_CICILAN } from '@/lib/rencana-belanja';
import { buatRencanaLanjutan } from '@/lib/rencana-berjalan';
import { PENGULANGAN, setelahDilunasi, type Pengulangan } from '@/lib/kewajiban';
import { cocokKataSandi, sidikKataSandi } from '@/lib/auth';
import { NAMA_KUKI, UMUR_SESI_HARI, buatToken } from '@/lib/sesi';
import { sesiSekarang } from '@/lib/sesi-server';
import { catatGagal, lupakan, sisaKunci } from '@/lib/gembok';
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

export type ActionState = {
  ok: boolean;
  message: string;
  /** Berhasil, tetapi ada yang perlu diperhatikan — ditampilkan berbeda. */
  warn?: boolean;
};

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

/** "14 Mar 2027" — untuk pesan yang dibaca manusia, bukan untuk disimpan. */
function formatTanggal(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
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

/** Akun yang dibuat dan dipakai sistem — tidak boleh dihapus lewat antarmuka. */
const SYSTEM_ACCOUNT_CODES = [INTERUNIT_RECEIVABLE, INTERUNIT_PAYABLE];

export async function saveAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '');
  const subtype = String(formData.get('subtype') ?? '').trim();
  const parentId = String(formData.get('parentId') ?? '').trim();
  const isCash = formData.get('isCash') === 'on';
  const isHeader = formData.get('isHeader') === 'on';
  const cashflowCategory = String(formData.get('cashflowCategory') ?? '').trim();

  if (!code) return fail('Nomor akun wajib diisi.');
  if (!name) return fail('Nama akun wajib diisi.');
  if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'].includes(type)) {
    return fail('Jenis akun tidak valid.');
  }
  if (isCash && type !== 'ASSET') return fail('Akun kas/bank harus berjenis Aset.');
  if (isCash && isHeader) return fail('Akun induk tidak bisa sekaligus menjadi akun kas/bank.');
  if (parentId && parentId === id) return fail('Akun tidak bisa menjadi induk bagi dirinya sendiri.');

  const duplicate = await prisma.account.findUnique({ where: { code }, select: { id: true } });
  if (duplicate && duplicate.id !== id) return fail(`Nomor akun ${code} sudah dipakai.`);

  if (parentId) {
    const parent = await prisma.account.findUnique({
      where: { id: parentId },
      select: { isHeader: true, code: true, name: true, parentId: true },
    });
    if (!parent) return fail('Akun induk tidak ditemukan.');
    if (!parent.isHeader) return fail(`${parent.code} ${parent.name} bukan akun induk.`);
    // Cegah lingkaran sederhana: induk tidak boleh anak dari akun ini.
    if (id && parent.parentId === id) return fail('Akun induk yang dipilih adalah anak dari akun ini.');
  }

  const payload = {
    code,
    name,
    type,
    subtype: subtype || null,
    parentId: parentId || null,
    isCash,
    isHeader,
    cashflowCategory: cashflowCategory || null,
  };

  if (!id) {
    await prisma.account.create({ data: payload });
    revalidatePath('/coa');
    return ok(`Akun ${code} — ${name} berhasil ditambahkan.`);
  }

  const existing = await prisma.account.findUnique({
    where: { id },
    select: { type: true, isCash: true, isHeader: true, code: true, _count: { select: { lines: true } } },
  });
  if (!existing) return fail('Akun tidak ditemukan.');

  // Akun yang sudah punya transaksi tidak boleh berubah sifat dasarnya.
  // Mengubah jenis akun membalik tanda saldo pada seluruh laporan lama,
  // dan mencabut tanda kas mengubah saldo kas serta hasil peramalan.
  if (existing._count.lines > 0) {
    if (existing.type !== type) {
      return fail(
        `Akun ${existing.code} sudah dipakai di ${existing._count.lines} baris jurnal, jenisnya tidak bisa diubah ` +
          'karena akan mengubah seluruh laporan yang sudah jadi. Non-aktifkan akun ini lalu buat akun baru.',
      );
    }
    if (existing.isCash !== isCash) {
      return fail(
        `Akun ${existing.code} sudah dipakai di ${existing._count.lines} baris jurnal, tanda kas/bank tidak bisa diubah ` +
          'karena akan mengubah saldo kas dan hasil peramalan.',
      );
    }
    if (!existing.isHeader && isHeader) {
      return fail(
        `Akun ${existing.code} sudah dipakai di ${existing._count.lines} baris jurnal, jadi tidak bisa dijadikan akun induk.`,
      );
    }
  }

  await prisma.account.update({ where: { id }, data: payload });
  revalidatePath('/coa');
  return ok(`Perubahan pada akun ${code} — ${name} tersimpan.`);
}

/**
 * Menghapus akun. Hanya boleh bila akun benar-benar bersih: belum pernah
 * dipakai di jurnal, tidak punya akun anak, dan tidak dirujuk item biaya proyek.
 * Akun yang sudah dipakai cukup dinonaktifkan supaya laporan lama tetap utuh.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  if (!id) return fail('Akun tidak ditemukan.');

  const account = await prisma.account.findUnique({
    where: { id },
    select: {
      code: true,
      name: true,
      _count: { select: { lines: true, children: true, costItems: true } },
    },
  });
  if (!account) return fail('Akun tidak ditemukan.');

  if (SYSTEM_ACCOUNT_CODES.includes(account.code)) {
    return fail(
      `Akun ${account.code} ${account.name} dipakai sistem untuk menjembatani transaksi antar cabang dan tidak bisa dihapus.`,
    );
  }
  if (account._count.lines > 0) {
    return fail(
      `Akun ${account.code} tidak bisa dihapus karena sudah dipakai di ${account._count.lines} baris jurnal. ` +
        'Non-aktifkan saja agar laporan lama tetap utuh.',
    );
  }
  if (account._count.children > 0) {
    return fail(
      `Akun ${account.code} masih menaungi ${account._count.children} akun di bawahnya. Pindahkan atau hapus akun tersebut terlebih dahulu.`,
    );
  }
  if (account._count.costItems > 0) {
    return fail(
      `Akun ${account.code} masih dirujuk ${account._count.costItems} item biaya proyek. Ubah item tersebut terlebih dahulu.`,
    );
  }

  await prisma.account.delete({ where: { id } });
  revalidatePath('/coa');
  return ok(`Akun ${account.code} — ${account.name} berhasil dihapus.`);
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
        description: 'Dibuat otomatis saat satu cabang menalangi cabang lain. Saldonya harus selalu meniadakan 2190.01.',
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
        description: 'Pasangan dari 1190.01, dibuat otomatis saat uang berpindah antar cabang.',
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

/* ------------------------------------------------------------------ */
/* Rencana Anggaran Biaya                                              */
/* ------------------------------------------------------------------ */

function segarkanRab() {
  revalidatePath('/rab');
  revalidatePath('/rab/laporan');
}

/** Scope yang boleh dipakai: kode cabang aktif, atau kelompok penanggung yang ada. */
async function scopeSah(): Promise<Set<string>> {
  const units = await prisma.businessUnit.findMany({ where: { active: true }, select: { code: true } });
  const sah = new Set(units.map((u) => u.code));
  for (const pms of Object.keys(PMS_SOURCES) as PmsSource[]) {
    for (const code of new Set(COA_TEMPLATE.filter((a) => !a.isHeader).map((a) => a.code))) {
      const nama = namaPenanggung(penanggungBeban(code, pms));
      if (nama) sah.add(nama);
    }
  }
  return sah;
}

export async function saveBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const scope = String(formData.get('scope') ?? '').trim().toUpperCase();
  const period = String(formData.get('period') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!/^\d{4}-\d{2}$/.test(period)) return fail('Bulan wajib diisi.');
  if (!scope) return fail('Pemilik RAB wajib dipilih.');
  if (!(await scopeSah()).has(scope)) return fail(`Pemilik RAB "${scope}" tidak dikenal.`);

  const kembar = await prisma.budget.findUnique({ where: { scope_period: { scope, period } }, select: { id: true } });
  if (kembar && kembar.id !== id) {
    return fail(`RAB ${scope} untuk ${period} sudah ada. Buka yang itu, jangan dibuat dua kali.`);
  }

  if (id) {
    await prisma.budget.update({ where: { id }, data: { scope, period, notes: notes || null } });
    segarkanRab();
    return ok('RAB diperbarui.');
  }

  const dibuat = await prisma.budget.create({ data: { scope, period, notes: notes || null } });
  segarkanRab();
  // RAB yang baru dibuat masih kosong, dan satu-satunya hal yang masuk akal
  // berikutnya adalah mengisi anggarannya per akun. Daripada meninggalkan
  // pemakai di daftar sambil menebak di mana tempat mengisinya, antar langsung
  // ke halaman rinciannya.
  redirect(`/rab/${dibuat.id}`);
}

export async function setBudgetStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!['DRAFT', 'ACTIVE'].includes(status)) return fail('Status tidak dikenal.');

  const budget = await prisma.budget.findUnique({ where: { id }, include: { lines: true } });
  if (!budget) return fail('RAB tidak ditemukan.');
  if (status === 'ACTIVE' && budget.lines.length === 0) {
    return fail('RAB kosong tidak bisa disahkan. Isi rinciannya dulu.');
  }

  await prisma.budget.update({ where: { id }, data: { status } });
  segarkanRab();
  return ok(status === 'ACTIVE' ? 'RAB disahkan.' : 'RAB dikembalikan ke draf.');
}

export async function deleteBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const budget = await prisma.budget.findUnique({ where: { id }, select: { status: true, scope: true, period: true } });
  if (!budget) return fail('RAB tidak ditemukan.');
  if (budget.status === 'ACTIVE') {
    return fail('RAB yang sudah disahkan tidak bisa dihapus. Kembalikan ke draf dulu.');
  }
  await prisma.budget.delete({ where: { id } });
  segarkanRab();
  // Tombol hapus hanya ada di halaman RAB itu sendiri, jadi setelah terhapus
  // alamat yang sedang dibuka tidak menunjuk apa pun lagi dan Next.js
  // menjawabnya dengan 404. Antar kembali ke daftar, di mana hilangnya baris
  // tadi sudah menjadi bukti bahwa penghapusan berhasil.
  redirect('/rab');
}

export async function saveBudgetLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const budgetId = String(formData.get('budgetId') ?? '');
  const accountId = String(formData.get('accountId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const amount = round(Number(String(formData.get('amount') ?? '').replace(/[^\d.-]/g, '')));

  if (!accountId) return fail('Akun wajib dipilih.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Nominal anggaran harus lebih dari nol.');

  const [budget, account] = await Promise.all([
    prisma.budget.findUnique({ where: { id: budgetId }, select: { id: true, status: true } }),
    prisma.account.findUnique({ where: { id: accountId }, select: { type: true, isHeader: true, name: true } }),
  ]);
  if (!budget) return fail('RAB tidak ditemukan.');
  if (budget.status === 'ACTIVE') return fail('RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.');
  if (!account) return fail('Akun tidak ditemukan.');
  if (account.isHeader) return fail('Akun induk tidak bisa dianggarkan, pilih akun rinciannya.');
  if (!['EXPENSE', 'COGS'].includes(account.type)) {
    return fail(`${account.name} bukan akun beban. RAB hanya untuk biaya.`);
  }

  await prisma.budgetLine.upsert({
    where: { budgetId_accountId: { budgetId, accountId } },
    update: { amount, notes: notes || null },
    create: { budgetId, accountId, amount, notes: notes || null },
  });
  segarkanRab();
  return ok('Anggaran disimpan.');
}

export async function deleteBudgetLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const line = await prisma.budgetLine.findUnique({ where: { id }, include: { budget: { select: { status: true } } } });
  if (!line) return fail('Baris anggaran tidak ditemukan.');
  if (line.budget.status === 'ACTIVE') return fail('RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.');

  await prisma.budgetLine.delete({ where: { id } });
  segarkanRab();
  return ok('Baris anggaran dihapus.');
}

/**
 * Menyalin RAB ke bulan berikutnya.
 *
 * Nominalnya disalin apa adanya, bukan diambil dari realisasi bulan lalu —
 * yang menyusun anggaran tetap orangnya. Hasil salinan selalu berstatus draf.
 */
export async function duplicateBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const budget = await prisma.budget.findUnique({ where: { id }, include: { lines: true } });
  if (!budget) return fail('RAB tidak ditemukan.');
  if (budget.lines.length === 0) return fail('RAB kosong, tidak ada yang bisa disalin.');

  const period = periodeBerikutnya(budget.period);
  const sudahAda = await prisma.budget.findUnique({
    where: { scope_period: { scope: budget.scope, period } },
    select: { id: true },
  });
  if (sudahAda) return fail(`RAB ${budget.scope} untuk ${period} sudah ada.`);

  const salinan = await prisma.budget.create({
    data: {
      scope: budget.scope,
      period,
      status: 'DRAFT',
      notes: budget.notes,
      lines: { create: budget.lines.map((l) => ({ accountId: l.accountId, amount: l.amount, notes: l.notes })) },
    },
  });
  segarkanRab();
  // Salinan dibuat untuk disesuaikan, bukan sekadar ada. Buka langsung supaya
  // judul halamannya sendiri yang memberi tahu bulan mana yang sedang dibuka.
  redirect(`/rab/${salinan.id}`);
}

/* ------------------------------------------------------------------ */
/* Rencana kas mingguan                                                */
/* ------------------------------------------------------------------ */

function segarkanRencanaKas() {
  revalidatePath('/rencana-kas');
}

function angka(formData: FormData, nama: string): number {
  return round(Number(String(formData.get(nama) ?? '').replace(/[^\d.-]/g, '')));
}

/** Kosong berarti "pakai usulan sistem", bukan nol. */
function angkaAtauNull(formData: FormData, nama: string): number | null {
  const mentah = String(formData.get(nama) ?? '').replace(/[^\d.-]/g, '');
  if (mentah === '') return null;
  const n = round(Number(mentah));
  return Number.isFinite(n) ? n : null;
}

export async function createCashPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const period = String(formData.get('period') ?? '').trim();
  if (!/^\d{4}-\d{2}$/.test(period)) return fail('Bulan wajib diisi.');

  const kembar = await prisma.cashPlan.findUnique({ where: { period }, select: { id: true } });
  if (kembar) return fail(`Rencana kas ${period} sudah ada. Buka yang itu.`);

  // Isinya diwarisi dari bulan terakhir yang ada — aturan yang sama dipakai
  // saat bulan berjalan dibuat sendiri, jadi keduanya memanggil satu fungsi.
  const hasil = await buatRencanaLanjutan(period);
  segarkanRencanaKas();
  return ok(
    hasil.dari
      ? `Rencana ${period} dibuat, ${hasil.komitmen} komitmen disalin dari ${hasil.dari}.`
      : `Rencana ${period} dibuat. Isi proyeksi dan komitmennya.`,
  );
}

export async function saveCashProjection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const plan = await prisma.cashPlan.findUnique({ where: { id }, select: { id: true } });
  if (!plan) return fail('Rencana kas tidak ditemukan.');

  const nilai = {
    incomePessimistic: angkaAtauNull(formData, 'pesimis'),
    incomeNormal: angkaAtauNull(formData, 'normal'),
    incomeOptimistic: angkaAtauNull(formData, 'optimis'),
  };
  const terisi = Object.values(nilai).filter((v) => v !== null) as number[];
  if (terisi.some((v) => v < 0)) return fail('Proyeksi tidak boleh negatif.');

  // Pesimis di atas optimis itu janggal, tetapi bukan mustahil: sheet optimis
  // di workbook bisa tertinggal saat yang lain sudah diperbarui. Menolaknya
  // akan mengunci seluruh formulir atas angka yang datang dari sana, jadi
  // disimpan apa adanya dan cukup diingatkan.
  const janggal = nilai.incomePessimistic !== null && nilai.incomeOptimistic !== null
    && nilai.incomePessimistic > nilai.incomeOptimistic;

  await prisma.cashPlan.update({
    where: { id },
    data: { ...nilai, notes: String(formData.get('notes') ?? '').trim() || null },
  });
  segarkanRencanaKas();
  return janggal
    ? {
        ok: true,
        warn: true,
        message: 'Proyeksi disimpan. Perhatikan: pesimis lebih besar daripada optimis, '
          + 'jadi kedua skenario itu tertukar.',
      }
    : ok('Proyeksi disimpan.');
}

export async function saveCheckpoint(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get('planId') ?? '');
  const tanggalTeks = String(formData.get('date') ?? '');
  const plan = await prisma.cashPlan.findUnique({ where: { id: planId }, select: { period: true } });
  if (!plan) return fail('Rencana kas tidak ditemukan.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalTeks)) return fail('Tanggal wajib diisi.');

  const date = parseDate(tanggalTeks);
  if (toPeriod(date) !== plan.period) return fail(`Tanggal harus berada di bulan ${plan.period}.`);

  const cashOnHand = angka(formData, 'cashOnHand');
  const incomeToDate = angka(formData, 'incomeToDate');
  if (!Number.isFinite(cashOnHand) || cashOnHand < 0) return fail('Saldo kas tidak boleh negatif.');
  if (!Number.isFinite(incomeToDate) || incomeToDate < 0) return fail('Uang masuk tidak boleh negatif.');

  const notes = String(formData.get('notes') ?? '').trim() || null;
  // Satu laporan per tanggal; mengirim ulang tanggal yang sama berarti koreksi.
  await prisma.cashCheckpoint.upsert({
    where: { planId_date: { planId, date } },
    update: { cashOnHand, incomeToDate, notes },
    create: { planId, date, cashOnHand, incomeToDate, notes },
  });
  segarkanRencanaKas();
  return ok('Posisi kas disimpan.');
}

export async function deleteCheckpoint(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const ada = await prisma.cashCheckpoint.findUnique({ where: { id }, select: { id: true } });
  if (!ada) return fail('Laporan posisi kas tidak ditemukan.');
  await prisma.cashCheckpoint.delete({ where: { id } });
  segarkanRencanaKas();
  return ok('Laporan posisi kas dihapus.');
}

export async function saveCommitment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get('planId') ?? '');
  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  const amount = angka(formData, 'amount');
  const dueDayMentah = String(formData.get('dueDay') ?? '').trim();
  const dueDay = dueDayMentah === '' ? null : Number(dueDayMentah);
  const recurring = formData.get('recurring') === 'on';

  if (!label) return fail('Nama komitmen wajib diisi.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Nominal harus lebih dari nol.');
  if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
    return fail('Tanggal jatuh tempo harus antara 1 dan 31.');
  }

  if (id) {
    await prisma.cashCommitment.update({ where: { id }, data: { label, amount, dueDay, recurring } });
  } else {
    const plan = await prisma.cashPlan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!plan) return fail('Rencana kas tidak ditemukan.');
    const jumlah = await prisma.cashCommitment.count({ where: { planId } });
    await prisma.cashCommitment.create({ data: { planId, label, amount, dueDay, recurring, sort: jumlah } });
  }
  segarkanRencanaKas();
  return ok(id ? 'Komitmen diperbarui.' : 'Komitmen ditambahkan.');
}

export async function toggleCommitmentPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const k = await prisma.cashCommitment.findUnique({ where: { id }, select: { paid: true, label: true } });
  if (!k) return fail('Komitmen tidak ditemukan.');
  await prisma.cashCommitment.update({ where: { id }, data: { paid: !k.paid } });
  segarkanRencanaKas();
  return ok(k.paid ? `${k.label} ditandai belum dibayar.` : `${k.label} ditandai sudah dibayar.`);
}

export async function deleteCommitment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const ada = await prisma.cashCommitment.findUnique({ where: { id }, select: { id: true } });
  if (!ada) return fail('Komitmen tidak ditemukan.');
  await prisma.cashCommitment.delete({ where: { id } });
  segarkanRencanaKas();
  return ok('Komitmen dihapus.');
}

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get('planId') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  const budget = angkaAtauNull(formData, 'budget');

  if (!label) return fail('Nama kategori wajib diisi.');
  if (budget === null) return fail('Jatah bulan ini wajib diisi.');
  if (budget < 0) return fail('Jatah tidak boleh negatif.');

  const plan = await prisma.cashPlan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) return fail('Rencana kas tidak ditemukan.');
  const jumlah = await prisma.spendCategory.count({ where: { planId } });
  await prisma.spendCategory.create({ data: { planId, label, budget, sort: jumlah } });
  segarkanRencanaKas();
  return ok('Kategori ditambahkan.');
}

export async function updateCategoryBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const budget = angkaAtauNull(formData, 'budget');

  if (budget === null) return fail('Jatah wajib diisi.');
  if (budget < 0) return fail('Jatah tidak boleh negatif.');
  const ada = await prisma.spendCategory.findUnique({ where: { id }, select: { label: true } });
  if (!ada) return fail('Kategori tidak ditemukan.');

  await prisma.spendCategory.update({ where: { id }, data: { budget } });
  segarkanRencanaKas();
  return ok(`Jatah ${ada.label} diubah.`);
}

export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const ada = await prisma.spendCategory.findUnique({ where: { id }, select: { id: true } });
  if (!ada) return fail('Kategori tidak ditemukan.');
  await prisma.spendCategory.delete({ where: { id } });
  segarkanRencanaKas();
  return ok('Kategori dihapus.');
}

export async function deleteCashPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const plan = await prisma.cashPlan.findUnique({ where: { id }, select: { period: true } });
  if (!plan) return fail('Rencana kas tidak ditemukan.');
  await prisma.cashPlan.delete({ where: { id } });
  segarkanRencanaKas();
  redirect('/rencana-kas');
}

export async function saveAssumptions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const plan = await prisma.cashPlan.findUnique({ where: { id }, select: { id: true } });
  if (!plan) return fail('Rencana kas tidak ditemukan.');

  const monthlyOutflow = angkaAtauNull(formData, 'monthlyOutflow');
  const salaryNeed = angkaAtauNull(formData, 'salaryNeed');
  if ((monthlyOutflow ?? 0) < 0 || (salaryNeed ?? 0) < 0) return fail('Angka tidak boleh negatif.');

  await prisma.cashPlan.update({ where: { id }, data: { monthlyOutflow, salaryNeed } });
  segarkanRencanaKas();
  return ok('Asumsi bulanan disimpan.');
}

export async function saveSpend(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const planId = String(formData.get('planId') ?? '');
  const categoryId = String(formData.get('categoryId') ?? '');
  const mode = String(formData.get('mode') ?? 'TAMBAH');
  const tanggalTeks = String(formData.get('date') ?? '');
  const amount = angka(formData, 'amount');

  if (!categoryId) return fail('Kategori wajib dipilih.');
  if (!['TAMBAH', 'SETEL'].includes(mode)) return fail('Cara pencatatan tidak dikenal.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalTeks)) return fail('Tanggal wajib diisi.');
  // SETEL boleh nol — itulah cara mengosongkan hitungan belanja sebuah kategori.
  if (!Number.isFinite(amount) || amount < 0) return fail('Nominal tidak boleh negatif.');
  if (mode === 'TAMBAH' && amount === 0) return fail('Nominal harus lebih dari nol.');

  const [plan, kategori, posisi] = await Promise.all([
    prisma.cashPlan.findUnique({ where: { id: planId }, select: { period: true } }),
    prisma.spendCategory.findUnique({ where: { id: categoryId }, select: { planId: true } }),
    prisma.cashCheckpoint.findFirst({
      where: { planId }, orderBy: { date: 'desc' }, select: { date: true },
    }),
  ]);
  if (!plan) return fail('Rencana kas tidak ditemukan.');
  if (!kategori || kategori.planId !== planId) return fail('Kategori bukan milik rencana ini.');

  const date = parseDate(tanggalTeks);
  if (toPeriod(date) !== plan.period) return fail(`Tanggal harus berada di bulan ${plan.period}.`);

  await prisma.spendEntry.create({
    data: { planId, categoryId, date, amount, mode, notes: String(formData.get('notes') ?? '').trim() || null },
  });
  segarkanRencanaKas();

  const pesan = mode === 'SETEL' ? 'Total belanja disetel ulang.' : 'Belanja ditambahkan.';

  // Belanja yang tanggalnya tidak melewati posisi kas dianggap sudah termasuk
  // dalam saldo yang dilaporkan, jadi ia tidak menggerakkan plafon sama sekali.
  // Tanpa diberitahu, yang terlihat hanyalah pesan berhasil di samping angka
  // yang tidak berubah — dan itu terbaca seperti kerusakan.
  if (posisi && date.getTime() <= posisi.date.getTime()) {
    return {
      ok: true,
      warn: true,
      message: `${pesan} Tanggalnya tidak melewati posisi kas terakhir `
        + `(${formatTanggal(posisi.date)}), jadi belanja ini dianggap sudah termasuk dalam saldo `
        + 'yang dilaporkan dan tidak mengurangi angka boleh belanja lagi. Sisa jatah '
        + 'kategorinya tetap terpotong seperti biasa.',
    };
  }
  return ok(pesan);
}

export async function deleteSpend(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const ada = await prisma.spendEntry.findUnique({ where: { id }, select: { id: true } });
  if (!ada) return fail('Laporan belanja tidak ditemukan.');
  await prisma.spendEntry.delete({ where: { id } });
  segarkanRencanaKas();
  return ok('Laporan belanja dihapus.');
}

/* ------------------------------------------------------------------ */
/* Musim                                                               */
/* ------------------------------------------------------------------ */

function segarkanMusim() {
  revalidatePath('/musim');
  revalidatePath('/rencana-kas');
}

/** Mengisi daftar musim pertama kali, agar menunya tidak dibuka dalam keadaan kosong. */
export async function seedSeasons(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const ada = await prisma.season.count();
  if (ada > 0) return fail('Daftar musim sudah terisi.');

  await prisma.season.createMany({
    data: MUSIM_BAWAAN.map((m) => ({ code: m.code, name: m.name, delta: m.delta, sort: m.sort })),
  });
  segarkanMusim();
  return ok(`${MUSIM_BAWAAN.length} musim bawaan ditambahkan. Sesuaikan persennya, lalu tentukan musim tiap bulan.`);
}

export async function saveSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const delta = Number(String(formData.get('delta') ?? '').replace(/[^\d.-]/g, ''));

  if (!code) return fail('Kode musim wajib diisi.');
  if (!/^[A-Z0-9_]+$/.test(code)) return fail('Kode hanya boleh huruf, angka, dan garis bawah.');
  if (!name) return fail('Nama musim wajib diisi.');
  if (!Number.isFinite(delta)) return fail('Persen harus berupa angka.');
  if (delta <= -100) return fail('Penurunan 100% atau lebih berarti pendapatan hilang sama sekali.');

  const kembar = await prisma.season.findUnique({ where: { code }, select: { id: true } });
  if (kembar && kembar.id !== id) return fail(`Kode ${code} sudah dipakai musim lain.`);

  if (id) {
    await prisma.season.update({ where: { id }, data: { code, name, delta } });
  } else {
    const jumlah = await prisma.season.count();
    await prisma.season.create({ data: { code, name, delta, sort: jumlah } });
  }
  segarkanMusim();
  return ok(id ? `Musim ${name} diperbarui.` : `Musim ${name} ditambahkan.`);
}

export async function deleteSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const musim = await prisma.season.findUnique({
    where: { id },
    select: { name: true, _count: { select: { months: true } } },
  });
  if (!musim) return fail('Musim tidak ditemukan.');

  // Bulan yang memakainya ikut terhapus, dan bulan tanpa musim diperlakukan
  // sebagai acuan — diam-diam mengubah ramalan. Jadi disebutkan di depan.
  await prisma.season.delete({ where: { id } });
  segarkanMusim();
  return ok(
    musim._count.months > 0
      ? `Musim ${musim.name} dihapus; ${musim._count.months} bulan kini belum punya musim.`
      : `Musim ${musim.name} dihapus.`,
  );
}

/** Menetapkan musim sebuah bulan kalender. Kosong berarti bulan itu dilepas. */
export async function setSeasonMonth(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const month = Number(formData.get('month'));
  const seasonId = String(formData.get('seasonId') ?? '');

  if (!Number.isInteger(month) || month < 1 || month > 12) return fail('Bulan tidak dikenal.');

  if (!seasonId) {
    await prisma.seasonMonth.deleteMany({ where: { month } });
    segarkanMusim();
    return ok(`${NAMA_BULAN[month - 1]} dilepas dari musim mana pun.`);
  }

  const musim = await prisma.season.findUnique({ where: { id: seasonId }, select: { name: true } });
  if (!musim) return fail('Musim tidak ditemukan.');

  await prisma.seasonMonth.upsert({
    where: { month },
    update: { seasonId },
    create: { month, seasonId },
  });
  segarkanMusim();
  return ok(`${NAMA_BULAN[month - 1]} ditetapkan sebagai ${musim.name}.`);
}

/* ------------------------------------------------------------------ */
/* Rencana belanja                                                     */
/* ------------------------------------------------------------------ */

export async function savePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  const amount = angka(formData, 'amount');
  const cadence = String(formData.get('cadence') ?? 'MONTHLY');
  const instalments = Number(String(formData.get('instalments') ?? '1').replace(/[^\d]/g, ''));
  const tanggalTeks = String(formData.get('startDate') ?? '');

  if (!label) return fail('Nama rencana belanja wajib diisi.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Harga harus lebih dari nol.');
  if (!['WEEKLY', 'MONTHLY'].includes(cadence)) return fail('Jarak cicilan tidak dikenal.');
  if (!Number.isInteger(instalments) || instalments < 1 || instalments > MAKS_CICILAN) {
    return fail(`Jumlah cicilan harus antara 1 dan ${MAKS_CICILAN}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalTeks)) return fail('Tanggal cicilan pertama wajib diisi.');

  const data = {
    label, amount, cadence, instalments, startDate: parseDate(tanggalTeks),
    notes: String(formData.get('notes') ?? '').trim() || null,
  };

  if (id) {
    const ada = await prisma.purchase.findUnique({ where: { id }, select: { status: true } });
    if (!ada) return fail('Rencana belanja tidak ditemukan.');
    if (ada.status === 'APPROVED') {
      return fail('Rencana yang sudah disetujui tidak bisa diubah. Kembalikan ke draf dulu.');
    }
    await prisma.purchase.update({ where: { id }, data });
  } else {
    await prisma.purchase.create({ data });
  }
  segarkanRencanaKas();
  return ok(id ? 'Rencana belanja diperbarui.' : `${label} disimpan sebagai draf.`);
}

export async function setPurchaseStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!['DRAFT', 'APPROVED'].includes(status)) return fail('Status tidak dikenal.');

  const ada = await prisma.purchase.findUnique({ where: { id }, select: { label: true } });
  if (!ada) return fail('Rencana belanja tidak ditemukan.');

  await prisma.purchase.update({ where: { id }, data: { status } });
  segarkanRencanaKas();
  return ok(status === 'APPROVED'
    ? `${ada.label} disetujui — cicilannya mulai memotong anggaran.`
    : `${ada.label} dikembalikan ke draf; cicilannya tidak lagi memotong anggaran.`);
}

export async function deletePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const ada = await prisma.purchase.findUnique({ where: { id }, select: { label: true } });
  if (!ada) return fail('Rencana belanja tidak ditemukan.');
  await prisma.purchase.delete({ where: { id } });
  segarkanRencanaKas();
  return ok(`${ada.label} dihapus.`);
}

/* ------------------------------------------------------------------ */
/* Kendaraan & kewajiban terjadwal                                     */
/* ------------------------------------------------------------------ */

function segarkanKewajiban() {
  revalidatePath('/kewajiban');
  revalidatePath('/kendaraan');
  revalidatePath('/rencana-kas');
}

const JENIS_KENDARAAN = ['MOBIL', 'MOTOR', 'LAINNYA'];

export async function saveVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const plate = String(formData.get('plate') ?? '').trim().toUpperCase();
  const name = String(formData.get('name') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'MOBIL');
  const unitId = String(formData.get('unitId') ?? '').trim() || null;
  const active = formData.get('active') !== 'off';

  if (!plate) return fail('Plat nomor wajib diisi.');
  if (!name) return fail('Nama kendaraan wajib diisi.');
  if (!JENIS_KENDARAAN.includes(kind)) return fail('Jenis kendaraan tidak dikenal.');

  const kembar = await prisma.vehicle.findUnique({ where: { plate }, select: { id: true } });
  if (kembar && kembar.id !== id) return fail(`Plat ${plate} sudah terdaftar.`);

  const data = {
    plate, name, kind, unitId, active,
    notes: String(formData.get('notes') ?? '').trim() || null,
  };

  if (id) {
    await prisma.vehicle.update({ where: { id }, data });
  } else {
    await prisma.vehicle.create({ data });
  }
  segarkanKewajiban();
  return ok(id ? `${plate} diperbarui.` : `${plate} ditambahkan.`);
}

export async function deleteVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const ada = await prisma.vehicle.findUnique({
    where: { id },
    select: { plate: true, _count: { select: { obligations: true } } },
  });
  if (!ada) return fail('Kendaraan tidak ditemukan.');

  // Jadwal pajaknya ikut terhapus bersama riwayat pelunasannya, jadi
  // jumlahnya disebutkan di layar sebelum tombol ini ditekan.
  await prisma.vehicle.delete({ where: { id } });
  segarkanKewajiban();
  return ok(
    ada._count.obligations > 0
      ? `${ada.plate} dihapus beserta ${ada._count.obligations} jadwalnya.`
      : `${ada.plate} dihapus.`,
  );
}

export async function saveObligation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  const amount = angka(formData, 'amount');
  const tanggalTeks = String(formData.get('dueDate') ?? '');
  const repeat = String(formData.get('repeat') ?? 'TAHUNAN');
  const repeatEvery = Number(String(formData.get('repeatEvery') ?? '1').replace(/[^\d]/g, ''));
  const vehicleId = String(formData.get('vehicleId') ?? '').trim() || null;

  if (!label) return fail('Nama kewajiban wajib diisi.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Nominal harus lebih dari nol.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalTeks)) return fail('Tanggal jatuh tempo wajib diisi.');
  if (!PENGULANGAN.some((p) => p.nilai === repeat)) return fail('Pengulangan tidak dikenal.');
  if (repeat !== 'SEKALI' && (!Number.isInteger(repeatEvery) || repeatEvery < 1 || repeatEvery > 60)) {
    return fail('Langkah pengulangan harus antara 1 dan 60.');
  }

  const data = {
    label,
    amount,
    dueDate: parseDate(tanggalTeks),
    repeat,
    repeatEvery: repeat === 'SEKALI' ? 1 : repeatEvery,
    vehicleId,
    notes: String(formData.get('notes') ?? '').trim() || null,
  };

  if (id) {
    const ada = await prisma.scheduledObligation.findUnique({ where: { id }, select: { id: true } });
    if (!ada) return fail('Kewajiban tidak ditemukan.');
    await prisma.scheduledObligation.update({ where: { id }, data });
  } else {
    await prisma.scheduledObligation.create({ data });
  }
  segarkanKewajiban();
  return ok(id ? `${label} diperbarui.` : `${label} ditambahkan.`);
}

export async function setObligationActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  const ada = await prisma.scheduledObligation.findUnique({ where: { id }, select: { label: true } });
  if (!ada) return fail('Kewajiban tidak ditemukan.');

  await prisma.scheduledObligation.update({ where: { id }, data: { active } });
  segarkanKewajiban();
  return ok(active
    ? `${ada.label} diaktifkan kembali dan ikut lagi di ramalan.`
    : `${ada.label} dinonaktifkan; tidak lagi memukul ramalan.`);
}

export async function deleteObligation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const ada = await prisma.scheduledObligation.findUnique({
    where: { id },
    select: { label: true, _count: { select: { payments: true } } },
  });
  if (!ada) return fail('Kewajiban tidak ditemukan.');

  await prisma.scheduledObligation.delete({ where: { id } });
  segarkanKewajiban();
  return ok(
    ada._count.payments > 0
      ? `${ada.label} dihapus beserta ${ada._count.payments} riwayat pelunasannya.`
      : `${ada.label} dihapus.`,
  );
}

/**
 * Menandai satu jatuh tempo sudah dibayar.
 *
 * Nominal sebenarnya dicatat, bukan nominal perkiraan: pajak naik sedikit tiap
 * tahun, dan angka tahun lalu adalah tebakan terbaik untuk tahun depan.
 */
export async function payObligation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const dueTeks = String(formData.get('dueDate') ?? '');
  const paidTeks = String(formData.get('paidDate') ?? '');
  const amount = angka(formData, 'amount');

  const row = await prisma.scheduledObligation.findUnique({ where: { id } });
  if (!row) return fail('Kewajiban tidak ditemukan.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueTeks)) return fail('Jatuh tempo yang dibayar tidak dikenal.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidTeks)) return fail('Tanggal pembayaran wajib diisi.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Nominal pembayaran harus lebih dari nol.');

  const dueDate = parseDate(dueTeks);
  await prisma.$transaction([
    prisma.obligationPayment.create({
      data: { obligationId: id, dueDate, paidDate: parseDate(paidTeks), amount },
    }),
    prisma.scheduledObligation.update({ where: { id }, data: { paidUntil: dueDate } }),
  ]);

  const lanjutan = setelahDilunasi(
    {
      label: row.label, amount: row.amount, dueDate: row.dueDate,
      repeat: row.repeat as Pengulangan, repeatEvery: row.repeatEvery,
      active: row.active, paidUntil: dueDate,
    },
    dueDate,
  );
  segarkanKewajiban();
  return ok(lanjutan
    ? `${row.label} dicatat lunas. Jatuh tempo berikutnya ${formatTanggal(lanjutan)}.`
    : `${row.label} dicatat lunas dan sudah tidak berulang lagi.`);
}

/** Membatalkan pelunasan terakhir, mis. salah tanggal atau salah nominal. */
export async function unpayObligation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const row = await prisma.scheduledObligation.findUnique({
    where: { id },
    select: { label: true, payments: { orderBy: { dueDate: 'desc' }, take: 2 } },
  });
  if (!row) return fail('Kewajiban tidak ditemukan.');
  const [terakhir, sebelumnya] = row.payments;
  if (!terakhir) return fail('Belum ada pelunasan yang bisa dibatalkan.');

  await prisma.$transaction([
    prisma.obligationPayment.delete({ where: { id: terakhir.id } }),
    prisma.scheduledObligation.update({
      where: { id },
      data: { paidUntil: sebelumnya?.dueDate ?? null },
    }),
  ]);
  segarkanKewajiban();
  return ok(`Pelunasan ${row.label} ${formatTanggal(terakhir.dueDate)} dibatalkan.`);
}

/* ------------------------------------------------------------------ */
/* Masuk dan keluar                                                    */
/* ------------------------------------------------------------------ */

/**
 * Memeriksa kata sandi lalu memasang kuki sesi.
 *
 * Pesan gagalnya sengaja sama untuk "pengguna tidak ada" dan "kata sandi
 * salah": membedakan keduanya memberi tahu penebak bahwa sebuah nama pengguna
 * memang ada, dan itu separuh pekerjaannya.
 */
export async function masuk(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const lanjut = String(formData.get('lanjut') ?? '/');

  if (!username || !password) return fail('Nama pengguna dan kata sandi wajib diisi.');

  // Alamat asal dibaca dari header yang dipasang reverse proxy. Bila tidak ada
  // (mis. dijalankan langsung di komputer sendiri), seluruh percobaan dihitung
  // sebagai satu asal — lebih ketat, bukan lebih longgar.
  const alamat = (await headers()).get('x-forwarded-for')?.split(',')[0].trim() || 'lokal';
  const terkunci = sisaKunci(alamat);
  if (terkunci > 0) {
    return fail(`Terlalu banyak percobaan. Coba lagi ${terkunci} menit lagi.`);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const cocok = user && user.active && await cocokKataSandi(password, user.password);
  if (!user || !cocok) {
    catatGagal(alamat);
    return fail('Nama pengguna atau kata sandi salah.');
  }

  lupakan(alamat);
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  (await cookies()).set({
    name: NAMA_KUKI,
    value: await buatToken({ id: user.id, username: user.username, name: user.name }),
    httpOnly: true,
    sameSite: 'lax',
    // Di belakang HTTPS kuki ditandai secure; saat dikembangkan di localhost
    // tanda itu justru membuat kukinya tidak pernah tersimpan.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: UMUR_SESI_HARI * 86_400,
  });

  // Hanya alamat di dalam aplikasi ini, supaya "?lanjut=" tidak bisa dipakai
  // mengarahkan orang ke situs lain sesudah masuk.
  redirect(lanjut.startsWith('/') && !lanjut.startsWith('//') ? lanjut : '/');
}

export async function keluar(): Promise<void> {
  (await cookies()).delete(NAMA_KUKI);
  redirect('/masuk');
}

/** Mengganti kata sandi sendiri. */
export async function gantiKataSandi(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sesi = await sesiSekarang();
  if (!sesi) return fail('Sesi berakhir. Muat ulang halaman lalu masuk kembali.');

  const lama = String(formData.get('lama') ?? '');
  const baru = String(formData.get('baru') ?? '');
  const ulangi = String(formData.get('ulangi') ?? '');

  if (baru.length < 8) return fail('Kata sandi baru minimal 8 karakter.');
  if (baru !== ulangi) return fail('Ketikan ulang kata sandi barunya tidak sama.');

  const user = await prisma.user.findUnique({ where: { id: sesi.id } });
  if (!user || !(await cocokKataSandi(lama, user.password))) return fail('Kata sandi lama salah.');

  await prisma.user.update({ where: { id: user.id }, data: { password: await sidikKataSandi(baru) } });
  return ok('Kata sandi diperbarui.');
}
