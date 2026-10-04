import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  barisMasukScope, cabangDalamScope, periodeBerikutnya, ringkasRab,
  scopeBersamaKah, type BarisRab, type BarisRealisasi,
} from '../src/lib/rab.ts';

/**
 * Aturan pencocokan anggaran dengan realisasi. Yang paling menentukan: biaya
 * yang ditanggung beberapa cabang tidak boleh dihitung sebagai realisasi
 * cabangnya — kalau ikut, selisih anggaran tiap cabang jadi tidak bermakna.
 */

const baris = (o: Partial<BarisRealisasi>): BarisRealisasi => ({
  accountId: 'a1', unitCode: 'THL', sharedGroup: null, debit: 0, credit: 0, ...o,
});

test('biaya milik cabang sendiri masuk ke RAB cabang itu', () => {
  assert.equal(barisMasukScope(baris({ unitCode: 'THL' }), 'THL'), true);
  assert.equal(barisMasukScope(baris({ unitCode: 'SKR' }), 'THL'), false);
});

test('biaya bersama TIDAK dihitung sebagai realisasi cabang', () => {
  // Gaji staf yang bekerja di Legian dan Sri Krisna tersimpan dengan unit THL,
  // tetapi bertanda THL+SKR. Legian tidak bisa mengendalikannya sendiri.
  const gajiBersama = baris({ unitCode: 'THL', sharedGroup: 'THL+SKR' });
  assert.equal(barisMasukScope(gajiBersama, 'THL'), false);
  assert.equal(barisMasukScope(gajiBersama, 'THL+SKR'), true);
});

test('RAB kelompok penanggung mengumpulkan porsi seluruh cabangnya', () => {
  const porsiLegian = baris({ unitCode: 'THL', sharedGroup: 'THL+SKR' });
  const porsiSriKrisna = baris({ unitCode: 'SKR', sharedGroup: 'THL+SKR' });
  assert.equal(barisMasukScope(porsiLegian, 'THL+SKR'), true);
  assert.equal(barisMasukScope(porsiSriKrisna, 'THL+SKR'), true);
});

test('kelompok lain tidak ikut tercampur', () => {
  const listrik = baris({ unitCode: 'THU', sharedGroup: 'THU+IGYT' });
  assert.equal(barisMasukScope(listrik, 'THL+SKR'), false);
  assert.equal(barisMasukScope(listrik, 'THU'), false);
});

test('scope bersama dikenali dari namanya', () => {
  assert.equal(scopeBersamaKah('THL+SKR'), true);
  assert.equal(scopeBersamaKah('THL'), false);
  assert.deepEqual(cabangDalamScope('THL+SKR'), ['THL', 'SKR']);
  assert.deepEqual(cabangDalamScope('THU'), ['THU']);
});

/* ---------------- Ringkasan anggaran vs realisasi ---------------- */

const b = (kode: string, anggaran: number, realisasi: number): BarisRab =>
  ({ accountId: kode, accountCode: kode, accountName: kode, anggaran, realisasi });

test('sisa anggaran dan persentase terpakai', () => {
  const r = ringkasRab([b('6150.05', 2_000_000, 1_583_270)]);
  assert.equal(r.baris[0].sisa, 416_730);
  assert.equal(Math.round(r.baris[0].terpakaiPct!), 79);
  assert.equal(r.baris[0].lewat, false);
});

test('realisasi melebihi anggaran ditandai, sisanya negatif', () => {
  const r = ringkasRab([b('6150.05', 1_000_000, 1_250_000)]);
  assert.equal(r.baris[0].sisa, -250_000);
  assert.equal(r.baris[0].lewat, true);
  assert.equal(r.jumlahLewat, 1);
});

test('akun yang terpakai tanpa pernah dianggarkan tetap muncul', () => {
  // Menyembunyikannya membuat total realisasi di laporan tidak sama dengan
  // beban yang benar-benar terjadi.
  const r = ringkasRab([b('6150.05', 1_000_000, 900_000), b('6160.01', 0, 450_000)]);
  assert.equal(r.baris.length, 2);
  assert.equal(r.baris[1].takDianggarkan, true);
  assert.equal(r.baris[1].terpakaiPct, null);
  assert.equal(r.jumlahTakDianggarkan, 1);
  assert.equal(r.totalRealisasi, 1_350_000, 'total realisasi harus memuat yang tak dianggarkan');
});

test('akun yang tak dianggarkan tidak dihitung dua kali sebagai lewat anggaran', () => {
  const r = ringkasRab([b('6160.01', 0, 450_000)]);
  assert.equal(r.jumlahTakDianggarkan, 1);
  assert.equal(r.jumlahLewat, 0);
});

test('anggaran yang belum terpakai sama sekali', () => {
  const r = ringkasRab([b('6150.05', 1_000_000, 0)]);
  assert.equal(r.baris[0].sisa, 1_000_000);
  assert.equal(r.baris[0].terpakaiPct, 0);
  assert.equal(r.baris[0].takDianggarkan, false);
});

test('total dan persentase keseluruhan', () => {
  const r = ringkasRab([b('A', 1_000_000, 500_000), b('B', 3_000_000, 2_500_000)]);
  assert.equal(r.totalAnggaran, 4_000_000);
  assert.equal(r.totalRealisasi, 3_000_000);
  assert.equal(r.totalSisa, 1_000_000);
  assert.equal(r.terpakaiPct, 75);
});

test('RAB kosong tidak membuat pembagian nol', () => {
  const r = ringkasRab([]);
  assert.equal(r.totalAnggaran, 0);
  assert.equal(r.terpakaiPct, null);
});

/* ---------------- Duplikat ke bulan berikutnya ---------------- */

test('bulan berikutnya, termasuk lompat tahun', () => {
  assert.equal(periodeBerikutnya('2026-01'), '2026-02');
  assert.equal(periodeBerikutnya('2026-09'), '2026-10');
  assert.equal(periodeBerikutnya('2026-12'), '2027-01');
});
