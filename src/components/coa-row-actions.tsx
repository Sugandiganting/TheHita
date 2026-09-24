'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteAccount, type ActionState } from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="text-xs font-medium text-red-600 hover:underline" disabled={pending}>
      {pending ? 'Menghapus…' : 'Ya, hapus'}
    </button>
  );
}

/**
 * Tombol Ubah dan Hapus pada tiap baris COA.
 *
 * Tombol Hapus hanya muncul bila akun benar-benar bersih. Bila akun sudah
 * dipakai, alasannya ditampilkan langsung supaya jelas kenapa tidak bisa
 * dihapus — bukan sekadar tombol mati tanpa penjelasan.
 */
export function CoaRowActions({
  id,
  editHref,
  usage,
  childCount,
  costItems,
  isSystem,
}: {
  id: string;
  editHref: string;
  usage: number;
  childCount: number;
  costItems: number;
  isSystem: boolean;
}) {
  const [state, formAction] = useActionState(deleteAccount, initial);
  const [confirming, setConfirming] = useState(false);

  const blocker = isSystem
    ? 'Dipakai sistem'
    : usage > 0
      ? `Dipakai ${usage} jurnal`
      : childCount > 0
        ? `Punya ${childCount} akun anak`
        : costItems > 0
          ? `Dipakai ${costItems} item proyek`
          : null;

  return (
    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
      <Link href={editHref} className="text-xs font-medium text-brand-700 hover:underline">
        Ubah
      </Link>

      {blocker ? (
        <span className="text-xs text-slate-400" title={`Tidak bisa dihapus — ${blocker.toLowerCase()}.`}>
          {blocker}
        </span>
      ) : confirming ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton />
          <button
            type="button"
            className="text-xs text-slate-500 hover:underline"
            onClick={() => setConfirming(false)}
          >
            Batal
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="text-xs font-medium text-slate-500 hover:text-red-600 hover:underline"
          onClick={() => setConfirming(true)}
        >
          Hapus
        </button>
      )}

      {state.message && !state.ok && (
        <span className="text-xs text-red-600" role="alert">
          {state.message}
        </span>
      )}
    </div>
  );
}
