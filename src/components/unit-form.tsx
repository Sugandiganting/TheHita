'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveUnit, type ActionState } from '@/app/actions';
import { UNIT_TYPE_LABEL } from '@/lib/accounting';
import { formatRupiah } from '@/lib/format';

const initial: ActionState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan unit'}
    </button>
  );
}

export function UnitForm() {
  const [state, formAction] = useActionState(saveUnit, initial);
  const [type, setType] = useState('HOTEL');
  const [openingCash, setOpeningCash] = useState('');

  const cash = Number(openingCash.replace(/[^\d]/g, '')) || 0;

  return (
    <form action={formAction} className="space-y-4" key={state.ok ? state.message : 'form'}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="u-code">Kode</label>
          <input id="u-code" name="code" className="input uppercase" placeholder="THS" required />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="u-name">Nama unit</label>
          <input id="u-name" name="name" className="input" placeholder="The Hita Sanur" required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="u-type">Jenis usaha</label>
        <select id="u-type" name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(UNIT_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {type === 'HOTEL' && (
        <div>
          <label className="label" htmlFor="u-rooms">Jumlah kamar</label>
          <input id="u-rooms" name="roomCount" type="number" min="0" className="input" defaultValue={0} />
        </div>
      )}

      <div>
        <label className="label" htmlFor="u-cash">Saldo kas awal</label>
        <input
          id="u-cash"
          name="openingCash"
          inputMode="numeric"
          className="input"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="0"
        />
        <p className="mt-1 text-xs text-slate-500">
          {cash > 0 ? formatRupiah(cash) : 'Saldo kas saat sistem mulai dipakai, bila tidak diinput lewat jurnal pembuka.'}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="u-pms">Asal PMS lama (opsional)</label>
        <input id="u-pms" name="legacyPms" className="input" placeholder="GuestPro 1" />
      </div>

      <div>
        <label className="label" htmlFor="u-address">Alamat (opsional)</label>
        <input id="u-address" name="address" className="input" />
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
