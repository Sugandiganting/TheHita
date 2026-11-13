import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anggaranPerAkun, barisMasukScope, cabangDalamScope, jenisRabSah, nilaiBarisBarang,
  penghematanBaris, periodeBerikutnya, ringkasRab, scopeBersamaKah, sisaAkanKeluar,
  statusRealisasi,
  type BarisBarangRab, type BarisRab, type BarisRealisasi, type RealisasiBaris,
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

/* ------------------------------------------------------------------ */
/* RAB Purchasing: per barang                                          */
/* ------------------------------------------------------------------ */

const barang = (o: Partial<BarisBarangRab>): BarisBarangRab => ({
  lineId: 'l1', itemId: 'i1', itemCode: 'BTN', itemName: 'Beton Instan',
  satuan: 'SAK', kategori: 'Operasional', subKategori: 'Engineering',
  accountId: 'a1', accountCode: '6150.01', accountName: 'Biaya Pemeliharaan',
  quantity: 0, unitPrice: 0, anggaran: 0, catatan: null,
  realisasi: { quantity: null, unitPrice: null, tanggal: null, selesai: false, catatan: null, nilai: null },
  ...o,
});

test('nilai baris barang adalah jumlah kali harga satuan', () => {
  assert.equal(nilaiBarisBarang({ quantity: 20, unitPrice: 65_000 }), 1_300_000);
});

test('jumlah pecahan tetap terhitung, tidak dibulatkan dulu', () => {
  // Satuan seperti meter kubik dan liter sering tidak bulat. Membulatkan
  // jumlahnya lebih dulu akan menggeser anggarannya tanpa terlihat.
  assert.equal(nilaiBarisBarang({ quantity: 2.5, unitPrice: 400_000 }), 1_000_000);
  assert.equal(nilaiBarisBarang({ quantity: 0.5, unitPrice: 1_000_001 }), 500_000.5);
});

test('beberapa barang dengan akun yang sama dijumlahkan menjadi satu baris akun', () => {
  // Inilah sebabnya baris barang tidak bisa memakai keunikan per akun seperti
  // RAB umum: semen dan besi sama-sama bermuara ke Biaya Pemeliharaan.
  const per = anggaranPerAkun([
    barang({ itemId: 'semen', anggaran: 1_300_000 }),
    barang({ itemId: 'besi', anggaran: 2_000_000 }),
    barang({ itemId: 'cat', accountId: 'a2', accountCode: '6160.01', accountName: 'Biaya Perlengkapan', anggaran: 450_000 }),
  ]);

  assert.equal(per.size, 2);
  assert.equal(per.get('a1')?.anggaran, 3_300_000);
  assert.equal(per.get('a2')?.anggaran, 450_000);
  assert.equal(per.get('a1')?.code, '6150.01');
});

test('akun dari barang pertama yang dipakai, bukan tertimpa yang terakhir', () => {
  const per = anggaranPerAkun([
    barang({ itemId: 'semen', anggaran: 100 }),
    barang({ itemId: 'besi', anggaran: 200 }),
  ]);
  assert.equal(per.get('a1')?.name, 'Biaya Pemeliharaan');
});

test('daftar barang kosong menghasilkan rekap kosong, bukan baris nol', () => {
  assert.equal(anggaranPerAkun([]).size, 0);
});

test('hanya dua jenis RAB yang dikenal', () => {
  assert.equal(jenisRabSah('PURCHASING'), true);
  assert.equal(jenisRabSah('UMUM'), true);
  // Huruf kecil ditolak: pemanggilnya yang membesarkan huruf lebih dulu, jadi
  // yang lolos di sini sudah pasti sama bentuknya dengan yang tersimpan.
  assert.equal(jenisRabSah('purchasing'), false);
  assert.equal(jenisRabSah('PROYEK'), false);
  assert.equal(jenisRabSah(''), false);
});

