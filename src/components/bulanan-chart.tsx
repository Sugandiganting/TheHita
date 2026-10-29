'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPeriodShort, formatRupiah, formatRupiahShort } from '@/lib/format';
import type { BarisBulan } from '@/lib/bulanan';
import { SERIES } from './charts';

/**
 * Proyeksi dan kenyataan, bulan demi bulan.
 *
 * Tiap bulan dua batang. Yang kiri proyeksi, bertingkat tiga: pesimis sebagai
 * dasar, lalu selisihnya ke normal, lalu ke optimis — jadi tinggi penuhnya
 * skenario paling baik, dan batas tiap warnanya adalah skenario itu sendiri.
 * Yang kanan uang yang benar-benar masuk.
 *
 * Bulan berjalan dibedakan: bagian bawah batang kanannya uang yang sudah
 * masuk, bagian atasnya lebih pucat untuk perkiraan sisa bulan. Tanpa itu,
 * batangnya selalu terlihat jauh lebih pendek daripada proyeksi di sebelahnya
 * sepanjang bulan belum habis — pendek karena bulannya belum selesai, bukan
 * karena uangnya seret.
 */

const WARNA = {
  pesimis: '#c9c2bb',
  normal: '#9a8f85',
  optimis: '#6b6159',
  masuk: SERIES.in,
  sisa: '#9dc2ee',
} as const;

const AXIS_PROPS = {
  stroke: SERIES.axis,
  tick: { fill: SERIES.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/**
 * Batas atas sumbu beserta tandanya, dibulatkan ke angka yang enak dibaca.
 * Dibiarkan otomatis, Recharts membulatkan terlalu jauh ke atas dan seluruh
 * batang terdesak ke bawah.
 */
function sumbuRapi(tertinggi: number, maksTanda = 6): { maks: number; ticks: number[] } {
  // Angka yang bukan bilangan hingga akan membuat langkahnya NaN, dan gelung
  // di bawah tidak akan pernah berhenti — satu baris data yang rusak cukup
  // untuk membekukan seluruh halaman. Lebih baik sumbunya salah daripada
  // layarnya mati.
  const aman = Number.isFinite(tertinggi) && tertinggi > 0 ? tertinggi : 1;
  const kasar = Math.max(aman, 1) / maksTanda;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  const langkah = [1, 2, 2.5, 5, 10].map((m) => m * pangkat).find((l) => l >= kasar)
    ?? pangkat * 10;

  const maks = Math.ceil(aman / langkah) * langkah;
  const ticks: number[] = [];
  for (let v = 0; v <= maks + langkah / 2; v += langkah) ticks.push(v);
  return { maks, ticks };
}

function Baris({ nama, nilai, warna, tebal }: {
  nama: string; nilai: string; warna?: string; tebal?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 text-xs">
      {warna
        ? <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: warna }} />
        : <span className="w-2 shrink-0" />}
      <span className="text-slate-600">{nama}</span>
      <span className={`ml-auto tabular-nums ${tebal ? 'font-semibold text-slate-900' : 'text-slate-900'}`}>
        {nilai}
      </span>
    </li>
  );
}

function Kotak({ active, payload }: { active?: boolean; payload?: { payload?: BarisBulan }[] }) {
  const b = payload?.[0]?.payload;
  if (!active || !b) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-slate-900">
        {formatPeriodShort(b.period)}
        {b.posisi === 'INI' && <span className="ml-2 font-normal text-brand-700">bulan berjalan</span>}
      </p>
      <ul className="space-y-0.5">
        <Baris nama="Optimis" nilai={formatRupiah(b.optimis)} warna={WARNA.optimis} />
        <Baris nama="Normal" nilai={formatRupiah(b.normal)} warna={WARNA.normal} />
        <Baris nama="Pesimis" nilai={formatRupiah(b.pesimis)} warna={WARNA.pesimis} />
        {b.masuk !== null && (
          <Baris
            nama={b.hariMasuk ? `Sudah masuk (s.d. hari ke-${b.hariMasuk})` : 'Uang masuk'}
            nilai={formatRupiah(b.masuk)}
            warna={WARNA.masuk}
            tebal
          />
        )}
        {b.perkiraanSisa !== null && b.perkiraanSisa > 0 && (
          <Baris nama="Perkiraan sisa bulan" nilai={formatRupiah(b.perkiraanSisa)} warna={WARNA.sisa} />
        )}
      </ul>
    </div>
  );
}

export function BulananChart({ data, height = 340 }: { data: BarisBulan[]; height?: number }) {
  const tertinggi = Math.max(
    ...data.map((b) => Math.max(
      b.lapisPesimis + b.lapisNormal + b.lapisOptimis,
      (b.masuk ?? 0) + (b.perkiraanSisa ?? 0),
    )),
    1,
  );
  const sumbu = sumbuRapi(tertinggi);
  const bulanIni = data.find((b) => b.posisi === 'INI')?.period;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 8 }} barGap={3}>
        <CartesianGrid stroke={SERIES.grid} vertical={false} />
        <XAxis dataKey="period" tickFormatter={formatPeriodShort} interval={0} {...AXIS_PROPS} />
        <YAxis
          tickFormatter={formatRupiahShort}
          width={84}
          domain={[0, sumbu.maks]}
          ticks={sumbu.ticks}
          {...AXIS_PROPS}
        />

        <Tooltip content={<Kotak />} cursor={{ fill: 'rgba(120,113,108,0.06)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#52525b', paddingTop: 8 }} />

        {/* Batas antara yang sudah terjadi dan yang masih ramalan. */}
        {bulanIni && (
          <ReferenceLine
            x={bulanIni}
            stroke={SERIES.axis}
            strokeDasharray="3 3"
            label={{ value: 'bulan ini', position: 'top', fill: SERIES.axis, fontSize: 10 }}
          />
        )}

        <Bar dataKey="lapisPesimis" name="Pesimis" stackId="proyeksi" fill={WARNA.pesimis} isAnimationActive={false} />
        <Bar dataKey="lapisNormal" name="Normal" stackId="proyeksi" fill={WARNA.normal} isAnimationActive={false} />
        <Bar dataKey="lapisOptimis" name="Optimis" stackId="proyeksi" fill={WARNA.optimis} isAnimationActive={false} radius={[3, 3, 0, 0]} />

        <Bar dataKey="masuk" name="Uang masuk sebenarnya" stackId="nyata" fill={WARNA.masuk} isAnimationActive={false} />
        <Bar dataKey="perkiraanSisa" name="Perkiraan sisa bulan" stackId="nyata" fill={WARNA.sisa} isAnimationActive={false} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
