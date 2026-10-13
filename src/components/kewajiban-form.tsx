'use client';

import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteObligation, deleteVehicle, payObligation, saveObligation, saveVehicle,
  setObligationActive, unpayObligation, type ActionState,
} from '@/app/actions';
import { PENGULANGAN, labelPengulangan, type Pengulangan } from '@/lib/kewajiban';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
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
export type KewajibanAwal = {
  id: string;
  label: string;
  amount: number;
  /** Format yyyy-mm-dd, siap dipakai <input type="date">. */
  dueDate: string;
  repeat: string;
  repeatEvery: number;
  vehicleId: string | null;
  notes: string | null;
};

export function ObligationForm({
  vehicleId, kendaraan = [], hariIni, awal, onSelesai,
}: {
  /** Bila diisi, kewajiban langsung menempel pada kendaraan itu. */
  vehicleId?: string;
  kendaraan?: { id: string; plate: string; name: string }[];
  hariIni: string;
  /** Diisi saat menyunting kewajiban yang sudah ada. */
  awal?: KewajibanAwal;
  onSelesai?: () => void;
}) {
  const [state, action] = useActionState(saveObligation, initial);
  const [repeat, setRepeat] = useState(awal?.repeat ?? 'TAHUNAN');
  const [label, setLabel] = useState(awal?.label ?? '');
  const [every, setEvery] = useState(awal?.repeatEvery ?? 1);
  const sunting = awal !== undefined;
  // Formulir ini bisa muncul beberapa kali dalam satu halaman, jadi id-nya
  // harus berbeda — label yang menunjuk id kembar akan menyorot isian keliru.
  const sufiks = awal?.id ?? 'baru';

  // Setelah tersimpan, formulir sunting menutup sendiri supaya layarnya kembali
  // ke daftar — formulir yang tetap terbuka terbaca seolah belum tersimpan.
  useEffect(() => {
    if (state.ok && sunting) onSelesai?.();
  }, [state, sunting, onSelesai]);

  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'baru'}>
      {sunting && <input type="hidden" name="id" value={awal.id} />}
      {/* Kendaraannya ditentukan salah satu dari tiga: dipaksa oleh tempat
          formulirnya muncul, dipilih sendiri, atau dipertahankan apa adanya. */}
      {vehicleId ? (
        <input type="hidden" name="vehicleId" value={vehicleId} />
      ) : kendaraan.length === 0 && awal?.vehicleId ? (
        <input type="hidden" name="vehicleId" value={awal.vehicleId} />
      ) : null}

      {vehicleId && !sunting && (
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
        <label className="label" htmlFor={`kw-label-${sufiks}`}>Nama kewajiban</label>
        <input
          id={`kw-label-${sufiks}`}
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
          <label className="label" htmlFor={`kw-kendaraan-${sufiks}`}>Kendaraan</label>
          <select
            id={`kw-kendaraan-${sufiks}`}
            name="vehicleId"
            className="input"
            defaultValue={awal?.vehicleId ?? ''}
          >
            <option value="">— bukan kendaraan —</option>
            {kendaraan.map((k) => (
              <option key={k.id} value={k.id}>{k.plate} · {k.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label" htmlFor={`kw-amount-${sufiks}`}>Nominal</label>
        <MoneyInput
          id={`kw-amount-${sufiks}`}
          name="amount"
          placeholder="3.500.000"
          defaultValue={awal ? String(awal.amount) : undefined}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor={`kw-due-${sufiks}`}>Jatuh tempo berikutnya</label>
        <input
          id={`kw-due-${sufiks}`}
          name="dueDate"
          type="date"
          className="input"
          defaultValue={awal?.dueDate ?? hariIni}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor={`kw-repeat-${sufiks}`}>Pengulangan</label>
        <div className="flex items-center gap-2">
          <select
            id={`kw-repeat-${sufiks}`}
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
        <label className="label" htmlFor={`kw-notes-${sufiks}`}>Catatan</label>
        <input
          id={`kw-notes-${sufiks}`}
          name="notes"
          className="input"
          placeholder="Opsional"
          defaultValue={awal?.notes ?? ''}
        />
      </div>

      <div className="flex items-center gap-3">
        <Submit label={sunting ? 'Simpan perubahan' : 'Tambah kewajiban'} full={!sunting} />
        {sunting && onSelesai && (
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={onSelesai}>
            Batal
          </button>
        )}
      </div>
      {!sunting && (
        <p className="text-xs text-slate-500">
          Jangan masukkan yang sudah terhitung di dalam pengeluaran rutin bulanan pada Rencana Kas —
          kalau dihitung di dua tempat, kas terlihat lebih buruk daripada kenyataannya.
        </p>
      )}
      <Pesan state={state} />
    </form>
  );
}

/** Tandai lunas: tanggal bayar dan nominal sebenarnya, bukan nominal perkiraan. */
function FormPelunasan({
  id, jatuhTempo, perkiraan, hariIni, onSelesai,
}: {
  id: string;
  jatuhTempo: Date;
  perkiraan: number;
  hariIni: string;
  onSelesai: () => void;
}) {
  const [state, action] = useActionState(payObligation, initial);

  useEffect(() => {
    if (state.ok) onSelesai();
  }, [state, onSelesai]);

  return (
    <form action={action} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
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
        <button type="button" className="text-xs text-slate-500 hover:underline" onClick={onSelesai}>
          Batal
        </button>
      </div>
      <Pesan state={state} />
    </form>
  );
}

/**
 * Baris aksi sebuah kewajiban beserta dua formulir yang bisa dibukanya.
 *
 * Satu komponen untuk ketiganya, dengan alasan yang sama seperti kepala kartu
 * kendaraan: formulir yang terbuka harus memakai lebar penuh di bawah barisnya,
 * bukan terjepit di sebelah tombol Hapus.
 */
export function KewajibanAksi({
  aktif, adaPelunasan, jatuhTempo, perkiraan, hariIni, awal, kendaraan = [],
}: {
  aktif: boolean;
  adaPelunasan: boolean;
  /** Jatuh tempo berikutnya; null berarti tidak ada yang bisa dilunasi. */
  jatuhTempo: Date | null;
  perkiraan: number;
  hariIni: string;
  awal: KewajibanAwal;
  kendaraan?: { id: string; plate: string; name: string }[];
}) {
  const [mode, setMode] = useState<'bayar' | 'ubah' | null>(null);
  const tutup = useCallback(() => setMode(null), []);
  const ganti = (m: 'bayar' | 'ubah') => setMode((v) => (v === m ? null : m));

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-3">
          {aktif && jatuhTempo && (
            <button
              type="button"
              className="text-xs font-medium text-slate-600 hover:underline"
              onClick={() => ganti('bayar')}
            >
              {mode === 'bayar' ? 'Tutup' : 'Tandai lunas'}
            </button>
          )}
          <button
            type="button"
            className="text-xs font-medium text-slate-600 hover:underline"
            onClick={() => ganti('ubah')}
          >
            {mode === 'ubah' ? 'Tutup' : 'Ubah'}
          </button>
        </span>
        <ObligationActions id={awal.id} active={aktif} adaPelunasan={adaPelunasan} />
      </div>

      {mode === 'bayar' && jatuhTempo && (
        <div className="mt-3">
          <FormPelunasan
            id={awal.id}
            jatuhTempo={jatuhTempo}
            perkiraan={perkiraan}
            hariIni={hariIni}
            onSelesai={tutup}
          />
        </div>
      )}

      {mode === 'ubah' && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">Ubah kewajiban</p>
          <ObligationForm awal={awal} hariIni={hariIni} kendaraan={kendaraan} onSelesai={tutup} />
        </div>
      )}
    </>
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

export type KendaraanAwal = {
  id: string;
  plate: string;
  name: string;
  kind: string;
  unitId: string | null;
  active: boolean;
  notes: string | null;
};

export function VehicleForm({
  unit, awal, onSelesai,
}: {
  unit: { id: string; code: string; name: string }[];
  awal?: KendaraanAwal;
  onSelesai?: () => void;
}) {
  const [state, action] = useActionState(saveVehicle, initial);
  const [aktif, setAktif] = useState(awal?.active ?? true);
  const sunting = awal !== undefined;
  const sufiks = awal?.id ?? 'baru';

  useEffect(() => {
    if (state.ok && sunting) onSelesai?.();
  }, [state, sunting, onSelesai]);

  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'baru'}>
      {sunting && <input type="hidden" name="id" value={awal.id} />}
      <div>
        <label className="label" htmlFor={`kn-plate-${sufiks}`}>Plat nomor</label>
        <input
          id={`kn-plate-${sufiks}`}
          name="plate"
          className="input"
          placeholder="DK 1234 XY"
          defaultValue={awal?.plate ?? ''}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor={`kn-name-${sufiks}`}>Nama kendaraan</label>
        <input
          id={`kn-name-${sufiks}`}
          name="name"
          className="input"
          placeholder="Avanza putih"
          defaultValue={awal?.name ?? ''}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor={`kn-kind-${sufiks}`}>Jenis</label>
        <select id={`kn-kind-${sufiks}`} name="kind" className="input" defaultValue={awal?.kind ?? 'MOBIL'}>
          <option value="MOBIL">Mobil</option>
          <option value="MOTOR">Motor</option>
          <option value="LAINNYA">Lainnya</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`kn-unit-${sufiks}`}>Penanggung</label>
        <select id={`kn-unit-${sufiks}`} name="unitId" className="input" defaultValue={awal?.unitId ?? ''}>
          <option value="">Semua cabang (beban bersama)</option>
          {unit.map((u) => (
            <option key={u.id} value={u.id}>{u.code} · {u.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Pilih satu cabang hanya bila kendaraannya memang milik cabang itu sendiri. Baik beban
          bersama maupun milik satu cabang, pajaknya tetap keluar dari kas grup dan menekan rencana
          kas dengan nominal yang sama — pilihan ini menentukan siapa yang menanggungnya di laporan,
          bukan berapa yang keluar.
        </p>
      </div>
      <div>
        <label className="label" htmlFor={`kn-notes-${sufiks}`}>Catatan</label>
        <input
          id={`kn-notes-${sufiks}`}
          name="notes"
          className="input"
          placeholder="Opsional, mis. disewakan harian"
          defaultValue={awal?.notes ?? ''}
        />
      </div>

      {sunting && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="hidden" name="active" value={aktif ? 'on' : 'off'} />
          <input
            type="checkbox"
            checked={aktif}
            onChange={(e) => setAktif(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Masih dipakai
        </label>
      )}

      <div className="flex items-center gap-3">
        <Submit label={sunting ? 'Simpan perubahan' : 'Tambah kendaraan'} full={!sunting} />
        {sunting && onSelesai && (
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={onSelesai}>
            Batal
          </button>
        )}
      </div>
      <Pesan state={state} />
    </form>
  );
}

/**
 * Kepala kartu kendaraan: keterangannya, tombolnya, dan formulir suntingnya.
 *
 * Ketiganya satu komponen supaya formulir yang terbuka bisa muncul sebagai
 * baris penuh di bawah tombolnya — kalau tombol dan formulirnya terpisah,
 * formulir itu terjepit menjadi satu kolom di sebelah tombol Hapus.
 */
export function VehicleHeader({
  awal, unit, keterangan, jumlahJadwal,
}: {
  awal: KendaraanAwal;
  unit: { id: string; code: string; name: string }[];
  /** Baris keterangan di bawah plat, mis. "Scoopy · Motor · Semua cabang". */
  keterangan: string;
  jumlahJadwal: number;
}) {
  const [buka, setBuka] = useState(false);
  const tutup = useCallback(() => setBuka(false), []);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-800">
            {awal.plate}
            {!awal.active && <span className="ml-2 text-xs font-medium text-slate-500">nonaktif</span>}
          </p>
          <p className="text-sm text-slate-500">{keterangan}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xs font-medium text-slate-600 hover:underline"
            onClick={() => setBuka((v) => !v)}
          >
            {buka ? 'Tutup' : 'Ubah'}
          </button>
          <VehicleDelete id={awal.id} plate={awal.plate} jumlahJadwal={jumlahJadwal} />
        </div>
      </div>

      {buka && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">Ubah kendaraan</p>
          <VehicleForm unit={unit} awal={awal} onSelesai={tutup} />
        </div>
      )}
    </>
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

/**
 * Satu baris jadwal pada kartu kendaraan, beserta formulir suntingnya.
 *
 * Baris dan formulirnya harus berada di satu komponen: formulir yang terbuka
 * ditampilkan sebagai baris penuh di bawahnya, dan dua <tr> hanya bisa muncul
 * bersama dari satu tempat.
 */
export function JadwalRow({
  awal, jatuhTempo, aktif, hariIni,
}: {
  awal: KewajibanAwal;
  /** Jatuh tempo berikutnya; null berarti sudah selesai atau nonaktif. */
  jatuhTempo: Date | null;
  aktif: boolean;
  hariIni: string;
}) {
  const [buka, setBuka] = useState(false);
  const tutup = useCallback(() => setBuka(false), []);

  return (
    <>
      <tr className={aktif ? '' : 'text-slate-400'}>
        <td className="td">{awal.label}</td>
        <td className="td num whitespace-nowrap">{formatRupiah(awal.amount)}</td>
        <td className="td whitespace-nowrap text-xs">
          {labelPengulangan(awal.repeat as Pengulangan, awal.repeatEvery)}
        </td>
        <td className="td whitespace-nowrap">
          {!aktif ? 'nonaktif' : jatuhTempo ? formatDate(jatuhTempo) : 'selesai'}
        </td>
        <td className="td num">
          <button
            type="button"
            className="text-xs font-medium text-slate-600 hover:underline"
            onClick={() => setBuka((v) => !v)}
          >
            {buka ? 'Tutup' : 'Ubah'}
          </button>
        </td>
      </tr>
      {buka && (
        <tr>
          <td colSpan={5} className="px-0 pb-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <ObligationForm awal={awal} hariIni={hariIni} onSelesai={tutup} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
