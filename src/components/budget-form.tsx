'use client';

import { useActionState, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { saveBudget, saveBudgetLine, type ActionState } from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import { ACCOUNT_TYPE_LABEL, type AccountType } from '@/lib/accounting';
import { SearchableSelect, type PickerOption } from './searchable-select';

const initial: ActionState = { ok: false, message: '' };

export type ScopeOption = {
  code: string;
  label: string;
  /** Ditanggung beberapa cabang bersama. */
  bersama: boolean;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

/** Membuat RAB baru: tinggal pilih pemilik dan bulannya, rinciannya menyusul. */
export function BudgetForm({ scopes, defaultPeriod }: { scopes: ScopeOption[]; defaultPeriod: string }) {
  const [state, formAction] = useActionState(saveBudget, initial);

  return (
    <form action={formAction} className="space-y-4" key={state.ok ? state.message : 'baru'}>
      <div>
        <label className="label" htmlFor="rab-scope">Pemilik anggaran</label>
        <select id="rab-scope" name="scope" className="input" required defaultValue="">
          <option value="" disabled>Pilih cabang atau kelompok…</option>
          <optgroup label="Cabang">
            {scopes.filter((s) => !s.bersama).map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </optgroup>
          <optgroup label="Ditanggung bersama">
            {scopes.filter((s) => s.bersama).map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </optgroup>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Kelompok bersama dipakai untuk biaya yang ditanggung beberapa cabang sekaligus —
          gaji staf yang bekerja di dua lokasi, listrik satu meteran. Biaya seperti itu
          tidak masuk RAB cabang mana pun.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rab-period">Bulan</label>
        <input id="rab-period" type="month" name="period" className="input" defaultValue={defaultPeriod} required />
      </div>

      <div>
        <label className="label" htmlFor="rab-notes">Catatan</label>
        <input id="rab-notes" name="notes" className="input" placeholder="Opsional" />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label="Buat RAB" />
    </form>
  );
}

export type AkunOption = { id: string; code: string; name: string; type: string };

/** Menambah atau mengubah satu baris anggaran di dalam sebuah RAB. */
export function BudgetLineForm({
  budgetId,
  accounts,
  values,
  disabled,
}: {
  budgetId: string;
  accounts: AkunOption[];
  values?: { accountId: string; amount: number; notes: string | null };
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(saveBudgetLine, initial);

  const opsiAkun: PickerOption[] = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        code: a.code,
        label: a.name,
        group: ACCOUNT_TYPE_LABEL[a.type as AccountType] ?? a.type,
      })),
    [accounts],
  );

  if (disabled) {
    return (
      <p className="text-sm text-slate-500">
        RAB ini sudah disahkan. Kembalikan ke draf dulu bila ingin mengubah anggarannya.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4" key={values?.accountId ?? (state.ok ? state.message : 'baru')}>
      <input type="hidden" name="budgetId" value={budgetId} />

      <div>
        <label className="label" htmlFor="rab-akun">Akun beban</label>
        <SearchableSelect
          id="rab-akun"
          name="accountId"
          options={opsiAkun}
          defaultValue={values?.accountId ?? ''}
          required
          placeholder="— Pilih akun —"
          searchPlaceholder="Ketik nomor atau nama akun…"
        />
      </div>

      <div>
        <label className="label" htmlFor="rab-amount">Dianggarkan</label>
        <input
          id="rab-amount"
          name="amount"
          inputMode="numeric"
          className="input"
          placeholder="5000000"
          defaultValue={values ? String(values.amount) : ''}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {values ? formatRupiah(values.amount) : 'Isi dalam rupiah penuh, tanpa titik.'}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rab-line-notes">Catatan</label>
        <input id="rab-line-notes" name="notes" className="input" placeholder="Opsional" defaultValue={values?.notes ?? ''} />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label={values ? 'Perbarui anggaran' : 'Tambah ke RAB'} />
    </form>
  );
}
