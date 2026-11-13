'use client';

import { DialogTombol } from './dialog';
import {
  BudgetForm, BudgetItemLineForm, BudgetLineForm, RealisasiAkunForm, RealisasiBarangForm,
  type AkunOption, type BarangOption, type ScopeOption,
} from './budget-form';

export function RabBaruDialog({
  scopes, defaultPeriod,
}: {
  scopes: ScopeOption[];
  defaultPeriod: string;
}) {
  return (
    <DialogTombol
      label="+ RAB baru"
      judul="RAB baru"
      keterangan="Pilih jenis, pemilik, dan bulannya. Rinciannya diisi di halaman RAB-nya sendiri, yang langsung terbuka setelah ini."
    >
      {(tutup) => <BudgetForm scopes={scopes} defaultPeriod={defaultPeriod} onTutup={tutup} />}
    </DialogTombol>
  );
}

export function TambahAnggaranDialog({
  budgetId, accounts, disabled,
}: {
  budgetId: string;
  accounts: AkunOption[];
  disabled: boolean;
}) {
  return (
    <DialogTombol
      label="+ Tambah anggaran"
      judul="Tambah anggaran"
      lebar="sm"
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
      keterangan="Satu baris per akun beban. Akunnya bisa dicari — ketik nomor atau namanya."
    >
      {(tutup) => <BudgetLineForm budgetId={budgetId} accounts={accounts} onTutup={tutup} />}
    </DialogTombol>
  );
}

/* ------------------------------------------------------------------ */
/* Ubah — dialog yang sama, dengan isinya sudah terisi                  */
/* ------------------------------------------------------------------ */

export function UbahBarangRabDialog({
  budgetId, items, nilai, nama, disabled,
}: {
  budgetId: string;
  items: BarangOption[];
  nilai: { itemId: string; quantity: number; unitPrice: number; catatan: string | null };
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
        <BudgetItemLineForm budgetId={budgetId} items={items} values={nilai} onTutup={tutup} />
      )}
    </DialogTombol>
  );
}

export function UbahAnggaranDialog({
  budgetId, accounts, nilai, nama, disabled,
}: {
  budgetId: string;
  accounts: AkunOption[];
  nilai: { accountId: string; amount: number; notes: string | null };
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
        <BudgetLineForm budgetId={budgetId} accounts={accounts} values={nilai} onTutup={tutup} />
      )}
    </DialogTombol>
  );
}

export function TambahBarangRabDialog({
  budgetId, items, disabled,
}: {
  budgetId: string;
  items: BarangOption[];
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
      {(tutup) => <BudgetItemLineForm budgetId={budgetId} items={items} onTutup={tutup} />}
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
