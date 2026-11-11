import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ALIAS_AKUN, BARANG_TAMBAHAN, KODE_DIPERBAIKI,
  coaBerbeda, cocokkanAkun, kodeDepartemen, namaSatuan, normalAkun, siapkanLembar, tanpaKembar,
  type AkunRingkas, type BarisLembar,
} from '../src/lib/impor-barang';

const akun: AkunRingkas[] = [
  { id: 'a1', code: '6150.10', name: 'Biaya Peralatan dan Perlengkapan FO' },
  { id: 'a2', code: '6150.03', name: 'Biaya Chemical HK' },
  { id: 'a3', code: '6160.05', name: 'Biaya Air Isi Ulang' },
  { id: 'a4', code: '6120.01', name: 'Biaya Listrik' },
  { id: 'a5', code: '6190.04', name: 'Biaya Packaging' },
];

const baris = (o: Partial<BarisLembar>): BarisLembar => ({
  baris: 2, code: 'HK-001', name: 'Shampoo', unit: 'Dr',
  kategori: 'OPEX', sub: 'House Keeping', coa: 'Biaya Chemical HK', catatan: '', ...o,
});

/* --------------------------------------------------------------- akun */

test('"&" dan "dan" dipakai bergantian untuk akun yang sama', () => {
  assert.equal(normalAkun('Biaya Peralatan & Perlengkapan FO'), normalAkun('Biaya Peralatan dan Perlengkapan FO'));
});

test('nama akun yang ejaannya cuma beda "&" tetap ketemu tanpa perlu alias', () => {
  const h = cocokkanAkun('Biaya Peralatan & Perlengkapan FO', akun);
  assert.ok(h.ok);
  assert.equal(h.akun.code, '6150.10');
  assert.equal(h.lewatAlias, false, 'ini kecocokan nama, bukan keputusan yang perlu diperiksa');
});

test('akhiran departemen dilipat lewat tabel alias, dan ditandai supaya diperiksa', () => {
  // Yang memisahkan laporan IGYT dari laporan hotel adalah kolom cabang pada
  // jurnalnya, bukan akun bernama IGYT.
  const h = cocokkanAkun('Biaya Air Isi Ulang IGYT', akun);
  assert.ok(h.ok);
  assert.equal(h.akun.code, '6160.05');
  assert.equal(h.lewatAlias, true, 'tiap alias adalah keputusan akuntansi, jadi harus ikut dilaporkan');
});

test('alias yang menunjuk akun yang sudah tidak ada menolak, bukan diam-diam salah', () => {
  // Akun bisa dinonaktifkan atau diganti nomornya setelah alias ditulis.
  // Menolak membuat orangnya memperbaiki tabelnya; menebak akun terdekat
  // membuat barangnya masuk dengan akun yang salah tanpa ada yang tahu.
  const tanpa6160 = akun.filter((a) => a.code !== '6160.05');
  const h = cocokkanAkun('Biaya Air Isi Ulang IGYT', tanpa6160);
  assert.equal(h.ok, false);
});

test('nama yang tak dikenali menyodorkan kandidat terdekat, bukan menebak', () => {
  const h = cocokkanAkun('Biaya Chemical Kolam', akun);
  assert.equal(h.ok, false);
  assert.ok(!h.ok && h.kandidat.some((a) => a.code === '6150.03'), 'yang berbagi kata "chemical" ikut');
});

test('tiap alias menunjuk nama yang sudah dibakukan, bukan ejaan asli', () => {
  // Kalau kuncinya belum dibakukan, aliasnya tidak akan pernah terpakai —
  // dan itu baru kelihatan saat impor berhenti dengan nama yang "tak dikenal".
  for (const kunci of Object.keys(ALIAS_AKUN)) {
    assert.equal(kunci, normalAkun(kunci), `kunci alias "${kunci}" belum dibakukan`);
  }
});

/* --------------------------------------------------- departemen & satuan */

