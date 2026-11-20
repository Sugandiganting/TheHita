'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  addCostItem, hapusPembayaranItem, setCostItemAccount, setItemSelesai, tambahPembayaranItem, updateCostItem,
  type ActionState,
} from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import { bacaJumlah, totalItemProyek } from '@/lib/proyek';
import { DialogTombol } from './dialog';
import { SearchableSelect } from './searchable-select';
import { MoneyInput } from './money-input';

const initial: ActionState = { ok: false, message: '' };

function SubmitButton({ label, onTutup }: { label: string; onTutup?: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className={`btn-primary ${onTutup ? '' : 'w-full'}`} disabled={pending}>
        {pending ? 'Menyimpan…' : label}
      </button>
      {onTutup && (
        <button type="button" className="btn-secondary" onClick={onTutup}>Tutup</button>
      )}
    </div>
  );
}

export type NilaiItemProyek = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  plannedDate: string;
  accountId: string | null;
};

/**
 * Menambah item biaya proyek, atau mengubahnya bila `nilai` diisi.
 *
 * Jumlah × harga satuan = total, dihitung di layar sambil diketik supaya
 * totalnya terlihat sebelum disimpan. Server menghitung ulang dengan rumus
 * yang sama; angka di layar hanya pratinjau.
 */
export function CostItemForm({
  projectId,
  accounts,
  nilai,
  onTutup,
}: {
  projectId?: string;
  accounts: { id: string; code: string; name: string }[];
  nilai?: NilaiItemProyek;
  onTutup?: () => void;
}) {
  const [state, formAction] = useActionState(nilai ? updateCostItem : addCostItem, initial);
  const [jumlah, setJumlah] = useState(nilai ? String(nilai.quantity) : '1');
  const [harga, setHarga] = useState(nilai ? String(nilai.unitPrice) : '');
  const total = totalItemProyek(bacaJumlah(jumlah), Number(harga) || 0);
  const awalan = nilai ? `u-${nilai.id}` : 'c';

  return (
    <form
      action={formAction}
      className="space-y-4"
      // Menambah: dikosongkan tiap kali tersimpan. Mengubah: isiannya bertahan.
      key={nilai ? nilai.id : (state.ok ? state.message : 'form')}
    >
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {nilai && <input type="hidden" name="id" value={nilai.id} />}

      <div>
        <label className="label" htmlFor={`${awalan}-name`}>Nama item</label>
        <input id={`${awalan}-name`} name="name" className="input" placeholder="Pondasi & struktur"
          defaultValue={nilai?.name} required />
      </div>

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <div>
          <label className="label" htmlFor={`${awalan}-qty`}>Qty</label>
          <input
            id={`${awalan}-qty`}
            name="quantity"
            inputMode="decimal"
            className="input"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            required
          />
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor={`${awalan}-price`}>Harga satuan (Rp)</label>
          <MoneyInput id={`${awalan}-price`} name="unitPrice" placeholder="2.500.000"
            value={harga} onChange={(v) => setHarga(v)} required />
        </div>
      </div>

      <div className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
        <span className="text-sm text-slate-600">Total</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {total > 0 ? formatRupiah(total) : '—'}
        </span>
      </div>

      <div>
        <label className="label" htmlFor={`${awalan}-date`}>Rencana dibayar</label>
        <input id={`${awalan}-date`} name="plannedDate" type="date" className="input"
          defaultValue={nilai?.plannedDate} required />
      </div>

      <div>
        <label className="label" htmlFor={`${awalan}-account`}>Dibebankan ke akun</label>
        <SearchableSelect
          id={`${awalan}-account`}
          name="accountId"
          options={accounts.map((a) => ({ value: a.id, code: a.code, label: a.name }))}
          defaultValue={nilai?.accountId ?? ''}
          placeholder="— Pilih akun —"
          searchPlaceholder="Ketik nomor atau nama akun…"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Wajib: akun beban atau aset tetap yang menanggung biaya ini, misalnya Biaya Renovasi
          atau Aset Dalam Pengerjaan.
        </p>
      </div>

      {state.message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </div>
      )}

      <SubmitButton label={nilai ? 'Simpan perubahan' : 'Tambah item'} onTutup={onTutup} />
    </form>
  );
}

/** Tombol Ubah di baris item, membuka formulir yang sama dengan isinya terisi. */
export function UbahItemProyekDialog({
  nilai,
  accounts,
}: {
  nilai: NilaiItemProyek;
  accounts: { id: string; code: string; name: string }[];
}) {
  return (
    <DialogTombol
      label="Ubah"
      varian="tautan"
      lebar="sm"
      judul={`Ubah item ${nilai.name}`}
      keterangan="Perubahan selama proyek berjalan: jumlah, harga, jadwal, atau akunnya. Totalnya dihitung ulang, dan peramalan ikut berubah."
    >
      {(tutup) => <CostItemForm accounts={accounts} nilai={nilai} onTutup={tutup} />}
    </DialogTombol>
  );
}

/**
 * Memilih akun untuk item lama yang dibuat sebelum akun diwajibkan. Disimpan
 * begitu dipilih; item yang sudah berakun tidak menampilkan pilihan ini.
 */
