'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  hapusKategoriBarang, hapusSatuan, hapusSubKategori, setelAktifItem, simpanItem,
  simpanKategoriBarang, simpanSatuan, simpanSubKategori, type ActionState,
} from '@/app/actions';
import { SearchableSelect, type PickerOption } from './searchable-select';

const initial: ActionState = { ok: false, message: '' };

export type Pilihan = { id: string; code: string; name: string };
export type Sub = Pilihan & { categoryId: string };

/** Kode dicari sekaligus dengan namanya, jadi keduanya masuk ke pilihan. */
function opsi(daftar: Pilihan[]): PickerOption[] {
  return daftar.map((d) => ({ value: d.id, code: d.code, label: d.name }));
}

function Tombol({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

function Pesan({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={`mt-2 rounded-md px-3 py-2 text-sm ${
      state.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    }`}>
      {state.message}
    </p>
  );
}

/** Tombol hapus dua langkah: sekali untuk bertanya, sekali untuk sungguhan. */
function Hapus({
  id, aksi, tanya,
}: {
  id: string;
  aksi: (p: ActionState, f: FormData) => Promise<ActionState>;
  tanya: string;
}) {
  const [state, action] = useActionState(aksi, initial);
  const [yakin, setYakin] = useState(false);

  if (!state.ok && state.message) {
    return <span className="text-[11px] text-red-600">{state.message}</span>;
  }
  if (!yakin) {
    return (
      <button type="button" className="text-xs font-medium text-red-600 hover:underline"
        onClick={() => setYakin(true)}>
        Hapus
      </button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-[11px] text-slate-500">{tanya}</span>
      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">Ya</button>
      <button type="button" className="text-xs text-slate-500 hover:underline"
        onClick={() => setYakin(false)}>Batal</button>
    </form>
  );
}

/* ---------------------------------------------------------------- klasifikasi */

export function FormSatuan() {
  const [state, action] = useActionState(simpanSatuan, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.message : 'isi'}>
      <div className="w-28">
        <label className="label" htmlFor="sat-code">Kode</label>
        <input id="sat-code" name="code" className="input font-mono" placeholder="KG" required />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="sat-name">Nama</label>
        <input id="sat-name" name="name" className="input" placeholder="Kilogram" required />
      </div>
      <Tombol label="Tambah" />
      <div className="w-full"><Pesan state={state} /></div>
    </form>
  );
}

export function HapusSatuan({ id, kode }: { id: string; kode: string }) {
  return <Hapus id={id} aksi={hapusSatuan} tanya={`Hapus satuan ${kode}?`} />;
}

export function FormKategori() {
  const [state, action] = useActionState(simpanKategoriBarang, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.message : 'isi'}>
      <div className="w-32">
        <label className="label" htmlFor="kat-code">Kode</label>
        <input id="kat-code" name="code" className="input font-mono" placeholder="OPEX" required />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="kat-name">Nama</label>
        <input id="kat-name" name="name" className="input" placeholder="Operasional" required />
      </div>
      <Tombol label="Tambah" />
      <div className="w-full"><Pesan state={state} /></div>
    </form>
  );
}

export function HapusKategori({ id, kode }: { id: string; kode: string }) {
  return <Hapus id={id} aksi={hapusKategoriBarang} tanya={`Hapus kategori ${kode}?`} />;
}

export function FormSubKategori({ kategori }: { kategori: Pilihan[] }) {
  const [state, action] = useActionState(simpanSubKategori, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2" key={state.ok ? state.message : 'isi'}>
      <div className="min-w-[14rem] flex-1">
        <label className="label" htmlFor="sub-kat">Kategori induk</label>
        <SearchableSelect
          id="sub-kat"
          name="categoryId"
          options={opsi(kategori)}
          required
          placeholder="— Pilih kategori —"
          searchPlaceholder="Ketik kode atau nama kategori…"
        />
      </div>
      <div className="w-32">
        <label className="label" htmlFor="sub-code">Kode</label>
        <input id="sub-code" name="code" className="input font-mono" placeholder="CHEM" required />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="sub-name">Nama</label>
        <input id="sub-name" name="name" className="input" placeholder="Chemical" required />
      </div>
      <Tombol label="Tambah" />
      <div className="w-full"><Pesan state={state} /></div>
    </form>
  );
}

export function HapusSubKategori({ id, kode }: { id: string; kode: string }) {
  return <Hapus id={id} aksi={hapusSubKategori} tanya={`Hapus sub kategori ${kode}?`} />;
}

/* ----------------------------------------------------------------- item */

export function FormItem({
  kategori, sub, satuan, akun,
}: {
  kategori: Pilihan[];
  sub: Sub[];
  satuan: Pilihan[];
  akun: Pilihan[];
}) {
  const [state, action] = useActionState(simpanItem, initial);
  const [kat, setKat] = useState('');
  const [subTerpilih, setSubTerpilih] = useState('');

  // Sub kategori milik kategori lain akan menghasilkan barang yang terbaca di
  // dua tempat sekaligus, jadi daftarnya disempitkan — bukan hanya ditolak
  // setelah disimpan.
  const subTersedia = useMemo(() => sub.filter((s) => s.categoryId === kat), [sub, kat]);

  // Tanpa ini, sub kategori yang sudah terpilih tetap terkirim setelah
  // kategorinya diganti — dan yang tersimpan bukan yang terbaca di layar.
  const gantiKategori = (v: string) => {
    setKat(v);
    setSubTerpilih('');
  };

  /*
   * Dikosongkan sendiri setelah tersimpan.
   *
   * Kode, nama, satuan dan akun sudah kosong dengan sendirinya karena `key`
   * pada <form> melahirkan ulang isinya. Kategori dan sub kategori tidak:
   * keduanya terkendali oleh state di sini, yang hidup di luar form itu.
   * Membiarkannya terisi memang menghemat dua klik saat mendaftarkan beberapa
   * barang sekaligus, tetapi sub kategori yang tertinggal dari barang
   * sebelumnya akan ikut tersimpan pada barang berikutnya tanpa ada yang
   * terlihat salah — dan itu harganya jauh lebih mahal daripada dua klik.
   */
  useEffect(() => {
    if (!state.ok) return;
    setKat('');
    setSubTerpilih('');
  }, [state]);

  /*
   * Pilihan "tanpa sub kategori" ikut masuk daftar, bukan dibiarkan sebagai
   * keadaan kosong yang hanya bisa dicapai dengan tidak menyentuh kolomnya.
   * Begitu seseorang sudah memilih satu sub kategori, tanpa pilihan ini ia
   * tidak punya cara membatalkannya lagi.
   */
  const opsiSub: PickerOption[] = useMemo(
    () => [
      { value: '', code: '—', label: 'Tanpa sub kategori' },
      ...opsi(subTersedia),
    ],
    [subTersedia],
  );

  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'isi'}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="it-code">Kode barang</label>
          <input id="it-code" name="code" className="input font-mono" placeholder="CHEM-01"
            autoCapitalize="off" spellCheck={false} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="it-name">Nama barang</label>
          <input id="it-name" name="name" className="input" placeholder="Chemical Lantai" required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="it-kat">Kategori</label>
          <SearchableSelect
            id="it-kat"
            name="categoryId"
            options={opsi(kategori)}
            value={kat}
            onChange={gantiKategori}
            required
            placeholder="— Pilih kategori —"
            searchPlaceholder="Ketik kode atau nama kategori…"
          />
        </div>
        <div>
          <label className="label" htmlFor="it-sub">Sub kategori</label>
          <SearchableSelect
            id="it-sub"
            name="subCategoryId"
            options={opsiSub}
            value={subTerpilih}
            onChange={setSubTerpilih}
            disabled={!kat || subTersedia.length === 0}
            placeholder="— Tanpa sub kategori —"
            searchPlaceholder="Ketik kode atau nama sub kategori…"
          />
          {kat && subTersedia.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">Kategori ini belum punya sub kategori.</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="it-sat">Satuan</label>
          <SearchableSelect
            id="it-sat"
            name="unitId"
            options={opsi(satuan)}
            required
            placeholder="— Pilih satuan —"
            searchPlaceholder="Ketik kode atau nama satuan…"
          />
        </div>
        <div>
          <label className="label" htmlFor="it-akun">Akun COA</label>
          <SearchableSelect
            id="it-akun"
            name="accountId"
            options={opsi(akun)}
            required
            placeholder="— Pilih akun —"
            searchPlaceholder="Ketik nomor atau nama akun…"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Kode dan nama hanya perlu unik di dalam kategorinya — barang yang sama boleh didaftarkan
        lagi di kategori lain dengan akun COA yang berbeda. Penyusun RAB cukup memilih barangnya;
        akun COA inilah yang mengikuti.
      </p>

      <Tombol label="Simpan barang" />
      <Pesan state={state} />
    </form>
  );
}

export function AktifItem({ id, kode, aktif }: { id: string; kode: string; aktif: boolean }) {
  const [state, action] = useActionState(setelAktifItem, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="aktif" value={aktif ? 'false' : 'true'} />
      <button type="submit" className={`text-xs font-medium hover:underline ${
        aktif ? 'text-red-600' : 'text-emerald-700'
      }`}>
        {aktif ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      <span className="sr-only">{kode}</span>
      {!state.ok && state.message && (
        <span className="mt-1 block text-[11px] text-red-600">{state.message}</span>
      )}
    </form>
  );
}
