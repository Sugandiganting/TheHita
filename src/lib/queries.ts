/**
 * Lapisan query pelaporan: mengubah baris jurnal menjadi angka laporan.
 * Semua fungsi menerima filter unit opsional — inilah yang membuat satu sistem
 * bisa menampilkan angka per cabang maupun gabungan seluruh grup.
 */

import { prisma } from './db';
import { isProfitLoss, signedBalance } from './accounting';
import { addMonths, currentPeriod, periodEndExclusive, periodStart, periodsBetween, toPeriod, type Period } from './period';
import type { MonthlyActual } from './forecast';

export type UnitFilter = string[] | null; // null = seluruh unit

function unitWhere(unitIds: UnitFilter) {
  return unitIds && unitIds.length > 0 ? { unitId: { in: unitIds } } : {};
}

/** Baris jurnal mentah dalam rentang periode, sudah termasuk data akun. */
async function linesInRange(from: Period, to: Period, unitIds: UnitFilter) {
  return prisma.journalLine.findMany({
    where: {
      ...unitWhere(unitIds),
      entry: { date: { gte: periodStart(from), lt: periodEndExclusive(to) } },
    },
    select: {
      debit: true,
      credit: true,
      unitId: true,
      entry: { select: { date: true } },
      account: { select: { id: true, code: true, name: true, type: true, subtype: true, isCash: true, cashflowCategory: true } },
    },
  });
}

/**
 * Ringkasan aktual bulanan — sumber data utama mesin peramalan.
 * Bulan tanpa transaksi tetap dikembalikan dengan nilai nol agar deret waktunya rapat.
 */
