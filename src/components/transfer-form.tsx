'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createTransfer, type ActionState } from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import type { CashAccountBalance } from '@/lib/queries';

const initial: ActionState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan transfer'}
    </button>
  );
}

/** Nilai gabungan akun+unit, karena satu rekening dibedakan oleh cabang pemiliknya. */
const keyOf = (a: { accountId: string; unitId: string }) => `${a.accountId}::${a.unitId}`;

export function TransferForm({
  accounts,
  defaultDate,
}: {
  accounts: CashAccountBalance[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(createTransfer, initial);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');

  const byKey = useMemo(() => new Map(accounts.map((a) => [keyOf(a), a])), [accounts]);
  const fromAcc = byKey.get(from);
  const toAcc = byKey.get(to);
  const nominal = Number(amount.replace(/[^\d]/g, '')) || 0;

  const crossUnit = !!fromAcc && !!toAcc && fromAcc.unitId !== toAcc.unitId;
  const sameAccount = !!from && from === to;
  const notEnough = !!fromAcc && nominal > fromAcc.balance;

  // Kelompokkan per cabang agar daftar rekening mudah dibaca.
  const grouped = useMemo(() => {
    const m = new Map<string, CashAccountBalance[]>();
    for (const a of accounts) {
      const label = `${a.unitCode} — ${a.unitName}`;
      (m.get(label) ?? m.set(label, []).get(label)!).push(a);
    }
    return [...m.entries()];
  }, [accounts]);

  const picker = (id: string, value: string, onChange: (v: string) => void, label: string) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">— Pilih rekening —</option>
        {grouped.map(([unitLabel, rows]) => (
          <optgroup key={unitLabel} label={unitLabel}>
            {rows.map((a) => (
              <option key={keyOf(a)} value={keyOf(a)}>
                {a.code} {a.name} · {formatRupiah(a.balance)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="fromAccountId" value={fromAcc?.accountId ?? ''} />
      <input type="hidden" name="fromUnitId" value={fromAcc?.unitId ?? ''} />
      <input type="hidden" name="toAccountId" value={toAcc?.accountId ?? ''} />
      <input type="hidden" name="toUnitId" value={toAcc?.unitId ?? ''} />

      <div>
        <label className="label" htmlFor="t-date">Tanggal</label>
        <input id="t-date" name="date" type="date" defaultValue={defaultDate} className="input sm:max-w-xs" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {picker('t-from', from, setFrom, 'Dari rekening')}
        {picker('t-to', to, setTo, 'Ke rekening')}
      </div>

      {fromAcc && (
        <p className="text-xs text-slate-500">
          Saldo {fromAcc.code} {fromAcc.name} di {fromAcc.unitCode}: <strong>{formatRupiah(fromAcc.balance)}</strong>
        </p>
      )}

      <div>
        <label className="label" htmlFor="t-amount">Nominal (Rp)</label>
        <input
          id="t-amount"
          name="amount"
          inputMode="numeric"
          className="input sm:max-w-xs"
          placeholder="25000000"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          required
        />
        {nominal > 0 && <p className="mt-1 text-xs text-slate-500">{formatRupiah(nominal)}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-desc">Keterangan</label>
          <input id="t-desc" name="description" className="input" placeholder="Isi ulang kas purchasing" required />
        </div>
        <div>
          <label className="label" htmlFor="t-ref">No. bukti (opsional)</label>
          <input id="t-ref" name="reference" className="input" placeholder="TRF-2026-001" />
        </div>
      </div>

      {sameAccount && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Rekening asal dan tujuan tidak boleh sama.
        </div>
      )}

      {notEnough && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nominal melebihi saldo rekening asal ({formatRupiah(fromAcc!.balance)}). Transfer tetap bisa disimpan,
          tetapi saldo rekening tersebut akan menjadi minus — periksa kembali angkanya.
        </div>
      )}

      {crossUnit && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <p className="font-semibold">Transfer antar cabang: {fromAcc!.unitCode} → {toAcc!.unitCode}</p>
          <p className="mt-0.5">
            Sistem otomatis mencatat <strong>Piutang Antar Unit</strong> di {fromAcc!.unitCode} dan{' '}
            <strong>Hutang Antar Unit</strong> di {toAcc!.unitCode}, supaya neraca kedua cabang tetap seimbang
            masing-masing. Pada laporan konsolidasi keduanya saling meniadakan.
          </p>
        </div>
      )}

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
