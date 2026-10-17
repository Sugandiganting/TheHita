/**
 * Lapisan query pelaporan: mengubah baris jurnal menjadi angka laporan.
 * Semua fungsi menerima filter unit opsional — inilah yang membuat satu sistem
 * bisa menampilkan angka per cabang maupun gabungan seluruh grup.
 */

import { prisma } from './db';
import { isProfitLoss, round, signedBalance } from './accounting';
import { barisMasukScope, cabangDalamScope, ringkasRab, scopeBersamaKah, type BarisRab, type RingkasanRab } from './rab';
import { addMonths, currentPeriod, monthOf, periodEndExclusive, periodStart, periodsBetween, toPeriod, type Period } from './period';
import type { MonthlyActual } from './forecast';
import {
  HORIZON_BULAN, SKENARIO, hitungRencana, hitungRunway, lipatBelanja, usulkanProyeksi,
  type ModeBelanja, type Rencana, type Runway, type Skenario,
} from './rencana-kas';
import {
  dasarAcuan, polaBervariasi, proyeksiBulan, type Musim, type PolaMusim,
} from './musim';
import {
  cicilanPada, cicilanSetelah, jadwalCicilan, konteksPembelian, type Cicilan,
} from './rencana-belanja';
import {
  berikutnya, kejadian, kewajibanPada, kewajibanSetelah,
  type Kejadian, type Kewajiban, type Pengulangan,
} from './kewajiban';
import { hitungTren, type Tren } from './tren-masuk';
import type { PurchaseCadence, PurchaseContext } from './forecast';

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

export type RencanaKasDetail = {
  id: string;
  period: Period;
  notes: string | null;
  /** Proyeksi yang tersimpan; null berarti memakai usulan. */
  tersimpan: Record<Skenario, number | null>;
  usulan: Record<Skenario, number> | null;
  /** Yang benar-benar dipakai menghitung: tersimpan bila ada, selain itu usulan. */
  dipakai: Record<Skenario, number>;
  /** Yang dipakai untuk bulan tepat sesudah bulan berjalan. */
  dipakaiBerikutnya: Record<Skenario, number>;
  musim: {
    /** Polanya sudah disiapkan dan ada bulan yang berbeda musim. */
    aktif: boolean;
    bulanIni: Musim | null;
    bulanDepan: Musim | null;
  };
  riwayatMasuk: { period: Period; cashIn: number }[];
  komitmen: { id: string; label: string; amount: number; dueDay: number | null; paid: boolean; recurring: boolean }[];
  kategori: {
    id: string; label: string; weight: number;
    /** Terpakai setelah tanggal posisi kas — yang mengurangi plafon. */
    terpakai: number;
    /** Terpakai sejak awal bulan, termasuk yang sudah tercermin di saldo. */
    terpakaiBulanIni: number;
  }[];
  belanja: {
    id: string; categoryId: string; categoryLabel: string; date: Date;
    amount: number; mode: ModeBelanja; notes: string | null;
    /** Sudah tercermin pada saldo kas yang dilaporkan, jadi tidak mengurangi plafon. */
    sebelumPosisi: boolean;
  }[];
  asumsi: {
    monthlyOutflow: number | null;
    salaryNeed: number | null;
    usulanOutflow: number | null;
    usulanGaji: number | null;
  };
  runway: Record<Skenario, Runway> | null;
  /**
   * Arah uang masuk bulan ini terhadap ketiga proyeksinya. null bila belum ada
   * satu pun posisi kas yang dilaporkan.
   */
  tren: Tren | null;
  rencanaBelanja: RencanaBelanja[];
  kewajiban: {
    /** Jatuh tempo di bulan ini, termasuk yang tanggalnya sudah lewat. */
    bulanIni: KejadianKewajiban[];
    /** Jatuh tempo dua belas bulan ke depan, di luar bulan ini. */
    mendatang: KejadianKewajiban[];
    /** Yang masih akan keluar bulan ini: jatuh tempo sesudah posisi kas. */
    belumKeluar: number;
  };
  /**
   * Konteks penilaian pembelian baru, satu untuk tiap skenario. Yang dipakai
   * dipilih di layar; pesimis adalah pilihan bawaannya.
   */
  konteksBeli: Record<Skenario, PurchaseContext> | null;
  checkpoint: { id: string; date: Date; cashOnHand: number; incomeToDate: number; notes: string | null }[];
  terakhir: { date: Date; cashOnHand: number; incomeToDate: number } | null;
  /** Angka menurut jurnal sistem, sebagai pembanding atas input manual. */
  menurutJurnal: { saldoKas: number; masukBulanIni: number };
  rencana: Rencana | null;
};

