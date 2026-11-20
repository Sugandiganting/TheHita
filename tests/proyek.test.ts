import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bacaJumlah, hargaSatuanItem, totalItemProyek } from '../src/lib/proyek.ts';

test('total item = jumlah × harga satuan', () => {
  assert.equal(totalItemProyek(4, 2_500_000), 10_000_000);
  assert.equal(totalItemProyek(1.5, 1_000_001), 1_500_001.5);
});

test('item lama tanpa harga satuan memakai nominalnya', () => {
  assert.equal(hargaSatuanItem({ quantity: 1, unitPrice: null, amount: 5_000_000 }), 5_000_000);
  assert.equal(hargaSatuanItem({ quantity: 3, unitPrice: 200, amount: 600 }), 200);
});

test('jumlah boleh pecahan dengan koma atau titik', () => {
  assert.equal(bacaJumlah('1,5'), 1.5);
  assert.equal(bacaJumlah('2.25'), 2.25);
  assert.equal(bacaJumlah('abc'), 0);
});

/* Alur persetujuan proyek */
import { aksiTersedia, AKSI_PROYEK, statusBaku, statusEfektif } from '../src/lib/proyek.ts';

const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);

test('status lama "Direncanakan" dibaca Approved supaya tetap memotong kas', () => {
  assert.equal(statusBaku('PLANNED'), 'APPROVED');
  assert.equal(statusBaku('PROPOSED'), 'PROPOSED');
  assert.equal(statusBaku('ANEH'), 'DRAFT');
});

test('Approved menjadi In Progress begitu tanggal mulai tiba', () => {
  assert.equal(statusEfektif('APPROVED', tgl('2026-12-01'), tgl('2026-11-30')), 'APPROVED');
  assert.equal(statusEfektif('APPROVED', tgl('2026-12-01'), tgl('2026-12-01')), 'ONGOING');
  assert.equal(statusEfektif('FUNDING_REVIEW', tgl('2026-12-01'), tgl('2027-01-01')), 'FUNDING_REVIEW');
});

test('tiap tahap hanya membuka langkah berikutnya', () => {
  assert.deepEqual(aksiTersedia('DRAFT'), ['AJUKAN']);
  assert.deepEqual(aksiTersedia('PROPOSED'), ['SETUJUI_RENCANA', 'TOLAK', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTersedia('FUNDING_REVIEW'), ['SETUJUI_DANA', 'TOLAK', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTersedia('APPROVED'), ['BATALKAN', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTersedia('ONGOING'), ['SELESAI', 'BATALKAN']);
  assert.deepEqual(aksiTersedia('DONE'), []);
  assert.equal(AKSI_PROYEK.SETUJUI_DANA.ke, 'APPROVED');
});

/* Realisasi item: pembayaran sebagian, status selesai, selisih terhadap rencana */
import { rekapRealisasiItem } from '../src/lib/proyek.ts';

test('belum ada pembayaran: seluruh total masih akan keluar', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: false }, []);
  assert.equal(r.status, 'BELUM');
  assert.equal(r.sisaAkanKeluar, 10_000_000);
  assert.equal(r.selisih, null);
});

test('dibayar sebagian: sisanya masih akan keluar, selisih belum dihitung', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: false }, [{ amount: 3_000_000 }, { amount: 2_000_000 }]);
  assert.equal(r.status, 'SEBAGIAN');
  assert.equal(r.realisasi, 5_000_000);
  assert.equal(r.sisaAkanKeluar, 5_000_000);
  assert.equal(r.selisih, null);
});

test('selesai lebih murah: tidak ada lagi yang keluar, selisihnya hemat', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: true }, [{ amount: 8_500_000 }]);
  assert.equal(r.status, 'SELESAI');
  assert.equal(r.sisaAkanKeluar, 0);
  assert.equal(r.selisih, 1_500_000);
});

test('selesai lebih mahal: selisih negatif', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: true }, [{ amount: 11_200_000 }]);
  assert.equal(r.selisih, -1_200_000);
});

test('dibayar melebihi total tetapi belum selesai: sisa tidak minus', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: false }, [{ amount: 12_000_000 }]);
  assert.equal(r.sisaAkanKeluar, 0);
});

test('tanda Lunas lama tanpa pembayaran dibaca selesai sebesar totalnya', () => {
  const r = rekapRealisasiItem({ amount: 2_000_000, paid: true, done: false }, []);
  assert.equal(r.status, 'SELESAI');
  assert.equal(r.realisasi, 2_000_000);
  assert.equal(r.selisih, 0);
  assert.equal(r.dariLunasLama, true);
});

import { realisasiDibuka } from '../src/lib/proyek.ts';
test('realisasi baru dibuka setelah dana disetujui', () => {
  for (const s of ['DRAFT', 'PROPOSED', 'FUNDING_REVIEW', 'REJECTED'] as const) assert.equal(realisasiDibuka(s), false, s);
  for (const s of ['APPROVED', 'ONGOING', 'DONE', 'CANCELLED'] as const) assert.equal(realisasiDibuka(s), true, s);
});
