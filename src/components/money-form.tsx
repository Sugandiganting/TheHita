'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPayMoney, createReceiveMoney, type ActionState } from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import type { CashAccountBalance } from '@/lib/queries';

const initial: ActionState = { ok: false, message: '' };

export type CategoryAccount = { id: string; code: string; name: string; type: string };
export type UnitOption = { id: string; code: string; name: string };

type Row = { key: number; accountId: string; unitId: string; amount: string; memo: string };

let nextKey = 1;
const blank = (unitId: string): Row => ({ key: nextKey++, accountId: '', unitId, amount: '', memo: '' });

const keyOf = (a: { accountId: string; unitId: string }) => `${a.accountId}::${a.unitId}`;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

/**
 * Formulir uang masuk dan uang keluar. Keduanya berbagi bentuk yang sama:
 * satu rekening kas, lalu beberapa baris rincian yang boleh menunjuk cabang
 * berbeda — mis. satu tagihan listrik dibagi ke hotel dan laundry.
 */
export function MoneyForm({
  kind,
  accounts,
  categories,
  units,
  defaultDate,
}: {
  kind: 'RECEIVE' | 'PAY';
  accounts: CashAccountBalance[];
  categories: CategoryAccount[];
  units: UnitOption[];
  defaultDate: string;
}) {
  const action = kind === 'RECEIVE' ? createReceiveMoney : createPayMoney;
  const [state, formAction] = useActionState(action, initial);
  const [cash, setCash] = useState('');

  const byKey = useMemo(() => new Map(accounts.map((a) => [keyOf(a), a])), [accounts]);
  const cashAcc = byKey.get(cash);
  const cashUnitId = cashAcc?.unitId ?? units[0]?.id ?? '';

  const [rows, setRows] = useState<Row[]>([blank(''), blank('')]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const total = rows.reduce((s, r) => s + (Number(r.amount.replace(/[^\d]/g, '')) || 0), 0);
  const filled = rows.filter((r) => r.accountId && Number(r.amount.replace(/[^\d]/g, '')) > 0);
  const crossUnit = filled.some((r) => (r.unitId || cashUnitId) !== cashUnitId);

  const grouped = useMemo(() => {
    const m = new Map<string, CashAccountBalance[]>();
    for (const a of accounts) {
      const label = `${a.unitCode} — ${a.unitName}`;
      if (!m.has(label)) m.set(label, []);
      m.get(label)!.push(a);
    }
    return [...m.entries()];
  }, [accounts]);

  const isReceive = kind === 'RECEIVE';

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="cashAccountId" value={cashAcc?.accountId ?? ''} />
      <input type="hidden" name="cashUnitId" value={cashAcc?.unitId ?? ''} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="m-date">Tanggal</label>
          <input id="m-date" name="date" type="date" defaultValue={defaultDate} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="m-cash">
            {isReceive ? 'Uang masuk ke rekening' : 'Uang dibayar dari rekening'}
          </label>
          <select id="m-cash" className="input" value={cash} onChange={(e) => setCash(e.target.value)} required>
            <option value="">— Pilih rekening —</option>
            {grouped.map(([unitLabel, list]) => (
              <optgroup key={unitLabel} label={unitLabel}>
                {list.map((a) => (
                  <option key={keyOf(a)} value={keyOf(a)}>
                    {a.code} {a.name} · {formatRupiah(a.balance)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="m-party">
            {isReceive ? 'Diterima dari' : 'Dibayarkan kepada'}
          </label>
          <input
            id="m-party"
            name="counterparty"
            className="input"
            placeholder={isReceive ? 'Agoda / Tamu / PT ABC' : 'PLN / Supplier / Karyawan'}
          />
        </div>
        <div>
          <label className="label" htmlFor="m-desc">Keterangan</label>
          <input
            id="m-desc"
            name="description"
            className="input"
            placeholder={isReceive ? 'Pencairan OTA Maret' : 'Tagihan listrik Maret'}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="m-ref">No. bukti (opsional)</label>
          <input id="m-ref" name="reference" className="input" placeholder={isReceive ? 'RV-001' : 'PV-001'} />
        </div>
      </div>

      <div>
        <p className="label">Rincian</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">{isReceive ? 'Akun pendapatan' : 'Akun beban / tujuan'}</th>
                <th className="th w-40">Untuk cabang</th>
                <th className="th w-40 text-right">Nominal</th>
                <th className="th w-48">Memo</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="td">
                    <select
                      name="lineAccountId"
                      className="input"
                      value={row.accountId}
                      onChange={(e) => update(row.key, { accountId: e.target.value })}
                    >
                      <option value="">— Pilih akun —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <select
                      name="lineUnitId"
                      className="input"
                      value={row.unitId || cashUnitId}
                      onChange={(e) => update(row.key, { unitId: e.target.value })}
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <input
                      name="lineAmount"
                      inputMode="numeric"
                      className="input text-right"
                      value={row.amount}
                      onChange={(e) => update(row.key, { amount: e.target.value.replace(/[^\d]/g, '') })}
                    />
                  </td>
                  <td className="td">
                    <input
                      name="lineMemo"
                      className="input"
                      value={row.memo}
                      onChange={(e) => update(row.key, { memo: e.target.value })}
                    />
                  </td>
                  <td className="td text-center">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        aria-label="Hapus baris"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td className="td" colSpan={2}>Total</td>
                <td className="td num">{formatRupiah(total)}</td>
                <td className="td" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, blank('')])}>
        + Tambah baris
      </button>

      {crossUnit && cashAcc && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <p className="font-semibold">Ada baris milik cabang lain</p>
          <p className="mt-0.5">
            Rekening yang dipakai milik {cashAcc.unitCode}, tetapi sebagian rincian ditujukan ke cabang lain.
            Sistem otomatis mencatat piutang dan hutang antar unit agar neraca tiap cabang tetap seimbang.
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

      <SubmitButton label={isReceive ? 'Simpan uang masuk' : 'Simpan uang keluar'} />
    </form>
  );
}
