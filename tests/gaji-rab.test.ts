import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  akunGajiKah, gajiAwalBulan, gajiRabBulanIni, hitungRencana, hitungRunway, lajuOperasionalBerjalan,
} from '../src/lib/rencana-kas.ts';

/*
 * Gaji dari RAB dibaca lewat COA-nya, lalu dipisah: yang sudah dibayar tidak
 * boleh ikut laju harian, yang belum dibayar tetap harus keluar bulan ini.
 */
const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);

test('akun gaji: kelompok 6130 bertipe PAYROLL saja', () => {
  assert.equal(akunGajiKah({ code: '6130.01', subtype: 'PAYROLL' }), true);
  assert.equal(akunGajiKah({ code: '6130.04', subtype: 'PAYROLL' }), true);
  // 6130.05 Biaya Marketing ada di bawah 6130 tetapi bukan gaji.
  assert.equal(akunGajiKah({ code: '6130.05', subtype: 'MARKETING' }), false);
  // Konsumsi dan rekrutmen bertipe PAYROLL tetapi bukan gaji.
  assert.equal(akunGajiKah({ code: '6181.04', subtype: 'PAYROLL' }), false);
  assert.equal(akunGajiKah({ code: '6130', subtype: 'PAYROLL' }), false);
});

test('gaji yang tanggalnya sudah lewat dianggap sudah keluar, yang belum dianggap akan keluar', () => {
  const hasil = gajiRabBulanIni([
    { amount: 100, planDate: tgl('2026-11-01'), realAmount: null, realDate: null },
    { amount: 50, planDate: tgl('2026-11-18'), realAmount: null, realDate: null },
    { amount: 30, planDate: tgl('2026-11-25'), realAmount: null, realDate: null },
  ], tgl('2026-11-18'));
  assert.deepEqual(hasil, { sudahKeluar: 150, akanKeluar: 30, tanpaTanggal: 0 });
});

test('realisasi yang dilaporkan menang atas anggaran dan tanggal rencananya', () => {
  const hasil = gajiRabBulanIni([
    { amount: 100, planDate: tgl('2026-11-25'), realAmount: 90, realDate: tgl('2026-11-10') },
    { amount: 100, planDate: tgl('2026-11-01'), realAmount: 95, realDate: null },
  ], tgl('2026-11-18'));
  assert.deepEqual(hasil, { sudahKeluar: 185, akanKeluar: 0, tanpaTanggal: 0 });
});

test('baris tanpa tanggal dan tanpa realisasi tidak ditebak', () => {
  const hasil = gajiRabBulanIni([
    { amount: 70, planDate: null, realAmount: null, realDate: null },
  ], tgl('2026-11-18'));
  assert.deepEqual(hasil, { sudahKeluar: 0, akanKeluar: 0, tanpaTanggal: 70 });
});

test('gaji yang sudah keluar tidak ikut terbagi menjadi laju harian', () => {
  // Angka November di database pemilik: keluar 279.779.063 dalam 18 hari,
  // 137.097.914 di antaranya gaji RAB yang sudah jatuh tempo.
  const tanpa = lajuOperasionalBerjalan({
    saldoAwal: 186_521_150, saldoKini: 131_164_015, masukSampaiKini: 224_421_928,
    hari: 18, komitmenTerbayar: 0,
  })!;
  const dengan = lajuOperasionalBerjalan({
    saldoAwal: 186_521_150, saldoKini: 131_164_015, masukSampaiKini: 224_421_928,
    hari: 18, komitmenTerbayar: 137_097_914,
  })!;
  assert.equal(Math.round(tanpa.perHari), 15_543_281);
  assert.equal(Math.round(dengan.perHari), 7_926_731);
});

/* ------------------------------------------------------------------ */
/* Sisa bulan dari kategori, dan gaji awal bulan sebagai batas aman    */
/* ------------------------------------------------------------------ */

