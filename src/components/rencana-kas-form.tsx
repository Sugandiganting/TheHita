'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createCashPlan, deleteCashPlan, deleteCategory, deleteCheckpoint, deleteCommitment,
  deleteSpend, saveAssumptions, saveCashProjection, saveCategory, saveCheckpoint,
  saveCommitment, saveSpend, toggleCommitmentPaid, type ActionState,
} from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import { MoneyInput } from './money-input';

const initial: ActionState = { ok: false, message: '' };

function Submit({ label, full = true }: { label: string; full?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn-primary ${full ? 'w-full' : ''}`} disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

function Tautan({ label, pendingLabel, bahaya }: { label: string; pendingLabel: string; bahaya?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`text-xs font-medium hover:underline ${bahaya ? 'text-red-600' : 'text-slate-600'}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Pesan({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={`mt-2 text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>;
}

/** Membuat rencana bulan baru; komitmen bulan sebelumnya ikut tersalin. */
export function PlanForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, action] = useActionState(createCashPlan, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="rk-period">Buat bulan baru</label>
        <input id="rk-period" type="month" name="period" className="input" defaultValue={defaultPeriod} required />
      </div>
      <button type="submit" className="btn-primary">Buat rencana</button>
      <Pesan state={state} />
    </form>
  );
}

/**
 * Laporan posisi kas mingguan — satu-satunya hal yang wajib diisi ulang tiap
 * minggu. Angka menurut jurnal ditampilkan sebagai pembanding, bukan sebagai
 * isian, karena saldo bank yang sebenarnya hampir selalu mendahului pembukuan.
 */
export function CheckpointForm({
  planId, defaultDate, menurutJurnal, terakhir,
}: {
  planId: string;
  defaultDate: string;
  menurutJurnal: { saldoKas: number; masukBulanIni: number };
  terakhir: { cashOnHand: number; incomeToDate: number } | null;
}) {
  // Kedua kolom sengaja dibiarkan kosong. Angka minggu lalu memang berguna
  // sebagai pembanding, tetapi kalau diisikan ke kolomnya ia justru berbahaya:
  // ketikan baru menempel di belakangnya, dan kalau pemakai lupa menggantinya
  // sistem menyimpan angka basi tanpa keluhan apa pun.
  const [state, action] = useActionState(saveCheckpoint, initial);
  return (
    <form action={action} className="space-y-4" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />

      <div>
        <label className="label" htmlFor="rk-date">Posisi per tanggal</label>
        <input id="rk-date" type="date" name="date" className="input" defaultValue={defaultDate} required />
      </div>

      <div>
        <label className="label" htmlFor="rk-cash">Saldo kas &amp; bank hari ini</label>
        <MoneyInput
          id="rk-cash"
          name="cashOnHand"
          placeholder="143.458.339"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {terakhir && <>Terakhir dilaporkan {formatRupiah(terakhir.cashOnHand)} · </>}
          menurut jurnal {formatRupiah(menurutJurnal.saldoKas)}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rk-income">Uang masuk bulan ini s.d. tanggal itu</label>
        <MoneyInput
          id="rk-income"
          name="incomeToDate"
          placeholder="154.700.000"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {terakhir && <>Terakhir dilaporkan {formatRupiah(terakhir.incomeToDate)} · </>}
          menurut jurnal {formatRupiah(menurutJurnal.masukBulanIni)}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rk-cnote">Catatan</label>
        <input id="rk-cnote" name="notes" className="input" placeholder="Opsional" />
      </div>

      <Submit label="Simpan posisi kas" />
      <Pesan state={state} />
    </form>
  );
}

/** Tiga proyeksi uang masuk sebulan penuh. Dikosongkan = pakai usulan sistem. */
export function ProjectionForm({
  id, tersimpan, usulan, notes,
}: {
  id: string;
  tersimpan: { PESIMIS: number | null; NORMAL: number | null; OPTIMIS: number | null };
  usulan: { PESIMIS: number; NORMAL: number; OPTIMIS: number } | null;
  notes: string | null;
}) {
  const [state, action] = useActionState(saveCashProjection, initial);
  const baris = [
    { name: 'pesimis', label: 'Pesimis', nilai: tersimpan.PESIMIS, usul: usulan?.PESIMIS },
    { name: 'normal', label: 'Normal', nilai: tersimpan.NORMAL, usul: usulan?.NORMAL },
    { name: 'optimis', label: 'Optimis', nilai: tersimpan.OPTIMIS, usul: usulan?.OPTIMIS },
  ];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {baris.map((b) => (
        <div key={b.name}>
          <label className="label" htmlFor={`rk-${b.name}`}>{b.label}</label>
          <MoneyInput
            id={`rk-${b.name}`}
            name={b.name}
            defaultValue={b.nilai === null ? '' : String(b.nilai)}
            placeholder={b.usul === undefined ? '0' : String(Math.round(b.usul))}
          />
          <p className="mt-1 text-xs text-slate-500">
            {b.nilai === null
              ? b.usul === undefined
                ? 'Belum ada riwayat untuk diusulkan.'
                : `Kosong — memakai usulan ${formatRupiah(b.usul)}`
              : b.usul === undefined
                ? 'Angka Anda sendiri.'
                : `Usulan sistem ${formatRupiah(b.usul)}`}
          </p>
        </div>
      ))}

      <div>
        <label className="label" htmlFor="rk-notes">Catatan</label>
        <input id="rk-notes" name="notes" className="input" defaultValue={notes ?? ''} placeholder="Opsional" />
      </div>

      <Submit label="Simpan proyeksi" />
      <Pesan state={state} />
    </form>
  );
}

export function CommitmentForm({ planId }: { planId: string }) {
  const [state, action] = useActionState(saveCommitment, initial);
  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />
      <div>
        <label className="label" htmlFor="rk-klabel">Nama komitmen</label>
        <input id="rk-klabel" name="label" className="input" placeholder="Cicilan bank" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="rk-kamount">Nominal</label>
          <MoneyInput id="rk-kamount" name="amount" placeholder="75.600.000" required />
        </div>
        <div>
          <label className="label" htmlFor="rk-kdue">Tanggal</label>
          <input id="rk-kdue" name="dueDay" inputMode="numeric" className="input" placeholder="15" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="recurring" defaultChecked className="h-4 w-4 rounded border-slate-300" />
        Berulang tiap bulan
      </label>
      <Submit label="Tambah komitmen" />
      <Pesan state={state} />
    </form>
  );
}

export function CommitmentRow({ id, paid }: { id: string; paid: boolean }) {
  const [bayarState, bayarAction] = useActionState(toggleCommitmentPaid, initial);
  const [hapusState, hapusAction] = useActionState(deleteCommitment, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  return (
    <span className="flex items-center justify-end gap-3">
      <form action={bayarAction}>
        <input type="hidden" name="id" value={id} />
        <Tautan label={paid ? 'Batalkan' : 'Sudah dibayar'} pendingLabel="…" />
      </form>
      {konfirmasi ? (
        <>
          <form action={hapusAction}>
            <input type="hidden" name="id" value={id} />
            <Tautan label="Ya, hapus" pendingLabel="…" bahaya />
          </form>
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
            Batal
          </button>
        </>
      ) : (
        <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setKonfirmasi(true)}>
          Hapus
        </button>
      )}
      {!bayarState.ok && bayarState.message && <span className="text-xs text-red-600">{bayarState.message}</span>}
      {!hapusState.ok && hapusState.message && <span className="text-xs text-red-600">{hapusState.message}</span>}
    </span>
  );
}

export function CategoryForm({ planId }: { planId: string }) {
  const [state, action] = useActionState(saveCategory, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="rk-glabel">Kategori</label>
        <input id="rk-glabel" name="label" className="input" placeholder="Maintenance" required />
      </div>
      <div className="w-24">
        <label className="label" htmlFor="rk-gweight">Porsi</label>
        <input id="rk-gweight" name="weight" inputMode="numeric" className="input" placeholder="5" required />
      </div>
      <button type="submit" className="btn-primary">Tambah</button>
      <Pesan state={state} />
    </form>
  );
}

export function CategoryDelete({ id }: { id: string }) {
  const [state, action] = useActionState(deleteCategory, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Tautan label="Hapus" pendingLabel="…" bahaya />
      {!state.ok && state.message && <span className="ml-2 text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

export function CheckpointDelete({ id }: { id: string }) {
  const [state, action] = useActionState(deleteCheckpoint, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Tautan label="Hapus" pendingLabel="…" bahaya />
      {!state.ok && state.message && <span className="ml-2 text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

export function PlanDelete({ id, period }: { id: string; period: string }) {
  const [state, action] = useActionState(deleteCashPlan, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  if (!konfirmasi) {
    return (
      <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setKonfirmasi(true)}>
        Hapus rencana {period}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-3">
      <span className="text-xs text-slate-600">Hapus rencana {period} beserta seluruh isinya?</span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Tautan label="Ya, hapus" pendingLabel="Menghapus…" bahaya />
      </form>
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
        Batal
      </button>
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}

/**
 * Laporan belanja. Dua cara mencatat, dan perbedaannya penting: TAMBAH untuk
 * pengeluaran baru, SETEL bila angka yang dilaporkan adalah total terbaru —
 * misalnya setelah purchasing merekap ulang, atau setelah posisi kas diperbarui
 * sehingga hitungan sebelumnya sudah termasuk di saldo.
 */
export function SpendForm({
  planId, kategori, defaultDate,
}: {
  planId: string;
  kategori: { id: string; label: string; terpakai: number }[];
  defaultDate: string;
}) {
  const [state, action] = useActionState(saveSpend, initial);
  const [mode, setMode] = useState<'TAMBAH' | 'SETEL'>('TAMBAH');

  if (kategori.length === 0) {
    return <p className="text-sm text-slate-500">Tambahkan kategori terlebih dahulu.</p>;
  }

  return (
    <form action={action} className="space-y-4" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="mode" value={mode} />

      <div>
        <label className="label" htmlFor="rk-skat">Dibelanjakan oleh</label>
        <select id="rk-skat" name="categoryId" className="input" required defaultValue="">
          <option value="" disabled>Pilih kategori…</option>
          {kategori.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} — terpakai {formatRupiah(k.terpakai)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="label">Cara mencatat</span>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['TAMBAH', 'Tambah', 'Ditumpuk ke total sebelumnya'],
            ['SETEL', 'Setel ulang', 'Mengganti total jadi angka ini'],
          ] as const).map(([nilai, judul, jelas]) => (
            <button
              key={nilai}
              type="button"
              onClick={() => setMode(nilai)}
              aria-pressed={mode === nilai}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                mode === nilai
                  ? 'border-brand-500 bg-brand-50 text-brand-800'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >
              <span className="block font-medium">{judul}</span>
              <span className="block text-[11px] text-slate-500">{jelas}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="rk-samount">
          {mode === 'SETEL' ? 'Total belanja terbaru' : 'Nominal belanja'}
        </label>
        <MoneyInput id="rk-samount" name="amount" placeholder="14.000.000" required />
        {mode === 'SETEL' && (
          <p className="mt-1 text-xs text-slate-500">Isi 0 untuk mengosongkan hitungan kategori ini.</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="rk-sdate">Tanggal</label>
        <input id="rk-sdate" type="date" name="date" className="input" defaultValue={defaultDate} required />
      </div>

      <div>
        <label className="label" htmlFor="rk-snote">Catatan</label>
        <input id="rk-snote" name="notes" className="input" placeholder="Opsional" />
      </div>

      <Submit label={mode === 'SETEL' ? 'Setel ulang total' : 'Catat belanja'} />
      <Pesan state={state} />
    </form>
  );
}

export function SpendDelete({ id }: { id: string }) {
  const [state, action] = useActionState(deleteSpend, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Tautan label="Hapus" pendingLabel="…" bahaya />
      {!state.ok && state.message && <span className="ml-2 text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

/** Dua angka yang hanya dipakai meramalkan kapan kas habis. */
export function AssumptionForm({
  id, asumsi,
}: {
  id: string;
  asumsi: {
    monthlyOutflow: number | null; salaryNeed: number | null;
    usulanOutflow: number | null; usulanGaji: number | null;
  };
}) {
  const [state, action] = useActionState(saveAssumptions, initial);
  const baris = [
    {
      name: 'monthlyOutflow', label: 'Pengeluaran rutin per bulan',
      nilai: asumsi.monthlyOutflow, usul: asumsi.usulanOutflow,
      jelas: 'Seluruh uang keluar sebulan termasuk gaji, service, dan cicilan bank.',
    },
    {
      name: 'salaryNeed', label: 'Kebutuhan gaji per bulan',
      nilai: asumsi.salaryNeed, usul: asumsi.usulanGaji,
      jelas: 'Dipakai menandai bulan yang saldonya tidak lagi menutup gaji.',
    },
  ];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {baris.map((b) => (
        <div key={b.name}>
          <label className="label" htmlFor={`rk-${b.name}`}>{b.label}</label>
          <MoneyInput
            id={`rk-${b.name}`}
            name={b.name}
            defaultValue={b.nilai === null ? '' : String(b.nilai)}
            placeholder={b.usul === null ? '402.800.000' : String(Math.round(b.usul))}
          />
          <p className="mt-1 text-xs text-slate-500">
            {b.jelas}
            {b.nilai === null && b.usul !== null && ` Kosong — memakai ${formatRupiah(b.usul)}.`}
          </p>
        </div>
      ))}
      <Submit label="Simpan asumsi" />
      <Pesan state={state} />
    </form>
  );
}
