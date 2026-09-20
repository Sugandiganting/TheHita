/**
 * Mesin peramalan arus kas.
 *
 * Alur kerja:
 *  1. Ambil histori pemasukan & pengeluaran bulanan dari jurnal yang sudah diinput.
 *  2. Hitung pola dasar (baseline) memakai rata-rata, rata-rata tertimbang, atau tren.
 *  3. Koreksi dengan indeks musiman bila histori sudah >= 12 bulan
 *     (penting untuk hotel: low season vs high season).
 *  4. Terapkan asumsi pertumbuhan tahunan.
 *  5. Suntikkan rencana proyek: belanja modal, pencairan pinjaman, cicilan,
 *     serta tambahan pendapatan/biaya setelah proyek beroperasi.
 *  6. Gulung saldo kas bulan demi bulan untuk menemukan kapan kas menipis/habis.
 *
 * Seluruh fungsi di file ini murni (tanpa akses database) supaya mudah diuji.
 */

import { addMonths, diffMonths, monthOf, periodRange, type Period } from './period';

export type ForecastMethod = 'AVERAGE' | 'WEIGHTED' | 'TREND';

/** Ringkasan aktual satu bulan, hasil agregasi jurnal. */
export type MonthlyActual = {
  period: Period;
  /** Total pendapatan (akun REVENUE). */
  revenue: number;
  /** Total HPP + beban operasional (akun COGS & EXPENSE). */
  expense: number;
  /** Arus kas masuk aktual (debit ke akun kas/bank). */
  cashIn: number;
  /** Arus kas keluar aktual (kredit dari akun kas/bank). */
  cashOut: number;
};

/** Rencana proyek yang sudah diratakan menjadi jadwal arus kas. */
export type ProjectPlan = {
  id: string;
  name: string;
  unitId: string;
  /** Belanja modal terjadwal yang belum dibayar. */
  costs: { period: Period; amount: number }[];
  /** Pencairan dana (pinjaman / setoran modal). */
  funding: { period: Period; amount: number } | null;
  /** Cicilan pinjaman per bulan beserta bulan mulainya. */
  loan: { monthlyPayment: number; startPeriod: Period; months: number } | null;
  /** Tambahan pendapatan & biaya bulanan setelah proyek beroperasi. */
  uplift: { startPeriod: Period; revenue: number; expense: number } | null;
};

export type ForecastParams = {
  /** Bulan pertama yang diproyeksikan. */
  startPeriod: Period;
  horizonMonths: number;
  method: ForecastMethod;
  lookbackMonths: number;
  useSeasonality: boolean;
  /** Pertumbuhan pendapatan per tahun dalam persen (mis. 8 = +8%/tahun). */
  revenueGrowthPct: number;
  /** Pertumbuhan biaya per tahun dalam persen (inflasi, kenaikan gaji, dsb). */
  expenseGrowthPct: number;
  /** Saldo kas minimum yang ingin dijaga. */
  minCashBuffer: number;
  /** Saldo kas pada awal periode proyeksi. */
  openingCash: number;
};

export type ForecastRow = {
  period: Period;
  /** Pemasukan operasional rutin hasil ramalan. */
  baselineIn: number;
  /** Pengeluaran operasional rutin hasil ramalan. */
  baselineOut: number;
  /** Tambahan pendapatan dari proyek yang sudah beroperasi. */
  projectIn: number;
  /** Tambahan biaya operasional dari proyek yang sudah beroperasi. */
  projectOpex: number;
  /** Belanja modal proyek yang jatuh tempo bulan ini. */
  projectCapex: number;
  /** Pencairan pinjaman / setoran modal. */
  fundingIn: number;
  /** Cicilan pinjaman. */
  loanPayment: number;
  totalIn: number;
  totalOut: number;
  netCash: number;
  /** Saldo kas akhir bulan. */
  cashBalance: number;
  belowBuffer: boolean;
  negative: boolean;
};