test('kode departemen dibuat sama dengan awalan kode barangnya', () => {
  // Barang HK-012 berada di departemen HK — kalau kodenya "HOUSE-KEEPING",
  // hubungan itu hilang dari layar.
  assert.equal(kodeDepartemen('House Keeping'), 'HK');
  assert.equal(kodeDepartemen('Front Office'), 'FO');
  assert.equal(kodeDepartemen('Laundry'), 'LDR');
  assert.equal(kodeDepartemen('Gudang Pusat'), 'GUDANG-PUSAT', 'yang belum ada di tabel pakai namanya');
});

test('satuan yang ditulis singkat dapat nama panjangnya', () => {
  assert.equal(namaSatuan('DR'), 'Drum');
  assert.equal(namaSatuan('KRAT'), 'KRAT', 'yang sudah jelas dibiarkan apa adanya');
});

/* -------------------------------------------------------------- lembar */

test('lembar yang bersih lolos, ejaannya dibakukan', () => {
  const { barang, masalah } = siapkanLembar([baris({ code: 'hk 001', name: '  Shampoo  ' })]);
  assert.deepEqual(masalah, []);
  const hk = barang.find((b) => b.code === 'HK-001');
  assert.equal(hk?.name, 'Shampoo');
  assert.equal(hk?.subKode, 'HK');
  assert.equal(hk?.satKode, 'DR');
});

test('satu kode untuk dua barang berbeda di departemen yang sama menghentikan impor', () => {
  // Sungguh terjadi di data yang ada: BO-001 dipakai untuk "HVS" dan
  // "Listrik Office" sekaligus.
  const { masalah } = siapkanLembar([
    baris({ baris: 83, code: 'XX-001', name: 'HVS', sub: 'Back Office' }),
    baris({ baris: 84, code: 'XX-001', name: 'Listrik Office', sub: 'Back Office' }),
  ]);
  assert.equal(masalah.length, 1);
  assert.ok(masalah[0].includes('XX-001'));
  assert.ok(masalah[0].includes('HVS') && masalah[0].includes('Listrik Office'), 'menyebut keduanya');
  assert.ok(masalah[0].includes('83') && masalah[0].includes('84'), 'menunjuk barisnya');
});

test('kode yang sama di dua departemen justru dibolehkan — itu jalan keluarnya', () => {
  const { barang, masalah } = siapkanLembar([
    baris({ code: 'HK-012', name: 'Sabun Cuci Piring', sub: 'House Keeping', unit: 'Dr' }),
    baris({ code: 'HK-012', name: 'Sabun Cuci Piring', sub: 'IGYT', unit: 'Pack' }),
  ]);
  assert.deepEqual(masalah, []);
  const dua = tanpaKembar(barang).filter((b) => b.code === 'HK-012');
  assert.equal(dua.length, 2, 'dua barang tersendiri, cuma namanya sama');
  assert.deepEqual(dua.map((b) => b.satKode).sort(), ['DR', 'PACK']);
});

test('dua nama sama dengan kode berbeda di satu departemen ditolak', () => {
  // Kodenya sengaja di luar penomoran yang sungguh dipakai: BARANG_TAMBAHAN
  // ikut masuk ke tiap pemeriksaan, jadi kode contoh yang kebetulan sama
  // dengan salah satunya akan menambah masalah kedua yang bukan maksud tes ini.
  const { masalah } = siapkanLembar([
    baris({ baris: 5, code: 'XX-030', name: 'Tissu Facial' }),
    baris({ baris: 6, code: 'XX-031', name: 'Tissu Facial' }),
  ]);
  assert.equal(masalah.length, 1);
  assert.ok(masalah[0].includes('Tissu Facial'));
  assert.ok(masalah[0].includes('XX-030') && masalah[0].includes('XX-031'));
});

