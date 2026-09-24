/**
 * Aturan akuntansi dasar: jenis akun, saldo normal, dan pembentukan jurnal
 * double-entry dari input sederhana (pemasukan / pengeluaran).
 */

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  ASSET: 'Aset',
  LIABILITY: 'Kewajiban',
  EQUITY: 'Modal',
  REVENUE: 'Pendapatan',
  COGS: 'Harga Pokok (HPP)',
  EXPENSE: 'Beban Operasional',
};

export const UNIT_TYPE_LABEL: Record<string, string> = {
  HOTEL: 'Hotel',
  LAUNDRY: 'Laundry',
  CAFE: 'Cafe & Resto',
  OTHER: 'Lainnya',
};

export const CASHFLOW_LABEL: Record<string, string> = {
  OPERATING: 'Operasional',
  INVESTING: 'Investasi',
  FINANCING: 'Pendanaan',
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Direncanakan',
  ONGOING: 'Berjalan',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

/** Akun bersaldo normal debit: aset, HPP, beban. */
export function isDebitNormal(type: string): boolean {
  return type === 'ASSET' || type === 'COGS' || type === 'EXPENSE';
}

/**
 * Saldo akun dengan tanda mengikuti saldo normalnya, sehingga
 * pendapatan dan beban sama-sama tampil sebagai angka positif di laporan.
 */
export function signedBalance(type: string, debit: number, credit: number): number {
  return isDebitNormal(type) ? debit - credit : credit - debit;
}

/** Akun yang masuk perhitungan laba rugi. */
export function isProfitLoss(type: string): boolean {
  return type === 'REVENUE' || type === 'COGS' || type === 'EXPENSE';
}

export type DraftLine = {
  accountId: string;
  unitId: string;
  debit: number;
  credit: number;
  memo?: string | null;
};

export type BalanceCheck = {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  balanced: boolean;
};

/** Toleransi pembulatan 1 rupiah — nilai uang disimpan dalam rupiah penuh. */
const TOLERANCE = 0.5;

export function checkBalance(lines: DraftLine[]): BalanceCheck {
  const totalDebit = round(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const totalCredit = round(lines.reduce((s, l) => s + (l.credit || 0), 0));
  const difference = round(totalDebit - totalCredit);
  return { totalDebit, totalCredit, difference, balanced: Math.abs(difference) < TOLERANCE };
}

export function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Membentuk jurnal dari entri cepat.
 *
 * Pemasukan  : debit kas/bank, kredit akun pendapatan.
 * Pengeluaran: debit akun beban, kredit kas/bank.
 *
 * Bila pembayaran belum tunai (`settlement` = 'CREDIT'), sisi kas diganti
 * akun piutang/hutang yang dipilih.
 */
export function buildQuickEntryLines(input: {
  kind: 'INCOME' | 'EXPENSE';
  amount: number;
  unitId: string;
  /** Akun pendapatan (pemasukan) atau akun beban/HPP (pengeluaran). */
  categoryAccountId: string;
  /** Akun kas/bank, atau akun piutang/hutang bila transaksi kredit. */
  counterAccountId: string;
  memo?: string | null;
}): DraftLine[] {
  const amount = round(Math.abs(input.amount));
  const { unitId, categoryAccountId, counterAccountId, memo } = input;

  if (input.kind === 'INCOME') {
    return [
      { accountId: counterAccountId, unitId, debit: amount, credit: 0, memo: memo ?? null },
      { accountId: categoryAccountId, unitId, debit: 0, credit: amount, memo: memo ?? null },
    ];
  }

  return [
    { accountId: categoryAccountId, unitId, debit: amount, credit: 0, memo: memo ?? null },
    { accountId: counterAccountId, unitId, debit: 0, credit: amount, memo: memo ?? null },
  ];
}

/* ------------------------------------------------------------------ */
/* Kas & Bank                                                          */
/* ------------------------------------------------------------------ */

/** Kode akun penghubung antar unit. Dipakai otomatis, tidak perlu dipilih pengguna. */
export const INTERUNIT_RECEIVABLE = '1-2500';
export const INTERUNIT_PAYABLE = '2-3500';

export type InterUnitAccounts = {
  /** Piutang Antar Unit — dipakai oleh unit yang uangnya keluar/menalangi. */
  receivableId: string;
  /** Hutang Antar Unit — dipakai oleh unit yang menerima manfaat. */
  payableId: string;
};

/**
 * Menjembatani transaksi lintas unit.
 *
 * Ketika kas milik satu cabang dipakai untuk urusan cabang lain, sisi kas dan
 * sisi lawannya berada di dua unit berbeda. Bila hanya dicatat dua baris,
 * neraca masing-masing cabang tidak lagi seimbang berdiri sendiri — hanya
 * gabungannya yang balance.
 *
 * Dua baris penghubung ini menutup lubang tersebut: unit pemberi mencatat
 * piutang, unit penerima mencatat hutang. Saldo kedua akun itu selalu saling
 * meniadakan pada laporan konsolidasi.
 */
function interUnitBridge(
  giverUnitId: string,
  receiverUnitId: string,
  amount: number,
  accounts: InterUnitAccounts,
  memo?: string | null,
): DraftLine[] {
  return [
    { accountId: accounts.receivableId, unitId: giverUnitId, debit: amount, credit: 0, memo: memo ?? null },
    { accountId: accounts.payableId, unitId: receiverUnitId, debit: 0, credit: amount, memo: memo ?? null },
  ];
}

/**
 * Transfer antar rekening milik grup — mis. Bank IGYT ke Bank The Hita Legian,
 * atau Bank ke Kas Kecil Purchasing.
 *
 * Transfer dalam satu unit cukup dua baris. Transfer antar unit menambah
 * sepasang baris antar unit sehingga neraca tiap cabang tetap seimbang.
 */
export function buildTransferLines(input: {
  amount: number;
  fromAccountId: string;
  fromUnitId: string;
  toAccountId: string;
  toUnitId: string;
  interUnit: InterUnitAccounts;
  memo?: string | null;
}): DraftLine[] {
  const amount = round(Math.abs(input.amount));
  const memo = input.memo ?? null;

  const out: DraftLine[] = [
    { accountId: input.toAccountId, unitId: input.toUnitId, debit: amount, credit: 0, memo },
    { accountId: input.fromAccountId, unitId: input.fromUnitId, debit: 0, credit: amount, memo },
  ];

  if (input.fromUnitId !== input.toUnitId) {
    // Unit pengirim menalangi unit penerima.
    out.push(...interUnitBridge(input.fromUnitId, input.toUnitId, amount, input.interUnit, memo));
  }

  return out;
}

export type MoneyLine = {
  accountId: string;
  /** Unit pemilik pos ini. Boleh berbeda dari unit pemilik kas. */
  unitId: string;
  amount: number;
  memo?: string | null;
};

/**
 * Uang masuk (Receive Money): satu penerimaan boleh dipecah ke beberapa akun
 * pendapatan sekaligus, dan tiap baris boleh menunjuk cabang yang berbeda.
 *
 * Bila sebuah baris milik cabang lain, kas cabang pemegang rekening menampung
 * uang milik cabang tersebut — jadi pemegang rekening mencatat hutang, dan
 * cabang pemilik pendapatan mencatat piutang.
 */
export function buildReceiveLines(input: {
  cashAccountId: string;
  cashUnitId: string;
  lines: MoneyLine[];
  interUnit: InterUnitAccounts;
}): DraftLine[] {
  const rows = input.lines.filter((l) => l.accountId && round(Math.abs(l.amount)) > 0);
  const total = round(rows.reduce((s, l) => s + round(Math.abs(l.amount)), 0));

  const out: DraftLine[] = [
    { accountId: input.cashAccountId, unitId: input.cashUnitId, debit: total, credit: 0, memo: null },
  ];

  for (const line of rows) {
    const amount = round(Math.abs(line.amount));
    const memo = line.memo ?? null;
    out.push({ accountId: line.accountId, unitId: line.unitId, debit: 0, credit: amount, memo });

    if (line.unitId !== input.cashUnitId) {
      // Pendapatan milik unit lain, uangnya dipegang unit pemilik rekening.
      out.push(...interUnitBridge(line.unitId, input.cashUnitId, amount, input.interUnit, memo));
    }
  }

  return out;
}

/**
 * Uang keluar (Pay Money): kebalikan dari penerimaan. Satu pembayaran boleh
 * dipecah ke beberapa akun beban, dan dibagi ke beberapa cabang — mis. satu
 * tagihan listrik yang dipakai bersama hotel dan laundry.
 */
export function buildPayLines(input: {
  cashAccountId: string;
  cashUnitId: string;
  lines: MoneyLine[];
  interUnit: InterUnitAccounts;
}): DraftLine[] {
  const rows = input.lines.filter((l) => l.accountId && round(Math.abs(l.amount)) > 0);
  const total = round(rows.reduce((s, l) => s + round(Math.abs(l.amount)), 0));

  const out: DraftLine[] = [];

  for (const line of rows) {
    const amount = round(Math.abs(line.amount));
    const memo = line.memo ?? null;
    out.push({ accountId: line.accountId, unitId: line.unitId, debit: amount, credit: 0, memo });

    if (line.unitId !== input.cashUnitId) {
      // Kas unit pemilik rekening menalangi beban unit lain.
      out.push(...interUnitBridge(input.cashUnitId, line.unitId, amount, input.interUnit, memo));
    }
  }

  out.push({ accountId: input.cashAccountId, unitId: input.cashUnitId, debit: 0, credit: total, memo: null });
  return out;
}

/**
 * Memastikan tiap unit yang tersentuh sebuah jurnal tetap seimbang sendiri.
 * Dipakai sebagai pengaman sebelum menyimpan transaksi kas.
 */
export function checkPerUnitBalance(lines: DraftLine[]): { unitId: string; difference: number }[] {
  const byUnit = new Map<string, number>();
  for (const l of lines) {
    byUnit.set(l.unitId, (byUnit.get(l.unitId) ?? 0) + (l.debit || 0) - (l.credit || 0));
  }
  return [...byUnit.entries()]
    .map(([unitId, difference]) => ({ unitId, difference: round(difference) }))
    .filter((u) => Math.abs(u.difference) >= TOLERANCE);
}
