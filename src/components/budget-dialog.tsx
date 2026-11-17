'use client';

import { DialogTombol } from './dialog';
import {
  BudgetForm, BudgetItemLineForm, BudgetLineForm, GantiJenisRabForm, JenisRabForm,
  RealisasiAkunForm, RealisasiBarangForm,
  type AkunOption, type BarangOption, type ScopeOption,
} from './budget-form';
import type { InfoJenisRab } from '@/lib/rab';

export function RabBaruDialog({
  scopes, jenis, defaultPeriod,
}: {
  scopes: ScopeOption[];
  jenis: InfoJenisRab[];
  defaultPeriod: string;
}) {
  return (
    <DialogTombol
      label="+ RAB baru"
      judul="RAB baru"
      keterangan="Pilih jenis, pemilik, dan bulannya. Rinciannya diisi di halaman RAB-nya sendiri, yang langsung terbuka setelah ini."
    >
      {(tutup) => <BudgetForm scopes={scopes} jenis={jenis} defaultPeriod={defaultPeriod} onTutup={tutup} />}
    </DialogTombol>
  );
}

export function TambahAnggaranDialog({
  budgetId, accounts, periode, disabled,
}: {
  budgetId: string;
  accounts: AkunOption[];
  periode: string;
  disabled: boolean;
}) {
  return (
    <DialogTombol
      label="+ Tambah anggaran"
      judul="Tambah anggaran"
      lebar="sm"
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
      keterangan="Akunnya bisa dicari — ketik nomor atau namanya. Akun yang sama boleh dipakai lagi untuk tagihan lain, dibedakan lewat catatan."
    >
      {(tutup) => (
        <BudgetLineForm budgetId={budgetId} accounts={accounts} periode={periode} onTutup={tutup} />
      )}
    </DialogTombol>
  );
}

/* ------------------------------------------------------------------ */
/* Ubah — dialog yang sama, dengan isinya sudah terisi                  */
/* ------------------------------------------------------------------ */

export function UbahBarangRabDialog({
  budgetId, items, periode, nilai, nama, disabled,
}: {
  budgetId: string;
  items: BarangOption[];
  periode: string;
  nilai: {
    itemId: string; quantity: number; unitPrice: number;
    catatan: string | null; planDate: string | null;
  };
  /** Nama barangnya, untuk judul dialognya. */
  nama: string;
  disabled: boolean;
}) {
  return (
    <DialogTombol
      label="Ubah"
      varian="tautan"
      judul={`Ubah ${nama}`}
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
      keterangan="Jumlah dan harga satuannya boleh dikoreksi. Nilai yang dianggarkan ikut sendiri, karena ia hasil kali keduanya."
    >
      {(tutup) => (
        <BudgetItemLineForm
          budgetId={budgetId} items={items} periode={periode} values={nilai} onTutup={tutup}
        />
      )}
    </DialogTombol>
  );
}

export function UbahAnggaranDialog({
  budgetId, accounts, periode, nilai, nama, pindahan, disabled,
}: {
  budgetId: string;
  accounts: AkunOption[];
  periode: string;
  nilai: { id: string; accountId: string; amount: number; notes: string | null; planDate: string | null };
  /** RAB lain milik pemilik dan bulan yang sama, tujuan pindah barisnya. */
  pindahan?: { id: string; nama: string }[];
  /** Nama akunnya, untuk judul dialognya. */
  nama: string;
  disabled: boolean;
}) {
  return (
    <DialogTombol
      label="Ubah"
      varian="tautan"
      lebar="sm"
      judul={`Ubah anggaran ${nama}`}
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
    >
      {(tutup) => (
        <BudgetLineForm
          budgetId={budgetId} accounts={accounts} periode={periode} values={nilai}
          pindahan={pindahan} onTutup={tutup}
        />
      )}
    </DialogTombol>
  );
}