test('gaji awal bulan: hanya tanggal 1 sampai 7; tanpa tanggal tetap dijaga', () => {
  // RAB gaji November pemilik: tanggal 1 dan 7 = 55.775.361, tanggal 15 = 81.322.553.
  const hasil = gajiAwalBulan([
    { amount: 10_584_359, tanggal: tgl('2026-12-01') },
    { amount: 18_134_336, tanggal: tgl('2026-12-01') },
    { amount: 17_700_769, tanggal: tgl('2026-12-01') },
    { amount: 9_355_897, tanggal: tgl('2026-12-07') },
    { amount: 81_322_553, tanggal: tgl('2026-12-15') },
  ]);
  assert.deepEqual(hasil, { total: 55_775_361, tanpaTanggal: 0 });
  assert.deepEqual(gajiAwalBulan([{ amount: 100, tanggal: null }]), { total: 100, tanpaTanggal: 100 });
  assert.equal(gajiAwalBulan([{ amount: 100, tanggal: tgl('2026-12-08') }]).total, 0);
});

const rencanaNov = (kategori: Parameters<typeof hitungRencana>[0]['kategori']) => hitungRencana({
  period: '2026-11',
  tanggal: tgl('2026-11-18'),
  saldoKas: 131_164_015,
  masukSampaiKini: 224_421_928,
  proyeksi: { PESIMIS: 326_882_758, NORMAL: 359_571_034, OPTIMIS: 449_463_792 },
  komitmen: [{ label: 'Cicilan Bank', amount: 75_650_000, dueDay: 20, paid: false }],
  kategori,
  terpakai: 0,
  kebutuhanGaji: 55_775_361,
});

test('kategori yang belanjanya sudah menyamai jatah tidak lagi menyumbang uang keluar', () => {
  const r = rencanaNov([
    { label: 'Purchasing', weight: 1, jatah: 300_000_000, terpakaiBulanIni: 113_221_270 },
    { label: 'HR', weight: 1, jatah: 88_982_851, terpakaiBulanIni: 88_982_851 },
    { label: 'Bank Perusahaan', weight: 1, jatah: 77_574_942, terpakaiBulanIni: 77_574_942 },
  ]);
  assert.deepEqual(r.kategori.map((k) => k.akanKeluar), [186_778_730, 0, 0]);
  assert.equal(r.keluarKategori, 186_778_730);
  // Boleh belanja menyisihkan gaji awal Desember saja, bukan seluruh RAB gaji.
  assert.equal(Math.round(r.skenario.NORMAL.bolehBelanja), 134_887_760);
});

test('kategori yang lewat jatah tidak membuat uang keluar minus', () => {
  const r = rencanaNov([{ label: 'X', weight: 1, jatah: 10, terpakaiBulanIni: 25 }]);
  assert.equal(r.kategori[0].akanKeluar, 0);
});

test('kategori bertaut RAB memakai sisa baris yang belum selesai, bukan hanya yang belum tersentuh', () => {
  const r = rencanaNov([{ label: 'HR', weight: 1, jatah: 100, terpakaiBulanIni: 40, belum: 30, akanKeluar: 55 }]);
  assert.equal(r.kategori[0].sisa, 30);
  assert.equal(r.kategori[0].akanKeluar, 55);
});

test('ramalan November: sisa keluar dari kategori menggantikan laju harian', () => {
  const r = hitungRunway({
    period: '2026-11',
    saldoKas: 131_164_015,
    sisaMasuk: 135_149_106,
    proyeksiBulanan: 359_571_034,
    proyeksiBerikutnya: () => 472_711_920,
    pengeluaranBulanan: 335_834_450,
    komitmenBelumBayar: 75_650_000,
    komitmenRutinSebulan: 75_650_000,
    kebutuhanGaji: 55_775_361,
    lajuOperasionalHarian: 7_926_731,
    sisaKeluarRencana: 186_778_730,
    hariTersisa: 12,
    hariSebulan: 30,
  });
  // 131.164.015 + 135.149.106 − 75.650.000 − 186.778.730
  assert.equal(r.bulan[0].saldoAkhir, 3_884_391);
  assert.equal(r.bulan[0].cukupGaji, false);
  // Desember tidak berubah caranya: proyeksi musim − pengeluaran rutin.
  assert.equal(r.bulan[1].saldoAkhir, 3_884_391 + 472_711_920 - 335_834_450);
});