export async function getMonthlyActuals(
  from: Period,
  to: Period,
  unitIds: UnitFilter = null,
): Promise<MonthlyActual[]> {
  const lines = await linesInRange(from, to, unitIds);

  const buckets = new Map<Period, MonthlyActual>();
  for (const period of periodsBetween(from, to)) {
    buckets.set(period, { period, revenue: 0, expense: 0, cashIn: 0, cashOut: 0 });
  }

  for (const line of lines) {
    const period = toPeriod(line.entry.date);
    const bucket = buckets.get(period);
    if (!bucket) continue;

    const { type, isCash } = line.account;
    if (type === 'REVENUE') bucket.revenue += line.credit - line.debit;
    if (type === 'COGS' || type === 'EXPENSE') bucket.expense += line.debit - line.credit;
    if (isCash) {
      bucket.cashIn += line.debit;
      bucket.cashOut += line.credit;
    }
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export type AccountBalance = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  debit: number;
  credit: number;
  /** Saldo mengikuti saldo normal akun (pendapatan & beban tampil positif). */
  balance: number;
};

/** Saldo per akun dalam satu rentang periode. */
export async function getAccountBalances(
  from: Period,
  to: Period,
  unitIds: UnitFilter = null,
): Promise<AccountBalance[]> {
  const lines = await linesInRange(from, to, unitIds);
  const map = new Map<string, AccountBalance>();

  for (const line of lines) {
    const a = line.account;
    const existing =
      map.get(a.id) ??
      { accountId: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype, debit: 0, credit: 0, balance: 0 };
    existing.debit += line.debit;
    existing.credit += line.credit;
    map.set(a.id, existing);
  }

  return [...map.values()]
    .map((a) => ({ ...a, balance: signedBalance(a.type, a.debit, a.credit) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export type ProfitLoss = {
  from: Period;
  to: Period;
  revenue: AccountBalance[];
  cogs: AccountBalance[];
  expense: AccountBalance[];
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalExpense: number;
  netProfit: number;
  /** Margin laba bersih dalam persen. */
  netMarginPct: number;
};

export async function getProfitLoss(from: Period, to: Period, unitIds: UnitFilter = null): Promise<ProfitLoss> {
  const balances = (await getAccountBalances(from, to, unitIds)).filter((b) => isProfitLoss(b.type));

  const revenue = balances.filter((b) => b.type === 'REVENUE');
  const cogs = balances.filter((b) => b.type === 'COGS');
  const expense = balances.filter((b) => b.type === 'EXPENSE');

  const sum = (rows: AccountBalance[]) => rows.reduce((s, r) => s + r.balance, 0);
  const totalRevenue = sum(revenue);
  const totalCogs = sum(cogs);
  const totalExpense = sum(expense);
  const netProfit = totalRevenue - totalCogs - totalExpense;

  return {
    from,
    to,
    revenue,
    cogs,
    expense,
    totalRevenue,
    totalCogs,
    grossProfit: totalRevenue - totalCogs,
    totalExpense,
    netProfit,
    netMarginPct: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
  };
}

/**
 * Saldo kas & bank per tanggal tertentu (kumulatif sejak awal),
 * ditambah saldo kas awal yang tercatat di master unit.
 */
export async function getCashBalance(asOf: Period, unitIds: UnitFilter = null): Promise<number> {
  const [agg, units] = await Promise.all([
    prisma.journalLine.aggregate({
      where: {
        ...unitWhere(unitIds),
        account: { isCash: true },
        entry: { date: { lt: periodEndExclusive(asOf) } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.businessUnit.findMany({
      where: unitIds && unitIds.length > 0 ? { id: { in: unitIds } } : {},
      select: { openingCash: true },
    }),
  ]);

  const movement = (agg._sum.debit ?? 0) - (agg._sum.credit ?? 0);
  const opening = units.reduce((s, u) => s + u.openingCash, 0);
  return opening + movement;
}

/** Rincian saldo tiap akun kas/bank. */
export async function getCashAccountBreakdown(asOf: Period, unitIds: UnitFilter = null) {
  const lines = await prisma.journalLine.findMany({
    where: {
      ...unitWhere(unitIds),
      account: { isCash: true },
      entry: { date: { lt: periodEndExclusive(asOf) } },
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { id: true, code: true, name: true } },
    },
  });

  const map = new Map<string, { code: string; name: string; balance: number }>();
  for (const l of lines) {
    const cur = map.get(l.account.id) ?? { code: l.account.code, name: l.account.name, balance: 0 };
    cur.balance += l.debit - l.credit;
    map.set(l.account.id, cur);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export type UnitPerformance = {
  unitId: string;
  code: string;
  name: string;
  type: string;
  revenue: number;
  expense: number;
  profit: number;
  marginPct: number;
  cash: number;
};

/** Perbandingan kinerja antar cabang untuk satu rentang periode. */
export async function getUnitPerformance(
  from: Period,
  to: Period,
): Promise<UnitPerformance[]> {
  const [units, lines] = await Promise.all([
    prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    linesInRange(from, to, null),
  ]);

  const stats = new Map<string, { revenue: number; expense: number }>();
  for (const line of lines) {
    const cur = stats.get(line.unitId) ?? { revenue: 0, expense: 0 };
    const t = line.account.type;
    if (t === 'REVENUE') cur.revenue += line.credit - line.debit;
    if (t === 'COGS' || t === 'EXPENSE') cur.expense += line.debit - line.credit;
    stats.set(line.unitId, cur);
  }

  const cashRows = await prisma.journalLine.groupBy({
    by: ['unitId'],
    where: { account: { isCash: true }, entry: { date: { lt: periodEndExclusive(to) } } },
    _sum: { debit: true, credit: true },
  });
  const cashMap = new Map(cashRows.map((r) => [r.unitId, (r._sum.debit ?? 0) - (r._sum.credit ?? 0)]));

  return units.map((u) => {
    const s = stats.get(u.id) ?? { revenue: 0, expense: 0 };
    const profit = s.revenue - s.expense;
    return {
      unitId: u.id,
      code: u.code,
      name: u.name,
      type: u.type,
      revenue: s.revenue,
      expense: s.expense,
      profit,
      marginPct: s.revenue > 0 ? (profit / s.revenue) * 100 : 0,
      cash: u.openingCash + (cashMap.get(u.id) ?? 0),
    };
  });
}

/** Periode transaksi paling awal yang tercatat; dipakai menentukan jendela histori. */
export async function getEarliestPeriod(unitIds: UnitFilter = null): Promise<Period | null> {
  const first = await prisma.journalEntry.findFirst({
    where: unitIds && unitIds.length > 0 ? { unitId: { in: unitIds } } : {},
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  return first ? toPeriod(first.date) : null;
}

/**
 * Jendela histori yang tersedia untuk peramalan: dari transaksi pertama
 * sampai bulan lalu (bulan berjalan belum lengkap sehingga dikecualikan).
 */
export async function getHistoryWindow(unitIds: UnitFilter = null): Promise<{ from: Period; to: Period } | null> {
  const earliest = await getEarliestPeriod(unitIds);
  if (!earliest) return null;
  const to = addMonths(currentPeriod(), -1);
  if (earliest > to) return { from: earliest, to: earliest };
  return { from: earliest, to };
}

export type CashAccountBalance = {
  accountId: string;
  code: string;
  name: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  balance: number;
};

/**
 * Saldo tiap pasangan rekening + cabang.
 *
 * Inilah yang membuat "Bank BCA milik IGYT" dan "Bank BCA milik The Hita Legian"
 * terbaca sebagai dua kantong uang berbeda, meski memakai satu nomor akun.
 * Rekening yang belum pernah dipakai tetap ditampilkan dengan saldo nol supaya
 * bisa dipilih sebagai tujuan transfer.
 */
export async function getCashAccountsByUnit(unitIds: UnitFilter = null): Promise<CashAccountBalance[]> {
  const [accounts, units, lines] = await Promise.all([
    prisma.account.findMany({
      where: { isCash: true, active: true, isHeader: false },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.businessUnit.findMany({
      where: { active: true, ...(unitIds && unitIds.length > 0 ? { id: { in: unitIds } } : {}) },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, openingCash: true },
    }),
    prisma.journalLine.groupBy({
      by: ['accountId', 'unitId'],
      where: { account: { isCash: true } },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const moved = new Map(
    lines.map((l) => [`${l.accountId}|${l.unitId}`, (l._sum.debit ?? 0) - (l._sum.credit ?? 0)]),
  );

  const out: CashAccountBalance[] = [];
  for (const unit of units) {
    for (const account of accounts) {
      out.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        unitId: unit.id,
        unitCode: unit.code,
        unitName: unit.name,
        balance: moved.get(`${account.id}|${unit.id}`) ?? 0,
      });
    }
  }
  return out;
}

/**
 * Posisi antar unit: siapa menalangi siapa, dan berapa.
 * Pada laporan konsolidasi seluruhnya harus saling meniadakan; bila tidak,
 * ada jurnal lintas unit yang belum dijembatani.
 */
export async function getInterUnitPositions(): Promise<{
  rows: { unitId: string; unitCode: string; unitName: string; net: number }[];
  total: number;
}> {
  const lines = await prisma.journalLine.findMany({
    where: { account: { subtype: 'INTERUNIT' } },
    select: { debit: true, credit: true, unit: { select: { id: true, code: true, name: true } } },
  });

  const map = new Map<string, { unitId: string; unitCode: string; unitName: string; net: number }>();
  for (const l of lines) {
    const cur = map.get(l.unit.id) ?? { unitId: l.unit.id, unitCode: l.unit.code, unitName: l.unit.name, net: 0 };
    // Positif = unit ini menalangi (punya piutang); negatif = unit ini berhutang.
    cur.net += l.debit - l.credit;
    map.set(l.unit.id, cur);
  }

  const rows = [...map.values()].filter((r) => Math.abs(r.net) >= 1).sort((a, b) => b.net - a.net);
  return { rows, total: rows.reduce((s, r) => s + r.net, 0) };
}

/** Transaksi kas terakhir untuk ditampilkan di bawah formulir. */
export async function getRecentCashEntries(sources: string[], take = 12) {
  return prisma.journalEntry.findMany({
    where: { source: { in: sources } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take,
    include: {
      unit: { select: { code: true } },
      lines: {
        include: {
          account: { select: { code: true, name: true, isCash: true, subtype: true } },
          unit: { select: { code: true } },
        },
      },
    },
  });
}