export type MusimDetail = Musim & { id: string; sort: number; bulan: number[] };

/** Daftar musim beserta bulan-bulan yang memakainya. */
export async function getSeasons(): Promise<MusimDetail[]> {
  const rows = await prisma.season.findMany({
    orderBy: [{ sort: 'asc' }, { delta: 'asc' }],
    include: { months: { select: { month: true }, orderBy: { month: 'asc' } } },
  });
  return rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, delta: r.delta, sort: r.sort,
    bulan: r.months.map((m) => m.month),
  }));
}

/** Musim yang berlaku untuk tiap bulan kalender. */
export async function polaMusim(): Promise<PolaMusim> {
  const rows = await prisma.seasonMonth.findMany({ include: { season: true } });
  return new Map(rows.map((r) => [
    r.month,
    { code: r.season.code, name: r.season.name, delta: r.season.delta },
  ]));
}

export type RencanaBelanja = {
  id: string;
  label: string;
  amount: number;
  cadence: PurchaseCadence;
  instalments: number;
  startDate: Date;
  status: string;
  notes: string | null;
  jadwal: Cicilan[];
  /** Cicilan yang jatuh tempo bulan ini, termasuk yang sudah lewat. */
  cicilanBulanIni: number;
};

/* ------------------------------------------------------------------ */
/* Kewajiban terjadwal & kendaraan                                     */
/* ------------------------------------------------------------------ */

export type KejadianKewajiban = {
  /** Id kewajibannya, bukan id kejadian — kejadian tidak disimpan. */
  id: string;
  label: string;
  jatuhTempo: Date;
  amount: number;
  period: Period;
  /** Sudah tercermin pada saldo kas yang dilaporkan. */
  sebelumPosisi: boolean;
};

export type KewajibanDetail = Kewajiban & {
  id: string;
  notes: string | null;
  vehicleId: string | null;
  kendaraan: { plate: string; name: string } | null;
  /** Jatuh tempo berikutnya yang belum dilunasi, dihitung dari hari ini. */
  berikutnya: Kejadian | null;
  riwayat: { id: string; dueDate: Date; paidDate: Date; amount: number }[];
};

export type KendaraanDetail = {
  id: string;
  plate: string;
  name: string;
  kind: string;
  unitId: string | null;
  unitName: string | null;
  active: boolean;
  notes: string | null;
  kewajiban: KewajibanDetail[];
};

/** Bentuk baris database menjadi bentuk yang dimengerti mesin kewajiban. */
function bentukKewajiban(r: {
  id: string; label: string; amount: number; dueDate: Date; repeat: string;
  repeatEvery: number; active: boolean; paidUntil: Date | null; notes: string | null;
  vehicleId: string | null;
  vehicle?: { plate: string; name: string } | null;
  payments?: { id: string; dueDate: Date; paidDate: Date; amount: number }[];
}): KewajibanDetail {
  const k: Kewajiban = {
    label: r.label,
    amount: r.amount,
    dueDate: r.dueDate,
    repeat: r.repeat as Pengulangan,
    repeatEvery: r.repeatEvery,
    active: r.active,
    paidUntil: r.paidUntil,
  };
  return {
    ...k,
    id: r.id,
    notes: r.notes,
    vehicleId: r.vehicleId,
    kendaraan: r.vehicle ? { plate: r.vehicle.plate, name: r.vehicle.name } : null,
    berikutnya: berikutnya(k, new Date()),
    riwayat: r.payments ?? [],
  };
}

