'use client';

import { useMemo, useState } from 'react';
import { advisePurchase, type PurchaseCadence, type PurchaseContext, type PurchasePlan } from '@/lib/forecast';
import { formatPeriod, formatRupiah } from '@/lib/format';

/**
 * "Uangnya cukup atau tidak?" — pemeriksa kemampuan beli.
 *
 * Perhitungannya dilakukan di sisi pengguna memakai mesin ramalan yang sama
 * dengan halaman ini, sehingga angkanya langsung berubah saat harga digeser
 * tanpa perlu memuat ulang halaman.
 */

const CADENCE_LABEL: Record<PurchaseCadence, string> = {
  WEEKLY: 'mingguan',
  MONTHLY: 'bulanan',
};

/** "sekarang", "2 minggu lagi", "1 bulan lagi" — dibaca dari selisih hari. */
function kapan(dayOffset: number, cadence: PurchaseCadence): string {
  if (dayOffset === 0) return 'sekarang';
  if (cadence === 'WEEKLY') {
    const minggu = Math.round(dayOffset / 7);
    return `${minggu} minggu lagi`;
  }
  const bulan = Math.max(1, Math.round(dayOffset / 30));
  return `${bulan} bulan lagi`;
}

function JadwalCicilan({ plan }: { plan: PurchasePlan }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[24rem] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="td">Cicilan</th>
            <th className="td whitespace-nowrap">Kapan</th>
            <th className="td num whitespace-nowrap">Dibayar</th>
            <th className="td num whitespace-nowrap">Sisa kas</th>
          </tr>
        </thead>
        <tbody>
          {plan.schedule.map((c) => (
            <tr key={c.index} className="border-t border-slate-100">
              <td className="td">ke-{c.index}</td>
              <td className="td">
                <span className="whitespace-nowrap">{kapan(c.dayOffset, plan.cadence)}</span>{' '}
                <span className="whitespace-nowrap text-xs text-slate-400">({formatPeriod(c.period)})</span>
              </td>
              <td className="td num whitespace-nowrap">{formatRupiah(c.amount)}</td>
              <td className={`td num whitespace-nowrap ${c.safe ? '' : 'font-semibold text-red-600'}`}>
                {formatRupiah(c.balanceAfter)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PurchaseCalculator({ context }: { context: PurchaseContext }) {
  const [harga, setHarga] = useState(0);
  const [cicilan, setCicilan] = useState(1);
  const [cadence, setCadence] = useState<PurchaseCadence>('WEEKLY');

  const saran = useMemo(
    () => (harga > 0 ? advisePurchase(context, harga, cicilan, cadence) : null),
    [context, harga, cicilan, cadence],
  );

  const rencana = saran?.requested;
  const usulanBeda =
    saran?.recommended && saran.minimumInstalments !== null && saran.minimumInstalments !== cicilan
      ? saran
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="beli-harga">Harga barang</label>
          <input
            id="beli-harga"
            inputMode="numeric"
            className="input"
            placeholder="150000000"
            value={harga === 0 ? '' : String(harga)}
            onChange={(e) => setHarga(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
          />
          <p className="mt-1 text-xs text-slate-500">
            {harga > 0 ? formatRupiah(harga) : 'Isi harga barang atau proyek yang ingin dibeli.'}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="beli-cicilan">Dipecah berapa kali</label>
          <div className="flex items-center gap-2">
            <input
              id="beli-cicilan"
              type="number"
              min={1}
              max={24}
              className="input w-20 shrink-0"
              value={cicilan}
              onChange={(e) => setCicilan(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            />
            <select
              aria-label="Jarak antar cicilan"
              className="input min-w-0 flex-1"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as PurchaseCadence)}
            >
              <option value="WEEKLY">mingguan</option>
              <option value="MONTHLY">bulanan</option>
            </select>
          </div>
          <p className="mt-1 text-xs text-slate-500">1 berarti dibayar sekaligus.</p>
        </div>
      </div>

      {!rencana && (
        <p className="text-sm text-slate-500">
          Sekali dibayar sekaligus sekarang, kemampuan belanja maksimum{' '}
          <strong>{formatRupiah(context.maxAffordableNow)}</strong> tanpa menembus batas aman.
        </p>
      )}

      {rencana && saran && (
        <>
          <div
            className={`rounded-lg border p-4 ${
              rencana.affordable
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p className={`font-semibold ${rencana.affordable ? 'text-emerald-800' : 'text-amber-900'}`}>
              {rencana.affordable
                ? cicilan === 1
                  ? 'Cukup — bisa dibayar sekaligus sekarang.'
                  : `Cukup bila dipecah ${cicilan} kali ${CADENCE_LABEL[cadence]}.`
                : 'Belum cukup dengan rencana ini.'}
            </p>

            {!rencana.affordable && (
              <p className="mt-1 text-sm text-amber-900">
                Pada titik terendah, kas kurang <strong>{formatRupiah(rencana.shortfall)}</strong> dari
                batas aman
                {rencana.lowest ? ` (${formatPeriod(rencana.lowest.period)})` : ''}.
              </p>
            )}

            {usulanBeda && (
              <p className="mt-2 text-sm text-amber-900">
                Pecah jadi <strong>{saran.minimumInstalments} kali {CADENCE_LABEL[cadence]}</strong>
                {' '}&mdash; masing-masing sekitar{' '}
                <strong>{formatRupiah(saran.recommended!.amount / saran.minimumInstalments!)}</strong>
                {' '}&mdash; dan kasnya cukup.
              </p>
            )}

            {!rencana.affordable && saran.minimumInstalments === null && (
              <p className="mt-2 text-sm text-amber-900">
                Dipecah berapa kali pun tetap tidak cukup, karena pada akhirnya seluruh harga keluar
                dari kas. Harga tertinggi yang masih aman bila dibayar sekaligus sekarang{' '}
                <strong>{formatRupiah(context.maxAffordableNow)}</strong>.
              </p>
            )}
          </div>

          <JadwalCicilan plan={rencana} />

          <p className="text-xs text-slate-500">
            Diperiksa bukan hanya saat tiap cicilan dibayar, tetapi juga bulan-bulan sesudahnya &mdash;
            pembelian menurunkan saldo kas seterusnya, jadi bisa saja tiap cicilan terlihat aman tetapi
            kasnya jebol beberapa bulan kemudian. Di dalam satu bulan, arus kas dianggap mengalir rata
            tiap hari, padahal gaji dan tagihan besar biasanya menumpuk di tanggal tertentu. Untuk
            pembelian yang mepet dengan batas aman, jangan bersandar pada selisih beberapa hari.
          </p>
        </>
      )}
    </div>
  );
}
