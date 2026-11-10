'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { hapusTargetMargin, simpanTargetMargin, type ActionState } from '@/app/actions';
import { SKENARIO_URUT, type SkenarioMargin } from '@/lib/target-margin';
import { NAMA_SKENARIO } from '@/lib/rencana-kas';

const initial: ActionState = { ok: false, message: '' };

const PITA: Record<SkenarioMargin, string> = {
  PESIMIS: 'biasanya −10% sampai 0%',
  NORMAL: 'biasanya 0% sampai 10%',
  OPTIMIS: 'biasanya 10% sampai 30%',
};

function Simpan() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan target'}
    </button>
  );
}

/**
 * Ketiga target disimpan sekaligus, bukan satu per satu.
 *
 * Ketiganya hanya berarti bersama-sama: penggolongan bulan memerlukan
 * seluruhnya, dan urutannya harus naik. Menyimpan satu per satu berarti ada
 * saat ketika pesimis sudah berubah sedangkan normal belum — dan di saat itu
 * urutannya bisa terbalik tanpa ada yang salah mengetik apa pun.
 */
export function TargetMarginForm({ nilai }: { nilai: Partial<Record<SkenarioMargin, number>> }) {
  const [state, action] = useActionState(simpanTargetMargin, initial);
  const [hapusState, hapusAction] = useActionState(hapusTargetMargin, initial);
  const terisi = SKENARIO_URUT.some((s) => nilai[s] !== undefined);
  const hapusRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {SKENARIO_URUT.map((sk) => (
            <div key={sk}>
              <label className="label" htmlFor={`margin-${sk}`}>{NAMA_SKENARIO[sk]}</label>
              <div className="flex items-center gap-2">
                <input
                  id={`margin-${sk}`}
                  name={`margin-${sk}`}
                  className="input text-right"
                  inputMode="decimal"
                  placeholder="—"
                  defaultValue={nilai[sk] === undefined ? '' : String(nilai[sk])}
                  required
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{PITA[sk]}</p>
            </div>
          ))}
        </div>

        {state.message && (
          <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Simpan />
          {terisi && (
            <button
              type="button"
              className="text-xs font-medium text-red-600 hover:underline"
              onClick={() => hapusRef.current?.requestSubmit()}
            >
              Kosongkan ketiganya
            </button>
          )}
        </div>
      </form>

      {/* Dipisah dari form di atas: form di dalam form tidak sah di HTML. */}
      <form ref={hapusRef} action={hapusAction} className="hidden" />
      {hapusState.message && (
        <p className={`mt-2 text-sm ${hapusState.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {hapusState.message}
        </p>
      )}
    </>
  );
}
