'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteObligation, deleteVehicle, payObligation, saveObligation, saveVehicle,
  setObligationActive, unpayObligation, type ActionState,
} from '@/app/actions';
import { PENGULANGAN } from '@/lib/kewajiban';
import { formatRupiah, toDateInput } from '@/lib/format';
import { MoneyInput } from './money-input';

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

function TautanKecil({ label, merah = false }: { label: string; merah?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`text-xs font-medium hover:underline ${merah ? 'text-red-600' : 'text-slate-600'}`}
    >
      {pending ? '…' : label}
    </button>
  );
}

/** Dua jadwal yang hampir selalu dipunyai sebuah kendaraan. */
const BAWAAN_KENDARAAN = [
  { label: 'Pajak tahunan', repeat: 'TAHUNAN', every: 1 },
  { label: 'STNK 5 tahunan', repeat: 'TAHUNAN', every: 5 },
];

/**
 * Formulir kewajiban. Dipakai di dua tempat: berdiri sendiri di menu Kewajiban
 * Terjadwal, dan menempel pada satu kendaraan di menu Kendaraan — bedanya cuma
 * pemilih kendaraannya diganti nilai tetap.
 */
export function ObligationForm({
  vehicleId, kendaraan = [], hariIni,
}: {
  /** Bila diisi, kewajiban langsung menempel pada kendaraan itu. */
  vehicleId?: string;
  kendaraan?: { id: string; plate: string; name: string }[];
  hariIni: string;
}) {
  const [state, action] = useActionState(saveObligation, initial);
  const [repeat, setRepeat] = useState('TAHUNAN');
  const [label, setLabel] = useState('');
  const [every, setEvery] = useState(1);

  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'baru'}>
      {vehicleId && <input type="hidden" name="vehicleId" value={vehicleId} />}

      {vehicleId && (
        <div className="flex flex-wrap gap-2">
          {BAWAAN_KENDARAAN.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => { setLabel(b.label); setRepeat(b.repeat); setEvery(b.every); }}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="label" htmlFor="kw-label">Nama kewajiban</label>
        <input
          id="kw-label"
          name="label"
          className="input"
          placeholder="Pajak tahunan"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
      </div>

      {!vehicleId && kendaraan.length > 0 && (
        <div>
          <label className="label" htmlFor="kw-kendaraan">Kendaraan</label>
          <select id="kw-kendaraan" name="vehicleId" className="input" defaultValue="">
            <option value="">— bukan kendaraan —</option>
            {kendaraan.map((k) => (
              <option key={k.id} value={k.id}>{k.plate} · {k.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor="kw-amount">Nominal</label>
        <MoneyInput id="kw-amount" name="amount" placeholder="3.500.000" required />
      </div>

      <div>
        <label className="label" htmlFor="kw-due">Jatuh tempo berikutnya</label>
        <input id="kw-due" name="dueDate" type="date" className="input" defaultValue={hariIni} required />
      </div>

      <div>
        <label className="label" htmlFor="kw-repeat">Pengulangan</label>
        <div className="flex items-center gap-2">
          <select
            id="kw-repeat"
            name="repeat"
            className="input min-w-0 flex-1"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          >
            {PENGULANGAN.map((p) => (
              <option key={p.nilai} value={p.nilai}>{p.label}</option>
            ))}
          </select>
          {repeat !== 'SEKALI' && (
            <span className="flex items-center gap-1 whitespace-nowrap text-sm text-slate-500">
              tiap
              <input
                name="repeatEvery"
                type="number"
                min={1}
                max={60}
                className="input w-16"
                value={every}
                onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Tiap berapa kali"
              />
              {repeat === 'TAHUNAN' ? 'tahun' : 'bulan'}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">STNK lima tahunan berarti tiap 5 tahun.</p>
      </div>

      <div>
        <label className="label" htmlFor="kw-notes">Catatan</label>
        <input id="kw-notes" name="notes" className="input" placeholder="Opsional" />
      </div>

      <Submit label="Tambah kewajiban" />
      <p className="text-xs text-slate-500">
        Jangan masukkan yang sudah terhitung di dalam pengeluaran rutin bulanan pada Rencana Kas —
        kalau dihitung di dua tempat, kas terlihat lebih buruk daripada kenyataannya.
      </p>
      <Pesan state={state} />
    </form>
  );
}

/** Tandai lunas: tanggal bayar dan nominal sebenarnya, bukan nominal perkiraan. */
export function PayObligation({
  id, jatuhTempo, perkiraan, hariIni,
}: {
  id: string;
  jatuhTempo: Date;
  perkiraan: number;
  hariIni: string;
}) {
  const [state, action] = useActionState(payObligation, initial);
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-slate-600 hover:underline"
        onClick={() => setBuka(true)}
      >
        Tandai lunas
      </button>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dueDate" value={toDateInput(jatuhTempo)} />
      <p className="mb-2 text-xs text-slate-500">
        Melunasi jatuh tempo {toDateInput(jatuhTempo)}. Nominal perkiraannya {formatRupiah(perkiraan)}.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`bayar-tgl-${id}`}>Tanggal bayar</label>
          <input id={`bayar-tgl-${id}`} name="paidDate" type="date" className="input" defaultValue={hariIni} required />
        </div>
        <div>
          <label className="label" htmlFor={`bayar-nom-${id}`}>Nominal sebenarnya</label>
          <MoneyInput id={`bayar-nom-${id}`} name="amount" defaultValue={String(perkiraan)} required />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Submit label="Simpan pelunasan" full={false} />
        <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setBuka(false)}>
          Batal
        </button>
      </div>
      <Pesan state={state} />
    </form>
  );
}

export function ObligationActions({
  id, active, adaPelunasan,
}: {
  id: string;
  active: boolean;
  adaPelunasan: boolean;
}) {
  const [hapusState, hapusAction] = useActionState(deleteObligation, initial);
  const [aktifState, aktifAction] = useActionState(setObligationActive, initial);
  const [batalState, batalAction] = useActionState(unpayObligation, initial);
  const [pending, mulaiTransition] = useTransition();
  const [konfirmasi, setKonfirmasi] = useState(false);

  const jalankan = (aksi: (fd: FormData) => void, tambahan?: Record<string, string>) => {
    const data = new FormData();
    data.set('id', id);
    for (const [k, v] of Object.entries(tambahan ?? {})) data.set(k, v);
    mulaiTransition(() => aksi(data));
  };

  return (
    <span className="flex flex-wrap items-center justify-end gap-3">
      {adaPelunasan && (
        <button
          type="button"
          disabled={pending}
          onClick={() => jalankan(batalAction)}
          className="text-xs font-medium text-slate-600 hover:underline"
        >
          Batalkan pelunasan
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => jalankan(aktifAction, { active: active ? 'false' : 'true' })}
        className="text-xs font-medium text-slate-600 hover:underline"
      >
        {active ? 'Nonaktifkan' : 'Aktifkan'}
      </button>

      {konfirmasi ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => jalankan(hapusAction)}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Ya, hapus
          </button>
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
            Batal
          </button>
        </>
      ) : (
        <button
          type="button"
          className="text-xs font-medium text-red-600 hover:underline"
          onClick={() => setKonfirmasi(true)}
        >
          Hapus
        </button>
      )}

      {[hapusState, aktifState, batalState].map((s, i) => (
        !s.ok && s.message ? <span key={i} className="text-xs text-red-600">{s.message}</span> : null
      ))}
    </span>
  );
}

/* ---------------------------- kendaraan ---------------------------- */

export function VehicleForm({ unit }: { unit: { id: string; code: string; name: string }[] }) {
  const [state, action] = useActionState(saveVehicle, initial);
  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'baru'}>
      <div>
        <label className="label" htmlFor="kn-plate">Plat nomor</label>
        <input id="kn-plate" name="plate" className="input" placeholder="DK 1234 XY" required />
      </div>
      <div>
        <label className="label" htmlFor="kn-name">Nama kendaraan</label>
        <input id="kn-name" name="name" className="input" placeholder="Avanza putih" required />
      </div>
      <div>
        <label className="label" htmlFor="kn-kind">Jenis</label>
        <select id="kn-kind" name="kind" className="input" defaultValue="MOBIL">
          <option value="MOBIL">Mobil</option>
          <option value="MOTOR">Motor</option>
          <option value="LAINNYA">Lainnya</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="kn-unit">Unit pemilik</label>
        <select id="kn-unit" name="unitId" className="input" defaultValue="">
          <option value="">— milik grup —</option>
          {unit.map((u) => (
            <option key={u.id} value={u.id}>{u.code} · {u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="kn-notes">Catatan</label>
        <input id="kn-notes" name="notes" className="input" placeholder="Opsional, mis. disewakan harian" />
      </div>
      <Submit label="Tambah kendaraan" />
      <Pesan state={state} />
    </form>
  );
}

export function VehicleDelete({ id, plate, jumlahJadwal }: { id: string; plate: string; jumlahJadwal: number }) {
  const [state, action] = useActionState(deleteVehicle, initial);
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
    <span className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs text-slate-600">
        {jumlahJadwal > 0
          ? `${jumlahJadwal} jadwal ${plate} ikut terhapus. Lanjut?`
          : `Hapus ${plate}?`}
      </span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <TautanKecil label="Ya, hapus" merah />
      </form>
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
        Batal
      </button>
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}

/** Formulir jadwal untuk satu kendaraan, disembunyikan sampai diperlukan. */
export function TambahJadwal({ vehicleId, hariIni }: { vehicleId: string; hariIni: string }) {
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-brand-700 hover:underline"
        onClick={() => setBuka(true)}
      >
        + Tambah jadwal pajak
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Jadwal baru</p>
        <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setBuka(false)}>
          Tutup
        </button>
      </div>
      <ObligationForm vehicleId={vehicleId} hariIni={hariIni} />
    </div>
  );
}