export type ForecastResult = {
  rows: ForecastRow[];
  openingCash: number;
  minCashBuffer: number;
  /** Rata-rata ramalan pemasukan operasional per bulan. */
  avgMonthlyIn: number;
  /** Rata-rata ramalan pengeluaran operasional per bulan. */
  avgMonthlyOut: number;
  avgMonthlyNet: number;
  /** Bulan pertama saldo kas turun di bawah buffer aman. */
  firstBufferBreach: Period | null;
  /** Bulan pertama saldo kas minus — "kapan uang kita habis". */
  firstNegative: Period | null;
  /** Berapa bulan lagi dari awal proyeksi sampai kas habis. */
  runwayMonths: number | null;
  lowestBalance: { period: Period; amount: number } | null;
  endingCash: number;
  /**
   * Dana maksimum yang masih bisa dibelanjakan sekarang tanpa menembus
   * buffer aman sepanjang horizon (tanpa memperhitungkan proyek).
   */
  maxAffordableNow: number;
  historyMonths: number;
  seasonalityApplied: boolean;
  warnings: string[];
};

const EPS = 1e-9;

/* ------------------------------------------------------------------ */
/* Estimator dasar                                                     */
/* ------------------------------------------------------------------ */

/** Rata-rata sederhana. */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Rata-rata tertimbang linear: bulan terbaru diberi bobot terbesar.
 * Cocok ketika kondisi usaha berubah (mis. habis renovasi).
 */
export function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0;
  let weightSum = 0;
  let total = 0;
  values.forEach((v, i) => {
    const w = i + 1;
    total += v * w;
    weightSum += w;
  });
  return total / weightSum;
}

/** Regresi linear sederhana terhadap indeks bulan; mengembalikan fungsi prediksi. */
export function linearTrend(values: number[]): (index: number) => number {
  const n = values.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => values[0];

  const meanX = (n - 1) / 2;
  const meanY = average(values);
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const slope = den < EPS ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return (index: number) => intercept + slope * index;
}

/**
 * Indeks musiman per bulan (1-12). Nilai 1 berarti rata-rata,
 * 1,2 berarti bulan itu biasanya 20% di atas rata-rata.
 * Bulan tanpa data diberi indeks 1.
 */
