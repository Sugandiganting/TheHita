import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { KODE_DIPERBAIKI } from '../src/lib/impor-barang';
import {
  nilaiBaris, periodeDariJudul, siapkanRab, type BarisRab,
} from '../src/lib/impor-rab';

const BULAN = ['2026-12', '2027-01', '2027-02'];
const bulanan = (...n: number[]) => BULAN.map((periode, i) => ({ periode, jumlah: n[i] ?? 0 }));

const baris = (o: Partial<BarisRab>): BarisRab => ({
  sheet: 'The Hita Uluwatu', baris: 5, code: 'HK-001', name: 'Box Dental Kit',
  type: 'OPEX', department: 'House Keeping', coa: 'Biaya Amenities', satuan: 'Pcs',
  harga: 500, bulanan: bulanan(600, 500, 400), ...o,
});

/* ----------------------------------------------------------------- bulan */

test('judul kolom bulan terbaca, ditulis sebagai tanggal maupun sebagai teks', () => {
  // Di lembar yang sama kolom pertama ditulis "Des 2026" sedangkan sisanya
  // tanggal Excel sungguhan. Melewatkan yang pertama berarti anggaran satu
  // bulan penuh hilang tanpa suara.
  assert.equal(periodeDariJudul(new Date(Date.UTC(2027, 0, 1))), '2027-01');
  assert.equal(periodeDariJudul('Des 2026'), '2026-12');
  assert.equal(periodeDariJudul('Jan 2027'), '2027-01');
  assert.equal(periodeDariJudul("Agu '27"), '2027-08');
  assert.equal(periodeDariJudul('Total QTY'), null);
  assert.equal(periodeDariJudul(''), null);
});

/* ----------------------------------------------------------------- baris */

test('satu baris lembar jadi satu baris RAB untuk tiap bulannya', () => {
  const { siap, masalah } = siapkanRab([baris({})]);
  assert.deepEqual(masalah, []);
  assert.equal(siap.length, 3);
  assert.deepEqual(siap.map((s) => s.periode), BULAN);
  assert.deepEqual(siap.map((s) => s.quantity), [600, 500, 400]);
  assert.ok(siap.every((s) => s.unitPrice === 500));
  assert.equal(nilaiBaris(siap[0]), 300_000);
});

test('bulan yang jumlahnya nol tidak jadi baris', () => {
  // RAB bulan itu memang tidak menganggarkan barang tersebut, dan baris
  // senilai nol hanya memenuhi layar.
  const { siap } = siapkanRab([baris({ bulanan: bulanan(600, 0, 400) })]);
  assert.deepEqual(siap.map((s) => s.periode), ['2026-12', '2027-02']);
});

test('baris yang tidak menganggarkan apa pun dilaporkan, bukan diam-diam hilang', () => {
  const { siap, kosong } = siapkanRab([baris({ bulanan: bulanan(0, 0, 0) })]);
  assert.deepEqual(siap, []);
  assert.equal(kosong.length, 1);
  assert.equal(kosong[0].code, 'HK-001');
});

test('baris tanpa HARGA diperlakukan sebagai rupiah langsung', () => {
  // Listrik pascabayar tidak punya "harga satuan": kolom bulanannya sudah
  // berupa tagihan. Disimpan satu satuan seharga tagihannya, supaya uangnya
  // tetap persis.
  const { siap, rupiah } = siapkanRab([baris({
    code: 'OPS-008', name: 'Listrik Pasca Bayar', satuan: 'Rupiah', harga: null,
    bulanan: bulanan(13_000_000, 11_000_000, 10_000_000),
  })]);
  assert.equal(rupiah.length, 1);
  assert.ok(siap.every((s) => s.quantity === 1));
  assert.deepEqual(siap.map((s) => s.unitPrice), [13_000_000, 11_000_000, 10_000_000]);
  assert.equal(siap.reduce((n, s) => n + nilaiBaris(s), 0), 34_000_000, 'uangnya tidak berubah');
  assert.ok(siap[0].catatan?.includes('langsung rupiah'), 'alasannya ikut tersimpan');
});

test('bulanan yang jelas bukan jumlah unit tetap tertangkap walau HARGA terisi', () => {
  const { rupiah } = siapkanRab([baris({ harga: 1, bulanan: bulanan(4_500_000, 0, 0) })]);
  assert.equal(rupiah.length, 1, 'jaring kedua untuk baris yang harganya terlanjur diisi');
});

test('baris biasa tidak ikut tertangkap sebagai rupiah', () => {
  const { rupiah, siap } = siapkanRab([baris({})]);
  assert.deepEqual(rupiah, []);
  assert.equal(siap[0].catatan, null);
});

test('kode yang sudah diperbaiki di master, diperbaiki juga di RAB', () => {
  // Kalau tidak, RAB menyebut kode lama sementara masternya memakai kode baru
  // — dan barangnya tidak akan pernah ketemu.
  const aturan = KODE_DIPERBAIKI[0];
  const { siap, terpakai } = siapkanRab([
    baris({ code: aturan.kode, name: aturan.nama, department: 'Back Office' }),
  ]);
  assert.ok(terpakai.includes(aturan));
  assert.ok(siap.every((s) => s.code === aturan.jadi));
});

test('kode kembar dalam satu lembar dilaporkan sekali, bukan sekali per bulan', () => {
  // Satu kode yang bentrok akan bentrok di tiap bulannya. Delapan keluhan
  // untuk satu masalah membuat yang lain tenggelam.
  const { masalah } = siapkanRab([
    baris({ baris: 58, code: 'XX-001', name: 'HVS', department: 'Back Office' }),
    baris({ baris: 59, code: 'XX-001', name: 'Listrik Office', department: 'Back Office' }),
  ]);
  assert.equal(masalah.length, 1);
  assert.ok(masalah[0].includes('XX-001'));
  assert.ok(masalah[0].includes('58') && masalah[0].includes('59'), 'menunjuk kedua barisnya');
  assert.ok(masalah[0].includes('3 bulan'), 'menyebut berapa bulan yang terkena');
});

test('kode yang sama di dua cabang bukan bentrok', () => {
  const { masalah, siap } = siapkanRab([
    baris({ sheet: 'The Hita Uluwatu' }),
    baris({ sheet: 'The Hita Legian' }),
  ]);
  assert.deepEqual(masalah, []);
  assert.equal(siap.length, 6, 'tiap cabang punya RAB-nya sendiri');
});

test('TYPE dan DEPARTMENT wajib — keduanya yang menentukan barang mana yang dimaksud', () => {
  assert.ok(siapkanRab([baris({ type: '' })]).masalah[0]?.includes('TYPE'));
  assert.ok(siapkanRab([baris({ department: '' })]).masalah[0]?.includes('DEPARTMENT'));
  assert.ok(siapkanRab([baris({ code: '  ' })]).masalah[0]?.includes('kode barang kosong'));
});
