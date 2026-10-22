import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { lajuHarian } from '../src/lib/laju-harian';

const jt = (n: number) => n * 1_000_000;

test('laju bulan berjalan adalah uang masuk dibagi hari yang sudah lewat', () => {
  const l = lajuHarian(jt(250), 16, []);
  assert.equal(l.bulanIni, jt(250) / 16);
  assert.equal(l.hariBulanIni, 16);
  assert.equal(l.riwayat, null, 'tanpa riwayat tidak ada pembanding');
  assert.equal(l.selisihPersen, null);
});

test('rata-rata riwayat memakai seluruh masuk dibagi seluruh hari', () => {
  // Sep 30 hari, Okt 31 hari. Rata-ratanya bukan rata-rata dari dua laju.
  const l = lajuHarian(0, 1, [
    { period: '2026-08', cashIn: jt(310) }, // 31 hari -> 10 jt/hari
    { period: '2026-09', cashIn: jt(300) }, // 30 hari -> 10 jt/hari
  ]);
  assert.equal(l.riwayat, jt(610) / 61);
  assert.equal(l.bulanRiwayat, 2);
  assert.equal(l.dari, '2026-08');
  assert.equal(l.sampai, '2026-09');
});

test('bulan berhari lebih sedikit tidak terlihat lebih sepi', () => {
  // Februari Rp 280 jt dan Januari Rp 310 jt sama-sama Rp 10 jt per hari.
  const l = lajuHarian(0, 1, [
    { period: '2027-01', cashIn: jt(310) },
    { period: '2027-02', cashIn: jt(280) },
  ]);
  assert.equal(l.riwayat, jt(10));
});

test('bulan tanpa uang masuk diabaikan, bukan dihitung nol', () => {
  const l = lajuHarian(0, 1, [
    { period: '2026-08', cashIn: 0 },
    { period: '2026-09', cashIn: jt(300) },
  ]);
  assert.equal(l.bulanRiwayat, 1);
  assert.equal(l.riwayat, jt(300) / 30);
  assert.equal(l.dari, '2026-09');
});

test('selisih persen membandingkan bulan berjalan dengan riwayatnya', () => {
  // Bulan ini Rp 12 jt per hari, riwayat Rp 10 jt per hari -> +20%.
  const l = lajuHarian(jt(120), 10, [{ period: '2026-09', cashIn: jt(300) }]);
  assert.equal(l.bulanIni, jt(12));
  assert.equal(l.riwayat, jt(10));
  assert.equal(Math.round(l.selisihPersen!), 20);
});

test('laporan bertanggal nol tidak membagi dengan nol', () => {
  const l = lajuHarian(jt(100), 0, []);
  assert.equal(l.bulanIni, 0);
  assert.ok(Number.isFinite(l.bulanIni));
});