export function seasonalIndices(history: { period: Period; value: number }[]): number[] {
  const overall = average(history.map((h) => h.value));
  const factors = new Array(13).fill(1);
  if (overall < EPS) return factors;

  for (let m = 1; m <= 12; m++) {
    const monthValues = history.filter((h) => monthOf(h.period) === m).map((h) => h.value);
    if (monthValues.length === 0) continue;
    const factor = average(monthValues) / overall;
    // Batasi agar satu bulan ekstrem tidak merusak proyeksi.
    factors[m] = clamp(factor, 0.5, 1.8);
  }
  return factors;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Membuat deret ramalan untuk `horizon` bulan ke depan.
 * Histori harus urut dari bulan terlama ke terbaru.
 */
export function projectSeries(
  history: { period: Period; value: number }[],
  options: {
    startPeriod: Period;
    horizon: number;
    method: ForecastMethod;
    useSeasonality: boolean;
    /** Pertumbuhan per tahun dalam persen. */
    growthPct: number;
  },
): number[] {
  const { startPeriod, horizon, method, growthPct } = options;
  if (horizon <= 0) return [];
  if (history.length === 0) return new Array(horizon).fill(0);

  const useSeasonality = options.useSeasonality && history.length >= 12;
  const factors = useSeasonality ? seasonalIndices(history) : new Array(13).fill(1);

  // Hilangkan pengaruh musim sebelum mencari pola dasar,
  // supaya tren tidak tertipu oleh high/low season.
  const deseasonalized = history.map((h) => {
    const f = factors[monthOf(h.period)] || 1;
    return f < EPS ? h.value : h.value / f;
  });

  const trend = method === 'TREND' ? linearTrend(deseasonalized) : null;
  const flat =
    method === 'AVERAGE' ? average(deseasonalized) : method === 'WEIGHTED' ? weightedAverage(deseasonalized) : 0;

  // Pertumbuhan tahunan diubah menjadi faktor bulanan yang berbunga majemuk.
  const monthlyGrowth = Math.pow(1 + growthPct / 100, 1 / 12);

  return periodRange(startPeriod, horizon).map((period, i) => {
    const base = trend ? trend(history.length + i) : flat;
    const seasonal = factors[monthOf(period)] || 1;
    const value = base * seasonal * Math.pow(monthlyGrowth, i + 1);
    return Math.max(0, value);
  });
}

/* ------------------------------------------------------------------ */
/* Proyeksi arus kas                                                   */
/* ------------------------------------------------------------------ */

/** Cicilan anuitas bulanan. Bunga 0 berarti pokok dibagi rata. */
export function monthlyInstallment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0 || principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r < EPS) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function buildForecast(
  history: MonthlyActual[],
  projects: ProjectPlan[],
  params: ForecastParams,
): ForecastResult {
  const warnings: string[] = [];
  const horizon = Math.max(1, params.horizonMonths);

  const sorted = [...history].sort((a, b) => a.period.localeCompare(b.period));
  const lookback = Math.max(1, params.lookbackMonths);
  const window = sorted.slice(-lookback);

  if (window.length === 0) {
    warnings.push('Belum ada data transaksi. Ramalan dimulai dari nol — input transaksi terlebih dahulu.');
  } else if (window.length < 3) {
    warnings.push(
      `Histori baru ${window.length} bulan. Ramalan masih kasar; akurasi meningkat setelah 6-12 bulan data.`,
    );
  }

  const seasonalityApplied = params.useSeasonality && window.length >= 12;
  if (params.useSeasonality && !seasonalityApplied && window.length > 0) {
    warnings.push('Pola musiman belum dipakai karena histori kurang dari 12 bulan.');
  }

  // Pakai arus kas aktual bila tersedia; bila belum, pakai pendapatan/beban
  // sebagai perkiraan (untuk usaha hotel mayoritas transaksi memang tunai).
  const cashHistory = window.map((h) => ({
    period: h.period,
    inValue: h.cashIn > 0 ? h.cashIn : h.revenue,
    outValue: h.cashOut > 0 ? h.cashOut : h.expense,
  }));

  const baselineIn = projectSeries(
    cashHistory.map((h) => ({ period: h.period, value: h.inValue })),
    {
      startPeriod: params.startPeriod,
      horizon,
      method: params.method,
      useSeasonality: params.useSeasonality,
      growthPct: params.revenueGrowthPct,
    },
  );

  const baselineOut = projectSeries(
    cashHistory.map((h) => ({ period: h.period, value: h.outValue })),
    {
      startPeriod: params.startPeriod,
      horizon,
      method: params.method,
      useSeasonality: params.useSeasonality,
      growthPct: params.expenseGrowthPct,
    },
  );

  const periods = periodRange(params.startPeriod, horizon);
  const rows: ForecastRow[] = [];

  let balance = params.openingCash;
  let lowest: { period: Period; amount: number } | null = null;
  let firstBufferBreach: Period | null = null;
  let firstNegative: Period | null = null;

  periods.forEach((period, i) => {
    let projectIn = 0;
    let projectOpex = 0;
    let projectCapex = 0;
    let fundingIn = 0;
    let loanPayment = 0;

    for (const p of projects) {
      for (const cost of p.costs) {
        if (cost.period === period) projectCapex += cost.amount;
      }
      if (p.funding && p.funding.period === period) fundingIn += p.funding.amount;
      if (p.loan && p.loan.monthlyPayment > 0) {
        const offset = diffMonths(p.loan.startPeriod, period);
        if (offset >= 0 && offset < p.loan.months) loanPayment += p.loan.monthlyPayment;
      }
      if (p.uplift && period >= p.uplift.startPeriod) {
        projectIn += p.uplift.revenue;
        projectOpex += p.uplift.expense;
      }
    }

    const totalIn = baselineIn[i] + projectIn + fundingIn;
    const totalOut = baselineOut[i] + projectOpex + projectCapex + loanPayment;
    const netCash = totalIn - totalOut;
    balance += netCash;

    const negative = balance < 0;
    const belowBuffer = balance < params.minCashBuffer;

    if (belowBuffer && !firstBufferBreach) firstBufferBreach = period;
    if (negative && !firstNegative) firstNegative = period;
    if (!lowest || balance < lowest.amount) lowest = { period, amount: balance };

    rows.push({
      period,
      baselineIn: baselineIn[i],
      baselineOut: baselineOut[i],
      projectIn,
      projectOpex,
      projectCapex,
      fundingIn,
      loanPayment,
      totalIn,
      totalOut,
      netCash,
      cashBalance: balance,
      belowBuffer,
      negative,
    });
  });

  // Kapasitas belanja: saldo terendah sepanjang horizon bila proyek diabaikan,
  // dikurangi buffer aman.
  let baselineBalance = params.openingCash;
  let baselineLowest = params.openingCash;
  for (let i = 0; i < horizon; i++) {
    baselineBalance += baselineIn[i] - baselineOut[i];
    baselineLowest = Math.min(baselineLowest, baselineBalance);
  }
  const maxAffordableNow = Math.max(0, baselineLowest - params.minCashBuffer);

  const avgMonthlyIn = average(baselineIn);
  const avgMonthlyOut = average(baselineOut);

  if (firstNegative) {
    warnings.push(
      `Dengan asumsi saat ini, saldo kas diperkirakan minus mulai ${firstNegative}. Tinjau ulang jadwal proyek atau tambahkan pendanaan.`,
    );
  } else if (firstBufferBreach) {
    warnings.push(
      `Saldo kas diperkirakan menembus batas aman pada ${firstBufferBreach}, meski tidak sampai minus.`,
    );
  }

  return {
    rows,
    openingCash: params.openingCash,
    minCashBuffer: params.minCashBuffer,
    avgMonthlyIn,
    avgMonthlyOut,
    avgMonthlyNet: avgMonthlyIn - avgMonthlyOut,
    firstBufferBreach,
    firstNegative,
    runwayMonths: firstNegative ? diffMonths(params.startPeriod, firstNegative) : null,
    lowestBalance: lowest,
    endingCash: rows.length > 0 ? rows[rows.length - 1].cashBalance : params.openingCash,
    maxAffordableNow,
    historyMonths: window.length,
    seasonalityApplied,
    warnings,
  };
}