test('baris yang kembar persis dilewati tanpa jadi masalah', () => {
  const { masalah } = siapkanLembar([baris({}), baris({ baris: 3 })]);
  assert.deepEqual(masalah, [], 'kembar persis bukan dua barang berbeda');
  assert.equal(tanpaKembar(siapkanLembar([baris({}), baris({ baris: 3 })]).barang)
    .filter((b) => b.code === 'HK-001').length, 1);
});

test('departemen yang kosong ditolak beserta alasannya', () => {
  const { masalah } = siapkanLembar([baris({ sub: '' })]);
  assert.equal(masalah.length, 1);
  assert.ok(masalah[0].includes('Sub Category'));
  assert.ok(masalah[0].includes('departemen'), 'menyebut kenapa kolom itu tidak boleh kosong');
});

test('perbaikan kode dilaporkan, dan menyelesaikan tabrakannya', () => {
  const aturan = KODE_DIPERBAIKI[0];
  const { masalah, terpakai, barang } = siapkanLembar([
    baris({ baris: 83, code: aturan.kode, name: 'HVS', sub: 'Back Office', kategori: 'OPEX' }),
    baris({ baris: 84, code: aturan.kode, name: aturan.nama, sub: 'Back Office', kategori: 'OPEX' }),
  ]);
  assert.deepEqual(masalah, [], 'kode yang diperbaiki tidak lagi menabrak');
  assert.ok(terpakai.includes(aturan), 'perbaikan yang terpakai harus bisa dilaporkan');
  assert.ok(barang.some((b) => b.code === aturan.jadi && b.name === aturan.nama));
  assert.ok(barang.some((b) => b.code === aturan.kode && b.name === 'HVS'));
});

test('perbaikan kode yang tidak terpakai tidak mengubah apa pun', () => {
  // Begitu lembarnya sendiri diperbaiki, aturannya tidak lagi menemukan
  // pasangan kode-dan-nama itu — dan harus diam, bukan mengganti yang lain.
  const { terpakai, barang } = siapkanLembar([
    baris({ code: KODE_DIPERBAIKI[0].kode, name: 'Nama Lain', sub: 'Back Office' }),
  ]);
  assert.deepEqual(terpakai, []);
  assert.ok(barang.some((b) => b.code === KODE_DIPERBAIKI[0].kode));
});

test('barang tambahan selalu ikut, walau lembarnya kosong', () => {
  const { barang } = siapkanLembar([]);
  assert.equal(barang.length, BARANG_TAMBAHAN.length);
  assert.ok(barang.every((b) => b.baris === 0), 'ditandai bukan dari lembarnya');
});

test('barang tambahan diperiksa dengan aturan yang sama seperti baris lembar', () => {
  // Kalau salah satunya menabrak barang dari lembarnya, itu harus terlihat —
  // bukan diam-diam menimpa.
  for (const t of BARANG_TAMBAHAN) {
    const { masalah } = siapkanLembar([baris({ ...t, baris: 9 })]);
    assert.equal(masalah.length, 0, `${t.code} bentrok dengan dirinya sendiri: ${masalah[0]}`);
  }
});

/* ------------------------------------------------------- catatan lembar */

test('catatan "COA berbeda" dibaca jadi bagian-bagiannya', () => {
  const h = coaBerbeda(
    'Department berbeda: IGYT di IGYT (dipakai: House Keeping); '
    + 'COA berbeda: Biaya Supplies & Packaging IGYT di IGYT (dipakai: Biaya Cleaning & Supplies)',
  );
  assert.deepEqual(h, {
    lain: 'Biaya Supplies & Packaging IGYT',
    cabang: 'IGYT',
    dipakai: 'Biaya Cleaning & Supplies',
  });
});

test('catatan yang cuma soal departemen tidak menuntut keputusan apa pun', () => {
  assert.equal(coaBerbeda('Department berbeda: IGYT di IGYT (dipakai: Front Office)'), null);
  assert.equal(coaBerbeda(''), null);
});
