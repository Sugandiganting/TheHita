import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  average,
  buildForecast,
  linearTrend,
  monthlyInstallment,
  projectSeries,
  seasonalIndices,
  weightedAverage,
  type MonthlyActual,
  type ProjectPlan,
} from '../src/lib/forecast.ts';
import { addMonths, diffMonths, periodRange } from '../src/lib/period.ts';
import { buildQuickEntryLines, checkBalance, signedBalance } from '../src/lib/accounting.ts';

/* ---------------- Utilitas periode ---------------- */

test('addMonths melewati pergantian tahun dengan benar', () => {
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.equal(addMonths('2026-02', -3), '2025-11');
});

test('diffMonths menghitung jarak bulan', () => {
  assert.equal(diffMonths('2026-01', '2026-12'), 11);
  assert.equal(diffMonths('2026-12', '2026-01'), -11);
});

/* ---------------- Estimator ---------------- */

test('weightedAverage memberi bobot lebih besar ke bulan terbaru', () => {
  const values = [100, 100, 400];
  assert.equal(average(values), 200);
  // (100*1 + 100*2 + 400*3) / 6 = 250
  assert.equal(weightedAverage(values), 250);
});

test('linearTrend menangkap kenaikan konstan', () => {
  const predict = linearTrend([100, 200, 300, 400]);
  assert.equal(Math.round(predict(4)), 500);
});

test('seasonalIndices mengenali bulan ramai dan sepi', () => {
  const history = periodRange('2025-01', 12).map((period, i) => ({
    period,
    // Juli (indeks 6) dua kali lipat bulan lain.
    value: i === 6 ? 200 : 100,
  }));
  const factors = seasonalIndices(history);
  assert.ok(factors[7] > 1.4, `indeks Juli seharusnya di atas 1,4 (dapat ${factors[7]})`);
  assert.ok(factors[1] < 1, `indeks Januari seharusnya di bawah 1 (dapat ${factors[1]})`);
});

test('projectSeries tanpa histori mengembalikan nol', () => {
  const series = projectSeries([], {
    startPeriod: '2026-10',
    horizon: 6,
    method: 'WEIGHTED',
    useSeasonality: true,
    growthPct: 10,
  });
  assert.deepEqual(series, [0, 0, 0, 0, 0, 0]);
});

test('projectSeries menerapkan pertumbuhan tahunan secara majemuk', () => {
  const history = periodRange('2025-10', 6).map((period) => ({ period, value: 1000 }));
  const series = projectSeries(history, {
    startPeriod: '2026-04',
    horizon: 12,
    method: 'AVERAGE',
    useSeasonality: false,
    growthPct: 12,
  });
  // Setelah 12 bulan nilainya harus mendekati 1000 * 1,12.
  assert.ok(Math.abs(series[11] - 1120) < 1, `dapat ${series[11]}`);
  assert.ok(series[0] > 1000 && series[0] < 1020);
});

test('projectSeries tidak pernah menghasilkan nilai negatif', () => {
  const history = periodRange('2025-01', 6).map((period, i) => ({ period, value: 600 - i * 100 }));
  const series = projectSeries(history, {
    startPeriod: '2025-07',
    horizon: 12,
    method: 'TREND',
    useSeasonality: false,
    growthPct: 0,
  });
  assert.ok(series.every((v) => v >= 0), 'deret tren tidak boleh minus');
});

/* ---------------- Cicilan ---------------- */

test('monthlyInstallment tanpa bunga membagi pokok rata', () => {
  assert.equal(monthlyInstallment(120_000_000, 0, 12), 10_000_000);
});

test('monthlyInstallment dengan bunga menghasilkan cicilan anuitas', () => {
  const payment = monthlyInstallment(900_000_000, 11, 60);
  // Anuitas 900jt, 11%/th, 60 bulan ≈ 19,57 juta per bulan.
  assert.ok(payment > 19_000_000 && payment < 20_000_000, `dapat ${payment}`);
  assert.ok(payment * 60 > 900_000_000, 'total bayar harus melebihi pokok');
});

/* ---------------- Proyeksi arus kas ---------------- */

function flatHistory(months: number, cashIn: number, cashOut: number): MonthlyActual[] {
  return periodRange('2025-01', months).map((period) => ({
    period,
    revenue: cashIn,
    expense: cashOut,
    cashIn,
    cashOut,
  }));
}

