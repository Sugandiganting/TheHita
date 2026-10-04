/**
 * Lapisan query pelaporan: mengubah baris jurnal menjadi angka laporan.
 * Semua fungsi menerima filter unit opsional — inilah yang membuat satu sistem
 * bisa menampilkan angka per cabang maupun gabungan seluruh grup.
 */

import { prisma } from './db';
import { isProfitLoss, round, signedBalance } from './accounting';
import { barisMasukScope, cabangDalamScope, ringkasRab, scopeBersamaKah, type BarisRab, type RingkasanRab } from './rab';
import { addMonths, currentPeriod, periodEndExclusive, periodStart, periodsBetween, toPeriod, type Period } from './period';
import type { MonthlyActual } from './forecast';

export type UnitFilter = string[] | null; // null = seluruh unit

function unitWhere(unitIds: UnitFilter) {
  return unitIds && unitIds.length > 0 ? { unitId: { in: unitIds } } : {};
}

/**
 * Bukti penyesuaian saldo, mis. saat saldo kas pembukuan disamakan dengan saldo
 * kas yang sebenarnya. Nilainya besar tetapi BUKAN arus kas yang benar-benar
 * terjadi pada bulan itu — hanya koreksi posisi. Kalau ikut dihitung sebagai
 * uang masuk atau keluar, rata-rata bulanan di peramalan jadi melenceng jauh.
 */
