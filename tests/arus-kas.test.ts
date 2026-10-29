import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { arusKasBulanan } from '../src/lib/arus-kas';

const jt = (n: number) => n * 1_000_000;
const tgl = (teks: string) => new Date(`${teks}T00:00:00.000Z`);

const laporan = [
  { period: '2026-08', tanggal: tgl('2026-08-31'), saldo: jt(180), masuk: jt(465) },
  { period: '2026-09', tanggal: tgl('2026-09-28'), saldo: jt(195), masuk: jt(420) },
  { period: '2026-10', tanggal: tgl('2026-10-23'), saldo: jt(143), masuk: jt(291) },
];

test('net adalah selisih saldo, dan keluar diturunkan dari masuk dikurangi net', () => {
  const a = arusKasBulanan(laporan);

  const september = a[1];
  assert.equal(september.saldoAwal, jt(180));
  assert.equal(september.net, jt(15), '195 dikurangi 180');
  assert.equal(september.keluar, jt(405), '420 dikurangi 15');
  // Ketiganya tidak mungkin tidak cocok: itulah gunanya menurunkan keluar.
  assert.equal(september.masuk - september.keluar!, september.net);
});

test('bulan yang kasnya menyusut menghasilkan net negatif', () => {
  const oktober = arusKasBulanan(laporan)[2];
  assert.equal(oktober.net, jt(-52), '143 dikurangi 195');
  assert.equal(oktober.keluar, jt(343), 'keluar melebihi masuk');
  assert.ok(oktober.net! < 0);
});

test('bulan pertama tidak punya pembanding, jadi tidak dikarang netnya', () => {
  const agustus = arusKasBulanan(laporan)[0];
  assert.equal(agustus.saldoAwal, null);
  assert.equal(agustus.net, null);
  assert.equal(agustus.keluar, null);
  assert.equal(agustus.masuk, jt(465), 'uang masuknya tetap diketahui');
});

test('bulan yang dilompati memutus rantai, bukan dijembatani diam-diam', () => {
  // Tanpa penjagaan ini, "net" Oktober akan memuat dua bulan sekaligus
  // tetapi tertulis sebagai net sebulan — salah tanpa terlihat salah.
  const a = arusKasBulanan([laporan[0], laporan[2]]);
  assert.equal(a[1].period, '2026-10');
  assert.equal(a[1].net, null);
  assert.equal(a[1].saldoAwal, null);
});

test('pergantian tahun tetap tersambung', () => {
  const a = arusKasBulanan([
    { period: '2026-12', tanggal: tgl('2026-12-31'), saldo: jt(200), masuk: jt(500) },
    { period: '2027-01', tanggal: tgl('2027-01-31'), saldo: jt(260), masuk: jt(480) },
  ]);
  assert.equal(a[1].net, jt(60));
  assert.equal(a[1].keluar, jt(420));
});

test('urutan masukan tidak memengaruhi hasilnya', () => {
  const terbalik = arusKasBulanan([...laporan].reverse());
  assert.deepEqual(terbalik.map((x) => x.period), ['2026-08', '2026-09', '2026-10']);
  assert.equal(terbalik[2].net, jt(-52));
});

test('tanggal kedua ujungnya ikut terbawa supaya bisa ditulis di layar', () => {
  const oktober = arusKasBulanan(laporan)[2];
  assert.equal(oktober.tanggalAwal?.toISOString().slice(0, 10), '2026-09-28');
  assert.equal(oktober.tanggal.toISOString().slice(0, 10), '2026-10-23');
});
