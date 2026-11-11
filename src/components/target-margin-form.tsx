'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  hapusTargetMargin, salinTargetMarginKeSemua, simpanTargetMargin, type ActionState,
} from '@/app/actions';
import { SKENARIO_URUT } from '@/lib/target-margin';

const initial: ActionState = { ok: false, message: '' };

export type NilaiBulan = { pesimis: number; normal: number; optimis: number } | null;

function Simpan() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="text-xs font-medium text-brand-600 hover:underline" disabled={pending}>
      {pending ? '…' : 'Simpan'}
    </button>
  );
}

const isi = (n: number | undefined) => (n === undefined ? '' : String(n));

/**
 * Satu baris bulan, disimpan sendiri-sendiri.
 *
 * Tidak dibuat satu formulir untuk dua belas bulan sekaligus: menyimpan
 * seluruhnya berarti satu salah ketik di bulan mana pun menolak sebelas bulan
 * lain yang sudah benar, dan yang mengisi harus mencari sendiri bulan mana
 * yang bermasalah. Tetapi ketiga skenario DALAM satu bulan disimpan bersama,
 * karena ketiganya hanya berarti bersama-sama dan urutannya harus naik.
 */
export function BarisTargetMargin({ bulan, nama, musim, nilai }: {
  bulan: number;
  nama: string;
  musim: string | null;
  nilai: NilaiBulan;
}) {
  const [state, action] = useActionState(simpanTargetMargin, initial);
  const [hapusState, hapusAction] = useActionState(hapusTargetMargin, initial);
  const [salinState, salinAction] = useActionState(salinTargetMarginKeSemua, initial);

  const pesan = state.message || hapusState.message || salinState.message;
  const berhasil = state.message ? state.ok : hapusState.message ? hapusState.ok : salinState.ok;

  return (
    <tr className={nilai ? '' : 'bg-slate-50/40'}>
      <td className="td align-top">
        <span className="font-medium text-slate-900">{nama}</span>
        <span className="mt-0.5 block text-[11px] text-slate-500">{musim ?? 'belum bermusim'}</span>
      </td>
      <td className="td" colSpan={3}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="month" value={bulan} />
          {SKENARIO_URUT.map((sk) => (
            <span key={sk} className="flex items-center gap-1">
              <label className="sr-only" htmlFor={`m-${bulan}-${sk}`}>
                Target {sk.toLowerCase()} {nama}
              </label>
              <input
                id={`m-${bulan}-${sk}`}
                name={`margin-${sk}`}
                className="input w-20 text-right"
                inputMode="decimal"
                placeholder="—"
                defaultValue={isi(nilai
                  ? { PESIMIS: nilai.pesimis, NORMAL: nilai.normal, OPTIMIS: nilai.optimis }[sk]
                  : undefined)}
              />
              <span className="text-xs text-slate-400">%</span>
            </span>
          ))}
          <Simpan />
        </form>
      </td>
      <td className="td align-top">
        <span className="flex flex-col gap-1">
          {nilai && (
            <>
              <form action={salinAction}>
                <input type="hidden" name="month" value={bulan} />
                <button type="submit" className="text-xs font-medium text-slate-600 hover:underline">
                  Salin ke semua
                </button>
              </form>
              <form action={hapusAction}>
                <input type="hidden" name="month" value={bulan} />
                <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                  Kosongkan
                </button>
              </form>
            </>
          )}
          {!nilai && <span className="text-[11px] text-slate-400">belum diset</span>}
        </span>
        {pesan && (
          <span className={`mt-1 block text-[11px] ${berhasil ? 'text-emerald-700' : 'text-red-600'}`}>
            {pesan}
          </span>
        )}
      </td>
    </tr>
  );
}