/** Seluruh kewajiban terjadwal, yang menempel pada kendaraan maupun yang berdiri sendiri. */
export async function getKewajiban(): Promise<KewajibanDetail[]> {
  const rows = await prisma.scheduledObligation.findMany({
    orderBy: [{ active: 'desc' }, { dueDate: 'asc' }],
    include: {
      vehicle: { select: { plate: true, name: true } },
      payments: {
        orderBy: { dueDate: 'desc' },
        select: { id: true, dueDate: true, paidDate: true, amount: true },
      },
    },
  });
  return rows.map(bentukKewajiban);
}

export async function getKendaraan(): Promise<KendaraanDetail[]> {
  const rows = await prisma.vehicle.findMany({
    orderBy: [{ active: 'desc' }, { plate: 'asc' }],
    include: {
      unit: { select: { name: true } },
      obligations: {
        orderBy: [{ active: 'desc' }, { dueDate: 'asc' }],
        include: {
          payments: {
            orderBy: { dueDate: 'desc' },
            select: { id: true, dueDate: true, paidDate: true, amount: true },
          },
        },
      },
    },
  });
  return rows.map((v) => ({
    id: v.id,
    plate: v.plate,
    name: v.name,
    kind: v.kind,
    unitId: v.unitId,
    unitName: v.unit?.name ?? null,
    active: v.active,
    notes: v.notes,
    kewajiban: v.obligations.map((o) => bentukKewajiban({ ...o, vehicle: null })),
  }));
}

/** Unit usaha untuk pemilih pada formulir kendaraan. */
export async function getUnitPilihan(): Promise<{ id: string; code: string; name: string }[]> {
  return prisma.businessUnit.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true },
  });
}

export async function getRencanaKasPeriods(): Promise<Period[]> {
  const rows = await prisma.cashPlan.findMany({ select: { period: true }, orderBy: { period: 'desc' } });
  return rows.map((r) => r.period);
}

/** Uang masuk bulanan, dipakai sebagai dasar usulan tiga skenario. */
async function riwayatUangMasuk(sebelum: Period, bulan = 6): Promise<{ period: Period; cashIn: number }[]> {
  const mulai = addMonths(sebelum, -bulan);
  const selesai = addMonths(sebelum, -1);
  const actuals = await getMonthlyActuals(mulai, selesai);
  return actuals.map((a) => ({ period: a.period, cashIn: round(a.cashIn) }));
}

/** Uang keluar bulanan, dipakai mengusulkan pengeluaran rutin sebulan. */
async function riwayatUangKeluar(sebelum: Period, bulan = 3): Promise<number[]> {
  const actuals = await getMonthlyActuals(addMonths(sebelum, -bulan), addMonths(sebelum, -1));
  return actuals.map((a) => round(a.cashOut)).filter((v) => v > 0);
}