export function TambahBarangRabDialog({
  budgetId, items, periode, disabled,
}: {
  budgetId: string;
  items: BarangOption[];
  periode: string;
  disabled: boolean;
}) {
  return (
    <DialogTombol
      label="+ Tambah barang"
      judul="Tambah barang ke RAB"
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
      keterangan="Akun bebannya ikut dari master barang, dan nilainya dihitung dari jumlah kali harga satuan."
    >
      {(tutup) => (
        <BudgetItemLineForm budgetId={budgetId} items={items} periode={periode} onTutup={tutup} />
      )}
    </DialogTombol>
  );
}

/* ------------------------------------------------------------------ */
/* Realisasi — hanya pada RAB yang sudah disahkan                      */
/* ------------------------------------------------------------------ */

export function RealisasiBarangDialog({
  lineId, nama, satuan, anggaran, nilai, defaultDate, sudahAda,
}: {
  lineId: string;
  nama: string;
  satuan: string;
  anggaran: number;
  nilai: {
    quantity: number | null; unitPrice: number | null;
    tanggal: string | null; selesai: boolean; catatan: string | null;
  };
  defaultDate: string;
  /** Sudah pernah dilaporkan; mengubah bunyi tombolnya. */
  sudahAda: boolean;
}) {
  return (
    <DialogTombol
      label={sudahAda ? 'Ubah realisasi' : 'Catat realisasi'}
      varian="tautan"
      judul={`Realisasi ${nama}`}
      keterangan="Rencananya sudah terkunci karena RAB ini disahkan; yang dicatat di sini apa yang sungguh terjadi."
    >
      {(tutup) => (
        <RealisasiBarangForm
          lineId={lineId} nama={nama} satuan={satuan} anggaran={anggaran}
          nilai={nilai} defaultDate={defaultDate} onTutup={tutup}
        />
      )}
    </DialogTombol>
  );
}

export function RealisasiAkunDialog({
  lineId, nama, anggaran, nilai, defaultDate, sudahAda,
}: {
  lineId: string;
  nama: string;
  anggaran: number;
  nilai: { amount: number | null; tanggal: string | null; selesai: boolean; catatan: string | null };
  defaultDate: string;
  sudahAda: boolean;
}) {
  return (
    <DialogTombol
      label={sudahAda ? 'Ubah realisasi' : 'Catat realisasi'}
      varian="tautan"
      lebar="sm"
      judul={`Realisasi ${nama}`}
      keterangan="Rencananya sudah terkunci karena RAB ini disahkan; yang dicatat di sini apa yang sungguh terjadi."
    >
      {(tutup) => (
        <RealisasiAkunForm
          lineId={lineId} nama={nama} anggaran={anggaran}
          nilai={nilai} defaultDate={defaultDate} onTutup={tutup}
        />
      )}
    </DialogTombol>
  );
}

export function TambahJenisRabDialog() {
  return (
    <DialogTombol
      label="+ Tambah jenis"
      judul="Tambah jenis RAB"
      lebar="sm"
      keterangan="Misalnya HR untuk gaji dan service, atau Management untuk pembayaran manajemen."
    >
      {(tutup) => <JenisRabForm onTutup={tutup} />}
    </DialogTombol>
  );
}

export function UbahJenisRabDialog({ nilai }: { nilai: { code: string; name: string } }) {
  return (
    <DialogTombol label="Ubah nama" varian="tautan" lebar="sm" judul={`Ubah nama jenis ${nilai.name}`}>
      {(tutup) => <JenisRabForm nilai={nilai} onTutup={tutup} />}
    </DialogTombol>
  );
}

export function GantiJenisRabDialog({
  id, kind, pilihan, disabled,
}: {
  id: string;
  kind: string;
  pilihan: InfoJenisRab[];
  disabled: boolean;
}) {
  return (
    <DialogTombol
      label="Ganti jenis"
      varian="tautan"
      lebar="sm"
      judul="Ganti jenis RAB"
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
    >
      {(tutup) => <GantiJenisRabForm id={id} kind={kind} pilihan={pilihan} onTutup={tutup} />}
    </DialogTombol>
  );
}
