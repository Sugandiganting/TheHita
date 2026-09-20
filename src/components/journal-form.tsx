'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createJournalEntry, type ActionState } from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import type { AccountOption, UnitOption } from './quick-entry-form';

const initial: ActionState = { ok: false, message: '' };

type Row = { key: number; accountId: string; unitId: string; debit: string; credit: string; memo: string };

let nextKey = 1;
const blankRow = (unitId: string): Row => ({ key: nextKey++, accountId: '', unitId, debit: '', credit: '', memo: '' });

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || disabled}>
      {pending ? 'Menyimpan…' : 'Simpan jurnal'}
    </button>
  );
}

/**
 * Jurnal manual multi-baris untuk transaksi yang tidak cukup diwakili entri cepat,
 * mis. satu tagihan listrik yang dibagi ke dua cabang, atau pelunasan hutang.
 */
export function JournalForm({
  units,
  accounts,
  defaultDate,
}: {
  units: UnitOption[];
  accounts: AccountOption[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(createJournalEntry, initial);
  const defaultUnit = units[0]?.id ?? '';
  const [rows, setRows] = useState<Row[]>([blankRow(defaultUnit), blankRow(defaultUnit)]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const toNum = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;
  const totalDebit = rows.reduce((s, r) => s + toNum(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + toNum(r.credit), 0);
  const difference = totalDebit - totalCredit;
  const balanced = difference === 0 && totalDebit > 0;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="j-date">Tanggal</label>
          <input id="j-date" name="date" type="date" defaultValue={defaultDate} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="j-unit">Unit utama</label>
          <select id="j-unit" name="unitId" className="input" required defaultValue={defaultUnit}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="j-desc">Keterangan</label>
          <input id="j-desc" name="description" className="input" placeholder="Pembayaran tagihan listrik bersama" required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="j-ref">No. bukti (opsional)</label>
        <input id="j-ref" name="reference" className="input sm:max-w-xs" placeholder="JV-2026-001" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[860px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Akun</th>
              <th className="th w-48">Unit</th>
              <th className="th w-36 text-right">Debit</th>
              <th className="th w-36 text-right">Kredit</th>
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
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="td">
                  <select
                    name="lineUnitId"
                    className="input"
                    value={row.unitId}
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
                    name="lineDebit"
                    inputMode="numeric"
                    className="input text-right"
                    value={row.debit}
                    onChange={(e) =>
                      update(row.key, { debit: e.target.value.replace(/[^\d]/g, ''), credit: '' })
                    }
                  />
                </td>
                <td className="td">
                  <input
                    name="lineCredit"
                    inputMode="numeric"
                    className="input text-right"
                    value={row.credit}
                    onChange={(e) =>
                      update(row.key, { credit: e.target.value.replace(/[^\d]/g, ''), debit: '' })
                    }
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
                  {rows.length > 2 && (
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
              <td className="td" colSpan={2}>
                Total
              </td>
              <td className="td num">{formatRupiah(totalDebit)}</td>
              <td className="td num">{formatRupiah(totalCredit)}</td>
              <td className="td" colSpan={2}>
                {totalDebit === 0 && totalCredit === 0 ? (
                  <span className="text-slate-500">Belum ada nilai</span>
                ) : balanced ? (
                  <span className="text-emerald-600">Balance ✓</span>
                ) : (
                  <span className="text-red-600">Selisih {formatRupiah(Math.abs(difference))}</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => setRows((rs) => [...rs, blankRow(defaultUnit)])}
      >
        + Tambah baris
      </button>

      {state.message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton disabled={!balanced} />
        {!balanced && <p className="text-xs text-slate-500">Jurnal harus balance sebelum bisa disimpan.</p>}
      </div>
    </form>
  );
}
