import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { barisMinggu } from '../src/lib/minggu';
import type { Minggu } from '../src/lib/rencana-kas';

const hari = (d: number, bulan = 10) => new Date(Date.UTC(2026, bulan - 1, d));
const jt = (n: number) => n * 1_000_000;

// Oktober 31 hari, normal Rp 310 jt -> Rp 10 jt per hari.
// November 30 hari, normal Rp 150 jt -> Rp 5 jt per hari.
const proyeksi = [
  { period: '2026-10', normal: jt(310) },
  { period: '2026-11', normal: jt(150) },
];

/** Minggu rencana dari 17 Okt sampai akhir bulan, seperti pecahMinggu membuatnya. */
const minggu: Minggu[] = [
  { mulai: hari(17), selesai: hari(23), hari: 7, plafonDasar: jt(50), tambahan: jt(10), targetMasuk: jt(230) },
  { mulai: hari(24), selesai: hari(31), hari: 8, plafonDasar: jt(60), tambahan: 0, targetMasuk: jt(310) },
];

const laporan = [
  { date: hari(9), incomeToDate: jt(100) },
  { date: hari(16), incomeToDate: jt(250) },
];

const pokok = { period: '2026-10', hariIni: hari(22), minggu, laporan, proyeksi };

test('baris ke belakang mengikuti laporan, bukan potongan tujuh harian', () => {
  const { baris } = barisMinggu(pokok);
  const lalu = baris.filter((b) => b.lalu);

  assert.equal(lalu.length, 2);
  assert.deepEqual(lalu.map((b) => b.hari), [9, 7], 'baris pertama 1–9 Okt, lalu 10–16 Okt');
  assert.equal(lalu[0].mulai.getUTCDate(), 1, 'mulai dari awal bulan, bukan dari laporan pertama');
  assert.equal(lalu[1].selesai.getUTCDate(), 16);
});

test('uang masuk tiap baris adalah selisih dua laporan', () => {
  const lalu = barisMinggu(pokok).baris.filter((b) => b.lalu);
  assert.equal(lalu[0].masuk, jt(100));
  assert.equal(lalu[1].masuk, jt(150), '250 dikurangi 100');
});

test('target dihitung per hari, jadi baris sembilan hari bukan seminggu penuh', () => {
  const lalu = barisMinggu(pokok).baris.filter((b) => b.lalu);
  assert.equal(lalu[0].target, jt(90), '9 hari x Rp 10 jt');
  assert.equal(lalu[1].target, jt(70), '7 hari x Rp 10 jt');
});

test('ringkasan menjumlahkan yang sudah dilaporkan saja', () => {
  const r = barisMinggu(pokok);
  assert.equal(r.masukLalu, jt(250));
  assert.equal(r.targetLalu, jt(160));
  assert.equal(r.selisihLalu, jt(90), 'lebih cepat Rp 90 jt daripada target sampai 16 Okt');
});

test('baris ke depan memakai rencana apa adanya', () => {
  const depan = barisMinggu(pokok).baris.filter((b) => !b.lalu);
  assert.equal(depan[0].plafonDasar, jt(50));
  assert.equal(depan[0].tambahan, jt(10));
  assert.equal(depan[0].targetKumulatif, jt(230), 'ambang pembuka tambahan ikut terbawa');
  assert.equal(depan[1].targetKumulatif, null, 'tanpa tambahan tidak ada ambang');
  assert.equal(depan[0].masuk, null, 'yang belum terjadi tidak punya angka nyata');
});

test('sisa bulan yang kurang dari empat minggu disambung ke bulan berikutnya', () => {
  const depan = barisMinggu(pokok).baris.filter((b) => !b.lalu);

  assert.equal(depan.length, 4);
  assert.equal(depan[2].mulai.getUTCMonth(), 10, 'baris ketiga sudah di November');
  assert.equal(depan[2].plafonDasar, null, 'jatah bulan depan belum dihitung');
  assert.equal(depan[2].dalamBulan, false);
  assert.equal(depan[2].target, jt(35), '7 hari x Rp 5 jt, memakai laju November');
});

test('baris yang menyeberang pergantian bulan memakai laju kedua bulannya', () => {
  // Laporan terakhir 24 Okt -> rencana 25–31 Okt, sambungannya 1–7 Nov dst.
  const r = barisMinggu({
    ...pokok,
    hariIni: hari(26),
    laporan: [{ date: hari(24), incomeToDate: jt(300) }],
    minggu: [
      { mulai: hari(25), selesai: hari(31), hari: 7, plafonDasar: jt(40), tambahan: 0, targetMasuk: jt(310) },
    ],
  });
  const depan = r.baris.filter((b) => !b.lalu);
  assert.equal(depan.length, 4);
  assert.equal(depan[0].target, jt(70), '25–31 Okt, tujuh hari Oktober');
  assert.equal(depan[1].target, jt(35), '1–7 Nov, tujuh hari November');
});

test('minggu yang sedang berjalan hanya satu, dan selalu yang ke depan', () => {
  const { baris } = barisMinggu(pokok);
  const berjalan = baris.filter((b) => b.berjalan);
  assert.equal(berjalan.length, 1);
  assert.equal(berjalan[0].mulai.getUTCDate(), 17, '22 Okt ada di baris 17–23');
  assert.equal(berjalan[0].lalu, false);
});

test('laporan bertanggal hari ini tidak menyisakan minggu berjalan', () => {
  const { baris } = barisMinggu({ ...pokok, hariIni: hari(16) });
  assert.equal(baris.filter((b) => b.berjalan).length, 0);
});

test('laporan di luar bulan rencana diabaikan', () => {
  const { baris } = barisMinggu({
    ...pokok,
    laporan: [...laporan, { date: hari(3, 11), incomeToDate: jt(999) }],
  });
  assert.equal(baris.filter((b) => b.lalu).length, 2);
});

test('koreksi yang menurunkan angka kumulatif tampil apa adanya', () => {
  const { baris } = barisMinggu({
    ...pokok,
    laporan: [
      { date: hari(9), incomeToDate: jt(100) },
      { date: hari(16), incomeToDate: jt(80) },
    ],
  });
  assert.equal(baris.filter((b) => b.lalu)[1].masuk, jt(-20));
});

test('tanpa rencana sisa bulan, empat baris ke depan tetap terbentuk', () => {
  const { baris } = barisMinggu({ ...pokok, minggu: [], hariIni: hari(31) });
  const depan = baris.filter((b) => !b.lalu);
  assert.equal(depan.length, 4);
  assert.equal(depan[0].mulai.getUTCDate(), 17, 'menyambung sehari setelah laporan terakhir');
});
