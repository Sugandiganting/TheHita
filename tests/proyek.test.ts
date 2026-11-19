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
