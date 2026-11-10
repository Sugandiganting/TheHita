'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { hapusTargetBulan, simpanTargetBulan, type ActionState } from '@/app/actions';
import type { TargetBulan } from '@/lib/target-bulan';

const initial: ActionState = { ok: false, message: '' };

function Simpan() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="text-xs font-medium text-brand-600 hover:underline" disabled={pending}>
      {pending ? '…' : 'Simpan'}
    </button>
  );
}

const nilai = (n: number | null) => (n === null ? '' : String(n));

/**
 * Satu baris bulan, disimpan sendiri-sendiri.
 *
 * Tidak dibuat satu formulir untuk dua belas bulan sekaligus: menyimpan
 * seluruhnya berarti satu salah ketik di bulan mana pun menolak sebelas bulan
 * lain yang sudah benar, dan yang mengisi harus mencari sendiri bulan mana
 * yang bermasalah.
 */
export function BarisTarget({ bulan, nama, musim, target }: {
  bulan: number;
  nama: string;
  musim: string | null;
  target: TargetBulan;
}) {
  const [state, action] = useActionState(simpanTargetBulan, initial);
  const [hapusState, hapusAction] = useActionState(hapusTargetBulan, initial);
  const terisi = target.cashMargin !== null || target.optimisticUp !== null || target.pessimisticDown !== null;
  const pesan = state.message || hapusState.message;
  const berhasil = state.message ? state.ok : hapusState.ok;

  return (
    <tr className={terisi ? '' : 'bg-slate-50/40'}>
      <td className="td">
        <span className="font-medium text-slate-900">{nama}</span>
        <span className="mt-0.5 block text-[11px] text-slate-500">{musim ?? 'belum bermusim'}</span>
      </td>
      <td className="td" colSpan={4}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="month" value={bulan} />
          <label className="sr-only" htmlFor={`m-${bulan}`}>Target margin kas {nama}</label>
          <input
            id={`m-${bulan}`}
            name="cashMargin"
            className="input w-24 text-right"
            inputMode="decimal"
            placeholder="—"
            defaultValue={nilai(target.cashMargin)}
          />
          <label className="sr-only" htmlFor={`o-${bulan}`}>Kenaikan optimis {nama}</label>
          <input
            id={`o-${bulan}`}
            name="optimisticUp"
            className="input w-24 text-right"
            inputMode="decimal"
            placeholder="—"
            defaultValue={nilai(target.optimisticUp)}
          />
          <label className="sr-only" htmlFor={`p-${bulan}`}>Penurunan pesimis {nama}</label>
          <input
            id={`p-${bulan}`}
            name="pessimisticDown"
            className="input w-24 text-right"
            inputMode="decimal"
            placeholder="—"
            defaultValue={nilai(target.pessimisticDown)}
          />
          <Simpan />
        </form>
      </td>
      <td className="td">
        {terisi ? (
          <form action={hapusAction}>
            <input type="hidden" name="month" value={bulan} />
            <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
              Kosongkan
            </button>
          </form>
        ) : (
          <span className="text-[11px] text-slate-400">belum diset</span>
        )}
        {pesan && (
          <span className={`mt-1 block text-[11px] ${berhasil ? 'text-emerald-700' : 'text-red-600'}`}>
            {pesan}
          </span>
        )}
      </td>
    </tr>
  );
}