/**
 * Mengubah data proyek dari database menjadi jadwal arus kas siap hitung.
 */
export function toProjectPlan(project: {
  id: string;
  name: string;
  unitId: string;
  items: { amount: number; plannedDate: Date; paid: boolean }[];
  fundingAmount: number;
  fundingDate: Date | null;
  fundingType: string;
  loanRatePct: number;
  loanTenorMonths: number;
  upliftRevenueMonthly: number;
  upliftExpenseMonthly: number;
  upliftStartDate: Date | null;
}): ProjectPlan {
  const toP = (d: Date): Period =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

  const costs = project.items
    .filter((i) => !i.paid)
    .map((i) => ({ period: toP(i.plannedDate), amount: i.amount }));

  const funding =
    project.fundingAmount > 0 && project.fundingDate
      ? { period: toP(project.fundingDate), amount: project.fundingAmount }
      : null;

  const loan =
    project.fundingType === 'LOAN' && project.fundingAmount > 0 && project.loanTenorMonths > 0 && funding
      ? {
          monthlyPayment: monthlyInstallment(
            project.fundingAmount,
            project.loanRatePct,
            project.loanTenorMonths,
          ),
          // Cicilan mulai satu bulan setelah dana cair.
          startPeriod: addMonths(funding.period, 1),
          months: project.loanTenorMonths,
        }
      : null;

  const uplift =
    project.upliftStartDate && (project.upliftRevenueMonthly > 0 || project.upliftExpenseMonthly > 0)
      ? {
          startPeriod: toP(project.upliftStartDate),
          revenue: project.upliftRevenueMonthly,
          expense: project.upliftExpenseMonthly,
        }
      : null;

  return { id: project.id, name: project.name, unitId: project.unitId, costs, funding, loan, uplift };
}
