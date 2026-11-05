'use client';

import { DialogTambah } from './dialog';
import {
  BudgetForm, BudgetItemLineForm, BudgetLineForm,
  type AkunOption, type BarangOption, type ScopeOption,
} from './budget-form';

export function RabBaruDialog({
  scopes, defaultPeriod,
}: {
  scopes: ScopeOption[];
  defaultPeriod: string;
}) {
  return (
    <DialogTambah
      label="+ RAB baru"
      judul="RAB baru"
      keterangan="Pilih jenis, pemilik, dan bulannya. Rinciannya diisi di halaman RAB-nya sendiri, yang langsung terbuka setelah ini."
    >
      {(tutup) => <BudgetForm scopes={scopes} defaultPeriod={defaultPeriod} onTutup={tutup} />}
    </DialogTambah>
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
    <DialogTambah
      label="+ Tambah anggaran"
      judul="Tambah anggaran"
      lebar="sm"
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
      keterangan="Satu baris per akun beban. Akunnya bisa dicari — ketik nomor atau namanya."
    >
      {(tutup) => <BudgetLineForm budgetId={budgetId} accounts={accounts} onTutup={tutup} />}
    </DialogTambah>
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
    <DialogTambah
      label="+ Tambah barang"
      judul="Tambah barang ke RAB"
      disabled={disabled}
      title={disabled ? 'RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya.' : undefined}
      keterangan="Akun bebannya ikut dari master barang, dan nilainya dihitung dari jumlah kali harga satuan."
    >
      {(tutup) => <BudgetItemLineForm budgetId={budgetId} items={items} onTutup={tutup} />}
    </DialogTambah>
  );
}
