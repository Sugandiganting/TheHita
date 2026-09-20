'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addCostItem, type ActionState } from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Menambahkan…' : 'Tambah item'}
    </button>
  );
}

export function CostItemForm({
  projectId,
  accounts,
}: {
  projectId: string;
  accounts: { id: string; code: string; name: string }[];
}) {
  const [state, formAction] = useActionState(addCostItem, initial);

  return (
    <form action={formAction} className="space-y-4" key={state.ok ? state.message : 'form'}>
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <label className="label" htmlFor="c-name">Nama item</label>
        <input id="c-name" name="name" className="input" placeholder="Pondasi & struktur" required />
      </div>

      <div>
        <label className="label" htmlFor="c-amount">Nominal (Rp)</label>
        <input id="c-amount" name="amount" inputMode="numeric" className="input" placeholder="420000000" required />
      </div>

      <div>
        <label className="label" htmlFor="c-date">Rencana dibayar</label>
        <input id="c-date" name="plannedDate" type="date" className="input" required />
      </div>

      <div>
        <label className="label" htmlFor="c-account">Akun (opsional)</label>
        <select id="c-account" name="accountId" className="input">
          <option value="">— Tidak ditentukan —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
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
