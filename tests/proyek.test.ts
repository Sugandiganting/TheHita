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
  assert.deepEqual(aksiTersedia('FUNDING_REVIEW'), ['SETUJUI_DANA', 'TOLAK']);
  assert.deepEqual(aksiTersedia('APPROVED'), ['BATALKAN']);
  assert.deepEqual(aksiTersedia('ONGOING'), ['SELESAI', 'BATALKAN']);
  assert.deepEqual(aksiTersedia('DONE'), []);
  assert.equal(AKSI_PROYEK.SETUJUI_DANA.ke, 'APPROVED');
});
