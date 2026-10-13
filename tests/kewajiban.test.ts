import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  berikutnya, kejadian, kejadianBulan, kewajibanPada, kewajibanSetelah,
  labelPengulangan, setelahDilunasi, type Kewajiban,
} from '../src/lib/kewajiban';

const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);
const hari = (d: Date) => d.toISOString().slice(0, 10);

/** Samsat tahunan sebuah kendaraan rental. */
const samsat: Kewajiban = {
  label: 'Samsat DK 1234 XY',
  amount: 3_500_000,
  dueDate: tgl('2026-03-14'),
  repeat: 'TAHUNAN',
  repeatEvery: 1,
  active: true,
  paidUntil: null,
};

test('kewajiban tahunan berulang pada tanggal yang sama tiap tahun', () => {
  const daftar = kejadian(samsat, tgl('2026-01-01'), tgl('2030-01-01'));
  assert.deepEqual(
    daftar.map((e) => hari(e.jatuhTempo)),
    ['2026-03-14', '2027-03-14', '2028-03-14', '2029-03-14'],
  );
});

test('STNK lima tahunan memakai pengulangan yang sama dengan langkah lima', () => {
  const stnk: Kewajiban = { ...samsat, label: 'STNK 5 tahunan', amount: 9_000_000, repeatEvery: 5 };
  const daftar = kejadian(stnk, tgl('2026-01-01'), tgl('2037-01-01'));
  assert.deepEqual(daftar.map((e) => hari(e.jatuhTempo)), ['2026-03-14', '2031-03-14', '2036-03-14']);
});

test('kewajiban sekali saja hanya muncul satu kali', () => {
  const sekali: Kewajiban = { ...samsat, repeat: 'SEKALI' };
  assert.equal(kejadian(sekali, tgl('2026-01-01'), tgl('2032-01-01')).length, 1);
});

test('tanggal 31 tidak melompat bulan pada pengulangan bulanan', () => {
  const bulanan: Kewajiban = { ...samsat, dueDate: tgl('2026-01-31'), repeat: 'BULANAN' };
  const daftar = kejadian(bulanan, tgl('2026-01-01'), tgl('2026-05-01'));
  assert.deepEqual(
    daftar.map((e) => hari(e.jatuhTempo)),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
  );
});

test('29 Februari ditarik ke 28 pada tahun biasa', () => {
  const kabisat: Kewajiban = { ...samsat, dueDate: tgl('2028-02-29') };
  const daftar = kejadian(kabisat, tgl('2028-01-01'), tgl('2031-01-01'));
  assert.deepEqual(daftar.map((e) => hari(e.jatuhTempo)), ['2028-02-29', '2029-02-28', '2030-02-28']);
});

test('yang sudah dilunasi tidak lagi memukul ramalan', () => {
  const dibayar: Kewajiban = { ...samsat, paidUntil: tgl('2026-03-14') };
  const daftar = kejadian(dibayar, tgl('2026-01-01'), tgl('2028-01-01'));
  assert.deepEqual(daftar.map((e) => hari(e.jatuhTempo)), ['2027-03-14'], 'tinggal tahun depannya');
  assert.equal(kewajibanPada([dibayar], '2026-03'), 0);
});

test('kewajiban yang dinonaktifkan tidak menghasilkan apa-apa', () => {
  assert.deepEqual(kejadian({ ...samsat, active: false }, tgl('2026-01-01'), tgl('2030-01-01')), []);
  assert.equal(berikutnya({ ...samsat, active: false }, tgl('2026-01-01')), null);
});

test('jumlah sebulan menghitung seluruh kewajiban yang jatuh tempo di bulan itu', () => {
  const lain: Kewajiban = { ...samsat, label: 'PBB', amount: 12_000_000, dueDate: tgl('2026-03-31') };
  assert.equal(kewajibanPada([samsat, lain], '2026-03'), 15_500_000);
  assert.equal(kewajibanPada([samsat, lain], '2026-04'), 0);
});

test('yang jatuh tempo sebelum posisi kas tidak dihitung dua kali', () => {
  const lain: Kewajiban = { ...samsat, label: 'PBB', amount: 12_000_000, dueDate: tgl('2026-03-31') };
  // Posisi kas 20 Maret: samsat tanggal 14 sudah tercermin di saldonya.
  assert.equal(kewajibanSetelah([samsat, lain], '2026-03', tgl('2026-03-20')), 12_000_000);
  assert.equal(kewajibanSetelah([samsat, lain], '2026-03', tgl('2026-03-01')), 15_500_000);
  assert.equal(kewajibanSetelah([samsat, lain], '2026-03', tgl('2026-03-31')), 0, 'tepat pada tanggalnya sudah masuk saldo');
});

test('kejadian sebulan urut menurut tanggal dan membawa labelnya', () => {
  const lain: Kewajiban = { ...samsat, label: 'PBB', amount: 12_000_000, dueDate: tgl('2026-03-02') };
  assert.deepEqual(kejadianBulan([samsat, lain], '2026-03').map((e) => e.label), ['PBB', 'Samsat DK 1234 XY']);
});

test('jatuh tempo berikutnya dihitung dari tanggal yang diberikan', () => {
  assert.equal(hari(berikutnya(samsat, tgl('2026-01-01'))!.jatuhTempo), '2026-03-14');
  assert.equal(hari(berikutnya(samsat, tgl('2026-03-14'))!.jatuhTempo), '2026-03-14', 'hari H masih dihitung');
  assert.equal(hari(berikutnya(samsat, tgl('2026-03-15'))!.jatuhTempo), '2027-03-14');
  assert.equal(berikutnya({ ...samsat, repeat: 'SEKALI' }, tgl('2026-03-15')), null);
});

test('setelah dilunasi, yang berulang bergeser dan yang sekali saja habis', () => {
  assert.equal(hari(setelahDilunasi(samsat, tgl('2026-03-14'))!), '2027-03-14');
  assert.equal(setelahDilunasi({ ...samsat, repeat: 'SEKALI' }, tgl('2026-03-14')), null);
});

test('label pengulangan menyebut langkahnya hanya bila lebih dari satu', () => {
  assert.equal(labelPengulangan('TAHUNAN', 1), 'tiap tahun');
  assert.equal(labelPengulangan('TAHUNAN', 5), 'tiap 5 tahun');
  assert.equal(labelPengulangan('BULANAN', 1), 'tiap bulan');
  assert.equal(labelPengulangan('SEKALI', 1), 'sekali saja');
});

test('nominal nol tidak menghasilkan kejadian apa pun', () => {
  assert.deepEqual(kejadian({ ...samsat, amount: 0 }, tgl('2026-01-01'), tgl('2030-01-01')), []);
});
