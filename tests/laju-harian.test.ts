import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { dariJurnal, lajuHarian } from '../src/lib/laju-harian';

const jt = (n: number) => n * 1_000_000;
const kosong = { laporan: [], jurnal: [] };

test('laju bulan berjalan adalah uang masuk dibagi hari yang sudah lewat', () => {
  const l = lajuHarian(jt(250), 16, kosong);
  assert.equal(l.bulanIni, jt(250) / 16);
  assert.equal(l.hariBulanIni, 16);
  assert.equal(l.riwayat, null, 'tanpa riwayat tidak ada pembanding');
  assert.equal(l.sumber, null);
  assert.equal(l.selisihPersen, null);
});

test('laporan posisi kas didahulukan daripada jurnal', () => {
  const l = lajuHarian(0, 1, {
    laporan: [{ period: '2026-09', masuk: jt(240), hari: 24 }], // Rp 10 jt/hari
    jurnal: dariJurnal([{ period: '2026-09', cashIn: jt(900) }]), // Rp 30 jt/hari
  });
  assert.equal(l.sumber, 'LAPORAN');
  assert.equal(l.riwayat, jt(10), 'angka jurnal tidak ikut sama sekali');
});

test('jurnal dipakai hanya bila belum ada laporan bulan sebelumnya', () => {
  const l = lajuHarian(0, 1, {
    laporan: [],
    jurnal: dariJurnal([{ period: '2026-09', cashIn: jt(300) }]),
  });
  assert.equal(l.sumber, 'JURNAL');
  assert.equal(l.riwayat, jt(10), '30 hari September');
});

test('laporan yang belum ada uang masuknya tidak menghalangi jurnal', () => {
  const l = lajuHarian(0, 1, {
    laporan: [{ period: '2026-09', masuk: 0, hari: 20 }],
    jurnal: dariJurnal([{ period: '2026-09', cashIn: jt(300) }]),
  });
  assert.equal(l.sumber, 'JURNAL');
});

test('kedua sumber tidak pernah dicampur dalam satu rata-rata', () => {
  const l = lajuHarian(0, 1, {
    laporan: [{ period: '2026-09', masuk: jt(240), hari: 24 }],
    jurnal: dariJurnal([
      { period: '2026-08', cashIn: jt(900) },
      { period: '2026-09', cashIn: jt(900) },
    ]),
  });
  assert.equal(l.bulanRiwayat, 1, 'hanya bulan dari laporan yang terhitung');
  assert.equal(l.dari, '2026-09');
  assert.equal(l.sampai, '2026-09');
});

test('rata-rata memakai seluruh masuk dibagi seluruh hari', () => {
  // Bukan rata-rata dari dua laju: panjang periodenya berbeda.
  const l = lajuHarian(0, 1, {
    laporan: [
      { period: '2026-08', masuk: jt(100), hari: 10 }, // 10 jt/hari
      { period: '2026-09', masuk: jt(600), hari: 30 }, // 20 jt/hari
    ],
    jurnal: [],
  });
  assert.equal(l.riwayat, jt(700) / 40, 'tertimbang menurut harinya, bukan 15 jt');
  assert.equal(l.bulanRiwayat, 2);
  assert.equal(l.dari, '2026-08');
  assert.equal(l.sampai, '2026-09');
});

test('bulan berhari lebih sedikit tidak terlihat lebih sepi', () => {
  // Februari Rp 280 jt dan Januari Rp 310 jt sama-sama Rp 10 jt per hari.
  const l = lajuHarian(0, 1, {
    laporan: [],
    jurnal: dariJurnal([
      { period: '2027-01', cashIn: jt(310) },
      { period: '2027-02', cashIn: jt(280) },
    ]),
  });
  assert.equal(l.riwayat, jt(10));
});

test('bulan tanpa uang masuk diabaikan, bukan dihitung nol', () => {
  const l = lajuHarian(0, 1, {
    laporan: [
      { period: '2026-08', masuk: 0, hari: 31 },
      { period: '2026-09', masuk: jt(300), hari: 30 },
    ],
    jurnal: [],
  });
  assert.equal(l.bulanRiwayat, 1);
  assert.equal(l.riwayat, jt(10));
  assert.equal(l.dari, '2026-09');
});

test('selisih persen membandingkan bulan berjalan dengan riwayatnya', () => {
  // Bulan ini Rp 12 jt per hari, riwayat Rp 10 jt per hari -> +20%.
  const l = lajuHarian(jt(120), 10, {
    laporan: [{ period: '2026-09', masuk: jt(300), hari: 30 }],
    jurnal: [],
  });
  assert.equal(l.bulanIni, jt(12));
  assert.equal(l.riwayat, jt(10));
  assert.equal(Math.round(l.selisihPersen!), 20);
});

test('laporan bertanggal nol tidak membagi dengan nol', () => {
  const l = lajuHarian(jt(100), 0, kosong);
  assert.equal(l.bulanIni, 0);
  assert.ok(Number.isFinite(l.bulanIni));
});
