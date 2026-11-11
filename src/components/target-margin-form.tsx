'use client';

import { useActionState, useId } from 'react';
import {
  hapusTargetMargin, salinTargetMarginKeSemua, simpanTargetMargin, type ActionState,
} from '@/app/actions';
import { SKENARIO_URUT } from '@/lib/target-margin';

const initial: ActionState = { ok: false, message: '' };

export type NilaiBulan = { pesimis: number; normal: number; optimis: number } | null;

const isi = (n: number | undefined) => (n === undefined ? '' : String(n));

/**
 * Satu baris bulan.
 *
 * Tiap skenario mendapat kolomnya sendiri supaya sejajar dengan judul kolom di
 * atasnya. Itu berarti ketiganya tidak bisa dibungkus satu <form> — sel tabel
 * tidak boleh dilompati elemen form — jadi formulirnya berdiri kosong di sel
 * pertama dan tiap isian menunjuk kepadanya lewat atribut `form`. Cara itu
 * memang bawaan HTML, dan FormData tetap memuat seluruh isian yang menunjuk ke
 * sana.
 *
 * Pesannya turun ke barisnya sendiri selebar tabel. Sebelumnya ia berbagi satu
 * sel dengan tombol aksi, dan pesan yang panjang menyempitkan kolom isian
 * sampai ketiga kotaknya terbungkus ke bawah — tampilan rusak justru pada saat
 * yang paling butuh dibaca dengan tenang.
 */
export function BarisTargetMargin({ bulan, nama, musim, nilai }: {
  bulan: number;
  nama: string;
  musim: string | null;
  nilai: NilaiBulan;
}) {
  const [state, action, sibuk] = useActionState(simpanTargetMargin, initial);
  const [hapusState, hapusAction] = useActionState(hapusTargetMargin, initial);
  const [salinState, salinAction] = useActionState(salinTargetMarginKeSemua, initial);
  const formId = `tm-${useId().replace(/:/g, '')}-${bulan}`;

  const pesan = state.message || hapusState.message || salinState.message;
  const berhasil = state.message ? state.ok : hapusState.message ? hapusState.ok : salinState.ok;

  const angka = nilai
    ? { PESIMIS: nilai.pesimis, NORMAL: nilai.normal, OPTIMIS: nilai.optimis }
    : null;

  return (
    <>
      <tr className={nilai ? '' : 'bg-slate-50/40'}>
        <td className="td whitespace-nowrap">
          <form id={formId} action={action} />
          <input type="hidden" name="month" value={bulan} form={formId} />
          <span className="font-medium text-slate-900">{nama}</span>
          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
            {musim ?? 'belum bermusim'}
          </span>
        </td>

        {SKENARIO_URUT.map((sk) => (
          <td key={sk} className="td">
            <span className="flex items-center gap-1">
              <label className="sr-only" htmlFor={`m-${bulan}-${sk}`}>
                Target {sk.toLowerCase()} {nama}
              </label>
              <input
                id={`m-${bulan}-${sk}`}
                name={`margin-${sk}`}
                form={formId}
                className="input w-20 text-right"
                inputMode="decimal"
                placeholder="—"
                defaultValue={isi(angka?.[sk])}
              />
              <span className="text-xs text-slate-400">%</span>
            </span>
          </td>
        ))}

        <td className="td whitespace-nowrap">
          <span className="flex items-center gap-3">
            <button
              type="submit"
              form={formId}
              className="text-xs font-medium text-brand-600 hover:underline disabled:text-slate-400"
              disabled={sibuk}
            >
              {sibuk ? '…' : 'Simpan'}
            </button>
            {nilai && (
              <>
                <form action={salinAction} className="contents">
                  <input type="hidden" name="month" value={bulan} />
                  <button type="submit" className="text-xs font-medium text-slate-600 hover:underline">
                    Salin ke semua
                  </button>
                </form>
                <form action={hapusAction} className="contents">
                  <input type="hidden" name="month" value={bulan} />
                  <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                    Kosongkan
                  </button>
                </form>
              </>
            )}
            {!nilai && <span className="text-[11px] text-slate-400">belum diset</span>}
          </span>
        </td>
      </tr>

      {pesan && (
        <tr
          className={berhasil ? 'bg-emerald-50/60' : 'bg-red-50/60'}
          /* Garis pemisah tbody dimatikan: pesan ini milik baris di atasnya,
             bukan baris tersendiri. */
          style={{ borderTopWidth: 0 }}
        >
          <td colSpan={5} className="px-3 pb-2 pt-0">
            <span className={`text-xs ${berhasil ? 'text-emerald-700' : 'text-red-700'}`}>
              {pesan}
            </span>
          </td>
        </tr>
      )}
    </>
  );
}