const baseParams = {
  startPeriod: '2026-01',
  horizonMonths: 12,
  method: 'AVERAGE' as const,
  lookbackMonths: 12,
  useSeasonality: false,
  revenueGrowthPct: 0,
  expenseGrowthPct: 0,
  minCashBuffer: 0,
  openingCash: 0,
};

test('usaha yang surplus tidak pernah kehabisan kas', () => {
  const result = buildForecast(flatHistory(12, 100_000_000, 80_000_000), [], {
    ...baseParams,
    openingCash: 50_000_000,
  });

  assert.equal(result.firstNegative, null);
  assert.equal(result.runwayMonths, null);
  // 50jt + 12 * 20jt surplus = 290jt
  assert.ok(Math.abs(result.endingCash - 290_000_000) < 1000, `dapat ${result.endingCash}`);
});

test('usaha yang defisit menemukan bulan kas habis', () => {
  const result = buildForecast(flatHistory(12, 80_000_000, 100_000_000), [], {
    ...baseParams,
    openingCash: 50_000_000,
  });

  // Defisit 20jt/bulan dari saldo 50jt: minus mulai bulan ke-3.
  assert.equal(result.firstNegative, '2026-03');
  assert.equal(result.runwayMonths, 2);
});

test('batas aman terdeteksi sebelum saldo benar-benar minus', () => {
  const result = buildForecast(flatHistory(12, 80_000_000, 100_000_000), [], {
    ...baseParams,
    openingCash: 100_000_000,
    minCashBuffer: 50_000_000,
  });

  assert.equal(result.firstBufferBreach, '2026-03'); // saldo 40jt < 50jt
  assert.equal(result.firstNegative, '2026-06'); // saldo -20jt
  assert.ok(result.firstBufferBreach! < result.firstNegative!);
});

test('belanja proyek mempercepat habisnya kas', () => {
  const history = flatHistory(12, 100_000_000, 90_000_000);
  const project: ProjectPlan = {
    id: 'p1',
    name: 'Tambah kamar',
    unitId: 'u1',
    costs: [
      { period: '2026-02', amount: 300_000_000 },
      { period: '2026-03', amount: 300_000_000 },
    ],
    funding: null,
    loan: null,
    uplift: null,
  };

  const tanpaProyek = buildForecast(history, [], { ...baseParams, openingCash: 200_000_000 });
  const denganProyek = buildForecast(history, [project], { ...baseParams, openingCash: 200_000_000 });

  assert.equal(tanpaProyek.firstNegative, null);
  // Saldo awal 200jt + surplus 10jt Januari tidak cukup menutup belanja 300jt Februari.
  assert.equal(denganProyek.firstNegative, '2026-02');
  assert.ok(denganProyek.endingCash < tanpaProyek.endingCash);
});

test('item proyek yang sudah dibayar tidak dihitung dua kali', () => {
  const history = flatHistory(12, 100_000_000, 90_000_000);
  const unpaidOnly: ProjectPlan = {
    id: 'p1',
    name: 'Tambah kamar',
    unitId: 'u1',
    costs: [{ period: '2026-02', amount: 100_000_000 }],
    funding: null,
    loan: null,
    uplift: null,
  };

  const result = buildForecast(history, [unpaidOnly], { ...baseParams, openingCash: 200_000_000 });
  const totalCapex = result.rows.reduce((s, r) => s + r.projectCapex, 0);
  assert.equal(totalCapex, 100_000_000);
});

test('pinjaman menambah kas saat cair lalu menguranginya lewat cicilan', () => {
  const history = flatHistory(12, 100_000_000, 95_000_000);
  const project: ProjectPlan = {
    id: 'p1',
    name: 'Renovasi',
    unitId: 'u1',
    costs: [{ period: '2026-02', amount: 500_000_000 }],
    funding: { period: '2026-01', amount: 500_000_000 },
    loan: { monthlyPayment: 10_000_000, startPeriod: '2026-02', months: 60 },
    uplift: null,
  };

  const result = buildForecast(history, [project], { ...baseParams, openingCash: 100_000_000 });

  assert.equal(result.rows[0].fundingIn, 500_000_000);
  assert.equal(result.rows[0].loanPayment, 0, 'cicilan belum jalan di bulan pencairan');
  assert.equal(result.rows[1].loanPayment, 10_000_000);
  assert.equal(result.rows[1].projectCapex, 500_000_000);
});

