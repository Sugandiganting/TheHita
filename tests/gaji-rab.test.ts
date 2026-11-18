import assert from 'node:assert/strict';
import { test } from 'node:test';
import { akunGajiKah, gajiRabBulanIni, lajuOperasionalBerjalan } from '../src/lib/rencana-kas.ts';

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
