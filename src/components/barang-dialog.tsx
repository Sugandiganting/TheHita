'use client';

import { DialogTombol } from './dialog';
import {
  FormItem, FormKategori, FormSatuan, FormSubKategori,
  type NilaiItem, type Pilihan, type Sub,
} from './barang-form';

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
    <DialogTombol
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
    </DialogTombol>
  );
}

export function TambahKategoriDialog() {
  return (
    <DialogTombol
      label="+ Tambah kategori"
      judul="Tambah kategori"
      lebar="sm"
      keterangan="Kode dirapikan sendiri jadi huruf besar tanpa spasi."
    >
      {(tutup) => <FormKategori onTutup={tutup} />}
    </DialogTombol>
  );
}

export function TambahSatuanDialog() {
  return (
    <DialogTombol
      label="+ Tambah satuan"
      judul="Tambah satuan"
      lebar="sm"
      keterangan="Satu ejaan untuk satu satuan — kg, Kg dan kilogram pada tiga barang berbeda membuat pemakaiannya tidak bisa dijumlahkan."
    >
      {(tutup) => <FormSatuan onTutup={tutup} />}
    </DialogTombol>
  );
}

export function TambahSubKategoriDialog({ kategori }: { kategori: Pilihan[] }) {
  return (
    <DialogTombol
      label="+ Tambah sub kategori"
      judul="Tambah sub kategori"
      disabled={kategori.length === 0}
      title={kategori.length === 0 ? 'Buat kategorinya lebih dulu.' : undefined}
      keterangan="Kodenya hanya perlu unik di dalam kategori induknya, jadi nama yang sama boleh dipakai di kategori lain."
    >
      {(tutup) => <FormSubKategori kategori={kategori} onTutup={tutup} />}
    </DialogTombol>
  );
}

/* ------------------------------------------------------------------ */
/* Ubah — dialog yang sama, dengan isinya sudah terisi                 */
/* ------------------------------------------------------------------ */

export function UbahBarangDialog({
  kategori, sub, satuan, akun, nilai,
}: {
  kategori: Pilihan[];
  sub: Sub[];
  satuan: Pilihan[];
  akun: Pilihan[];
  nilai: NilaiItem;
}) {
  return (
    <DialogTombol
      label="Ubah"
      varian="tautan"
      judul={`Ubah ${nilai.code}`}
      keterangan="Memindahkan barang ke kategori lain dibolehkan selama kode dan namanya belum dipakai di kategori tujuan. Akun COA yang diubah di sini berlaku untuk RAB yang disusun sesudahnya, bukan yang sudah ada."
    >
      {(tutup) => (
        <FormItem
          kategori={kategori}
          sub={sub}
          satuan={satuan}
          akun={akun}
          nilai={nilai}
          onTutup={tutup}
        />
      )}
    </DialogTombol>
  );
}

export function UbahKategoriDialog({ nilai }: { nilai: Pilihan }) {
  return (
    <DialogTombol label="Ubah" varian="tautan" lebar="sm" judul={`Ubah kategori ${nilai.code}`}>
      {(tutup) => <FormKategori nilai={nilai} onTutup={tutup} />}
    </DialogTombol>
  );
}

export function UbahSatuanDialog({ nilai }: { nilai: Pilihan }) {
  return (
    <DialogTombol label="Ubah" varian="tautan" lebar="sm" judul={`Ubah satuan ${nilai.code}`}>
      {(tutup) => <FormSatuan nilai={nilai} onTutup={tutup} />}
    </DialogTombol>
  );
}

export function UbahSubKategoriDialog({
  kategori, nilai,
}: {
  kategori: Pilihan[];
  nilai: Sub;
}) {
  return (
    <DialogTombol
      label="Ubah"
      varian="tautan"
      judul={`Ubah sub kategori ${nilai.code}`}
      keterangan="Kategori induknya boleh dipindah selama kodenya belum dipakai di kategori tujuan."
    >
      {(tutup) => <FormSubKategori kategori={kategori} nilai={nilai} onTutup={tutup} />}
    </DialogTombol>
  );
}