test('tambahan pendapatan proyek baru dihitung setelah mulai beroperasi', () => {
  const history = flatHistory(12, 100_000_000, 100_000_000);
  const project: ProjectPlan = {
    id: 'p1',
    name: 'Kamar baru',
    unitId: 'u1',
    costs: [],
    funding: null,
    loan: null,
    uplift: { startPeriod: '2026-07', revenue: 50_000_000, expense: 20_000_000 },
  };

  const result = buildForecast(history, [project], { ...baseParams, openingCash: 0 });

  assert.equal(result.rows[0].projectIn, 0);
  assert.equal(result.rows[5].projectIn, 0); // 2026-06
  assert.equal(result.rows[6].projectIn, 50_000_000); // 2026-07
  assert.equal(result.rows[6].projectOpex, 20_000_000);
});

test('kemampuan belanja memperhitungkan batas aman', () => {
  const result = buildForecast(flatHistory(12, 100_000_000, 90_000_000), [], {
    ...baseParams,
    openingCash: 500_000_000,
    minCashBuffer: 200_000_000,
  });

  // Saldo terendah sepanjang horizon adalah saldo awal (500jt) karena selalu surplus.
  assert.equal(result.maxAffordableNow, 300_000_000);
});

test('tanpa data transaksi hasilnya nol dan ada peringatan', () => {
  const result = buildForecast([], [], { ...baseParams, openingCash: 10_000_000 });

  assert.equal(result.endingCash, 10_000_000);
  assert.equal(result.historyMonths, 0);
  assert.ok(result.warnings.some((w) => w.includes('Belum ada data')));
});

test('saldo kas bergulir konsisten dari bulan ke bulan', () => {
  const result = buildForecast(flatHistory(12, 100_000_000, 70_000_000), [], {
    ...baseParams,
    openingCash: 25_000_000,
  });

  let expected = 25_000_000;
  for (const row of result.rows) {
    expected += row.netCash;
    assert.ok(Math.abs(row.cashBalance - expected) < 1, `saldo ${row.period} tidak konsisten`);
    assert.ok(Math.abs(row.netCash - (row.totalIn - row.totalOut)) < 1);
  }
});

/* ---------------- Akuntansi ---------------- */

test('entri cepat pemasukan menghasilkan jurnal yang balance', () => {
  const lines = buildQuickEntryLines({
    kind: 'INCOME',
    amount: 1_500_000,
    unitId: 'u1',
    categoryAccountId: 'rev',
    counterAccountId: 'kas',
  });

  const balance = checkBalance(lines);
  assert.ok(balance.balanced);
  // Kas didebit, pendapatan dikredit.
  assert.equal(lines.find((l) => l.accountId === 'kas')!.debit, 1_500_000);
  assert.equal(lines.find((l) => l.accountId === 'rev')!.credit, 1_500_000);
});

test('entri cepat pengeluaran membalik sisi debit dan kredit', () => {
  const lines = buildQuickEntryLines({
    kind: 'EXPENSE',
    amount: 750_000,
    unitId: 'u1',
    categoryAccountId: 'beban',
    counterAccountId: 'kas',
  });

  assert.ok(checkBalance(lines).balanced);
  assert.equal(lines.find((l) => l.accountId === 'beban')!.debit, 750_000);
  assert.equal(lines.find((l) => l.accountId === 'kas')!.credit, 750_000);
});

test('nominal negatif diperlakukan sebagai nilai mutlak', () => {
  const lines = buildQuickEntryLines({
    kind: 'INCOME',
    amount: -500_000,
    unitId: 'u1',
    categoryAccountId: 'rev',
    counterAccountId: 'kas',
  });
  assert.equal(lines[0].debit, 500_000);
});

test('checkBalance mendeteksi jurnal yang tidak seimbang', () => {
  const result = checkBalance([
    { accountId: 'a', unitId: 'u', debit: 100, credit: 0 },
    { accountId: 'b', unitId: 'u', debit: 0, credit: 90 },
  ]);
  assert.equal(result.balanced, false);
  assert.equal(result.difference, 10);
});

test('saldo normal membuat pendapatan dan beban sama-sama positif', () => {
  assert.equal(signedBalance('REVENUE', 0, 5_000_000), 5_000_000);
  assert.equal(signedBalance('EXPENSE', 5_000_000, 0), 5_000_000);
  assert.equal(signedBalance('ASSET', 3_000_000, 1_000_000), 2_000_000);
  assert.equal(signedBalance('LIABILITY', 1_000_000, 3_000_000), 2_000_000);
});
