'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createQuickEntry, type ActionState } from '@/app/actions';
import { formatRupiah } from '@/lib/format';

export type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: string;
  isCash: boolean;
};

export type UnitOption = { id: string; code: string; name: string };

const initial: ActionState = { ok: false, message: '' };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

/**
 * Entri cepat untuk pemakaian harian: pilih kategori dan kas, jurnal
 * double-entry dibuat otomatis di server.
 */
export function QuickEntryForm({
  units,
  accounts,
  defaultDate,
}: {
  units: UnitOption[];
  accounts: AccountOption[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(createQuickEntry, initial);
  const [kind, setKind] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');

  const categories = accounts.filter((a) =>
    kind === 'INCOME' ? a.type === 'REVENUE' : a.type === 'EXPENSE' || a.type === 'COGS',
  );
  const cashAccounts = accounts.filter((a) => a.isCash);
  const numericAmount = Number(String(amount).replace(/[^\d]/g, '')) || 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setKind('INCOME')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            kind === 'INCOME' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          Pemasukan
        </button>
        <button
          type="button"
          onClick={() => setKind('EXPENSE')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            kind === 'EXPENSE' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          Pengeluaran
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="q-date">Tanggal</label>
          <input id="q-date" name="date" type="date" defaultValue={defaultDate} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="q-unit">Unit usaha</label>
          <select id="q-unit" name="unitId" className="input" required defaultValue={units[0]?.id}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="q-amount">Nominal (Rp)</label>
        <input
          id="q-amount"
          name="amount"
          inputMode="numeric"
          className="input"
          placeholder="1500000"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          required
        />
        {numericAmount > 0 && <p className="mt-1 text-xs text-slate-500">{formatRupiah(numericAmount)}</p>}
      </div>

      <div>
        <label className="label" htmlFor="q-category">
          {kind === 'INCOME' ? 'Kategori pendapatan' : 'Kategori beban / HPP'}
        </label>
        <select id="q-category" name="categoryAccountId" className="input" required>
          <option value="">— Pilih akun —</option>
          {categories.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="q-counter">
          {kind === 'INCOME' ? 'Masuk ke kas/bank' : 'Dibayar dari kas/bank'}
        </label>
        <select id="q-counter" name="counterAccountId" className="input" required>
          <option value="">— Pilih akun —</option>
          {cashAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="q-desc">Keterangan</label>
          <input
            id="q-desc"
            name="description"
            className="input"
            placeholder={kind === 'INCOME' ? 'Pendapatan kamar 12 Mar' : 'Bayar listrik PLN'}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="q-ref">No. bukti (opsional)</label>
          <input id="q-ref" name="reference" className="input" placeholder="INV-001" />
        </div>
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

      <SubmitButton label={kind === 'INCOME' ? 'Simpan pemasukan' : 'Simpan pengeluaran'} />
    </form>
  );
}
