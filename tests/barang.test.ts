import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalKode, normalNama, periksaItem, pesanKembar, type MasukanItem } from '../src/lib/barang';

const sah: MasukanItem = {
  code: 'CHEM-01', name: 'Chemical Lantai', categoryId: 'kat-opex',
  subCategoryId: null, unitId: 'sat-liter', accountId: 'akun-hk',
};

test('kode dirapikan supaya satu barang tidak jadi dua', () => {
  // "chem 01" dan "CHEM-01" diketik dua orang berbeda untuk barang yang sama.
  assert.equal(normalKode('chem 01'), 'CHEM-01');
  assert.equal(normalKode('  CHEM-01  '), 'CHEM-01');
  assert.equal(normalKode('chem   01'), 'CHEM-01');
});

test('nama hanya dirapikan spasinya, hurufnya tidak diubah', () => {
  assert.equal(normalNama('  Chemical   Lantai '), 'Chemical Lantai');
  assert.equal(normalNama('pH Minus'), 'pH Minus', 'huruf besar-kecil milik yang mengetik');
});

test('item yang lengkap lolos', () => {
  assert.equal(periksaItem(sah), null);
});

test('kategori wajib, dan alasannya disebut', () => {
  const pesan = periksaItem({ ...sah, categoryId: '' });
  assert.ok(pesan?.includes('Kategori wajib'));
  // Kategorilah yang mengunci kode, jadi tanpa kategori aturan kembarnya
  // tidak bisa ditegakkan sama sekali.
  assert.ok(pesan?.includes('kode'), 'menyebut akibatnya, bukan hanya kewajibannya');
});

test('akun COA wajib — tanpa itu RAB tidak tahu dibebankan ke mana', () => {
  assert.ok(periksaItem({ ...sah, accountId: '' })?.includes('Akun COA wajib'));
});

test('satuan wajib', () => {
  assert.ok(periksaItem({ ...sah, unitId: '' })?.includes('Satuan wajib'));
});

test('kode dengan bentuk yang tidak dikenal ditolak', () => {
  assert.ok(periksaItem({ ...sah, code: '' })?.includes('wajib diisi'));
  assert.ok(periksaItem({ ...sah, code: '-AWAL' })?.includes('diawali huruf atau angka'));
  assert.ok(periksaItem({ ...sah, code: 'A'.repeat(33) })?.includes('1–32 karakter'));
});

test('sub kategori boleh kosong', () => {
  assert.equal(periksaItem({ ...sah, subCategoryId: null }), null);
});

test('nama terlalu panjang ditolak', () => {
  assert.ok(periksaItem({ ...sah, name: 'x'.repeat(121) })?.includes('terlalu panjang'));
});

test('pesan kembar menyebut kategorinya, dan bahwa kategori lain boleh', () => {
  const kode = pesanKembar(['categoryId', 'code'], 'Opex', { code: 'CHEM-01', name: 'Chemical' });
  assert.ok(kode.includes('CHEM-01'));
  assert.ok(kode.includes('Opex'));
  assert.ok(kode.includes('kategori lain'), 'menyebut bahwa pengulangan antar kategori justru diizinkan');

  const nama = pesanKembar(['categoryId', 'name'], 'Proyek', { code: 'X', name: 'Semen' });
  assert.ok(nama.includes('Semen'));
  assert.ok(nama.includes('Proyek'));
});
