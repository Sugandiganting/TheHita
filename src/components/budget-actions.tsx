'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  deleteBudget, deleteBudgetItemLine, deleteBudgetLine, duplicateBudget, setBudgetStatus,
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
  id, status, lineCount,
}: {
  id: string;
  status: string;
  lineCount: number;
}) {
  const [statusState, statusAction] = useActionState(setBudgetStatus, initial);
  const [salinState, salinAction] = useActionState(duplicateBudget, initial);
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

        <form action={salinAction} className="contents">
          <input type="hidden" name="id" value={id} />
          <Tombol label="Salin ke bulan berikutnya" pendingLabel="Menyalin…" />
        </form>

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
      <Pesan state={salinState} />
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
