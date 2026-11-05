'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  hapusKategoriBarang, hapusSatuan, hapusSubKategori, setelAktifItem, simpanItem,
  simpanKategoriBarang, simpanSatuan, simpanSubKategori, type ActionState,
} from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

type Pilihan = { id: string; label: string };
type Sub = { id: string; label: string; categoryId: string };

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
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="sub-kat">Kategori induk</label>
        <select id="sub-kat" name="categoryId" className="input" required defaultValue="">
          <option value="" disabled>— Pilih —</option>
          {kategori.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
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

  // Sub kategori milik kategori lain akan menghasilkan barang yang terbaca di
  // dua tempat sekaligus, jadi daftarnya disempitkan — bukan hanya ditolak
  // setelah disimpan.
  const subTersedia = useMemo(() => sub.filter((s) => s.categoryId === kat), [sub, kat]);

  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'isi'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="it-code">Kode barang</label>
          <input id="it-code" name="code" className="input font-mono" placeholder="CHEM-01"
            autoCapitalize="off" spellCheck={false} required />
        </div>
        <div>
          <label className="label" htmlFor="it-name">Nama barang</label>
          <input id="it-name" name="name" className="input" placeholder="Chemical Lantai" required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="it-kat">Kategori</label>
          <select id="it-kat" name="categoryId" className="input" required value={kat}
            onChange={(e) => setKat(e.target.value)}>
            <option value="" disabled>— Pilih —</option>
            {kategori.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Kode dan nama hanya perlu unik di dalam kategorinya. Barang yang sama boleh didaftarkan
            lagi di kategori lain dengan akun COA yang berbeda.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="it-sub">Sub kategori</label>
          <select id="it-sub" name="subCategoryId" className="input" defaultValue=""
            disabled={!kat || subTersedia.length === 0}>
            <option value="">— Tanpa sub kategori —</option>
            {subTersedia.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {kat && subTersedia.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">Kategori ini belum punya sub kategori.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="it-sat">Satuan</label>
          <select id="it-sat" name="unitId" className="input" required defaultValue="">
            <option value="" disabled>— Pilih —</option>
            {satuan.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="it-akun">Akun COA</label>
          <select id="it-akun" name="accountId" className="input" required defaultValue="">
            <option value="" disabled>— Pilih —</option>
            {akun.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Penyusun RAB cukup memilih barangnya; akun ini yang mengikuti.
          </p>
        </div>
      </div>

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