export function CostItemAccount({
  id,
  accounts,
}: {
  id: string;
  accounts: { id: string; code: string; name: string }[];
}) {
  const [state, action] = useActionState(setCostItemAccount, initial);
  const [pending, mulai] = useTransition();

  return (
    <div className="min-w-[12rem]">
      <span className="mb-1 block text-[11px] font-medium text-amber-700">Belum ada akun — wajib diisi</span>
      <SearchableSelect
        options={accounts.map((a) => ({ value: a.id, code: a.code, label: a.name }))}
        placeholder={pending ? 'Menyimpan…' : '— Pilih akun —'}
        searchPlaceholder="Ketik nomor atau nama akun…"
        disabled={pending}
        onChange={(accountId) => {
          if (!accountId) return;
          const data = new FormData();
          data.set('id', id);
          data.set('accountId', accountId);
          mulai(() => action(data));
        }}
      />
      {!state.ok && state.message && <span className="mt-0.5 block text-[11px] text-red-600">{state.message}</span>}
    </div>
  );
}

export type PembayaranTampil = { id: string; tanggal: string; amount: number; note: string | null };

function HapusPembayaran({ id }: { id: string }) {
  const [state, action] = useActionState(hapusPembayaranItem, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-slate-400 hover:text-red-600">Hapus</button>
      {!state.ok && state.message && <span className="ml-2 text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

/**
 * Realisasi satu item: pembayaran yang sudah dicatat (boleh beberapa kali,
 * sebagian-sebagian), formulir pembayaran baru, dan tanda selesai belanja.
 */
export function RealisasiItemDialog({
  itemId, nama, total, realisasi, selesai, pembayaran, tanggalBawaan,
}: {
  itemId: string;
  nama: string;
  total: number;
  realisasi: number;
  selesai: boolean;
  pembayaran: PembayaranTampil[];
  /** Hari ini, untuk isian tanggal pembayaran. */
  tanggalBawaan: string;
}) {
  const [stateBayar, bayar] = useActionState(tambahPembayaranItem, initial);
  const [stateSelesai, tandai] = useActionState(setItemSelesai, initial);
  const sisa = Math.max(0, total - realisasi);
  const selisih = total - realisasi;

  return (
    <DialogTombol
      label="Realisasi"
      varian="tautan"
      lebar="sm"
      judul={`Realisasi ${nama}`}
      keterangan="Catat setiap pembayaran, boleh sebagian-sebagian. Tandai selesai bila pembelanjaannya sudah tuntas, berapa pun totalnya."
    >
      {(tutup) => (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div><dt className="text-xs text-slate-500">Rencana</dt><dd className="font-medium tabular-nums">{formatRupiah(total)}</dd></div>
            <div><dt className="text-xs text-slate-500">Sudah dibayar</dt><dd className="font-medium tabular-nums">{formatRupiah(realisasi)}</dd></div>
            <div>
              <dt className="text-xs text-slate-500">{selesai ? (selisih >= 0 ? 'Hemat' : 'Lebih mahal') : 'Sisa'}</dt>
              <dd className={`font-medium tabular-nums ${selesai ? (selisih >= 0 ? 'text-emerald-700' : 'text-red-600') : ''}`}>
                {formatRupiah(selesai ? Math.abs(selisih) : sisa)}
              </dd>
            </div>
          </dl>

          {pembayaran.length > 0 && (
            <ul className="divide-y divide-slate-100 text-sm">
              {pembayaran.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span>
                    <span className="tabular-nums">{p.tanggal}</span>
                    {p.note && <span className="ml-2 text-xs text-slate-500">{p.note}</span>}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="font-medium tabular-nums">{formatRupiah(p.amount)}</span>
                    <HapusPembayaran id={p.id} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form action={bayar} className="space-y-3 rounded-lg border border-slate-200 p-3" key={stateBayar.ok ? stateBayar.message : 'bayar'}>
            <input type="hidden" name="itemId" value={itemId} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor={`bayar-tgl-${itemId}`}>Tanggal bayar</label>
                <input id={`bayar-tgl-${itemId}`} name="date" type="date" className="input" defaultValue={tanggalBawaan} required />
              </div>
              <div className="min-w-0">
                <label className="label" htmlFor={`bayar-nom-${itemId}`}>Nominal</label>
                <MoneyInput id={`bayar-nom-${itemId}`} name="amount" placeholder={sisa > 0 ? String(Math.round(sisa)) : '0'} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor={`bayar-cat-${itemId}`}>Catatan</label>
              <input id={`bayar-cat-${itemId}`} name="note" className="input" placeholder="Opsional, mis. DP 50%" />
            </div>
            <button type="submit" className="btn-primary">Catat pembayaran</button>
            {stateBayar.message && (
              <p className={`text-sm ${stateBayar.ok ? 'text-emerald-700' : 'text-red-600'}`}>{stateBayar.message}</p>
            )}
          </form>

          <form action={tandai} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="selesai" value={selesai ? 'tidak' : 'ya'} />
            <button type="submit" className={selesai ? 'btn-secondary' : 'btn-primary'}>
              {selesai ? 'Buka lagi (belum selesai)' : 'Tandai pembelanjaan selesai'}
            </button>
            <button type="button" className="btn-secondary" onClick={tutup}>Tutup</button>
            {stateSelesai.message && (
              <p className={`w-full text-sm ${stateSelesai.ok ? 'text-emerald-700' : 'text-red-600'}`}>{stateSelesai.message}</p>
            )}
          </form>
        </div>
      )}
    </DialogTombol>
  );
}
