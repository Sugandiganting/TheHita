import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalKode, normalNama, periksaItem, pesanKembar, type MasukanItem } from '../src/lib/barang';

const sah: MasukanItem = {
  code: 'CHEM-01', name: 'Chemical Lantai', categoryId: 'kat-opex',
  subCategoryId: 'sub-hk', unitId: 'sat-liter', accountId: 'akun-hk',
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

test('sub kategori wajib — di situlah departemen yang menentukan akun bebannya', () => {
  const pesan = periksaItem({ ...sah, subCategoryId: '' });
  assert.ok(pesan?.includes('Sub kategori wajib'));
  // Yang perlu dimengerti bukan cuma bahwa kolomnya wajib, tetapi bahwa satu
  // kode yang dipakai dua departemen memang didaftarkan dua kali.
  assert.ok(pesan?.includes('departemen'), 'menyebut alasannya');
  assert.ok(pesan?.includes('dua kali'), 'menyebut cara mendaftarkan kode yang dipakai dua departemen');
});

test('nama terlalu panjang ditolak', () => {
  assert.ok(periksaItem({ ...sah, name: 'x'.repeat(121) })?.includes('terlalu panjang'));
});

test('pesan kembar menyebut kategori dan departemennya, dan bahwa departemen lain boleh', () => {
  const tempat = { kategori: 'Opex', sub: 'House Keeping' };
  const kode = pesanKembar(['categoryId', 'subCategoryId', 'code'], tempat, { code: 'HK-012', name: 'Sabun' });
  assert.ok(kode.includes('HK-012'));
  assert.ok(kode.includes('Opex'));
  assert.ok(kode.includes('House Keeping'), 'kembarnya di departemen mana');
  assert.ok(
    kode.includes('sub kategori lain'),
    'menyebut bahwa pengulangan antar sub kategori justru diizinkan — itu jalan keluarnya',
  );

  const nama = pesanKembar(['categoryId', 'subCategoryId', 'name'], { kategori: 'Opex', sub: 'Laundry' },
    { code: 'X', name: 'Detergen' });
  assert.ok(nama.includes('Detergen'));
  assert.ok(nama.includes('Laundry'));
});
