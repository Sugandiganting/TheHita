'use client';

import { DialogTambah } from './dialog';
import { FormItem, FormKategori, FormSatuan, FormSubKategori, type Pilihan, type Sub } from './barang-form';

export function TambahBarangDialog({
  kategori, sub, satuan, akun, bisa,
}: {
  kategori: Pilihan[];
  sub: Sub[];
  satuan: Pilihan[];
  akun: Pilihan[];
  /** Akun COA sudah ada. Tanpa itu barang tidak bisa didaftarkan sama sekali. */
  bisa: boolean;
}) {
  return (
    <DialogTambah
      label="+ Tambah barang"
      judul="Tambah barang"
      disabled={!bisa}
      title={bisa ? undefined : 'Belum ada akun COA yang bisa dipakai barang.'}
      keterangan={
        <>
          Kode dirapikan sendiri jadi huruf besar tanpa spasi. Semua pilihan bisa dicari, dan
          kategori, sub kategori atau satuan yang belum ada bisa dibuat di sini juga lewat tombol{' '}
          <span className="font-medium text-brand-600">+ Baru</span>.
        </>
      }
    >
      {(tutup) => (
        <FormItem kategori={kategori} sub={sub} satuan={satuan} akun={akun} onTutup={tutup} />
      )}
    </DialogTambah>
  );
}

export function TambahKategoriDialog() {
  return (
    <DialogTambah
      label="+ Tambah kategori"
      judul="Tambah kategori"
      lebar="sm"
      keterangan="Kode dirapikan sendiri jadi huruf besar tanpa spasi."
    >
      {(tutup) => <FormKategori onTutup={tutup} />}
    </DialogTambah>
  );
}

export function TambahSatuanDialog() {
  return (
    <DialogTambah
      label="+ Tambah satuan"
      judul="Tambah satuan"
      lebar="sm"
      keterangan="Satu ejaan untuk satu satuan — kg, Kg dan kilogram pada tiga barang berbeda membuat pemakaiannya tidak bisa dijumlahkan."
    >
      {(tutup) => <FormSatuan onTutup={tutup} />}
    </DialogTambah>
  );
}

export function TambahSubKategoriDialog({ kategori }: { kategori: Pilihan[] }) {
  return (
    <DialogTambah
      label="+ Tambah sub kategori"
      judul="Tambah sub kategori"
      disabled={kategori.length === 0}
      title={kategori.length === 0 ? 'Buat kategorinya lebih dulu.' : undefined}
      keterangan="Kodenya hanya perlu unik di dalam kategori induknya, jadi nama yang sama boleh dipakai di kategori lain."
    >
      {(tutup) => <FormSubKategori kategori={kategori} onTutup={tutup} />}
    </DialogTambah>
  );
}
