'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAccount, type ActionState } from '@/app/actions';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL } from '@/lib/accounting';

const initial: ActionState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan akun'}
    </button>
  );
}

export function AccountForm() {
  const [state, formAction] = useActionState(saveAccount, initial);
  const [type, setType] = useState<string>('EXPENSE');

  return (
    <form action={formAction} className="space-y-4" key={state.ok ? state.message : 'form'}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="a-code">Nomor</label>
          <input id="a-code" name="code" className="input" placeholder="6-2600" required />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="a-name">Nama akun</label>
          <input id="a-name" name="name" className="input" placeholder="Beban Genset & Solar" required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="a-type">Jenis akun</label>
        <select id="a-type" name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="a-subtype">Kelompok (opsional)</label>
          <input id="a-subtype" name="subtype" className="input" placeholder="UTILITIES" />
        </div>
        <div>
          <label className="label" htmlFor="a-cashflow">Arus kas</label>
          <select id="a-cashflow" name="cashflowCategory" className="input" defaultValue="OPERATING">
            <option value="">—</option>
            <option value="OPERATING">Operasional</option>
            <option value="INVESTING">Investasi</option>
            <option value="FINANCING">Pendanaan</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isCash" className="mt-0.5" disabled={type !== 'ASSET'} />
          <span>
            Akun kas / bank
            <span className="block text-xs text-slate-500">
              Saldo akun bertanda ini yang dipakai mesin peramalan. Hanya untuk akun berjenis Aset.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isHeader" className="mt-0.5" />
          <span>
            Akun induk (header)
            <span className="block text-xs text-slate-500">Hanya untuk pengelompokan, tidak bisa diposting.</span>
          </span>
        </label>
      </div>

      {state.message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