const SOURCE_PENYESUAIAN = 'ADJUSTMENT';

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
      sharedGroup: true,
      entry: { select: { date: true, source: true } },
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
    // Penyesuaian saldo tetap mengubah saldo kas, tetapi tidak dihitung sebagai
    // uang masuk atau keluar bulan itu.
    if (isCash && line.entry.source !== SOURCE_PENYESUAIAN) {
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
  /** Seluruh beban, termasuk porsi beban bersama. */
  expense: number;
  /**
   * Porsi beban yang ditanggung bersama cabang lain — gaji staf yang bekerja di
   * dua lokasi, listrik satu meteran, dan sejenisnya. Cabang tidak bisa
   * mengendalikannya sendiri, jadi dipisahkan dari biayanya sendiri.
   */
  sharedExpense: number;
  /** Laba setelah seluruh beban, termasuk porsi bersama. */
  profit: number;
  /** Laba sebelum porsi beban bersama — ini yang benar-benar dikendalikan cabang. */
  profitBeforeShared: number;
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

  const stats = new Map<string, { revenue: number; expense: number; shared: number }>();
  for (const line of lines) {
    const cur = stats.get(line.unitId) ?? { revenue: 0, expense: 0, shared: 0 };
    const t = line.account.type;
    if (t === 'REVENUE') cur.revenue += line.credit - line.debit;
    if (t === 'COGS' || t === 'EXPENSE') {
      cur.expense += line.debit - line.credit;
      if (line.sharedGroup) cur.shared += line.debit - line.credit;
    }
    stats.set(line.unitId, cur);
  }

  const cashRows = await prisma.journalLine.groupBy({
    by: ['unitId'],
    where: { account: { isCash: true }, entry: { date: { lt: periodEndExclusive(to) } } },
    _sum: { debit: true, credit: true },
  });
  const cashMap = new Map(cashRows.map((r) => [r.unitId, (r._sum.debit ?? 0) - (r._sum.credit ?? 0)]));

  return units.map((u) => {
    const s = stats.get(u.id) ?? { revenue: 0, expense: 0, shared: 0 };
    const profit = s.revenue - s.expense;
    return {
      unitId: u.id,
      code: u.code,
      name: u.name,
      type: u.type,
      revenue: s.revenue,
      expense: s.expense,
      sharedExpense: s.shared,
      profit,
      profitBeforeShared: s.revenue - (s.expense - s.shared),
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

/* ------------------------------------------------------------------ */
/* Statistik hunian                                                    */
/* ------------------------------------------------------------------ */

export type OccupancyRow = {
  period: Period;
  unitCode: string;
  unitName: string;
  roomsSold: number;
  /** Nol berarti jumlah kamar belum diketahui, jadi hunian tidak dihitung. */
  roomsAvailable: number;
  guests: number;
  occupancy: number | null;
  /** Pendapatan kamar bulan itu, dari jurnal — bukan dari laporan Sales Summary. */
  roomRevenue: number;
  /** Average Room Rate: pendapatan kamar dibagi kamar terjual. */
  arr: number | null;
};

/**
 * Statistik hunian per unit per bulan.
 *
 * Kamar terjual dan jumlah tamu berasal dari Sales Summary GuestPro. ARR
 * sengaja dihitung ulang di sini dari pendapatan kamar yang sudah tercatat di
 * jurnal, bukan diambil dari ARR yang tercetak di Sales Summary: pada beberapa
 * bulan, ARR cetak GuestPro tidak sepadan dengan Total Room Net-nya sendiri.
 */
export async function getOccupancy(from: Period, to: Period, unitIds: UnitFilter): Promise<OccupancyRow[]> {
  const periods = periodsBetween(from, to);
  const awal = periods[0];
  const akhir = periods[periods.length - 1];

  const [stats, lines] = await Promise.all([
    prisma.monthlyStat.findMany({
      where: {
        ...(unitIds && unitIds.length > 0 ? { unitId: { in: unitIds } } : {}),
        period: { gte: awal, lte: akhir },
      },
      include: { unit: { select: { code: true, name: true } } },
    }),
    prisma.journalLine.findMany({
      where: {
        ...unitWhere(unitIds),
        entry: { date: { gte: periodStart(from), lt: periodEndExclusive(to) } },
        account: { code: { startsWith: '4110.' } },
      },
      select: {
        debit: true, credit: true,
        unit: { select: { code: true } },
        entry: { select: { date: true } },
      },
    }),
  ]);

  const revenue = new Map<string, number>();
  for (const l of lines) {
    const key = `${l.unit.code}|${toPeriod(l.entry.date)}`;
    revenue.set(key, (revenue.get(key) ?? 0) + l.credit - l.debit);
  }

  return stats
    .map((s) => {
      const roomRevenue = revenue.get(`${s.unit.code}|${s.period}`) ?? 0;
      return {
        period: s.period as Period,
        unitCode: s.unit.code,
        unitName: s.unit.name,
        roomsSold: s.roomsSold,
        roomsAvailable: s.roomsAvailable,
        guests: s.guests,
        occupancy: s.roomsAvailable > 0 ? s.roomsSold / s.roomsAvailable : null,
        roomRevenue,
        arr: s.roomsSold > 0 ? roomRevenue / s.roomsSold : null,
      };
    })
    .sort((a, b) => a.unitCode.localeCompare(b.unitCode) || a.period.localeCompare(b.period));
}

/* ------------------------------------------------------------------ */
/* Rencana Anggaran Biaya                                              */
/* ------------------------------------------------------------------ */


export type RabRingkas = {
  id: string;
  scope: string;
  period: Period;
  status: string;
  bersama: boolean;
  jumlahBaris: number;
  totalAnggaran: number;
  totalRealisasi: number;
};

/** Daftar RAB beserta total anggaran dan realisasinya. */
export async function getBudgetList(period?: Period): Promise<RabRingkas[]> {
  const budgets = await prisma.budget.findMany({
    where: period ? { period } : {},
    include: { lines: true },
    orderBy: [{ period: 'desc' }, { scope: 'asc' }],
  });
  if (budgets.length === 0) return [];

  const periods = [...new Set(budgets.map((b) => b.period))].sort();
  const realisasi = await realisasiPerScope(periods[0] as Period, periods[periods.length - 1] as Period);

  return budgets.map((b) => {
    const kunciRealisasi = realisasi.get(`${b.scope}|${b.period}`) ?? new Map<string, number>();
    return {
      id: b.id,
      scope: b.scope,
      period: b.period as Period,
      status: b.status,
      bersama: scopeBersamaKah(b.scope),
      jumlahBaris: b.lines.length,
      totalAnggaran: b.lines.reduce((s, l) => s + l.amount, 0),
      totalRealisasi: [...kunciRealisasi.values()].reduce((s, v) => s + v, 0),
    };
  });
}

/**
 * Realisasi beban per scope per periode, dikelompokkan per akun.
 *
 * Kuncinya `"<scope>|<period>"`, isinya peta accountId -> nominal. Biaya
 * bersama dihitung ke kelompok penanggungnya, bukan ke cabang — lihat
 * src/lib/rab.ts.
 */
async function realisasiPerScope(from: Period, to: Period) {
  const lines = await prisma.journalLine.findMany({
    where: {
      account: { type: { in: ['EXPENSE', 'COGS'] } },
      entry: { date: { gte: periodStart(from), lt: periodEndExclusive(to) } },
    },
    select: {
      accountId: true, debit: true, credit: true, sharedGroup: true,
      unit: { select: { code: true } },
      entry: { select: { date: true } },
    },
  });

  const hasil = new Map<string, Map<string, number>>();
  for (const l of lines) {
    const scope = l.sharedGroup ?? l.unit.code;
    const kunci = `${scope}|${toPeriod(l.entry.date)}`;
    const per = hasil.get(kunci) ?? new Map<string, number>();
    per.set(l.accountId, (per.get(l.accountId) ?? 0) + l.debit - l.credit);
    hasil.set(kunci, per);
  }
  return hasil;
}

export type RabRinci = {
  id: string;
  scope: string;
  period: Period;
  status: string;
  notes: string | null;
  bersama: boolean;
  /** Cabang yang tercakup scope ini. */
  cabang: string[];
  ringkasan: RingkasanRab;
};

/** Satu RAB lengkap dengan realisasinya, siap ditampilkan. */
export async function getBudgetDetail(id: string): Promise<RabRinci | null> {
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: { lines: { include: { account: true } } },
  });
  if (!budget) return null;

  const lines = await prisma.journalLine.findMany({
    where: {
      account: { type: { in: ['EXPENSE', 'COGS'] } },
      entry: {
        date: {
          gte: periodStart(budget.period as Period),
          lt: periodEndExclusive(budget.period as Period),
        },
      },
    },
    select: {
      accountId: true, debit: true, credit: true, sharedGroup: true,
      account: { select: { code: true, name: true } },
      unit: { select: { code: true } },
    },
  });

  const realisasi = new Map<string, { nilai: number; code: string; name: string }>();
  for (const l of lines) {
    if (!barisMasukScope(
      { accountId: l.accountId, unitCode: l.unit.code, sharedGroup: l.sharedGroup, debit: l.debit, credit: l.credit },
      budget.scope,
    )) continue;
    const cur = realisasi.get(l.accountId) ?? { nilai: 0, code: l.account.code, name: l.account.name };
    cur.nilai += l.debit - l.credit;
    realisasi.set(l.accountId, cur);
  }

  const baris: BarisRab[] = budget.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.account.code,
    accountName: l.account.name,
    anggaran: l.amount,
    realisasi: realisasi.get(l.accountId)?.nilai ?? 0,
  }));

  // Akun yang terpakai tetapi tidak pernah dianggarkan tetap ditampilkan.
  const dianggarkan = new Set(budget.lines.map((l) => l.accountId));
  for (const [accountId, r] of realisasi) {
    if (dianggarkan.has(accountId) || r.nilai === 0) continue;
    baris.push({ accountId, accountCode: r.code, accountName: r.name, anggaran: 0, realisasi: r.nilai });
  }
  baris.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return {
    id: budget.id,
    scope: budget.scope,
    period: budget.period as Period,
    status: budget.status,
    notes: budget.notes,
    bersama: scopeBersamaKah(budget.scope),
    cabang: cabangDalamScope(budget.scope),
    ringkasan: ringkasRab(baris, round),
  };
}
