'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveProject, type ActionState } from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import { monthlyInstallment } from '@/lib/forecast';

const initial: ActionState = { ok: false, message: '' };

export type ProjectFormValues = {
  id?: string;
  name?: string;
  unitId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  fundingType?: string;
  fundingAmount?: number;
  fundingDate?: string;
  loanRatePct?: number;
  loanTenorMonths?: number;
  upliftRevenueMonthly?: number;
  upliftExpenseMonthly?: number;
  upliftStartDate?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan proyek'}
    </button>
  );
}

/**
 * Formulir rencana proyek. Nilai yang diisi di sini langsung dipakai
 * mesin peramalan untuk menghitung dampaknya terhadap saldo kas.
 */
export function ProjectForm({
  units,
  values = {},
}: {
  units: { id: string; code: string; name: string }[];
  values?: ProjectFormValues;
}) {
  const [state, formAction] = useActionState(saveProject, initial);
  const [fundingType, setFundingType] = useState(values.fundingType ?? 'NONE');
  const [fundingAmount, setFundingAmount] = useState(String(values.fundingAmount ?? ''));
  const [rate, setRate] = useState(String(values.loanRatePct ?? 11));
  const [tenor, setTenor] = useState(String(values.loanTenorMonths ?? 60));

  const principal = Number(fundingAmount.replace(/[^\d]/g, '')) || 0;
  const installment =
    fundingType === 'LOAN' ? monthlyInstallment(principal, Number(rate) || 0, Number(tenor) || 0) : 0;

  return (
    <form action={formAction} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-name">Nama proyek</label>
          <input
            id="p-name"
            name="name"
            className="input"
            defaultValue={values.name}
            placeholder="Penambahan 8 kamar baru"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="p-unit">Unit usaha</label>
          <select id="p-unit" name="unitId" className="input" defaultValue={values.unitId} required>
            <option value="">— Pilih unit —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-status">Status</label>
          <select id="p-status" name="status" className="input" defaultValue={values.status ?? 'PLANNED'}>
            <option value="DRAFT">Draft</option>
            <option value="PLANNED">Direncanakan</option>
            <option value="ONGOING">Berjalan</option>
            <option value="DONE">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-start">Tanggal mulai</label>
          <input id="p-start" name="startDate" type="date" className="input" defaultValue={values.startDate} required />
        </div>
        <div>
          <label className="label" htmlFor="p-end">Target selesai</label>
          <input id="p-end" name="endDate" type="date" className="input" defaultValue={values.endDate} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-desc">Catatan</label>
          <textarea id="p-desc" name="description" rows={2} className="input" defaultValue={values.description} />
        </div>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Sumber dana tambahan</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-ftype">Jenis pendanaan</label>
            <select
              id="p-ftype"
              name="fundingType"
              className="input"
              value={fundingType}
              onChange={(e) => setFundingType(e.target.value)}
            >
              <option value="NONE">Dana sendiri (kas operasional)</option>
              <option value="LOAN">Pinjaman bank</option>
              <option value="EQUITY">Setoran modal pemilik</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="p-famount">Jumlah dana masuk</label>
            <input
              id="p-famount"
              name="fundingAmount"
              inputMode="numeric"
              className="input"
              value={fundingAmount}
              onChange={(e) => setFundingAmount(e.target.value.replace(/[^\d]/g, ''))}
              disabled={fundingType === 'NONE'}
            />
            {principal > 0 && <p className="mt-1 text-xs text-slate-500">{formatRupiah(principal)}</p>}
          </div>
          <div>
            <label className="label" htmlFor="p-fdate">Tanggal dana cair</label>
            <input
              id="p-fdate"
              name="fundingDate"
              type="date"
              className="input"
              defaultValue={values.fundingDate}
              disabled={fundingType === 'NONE'}
            />
          </div>
          {fundingType === 'LOAN' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="p-rate">Bunga (%/th)</label>
                  <input
                    id="p-rate"
                    name="loanRatePct"
                    type="number"
                    step="0.1"
                    className="input"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="p-tenor">Tenor (bulan)</label>
                  <input
                    id="p-tenor"
                    name="loanTenorMonths"
                    type="number"
                    className="input"
                    value={tenor}
                    onChange={(e) => setTenor(e.target.value)}
                  />
                </div>
              </div>
              {installment > 0 && (
                <div className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Cicilan per bulan: <strong>{formatRupiah(installment)}</strong>
                  <span className="block text-xs text-slate-500">
                    Total dibayar {formatRupiah(installment * (Number(tenor) || 0))} selama {tenor} bulan.
                    Cicilan mulai satu bulan setelah dana cair.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Perkiraan hasil setelah proyek jadi</legend>
        <p className="mb-3 text-xs text-slate-500">
          Opsional. Bila diisi, tambahan pendapatan dan biaya ini ikut dihitung di peramalan mulai bulan yang ditentukan.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="p-urev">Tambahan pendapatan/bulan</label>
            <input
              id="p-urev"
              name="upliftRevenueMonthly"
              inputMode="numeric"
              className="input"
              defaultValue={values.upliftRevenueMonthly || ''}
            />
          </div>
          <div>
            <label className="label" htmlFor="p-uexp">Tambahan biaya/bulan</label>
            <input
              id="p-uexp"
              name="upliftExpenseMonthly"
              inputMode="numeric"
              className="input"
              defaultValue={values.upliftExpenseMonthly || ''}
            />
          </div>
          <div>
            <label className="label" htmlFor="p-ustart">Mulai beroperasi</label>
            <input
              id="p-ustart"
              name="upliftStartDate"
              type="date"
              className="input"
              defaultValue={values.upliftStartDate}
            />
          </div>
        </div>
      </fieldset>

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
