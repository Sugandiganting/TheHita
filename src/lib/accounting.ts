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
