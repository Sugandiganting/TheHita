'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { gantiKataSandi, type ActionState } from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

function Tombol({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

export function FormKataSandi() {
  const [state, action] = useActionState(gantiKataSandi, initial);

  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'isi'}>
      <div>
        <label className="label" htmlFor="sandi-lama">Kata sandi sekarang</label>
        <input id="sandi-lama" name="lama" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="sandi-baru">Kata sandi baru</label>
        <input id="sandi-baru" name="baru" type="password" className="input" autoComplete="new-password" required />
        <p className="mt-1 text-xs text-slate-500">Minimal 8 karakter.</p>
      </div>
      <div>
        <label className="label" htmlFor="sandi-ulang">Ketik ulang kata sandi baru</label>
        <input id="sandi-ulang" name="ulangi" type="password" className="input" autoComplete="new-password" required />
      </div>
      <Tombol label="Simpan kata sandi" />
      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}
    </form>
  );
}

/** Unduhan biasa, bukan aksi server: berkasnya bisa puluhan megabita. */
export function UnduhCadangan() {
  return (
    <a href="/api/cadangan" className="btn-secondary inline-flex" download>
      Unduh salinan sekarang
    </a>
  );
}
