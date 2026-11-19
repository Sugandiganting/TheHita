'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { DialogTombol } from './dialog';
import { formatPeriod } from '@/lib/format';
import { MAKS_BULAN_SALIN, deretBulanSesudah, periodeBerikutnya } from '@/lib/rab';
import {
  deleteBudget, deleteBudgetItemLine, deleteBudgetLine, duplicateBudget, hapusJenisRab, setBudgetStatus,
  type ActionState,
} from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

function Tombol({ label, pendingLabel, tone = 'biasa' }: { label: string; pendingLabel: string; tone?: 'biasa' | 'bahaya' }) {
  const { pending } = useFormStatus();
  const kelas = tone === 'bahaya'
    ? 'text-xs font-medium text-red-600 hover:underline'
    : 'text-xs font-medium text-slate-600 hover:underline';
  return (
    <button type="submit" className={kelas} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function Pesan({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={`mt-1 text-xs ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
  );
}

/**
 * Apa yang sebenarnya dilakukan "Sahkan RAB".
 *
 * Ditulis di layar, bukan hanya diketahui yang membuatnya. Tombol yang tidak
 * mengatakan akibatnya akan ditekan sambil menebak — dan yang ditebak di sini
 * adalah apakah anggaran yang sudah disepakati masih bisa berubah.
 */
const ARTI_STATUS = {
  DRAFT: 'Masih draf, jadi barisnya masih bisa ditambah, diubah dan dihapus. '
    + 'Menyahkannya menguncinya — bisa dibuka lagi kapan saja lewat tombol yang sama.',
  ACTIVE: 'Sudah disahkan, jadi terkunci: barisnya tidak bisa ditambah, diubah atau dihapus. '
    + 'Kembalikan ke draf dulu bila ada yang perlu dikoreksi.',
} as const;

/** Sahkan / kembalikan ke draf, salin ke bulan berikutnya, hapus. */
export function BudgetActions({
  id, period, status, lineCount,
}: {
  id: string;
  /** Bulan RAB ini, "YYYY-MM": salinannya dimulai dari bulan sesudahnya. */
  period: string;
  status: string;
  lineCount: number;
}) {
  const [statusState, statusAction] = useActionState(setBudgetStatus, initial);
  const [hapusState, hapusAction] = useActionState(deleteBudget, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const draf = status === 'DRAFT';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form action={statusAction} className="contents">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={draf ? 'ACTIVE' : 'DRAFT'} />
          <Tombol
            label={draf ? 'Sahkan RAB' : 'Kembalikan ke draf'}
            pendingLabel="Menyimpan…"
          />
        </form>

        <DialogTombol
          label="Salin ke bulan lain…"
          varian="tautan"
          lebar="sm"
          judul="Salin RAB"
          keterangan="Isinya disalin apa adanya ke tiap bulan, sebagai draf. Perkiraan tanggal belanja ikut ke tanggal yang sama (tanggal 31 jatuh ke hari terakhir bulan bila tidak ada). Realisasi tidak ikut."
        >
          {(tutup) => <SalinRabForm id={id} period={period} lineCount={lineCount} onTutup={tutup} />}
        </DialogTombol>

        {draf && !konfirmasi && (
          <button
            type="button"
            className="text-xs font-medium text-red-600 hover:underline"
            onClick={() => setKonfirmasi(true)}
          >
            Hapus RAB
          </button>
        )}

        {draf && konfirmasi && (
          <span className="flex items-center gap-3">
            <span className="text-xs text-slate-600">
              Hapus RAB ini beserta {lineCount} barisnya?
            </span>
            <form action={hapusAction} className="contents">
              <input type="hidden" name="id" value={id} />
              <Tombol label="Ya, hapus" pendingLabel="Menghapus…" tone="bahaya" />
            </form>
            <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
              Batal
            </button>
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">{draf ? ARTI_STATUS.DRAFT : ARTI_STATUS.ACTIVE}</p>

      <Pesan state={statusState} />
      <Pesan state={hapusState} />
    </div>
  );
}

/** Hapus satu baris anggaran — per akun maupun per barang. */
function HapusBaris({
  id,
  disabled,
  server,
}: {
  id: string;
  disabled: boolean;
  server: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, action] = useActionState(server, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  /*
   * Saat RAB terkunci tombolnya tetap tampak, hanya redup dan tidak bisa
   * ditekan — sama seperti Ubah di sebelahnya. Menggantinya dengan "—"
   * membuat satu sel memuat dua perlakuan berbeda untuk satu sebab yang
   * sama, dan "—" sendiri tidak mengatakan kenapa.
   */
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="RAB sudah disahkan. Kembalikan ke draf untuk mengubahnya."
        className="text-xs font-medium text-red-600 disabled:text-slate-400 disabled:no-underline"
      >
        Hapus
      </button>
    );
  }

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
      <form action={action} className="contents">
        <input type="hidden" name="id" value={id} />
        <Tombol label="Ya" pendingLabel="…" tone="bahaya" />
      </form>
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
        Batal
      </button>
      {state.message && !state.ok && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}

/** Hapus satu baris anggaran per akun. */
export function BudgetLineDelete({ id, disabled }: { id: string; disabled: boolean }) {
  return <HapusBaris id={id} disabled={disabled} server={deleteBudgetLine} />;
}

/** Hapus satu baris anggaran per barang. */
export function BudgetItemLineDelete({ id, disabled }: { id: string; disabled: boolean }) {
  return <HapusBaris id={id} disabled={disabled} server={deleteBudgetItemLine} />;
}

/** Hapus jenis RAB tambahan. Terkunci selama masih dipakai RAB atau kategori rencana kas. */
export function HapusJenisRab({ code, nama, dipakai }: { code: string; nama: string; dipakai: number }) {
  const [state, action] = useActionState(hapusJenisRab, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  if (dipakai > 0) {
    return (
      <span className="text-[11px] text-slate-400" title="Pindahkan atau hapus RAB jenis ini dulu, dan lepas tautannya dari kategori rencana kas.">
        sudah dipakai
      </span>
    );
  }
  if (!konfirmasi) {
    return (
      <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setKonfirmasi(true)}>
        Hapus
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <form action={action} className="contents">
        <input type="hidden" name="code" value={code} />
        <span className="text-[11px] text-slate-500">Hapus jenis {nama}?</span>
        <Tombol label="Ya" pendingLabel="…" tone="bahaya" />
      </form>
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
        Batal
      </button>
      {state.message && !state.ok && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}

/** Tombol kirim berukuran biasa, untuk formulir di dalam dialog. */
function KirimSalin({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyalin…' : label}
    </button>
  );
}

/**
 * Salin RAB sampai bulan tertentu — bukan hanya ke bulan berikutnya.
 *
 * Banyaknya bulan disebut sebelum tombolnya ditekan, supaya salah pilih tahun
 * (Desember 2027 alih-alih 2026) ketahuan sebelum dua belas RAB tercipta.
 */
function SalinRabForm({
  id, period, lineCount, onTutup,
}: {
  id: string;
  period: string;
  lineCount: number;
  onTutup: () => void;
}) {
  const [state, action] = useActionState(duplicateBudget, initial);
  const pertama = periodeBerikutnya(period);
  const [sampai, setSampai] = useState(pertama);
  const [timpa, setTimpa] = useState(false);
  // Selesai menyalin, pilihan timpa kembali kosong. Formulir sendiri ikut
  // dikosongkan setelah terkirim, dan centang yang hilang sementara tulisan di
  // sebelahnya masih berkata "timpa" membuat orang tidak tahu mana yang benar.
  // Menimpa juga sebaiknya dipilih ulang dengan sadar tiap kali.
  useEffect(() => { setTimpa(false); }, [state]);
  const bulan = deretBulanSesudah(period, sampai);
  const kebanyakan = bulan.length > MAKS_BULAN_SALIN;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="salin-sampai">Salin sampai bulan</label>
        <input
          id="salin-sampai"
          type="month"
          name="sampai"
          className="input"
          min={pertama}
          value={sampai}
          onChange={(e) => setSampai(e.target.value)}
          required
        />
        <p className={`mt-1 text-xs ${kebanyakan || bulan.length === 0 ? 'text-red-600' : 'text-slate-500'}`}>
          {bulan.length === 0
            ? `Pilih bulan sesudah ${formatPeriod(period)}.`
            : kebanyakan
              ? `Paling jauh ${MAKS_BULAN_SALIN} bulan sekaligus. Periksa lagi tahunnya.`
              : bulan.length === 1
                ? `Satu RAB baru untuk ${formatPeriod(bulan[0])}, berisi ${lineCount} baris.`
                : `${bulan.length} bulan, ${formatPeriod(bulan[0])} sampai ${formatPeriod(bulan[bulan.length - 1])}, `
                  + `masing-masing ${lineCount} baris.`}
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
        <input type="checkbox" name="timpa" value="ya" checked={timpa}
          onChange={(e) => setTimpa(e.target.checked)} className="mt-0.5" />
        <span className="text-sm">
          <span className="font-medium">Timpa RAB yang sudah ada di bulan-bulan itu</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {timpa
              ? 'Seluruh baris RAB sejenis di bulan-bulan itu diganti dengan isi RAB ini, termasuk perkiraan tanggal belanjanya yang digeser ke bulan masing-masing. '
                + 'RAB yang sudah disahkan atau sudah ada realisasinya tetap tidak disentuh.'
              : 'Tanpa centang, bulan yang sudah punya RAB sejenis dilewati — cocok untuk mengisi bulan yang masih kosong saja.'}
          </span>
        </span>
      </label>
      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <KirimSalin label={`${timpa ? 'Salin & timpa' : 'Salin'}${bulan.length > 1 ? ` ke ${bulan.length} bulan` : ''}`} />
        <button type="button" className="btn-secondary" onClick={onTutup}>Tutup</button>
      </div>
    </form>
  );
}
