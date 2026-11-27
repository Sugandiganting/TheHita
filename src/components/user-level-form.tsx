'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { hapusUserLevel, setelLevelPengguna, simpanUserLevel, type ActionState } from '@/app/actions';
import { KATALOG_HAK } from '@/lib/hak-akses';
import { DialogTombol } from './dialog';

const initial: ActionState = { ok: false, message: '' };

function Simpan({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

/** Formulir user level: nama, keterangan, dan centang hak akses per menu. */
export function UserLevelForm({
  nilai, onTutup,
}: {
  nilai?: { id: string; name: string; description: string | null; hak: string[] };
  onTutup?: () => void;
}) {
  const [state, action] = useActionState(
    async (prev: ActionState, data: FormData) => {
      const hasil = await simpanUserLevel(prev, data);
      if (hasil.ok && onTutup) onTutup();
      return hasil;
    },
    initial,
  );
  const awalan = nilai ? `ul-${nilai.id}` : 'ul-baru';
  const dicentang = new Set(nilai?.hak ?? []);

  return (
    <form action={action} className="space-y-4" key={!nilai && state.ok ? state.message : 'isi'}>
      {nilai && <input type="hidden" name="id" value={nilai.id} />}
      <div>
        <label className="label" htmlFor={`${awalan}-nama`}>Nama user level</label>
        <input id={`${awalan}-nama`} name="name" className="input" defaultValue={nilai?.name}
          placeholder="Misalnya: Manajer Keuangan" required />
      </div>
      <div>
        <label className="label" htmlFor={`${awalan}-ket`}>Keterangan</label>
        <input id={`${awalan}-ket`} name="description" className="input" defaultValue={nilai?.description ?? ''}
          placeholder="Opsional, mis. menyetujui dana proyek" />
      </div>
      {KATALOG_HAK.map((m) => (
        <fieldset key={m.modul} className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">{m.modul}</legend>
          <div className="space-y-2">
            {m.hak.map((h) => (
              <label key={h.kode} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="hak" value={h.kode} defaultChecked={dicentang.has(h.kode)} className="mt-1" />
                <span>
                  <span className="font-medium text-slate-900">{h.label}</span>
                  <span className="block text-xs text-slate-500">{h.keterangan}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Simpan label={nilai ? 'Simpan perubahan' : 'Tambah user level'} />
      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}
    </form>
  );
}

export function UbahUserLevelDialog({ nilai }: { nilai: { id: string; name: string; description: string | null; hak: string[] } }) {
  return (
    <DialogTombol label="Ubah" varian="tautan" judul={`Ubah ${nilai.name}`}
      keterangan="Perubahan hak akses langsung berlaku bagi semua pengguna di level ini.">
      {(tutup) => <UserLevelForm nilai={nilai} onTutup={tutup} />}
    </DialogTombol>
  );
}

export function HapusUserLevel({ id, nama }: { id: string; nama: string }) {
  const [state, action] = useActionState(hapusUserLevel, initial);
  const [yakin, setYakin] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      {yakin ? (
        <form action={action} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-slate-600">Hapus {nama}?</span>
          <button type="submit" className="font-medium text-red-600 hover:underline">Ya</button>
          <button type="button" className="text-slate-500 hover:underline" onClick={() => setYakin(false)}>Batal</button>
        </form>
      ) : (
        <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setYakin(true)}>Hapus</button>
      )}
      {!state.ok && state.message && <span className="block text-red-600">{state.message}</span>}
    </span>
  );
}

/**
 * Pilihan user level seorang pengguna, tersimpan begitu diganti. Dikendalikan
 * dan dikirim langsung — bukan lewat form action — karena React mengosongkan
 * formulir setelah aksinya selesai, dan pilihan yang baru disimpan akan
 * terlihat kembali ke semula.
 */
export function SetelLevel({
  id, levelId, levels,
}: {
  id: string;
  levelId: string | null;
  levels: { id: string; name: string }[];
}) {
  const [nilai, setNilai] = useState(levelId ?? '');
  const [state, setState] = useState<ActionState>(initial);
  const [sibuk, setSibuk] = useState(false);
  return (
    <span className="block">
      <select
        aria-label="User level"
        className="input py-1 text-sm"
        value={nilai}
        disabled={sibuk}
        onChange={async (e) => {
          const baru = e.target.value;
          const lama = nilai;
          setNilai(baru);
          setSibuk(true);
          const data = new FormData();
          data.set('id', id);
          data.set('levelId', baru);
          const hasil = await setelLevelPengguna(initial, data);
          setSibuk(false);
          setState(hasil);
          if (!hasil.ok) setNilai(lama);
        }}
      >
        <option value="">— Tanpa level (akses penuh) —</option>
        {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {state.message && (
        <span className={`mt-1 block text-[11px] ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</span>
      )}
    </span>
  );
}
