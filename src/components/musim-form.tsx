'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteSeason, saveSeason, seedSeasons, setSeasonMonth, type ActionState,
} from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

function Pesan({ state }: { state: ActionState }) {
  if (!state.message) return null;
  const warna = !state.ok ? 'text-red-600' : state.warn ? 'text-amber-700' : 'text-emerald-700';
  return <p className={`mt-2 text-sm ${warna}`}>{state.message}</p>;
}

function Submit({ label, full = true }: { label: string; full?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn-primary ${full ? 'w-full' : ''}`} disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

export function SeedSeasons() {
  const [state, action] = useActionState(seedSeasons, initial);
  return (
    <form action={action}>
      <Submit label="Isi dengan lima musim bawaan" full={false} />
      <Pesan state={state} />
    </form>
  );
}

export function SeasonForm() {
  const [state, action] = useActionState(saveSeason, initial);
  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'baru'}>
      <div>
        <label className="label" htmlFor="ms-code">Kode</label>
        <input id="ms-code" name="code" className="input" placeholder="SHOULDER" required />
      </div>
      <div>
        <label className="label" htmlFor="ms-name">Nama</label>
        <input id="ms-name" name="name" className="input" placeholder="Shoulder season" required />
      </div>
      <div>
        <label className="label" htmlFor="ms-delta">Selisih terhadap acuan (%)</label>
        <input id="ms-delta" name="delta" inputMode="numeric" className="input" placeholder="12" required />
        <p className="mt-1 text-xs text-slate-500">
          Boleh negatif. Musim acuan diisi 0 — seluruh musim lain diukur terhadapnya.
        </p>
      </div>
      <Submit label="Tambah musim" />
      <Pesan state={state} />
    </form>
  );
}

/** Persen sebuah musim, disunting di tempat seperti porsi kategori. */
export function SeasonDelta({
  id, code, name, delta,
}: {
  id: string; code: string; name: string; delta: number;
}) {
  const [state, action] = useActionState(saveSeason, initial);
  const [nilai, setNilai] = useState(String(delta));
  const berubah = nilai.trim() !== String(delta);

  return (
    <form action={action} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="name" value={name} />
      <input
        name="delta"
        inputMode="numeric"
        value={nilai}
        onChange={(e) => setNilai(e.target.value.replace(/[^\d.-]/g, ''))}
        aria-label={`Persen ${name}`}
        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <span className="text-sm text-slate-500">%</span>
      {berubah && <SimpanKecil />}
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

function SimpanKecil() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-xs font-medium text-slate-600 hover:underline">
      {pending ? '…' : 'Simpan'}
    </button>
  );
}

export function SeasonDelete({ id, jumlahBulan }: { id: string; jumlahBulan: number }) {
  const [state, action] = useActionState(deleteSeason, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  if (!konfirmasi) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-red-600 hover:underline"
        onClick={() => setKonfirmasi(true)}
      >
        Hapus
      </button>
    );
  }
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="text-xs text-slate-600">
        {jumlahBulan > 0 ? `${jumlahBulan} bulan akan kehilangan musimnya. Lanjut?` : 'Hapus musim ini?'}
      </span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <SimpanKecil />
      </form>
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
        Batal
      </button>
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}

/**
 * Pemilih musim untuk satu bulan. Menyimpan begitu pilihannya berubah — satu
 * tombol simpan per bulan berarti dua belas tombol di satu layar.
 */
export function MonthSeason({
  month, seasonId, seasons,
}: {
  month: number;
  seasonId: string | null;
  seasons: { id: string; name: string; delta: number }[];
}) {
  const [state, action] = useActionState(setSeasonMonth, initial);
  const { pending } = useFormStatus();

  return (
    <form action={action}>
      <input type="hidden" name="month" value={month} />
      <select
        name="seasonId"
        defaultValue={seasonId ?? ''}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label={`Musim bulan ke-${month}`}
        className="input py-1.5 text-sm"
      >
        <option value="">— belum ditentukan —</option>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.delta > 0 ? '+' : ''}{s.delta}%)
          </option>
        ))}
      </select>
      {!state.ok && state.message && <p className="mt-1 text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
