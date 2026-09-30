import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advisePurchase, buildForecast, planPurchase, type ForecastResult } from '../src/lib/forecast.ts';

/**
 * Perencana pembelian. Pertanyaannya sederhana — "uangnya cukup atau tidak" —
 * tetapi jawabannya harus benar pada dua hal: saldo saat tiap cicilan dibayar,
 * DAN saldo pada bulan-bulan sesudahnya, karena pembelian menurunkan garis kas
 * secara permanen.
 */

/** Ramalan dengan arus kas tetap tiap bulan, supaya angkanya mudah diperiksa. */
function ramalan(opts: {
  masuk: number;
  keluar: number;
  saldoAwal: number;
  buffer?: number;
  bulan?: number;
}): ForecastResult {
  const riwayat = Array.from({ length: 6 }, (_, i) => ({
    period: `2026-0${i + 1}`,
    revenue: opts.masuk,
    expense: opts.keluar,
    cashIn: opts.masuk,
    cashOut: opts.keluar,
  }));
  return buildForecast(riwayat, [], {
    startPeriod: '2026-07',
    horizonMonths: opts.bulan ?? 12,
    method: 'AVERAGE',
    lookbackMonths: 6,
    useSeasonality: false,
    revenueGrowthPct: 0,
    expenseGrowthPct: 0,
    minCashBuffer: opts.buffer ?? 0,
    openingCash: opts.saldoAwal,
  });
}

test('pembelian yang jauh di bawah saldo dinyatakan cukup', () => {
  const r = ramalan({ masuk: 100_000_000, keluar: 90_000_000, saldoAwal: 200_000_000 });
  const p = planPurchase(r, 50_000_000, 1, 'MONTHLY');
  assert.equal(p.affordable, true);
  assert.equal(p.shortfall, 0);
  assert.equal(p.schedule.length, 1);
  assert.equal(p.schedule[0].amount, 50_000_000);
});

test('pembelian yang melebihi saldo dinyatakan tidak cukup, berikut kekurangannya', () => {
  const r = ramalan({ masuk: 100_000_000, keluar: 100_000_000, saldoAwal: 50_000_000 });
  const p = planPurchase(r, 80_000_000, 1, 'MONTHLY');
  assert.equal(p.affordable, false);
  // Arus kas datar, jadi kekurangannya tepat 80 juta dikurangi saldo 50 juta.
  assert.equal(Math.round(p.shortfall), 30_000_000);
});

test('batas aman ikut dijaga, bukan cuma jangan sampai minus', () => {
  const r = ramalan({ masuk: 100_000_000, keluar: 100_000_000, saldoAwal: 100_000_000, buffer: 40_000_000 });
  const p = planPurchase(r, 70_000_000, 1, 'MONTHLY');
  // Saldo setelah beli 30 juta, masih positif tetapi menembus batas aman 40 juta.
  assert.equal(p.affordable, false);
  assert.equal(Math.round(p.shortfall), 10_000_000);
});

test('jumlah seluruh cicilan selalu persis sama dengan harga barang', () => {
  const r = ramalan({ masuk: 100_000_000, keluar: 90_000_000, saldoAwal: 200_000_000 });
  for (const n of [2, 3, 4, 7]) {
    const p = planPurchase(r, 100_000_000, n, 'WEEKLY');
    const jumlah = p.schedule.reduce((s, c) => s + c.amount, 0);
    assert.equal(Math.round(jumlah), 100_000_000, `${n} cicilan tidak berjumlah utuh`);
    assert.equal(p.schedule.length, n);
  }
});

test('dipecah mingguan membuat pembelian yang tadinya berat jadi aman', () => {
  // Kas tumbuh 30 juta per bulan, saldo awal 20 juta. Beli 40 juta sekaligus
  // tidak mungkin; dicicil beberapa minggu, kas sempat terkumpul dulu.
  const r = ramalan({ masuk: 100_000_000, keluar: 70_000_000, saldoAwal: 20_000_000 });
  assert.equal(planPurchase(r, 40_000_000, 1, 'WEEKLY').affordable, false);
  const saran = advisePurchase(r, 40_000_000, 1, 'WEEKLY');
  assert.notEqual(saran.minimumInstalments, null);
  assert.ok(saran.minimumInstalments! > 1);
  assert.equal(saran.recommended?.affordable, true);
});

test('cicilan pertama selalu dibayar sekarang', () => {
  const r = ramalan({ masuk: 100_000_000, keluar: 90_000_000, saldoAwal: 200_000_000 });
  for (const cadence of ['WEEKLY', 'MONTHLY'] as const) {
    const p = planPurchase(r, 30_000_000, 3, cadence);
    assert.equal(p.schedule[0].dayOffset, 0);
  }
});

test('cicilan mingguan berjarak tujuh hari, bulanan berjarak sebulan', () => {
  const r = ramalan({ masuk: 100_000_000, keluar: 90_000_000, saldoAwal: 200_000_000 });
  const mingguan = planPurchase(r, 30_000_000, 3, 'WEEKLY');
  assert.deepEqual(mingguan.schedule.map((c) => c.dayOffset), [0, 7, 14]);
  const bulanan = planPurchase(r, 30_000_000, 3, 'MONTHLY');
  // Juli 31 hari, Agustus 31 hari.
  assert.deepEqual(bulanan.schedule.map((c) => c.dayOffset), [0, 31, 62]);
});

test('pembelian yang tidak akan pernah terjangkau tidak diberi saran cicilan', () => {
  // Kas tidak tumbuh sama sekali, harga jauh di atas saldo. Dipecah berapa pun
  // tetap jebol, karena pada akhirnya seluruh harga keluar dari kas.
  const r = ramalan({ masuk: 100_000_000, keluar: 100_000_000, saldoAwal: 10_000_000 });
  const saran = advisePurchase(r, 500_000_000, 3, 'MONTHLY');
  assert.equal(saran.requested.affordable, false);
  assert.equal(saran.minimumInstalments, null);
  assert.equal(saran.recommended, null);
});

test('mencicil tidak menolong bila bulan-bulan sesudahnya tetap jebol', () => {
  // Kas menyusut 10 juta per bulan. Tiap cicilan dibayar saat kas masih tebal
  // sehingga semuanya terlihat aman, tetapi setelah harga penuh keluar, saldo
  // beberapa bulan kemudian menembus batas aman. Pemeriksaan yang hanya melihat
  // saat cicilan dibayar akan menyatakan ini aman — dan itu keliru.
  const r = ramalan({ masuk: 100_000_000, keluar: 110_000_000, saldoAwal: 200_000_000, buffer: 50_000_000 });
  const p = planPurchase(r, 100_000_000, 4, 'WEEKLY');
  assert.ok(p.schedule.every((c) => c.safe), 'tiap cicilan seharusnya terlihat aman');
  assert.equal(p.affordable, false);
  assert.equal(p.lowest?.dayOffset, null, 'titik terendah seharusnya sesudah cicilan terakhir');
});

test('jumlah cicilan tidak masuk akal tetap ditangani', () => {
  const r = ramalan({ masuk: 100_000_000, keluar: 90_000_000, saldoAwal: 200_000_000 });
  assert.equal(planPurchase(r, 10_000_000, 0, 'WEEKLY').instalments, 1);
  assert.equal(planPurchase(r, 10_000_000, -5, 'WEEKLY').instalments, 1);
  assert.equal(planPurchase(r, 10_000_000, 999, 'WEEKLY').instalments, 24);
});