test('rekap per akun dari RAB Purchasing bisa langsung diringkas seperti RAB umum', () => {
  // Pembuktian bahwa kedua jenis RAB berakhir di satu jalur perbandingan yang
  // sama — kalau tidak, laporannya akan punya dua definisi "sisa".
  const per = anggaranPerAkun([
    barang({ itemId: 'semen', anggaran: 1_300_000 }),
    barang({ itemId: 'besi', anggaran: 700_000 }),
  ]);
  const ringkas = ringkasRab(
    [...per].map(([accountId, a]) => ({
      accountId, accountCode: a.code, accountName: a.name, anggaran: a.anggaran, realisasi: 2_500_000,
    })),
  );

  assert.equal(ringkas.totalAnggaran, 2_000_000);
  assert.equal(ringkas.totalRealisasi, 2_500_000);
  assert.equal(ringkas.totalSisa, -500_000);
  assert.equal(ringkas.jumlahLewat, 1);
});

/* ------------------------------------------------------------------ */
/* Realisasi RAB                                                       */
/* ------------------------------------------------------------------ */

const realisasi = (o: Partial<RealisasiBaris>): RealisasiBaris => ({
  quantity: null, unitPrice: null, tanggal: null, selesai: false, catatan: null, nilai: null, ...o,
});

test('tiga keadaan realisasi dibedakan, bukan dua', () => {
  // "Belum dilaporkan" dan "nol" bukan hal yang sama: yang satu berarti
  // uangnya masih akan keluar, yang lain berarti tidak akan.
  assert.equal(statusRealisasi(realisasi({})), 'BELUM');
  assert.equal(statusRealisasi(realisasi({ quantity: 2, unitPrice: 50, nilai: 100 })), 'BERJALAN');
  assert.equal(statusRealisasi(realisasi({ quantity: 0, unitPrice: 0, nilai: 0, selesai: true })), 'SELESAI');
});

test('hanya baris yang selesai menghasilkan penghematan', () => {
  const b = (r: RealisasiBaris) => ({ anggaran: 1_000_000, realisasi: r });
  assert.equal(penghematanBaris(b(realisasi({}))), null, 'belum dilaporkan belum tentu hemat');
  assert.equal(
    penghematanBaris(b(realisasi({ quantity: 1, unitPrice: 400_000, nilai: 400_000 }))),
    null,
    'baru sebagian — sisanya masih mungkin keluar',
  );
  assert.equal(
    penghematanBaris(b(realisasi({ quantity: 1, unitPrice: 400_000, nilai: 400_000, selesai: true }))),
    600_000,
  );
});

test('tidak jadi dibeli adalah penghematan penuh, bukan baris yang hilang', () => {
  assert.equal(
    penghematanBaris({
      anggaran: 1_000_000,
      realisasi: realisasi({ quantity: 0, unitPrice: 0, nilai: 0, selesai: true }),
    }),
    1_000_000,
  );
});

test('belanja yang melewati anggarannya tampil negatif, tidak disembunyikan', () => {
  // Menyembunyikannya di balik nol membuat total penghematan terbaca lebih
  // besar daripada yang sungguh dihemat.
  assert.equal(
    penghematanBaris({
      anggaran: 1_000_000,
      realisasi: realisasi({ quantity: 1, unitPrice: 1_250_000, nilai: 1_250_000, selesai: true }),
    }),
    -250_000,
  );
});

test('sisa yang akan keluar: selesai nol, belum penuh, sebagian sisanya', () => {
  const b = (r: RealisasiBaris) => ({ anggaran: 1_000_000, realisasi: r });
  assert.equal(sisaAkanKeluar(b(realisasi({}))), 1_000_000);
  assert.equal(sisaAkanKeluar(b(realisasi({ quantity: 1, unitPrice: 400_000, nilai: 400_000 }))), 600_000);
  assert.equal(
    sisaAkanKeluar(b(realisasi({ quantity: 1, unitPrice: 400_000, nilai: 400_000, selesai: true }))),
    0,
    'yang sudah selesai tidak akan keluar lagi, berapa pun sisa anggarannya',
  );
});

test('realisasi yang melewati anggaran tidak membuat sisa jadi negatif', () => {
  // Sisa negatif akan menambah plafon belanja alih-alih menguranginya.
  assert.equal(
    sisaAkanKeluar({
      anggaran: 1_000_000,
      realisasi: realisasi({ quantity: 1, unitPrice: 1_250_000, nilai: 1_250_000 }),
    }),
    0,
  );
});