export async function getRencanaKas(period: Period): Promise<RencanaKasDetail | null> {
  const plan = await prisma.cashPlan.findUnique({
    where: { period },
    include: {
      commitments: { orderBy: [{ sort: 'asc' }, { label: 'asc' }] },
      categories: { orderBy: [{ sort: 'asc' }, { label: 'asc' }] },
      checkpoints: { orderBy: { date: 'desc' } },
      spends: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], include: { category: true } },
    },
  });
  if (!plan) return null;

  const riwayat = await riwayatUangMasuk(period);
  const usulan = usulkanProyeksi(riwayat.map((r) => r.cashIn));

  const tersimpan: Record<Skenario, number | null> = {
    PESIMIS: plan.incomePessimistic,
    NORMAL: plan.incomeNormal,
    OPTIMIS: plan.incomeOptimistic,
  };
  // Usulan hanya mengisi yang dikosongkan; angka yang sudah diketik menang.
  const dipakai = Object.fromEntries(
    SKENARIO.map((s) => [s, tersimpan[s] ?? usulan?.[s] ?? 0]),
  ) as Record<Skenario, number>;

  // Bulan-bulan sesudah bulan berjalan mengikuti pola musim; bila polanya belum
  // disiapkan, angkanya sama dengan bulan berjalan.
  const pola = await polaMusim();
  const musimAktif = polaBervariasi(pola);
  const musimBulanIni = pola.get(monthOf(period)) ?? null;
  const dasar = Object.fromEntries(
    SKENARIO.map((s) => [s, musimAktif ? dasarAcuan(dipakai[s], musimBulanIni ?? undefined) : null]),
  ) as Record<Skenario, number | null>;

  /**
   * Proyeksi sebuah bulan menurut pola musim.
   *
   * Bulan yang belum diberi musim diramalkan sebagai musim acuan — bukan
   * disamakan dengan bulan berjalan. Keduanya kebetulan sama persis selama
   * bulan berjalan memang bulan acuan, tetapi berbeda jauh begitu bulan
   * berjalan ternyata high atau low: menyamakannya dengan bulan berjalan akan
   * menularkan musim bulan ini ke seluruh bulan yang belum diisi.
   *
   * Pola yang belum terpakai sama sekali (dasarnya null) tetap memakai angka
   * bulan berjalan, karena memang tidak ada pola yang bisa diikuti.
   */
  const proyeksiUntuk = (s: Skenario) => (p: Period) => {
    const acuan = dasar[s];
    return acuan === null ? dipakai[s] : proyeksiBulan(p, acuan, pola);
  };

  const bulanDepan = addMonths(period, 1);
  const dipakaiBerikutnya = Object.fromEntries(
    SKENARIO.map((s) => [s, proyeksiUntuk(s)(bulanDepan)]),
  ) as Record<Skenario, number>;

  const terakhir = plan.checkpoints[0] ?? null;
  const [saldoKas, bulanIni] = await Promise.all([
    getCashBalance(period),
    getMonthlyActuals(period, period),
  ]);

  // Belanja yang sudah tercermin pada saldo yang dilaporkan tidak boleh
  // mengurangi plafon lagi — kalau ikut dikurangi, uang yang sama dihitung dua
  // kali dan anggarannya mengecil tanpa sebab.
  const batas = terakhir?.date ?? null;
  const belanja = plan.spends.map((e, i) => ({
    id: e.id,
    categoryId: e.categoryId,
    categoryLabel: e.category.label,
    date: e.date,
    amount: e.amount,
    mode: e.mode as ModeBelanja,
    notes: e.notes,
    sebelumPosisi: batas !== null && e.date <= batas,
    urut: i,
  }));

  const terpakaiKategori = (id: string, hanyaSetelahPosisi: boolean) =>
    lipatBelanja(
      belanja
        .filter((e) => e.categoryId === id && (!hanyaSetelahPosisi || !e.sebelumPosisi))
        .map((e) => ({ urut: e.urut, date: e.date, amount: e.amount, mode: e.mode })),
    );

  const kategori = plan.categories.map((k) => ({
    id: k.id,
    label: k.label,
    weight: k.weight,
    terpakai: terpakaiKategori(k.id, true),
    terpakaiBulanIni: terpakaiKategori(k.id, false),
  }));
  // Hanya rencana yang sudah disetujui yang memotong anggaran; yang masih draf
  // adalah hitung-hitungan, belum keputusan.
  const belanjaRows = await prisma.purchase.findMany({ orderBy: { createdAt: 'desc' } });
  const rencanaBelanja: RencanaBelanja[] = belanjaRows.map((b) => {
    const jadwal = jadwalCicilan(b.amount, b.instalments, b.cadence as PurchaseCadence, b.startDate);
    return {
      id: b.id, label: b.label, amount: b.amount, cadence: b.cadence as PurchaseCadence,
      instalments: b.instalments, startDate: b.startDate, status: b.status, notes: b.notes,
      jadwal, cicilanBulanIni: cicilanPada(jadwal, period),
    };
  });
  const disetujui = rencanaBelanja.filter((b) => b.status === 'APPROVED');

  // Cicilan yang jatuh tempo sebelum posisi kas dilaporkan sudah tercermin pada
  // saldonya, sama seperti belanja biasa.
  const cicilanBulanIni = terakhir
    ? disetujui.reduce((t, b) => t + cicilanSetelah(b.jadwal, period, terakhir.date), 0)
    : 0;
  // Bulan berjalan memakai angka yang sudah dibersihkan dari cicilan sebelum
  // posisi kas; bulan-bulan berikutnya dihitung penuh.
  const cicilanBulan = (p: Period) =>
    p === period ? cicilanBulanIni : disetujui.reduce((t, b) => t + cicilanPada(b.jadwal, p), 0);

  // Kewajiban terjadwal datang dari master data, bukan dari rencana bulan ini,
  // sehingga satu pajak yang jatuh tempo tahun depan sudah terlihat sekarang.
  const kewajibanRows = await prisma.scheduledObligation.findMany({
    where: { active: true },
    include: { vehicle: { select: { plate: true, name: true } } },
  });
  const daftarKewajiban = kewajibanRows.map((r) => bentukKewajiban(r));

  const kejadianKewajiban = (dari: Period, sampai: Period): KejadianKewajiban[] =>
    daftarKewajiban
      .flatMap((k) =>
        kejadian(k, periodStart(dari), periodEndExclusive(sampai)).map((e) => ({
          id: k.id,
          label: k.kendaraan ? `${k.label} — ${k.kendaraan.plate}` : k.label,
          jatuhTempo: e.jatuhTempo,
          amount: e.amount,
          period: toPeriod(e.jatuhTempo),
          sebelumPosisi: batas !== null && e.jatuhTempo <= batas,
        })),
      )
      .sort((a, b) => a.jatuhTempo.getTime() - b.jatuhTempo.getTime());

  // Yang jatuh tempo sebelum posisi kas dilaporkan sudah tercermin pada
  // saldonya — sama seperti belanja dan cicilan rencana belanja.
  const kewajibanBulanIni = terakhir
    ? kewajibanSetelah(daftarKewajiban, period, terakhir.date)
    : kewajibanPada(daftarKewajiban, period);
  const kewajibanBulan = (p: Period) =>
    p === period ? kewajibanBulanIni : kewajibanPada(daftarKewajiban, p);

  const rencana = terakhir
    ? hitungRencana({
        period,
        tanggal: terakhir.date,
        saldoKas: terakhir.cashOnHand,
        masukSampaiKini: terakhir.incomeToDate,
        proyeksi: dipakai,
        cicilanBelanja: cicilanBulanIni,
        kewajiban: kewajibanBulanIni,
        komitmen: plan.commitments.map((k) => ({
          label: k.label, amount: k.amount, dueDay: k.dueDay, paid: k.paid,
        })),
        // Total terpakai diturunkan dari rinciannya, jadi keduanya tidak bisa
        // berbeda — dan kategori yang terhapus tidak meninggalkan selisih.
        kategori: kategori.map((k) => ({ label: k.label, weight: k.weight, terpakai: k.terpakai })),
      })
    : null;

  // Usulan pengeluaran bulanan dari riwayat; kebutuhan gaji dari komitmen yang
  // berulang, karena gaji memang didaftarkan di sana.
  const keluarRiwayat = riwayat.map((r) => r.cashIn).length > 0 ? await riwayatUangKeluar(period) : [];
  const usulanOutflow = keluarRiwayat.length > 0
    ? round(keluarRiwayat.reduce((s, v) => s + v, 0) / keluarRiwayat.length)
    : null;
  const usulanGaji = plan.commitments
    .filter((k) => k.recurring && /gaji/i.test(k.label))
    .reduce((s, k) => s + k.amount, 0) || null;

  const outflow = plan.monthlyOutflow ?? usulanOutflow;
  const gaji = plan.salaryNeed ?? usulanGaji ?? 0;

  const runway = rencana && outflow !== null
    ? (Object.fromEntries(
        SKENARIO.map((sk) => [
          sk,
          hitungRunway({
            period,
            saldoKas: terakhir!.cashOnHand,
            sisaMasuk: rencana.skenario[sk].sisaMasuk,
            proyeksiBulanan: dipakai[sk],
            proyeksiBerikutnya: proyeksiUntuk(sk),
            pengeluaranBulanan: outflow,
            komitmenBelumBayar: rencana.komitmenBelumBayar,
            komitmenRutinSebulan: plan.commitments
              .filter((k) => k.recurring)
              .reduce((t, k) => t + k.amount, 0),
            kebutuhanGaji: gaji,
            cicilanPada: cicilanBulan,
            kewajibanPada: kewajibanBulan,
            hariTersisa: rencana.hari,
            hariSebulan: new Date(Date.UTC(
              Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0,
            )).getUTCDate(),
          }),
        ]),
      ) as Record<Skenario, Runway>)
    : null;

  return {
    id: plan.id,
    period: plan.period,
    notes: plan.notes,
    tersimpan,
    usulan,
    dipakai,
    dipakaiBerikutnya,
    musim: {
      aktif: musimAktif,
      bulanIni: musimBulanIni,
      bulanDepan: pola.get(monthOf(bulanDepan)) ?? null,
    },
    riwayatMasuk: riwayat,
    komitmen: plan.commitments.map((k) => ({
      id: k.id, label: k.label, amount: k.amount, dueDay: k.dueDay, paid: k.paid, recurring: k.recurring,
    })),
    kategori,
    belanja: belanja.map(({ urut: _urut, ...b }) => b),
    asumsi: {
      monthlyOutflow: plan.monthlyOutflow,
      salaryNeed: plan.salaryNeed,
      usulanOutflow,
      usulanGaji,
    },
    runway,
    // Tiap posisi kas membawa uang masuk kumulatif pada tanggalnya; itu sudah
    // cukup untuk melihat ke skenario mana bulan ini sedang mengarah.
    tren: hitungTren(
      period,
      plan.checkpoints.map((c) => ({ hari: c.date.getUTCDate(), masuk: c.incomeToDate })),
      dipakai,
    ),
    rencanaBelanja,
    kewajiban: {
      bulanIni: kejadianKewajiban(period, period),
      mendatang: kejadianKewajiban(addMonths(period, 1), addMonths(period, HORIZON_BULAN)),
      belumKeluar: kewajibanBulanIni,
    },
    konteksBeli: runway && terakhir
      ? (Object.fromEntries(
          SKENARIO.map((sk) => [
            sk,
            konteksPembelian(runway[sk], terakhir!.cashOnHand, gaji, rencana!.hari),
          ]),
        ) as Record<Skenario, PurchaseContext>)
      : null,
    checkpoint: plan.checkpoints.map((c) => ({
      id: c.id, date: c.date, cashOnHand: c.cashOnHand, incomeToDate: c.incomeToDate, notes: c.notes,
    })),
    terakhir: terakhir && { date: terakhir.date, cashOnHand: terakhir.cashOnHand, incomeToDate: terakhir.incomeToDate },
    menurutJurnal: { saldoKas: round(saldoKas), masukBulanIni: round(bulanIni[0]?.cashIn ?? 0) },
    rencana,
  };
}
