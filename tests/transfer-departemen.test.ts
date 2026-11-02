import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  terpakaiDariTransfer, transferPerCabang, type BarisTransfer,
} from '../src/lib/transfer-departemen';

const jt = (n: number) => n * 1_000_000;
const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);

const PURCHASING = 'akun-purchasing';
const HR = 'akun-hr';

/** Dua cabang mengirim ke Purchasing, satu cabang ke HR. */
const baris: BarisTransfer[] = [
  { accountId: PURCHASING, debit: jt(20), credit: 0, tanggal: tgl('2026-10-15'), unit: 'THL' },
  { accountId: PURCHASING, debit: jt(40), credit: 0, tanggal: tgl('2026-10-29'), unit: 'SKR' },
  { accountId: HR, debit: jt(30), credit: 0, tanggal: tgl('2026-10-20'), unit: 'THL' },
];

test('transfer ke kas departemen dijumlahkan dari semua cabang', () => {
  assert.equal(terpakaiDariTransfer(baris, PURCHASING), jt(60));
  assert.equal(terpakaiDariTransfer(baris, HR), jt(30));
});

test('kategori tanpa tautan rekening tidak mengambil apa pun', () => {
  // Pembayaran langsung dari rekening bank bukan perpindahan ke kas
  // departemen, jadi angkanya memang harus tetap diketik.
  assert.equal(terpakaiDariTransfer(baris, null), 0);
});

test('yang sudah tercermin di saldo tidak memotong plafon dua kali', () => {
  // Laporan posisi kas 28 Oktober: transfer 15 Okt sudah ada di dalam saldonya,
  // transfer 29 Okt belum.
  const setelah = terpakaiDariTransfer(baris, PURCHASING, {
    batasPosisi: tgl('2026-10-28'), hanyaSetelahPosisi: true,
  });
  assert.equal(setelah, jt(40));

  // Tanpa laporan posisi kas, belum ada yang tercermin di mana pun.
  assert.equal(
    terpakaiDariTransfer(baris, PURCHASING, { batasPosisi: null, hanyaSetelahPosisi: true }),
    jt(60),
  );
});

test('transfer yang dikembalikan tidak ikut terhitung habis', () => {
  // Pembatalan dicatat sebagai kredit di akun yang sama. Menghitung debit saja
  // akan membuat uang yang sudah kembali tetap terbaca sebagai belanja.
  const dengan = [...baris, {
    accountId: PURCHASING, debit: 0, credit: jt(20), tanggal: tgl('2026-10-16'), unit: 'THL',
  }];
  assert.equal(terpakaiDariTransfer(dengan, PURCHASING), jt(40));
});

test('rincian per cabang diurutkan dari yang terbesar', () => {
  assert.deepEqual(transferPerCabang(baris, PURCHASING), [
    { unit: 'SKR', amount: jt(40) },
    { unit: 'THL', amount: jt(20) },
  ]);
  assert.deepEqual(transferPerCabang(baris, null), []);
});

test('cabang yang kirimannya kembali utuh tidak ikut ditampilkan', () => {
  const dengan = [...baris, {
    accountId: PURCHASING, debit: 0, credit: jt(20), tanggal: tgl('2026-10-16'), unit: 'THL',
  }];
  assert.deepEqual(transferPerCabang(dengan, PURCHASING), [{ unit: 'SKR', amount: jt(40) }]);
});
