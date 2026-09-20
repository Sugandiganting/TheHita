'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPeriodShort, formatRupiah, formatRupiahShort } from '@/lib/format';

/**
 * Palet kategorikal tervalidasi (slot 1-3). Urutan slot tetap — warna
 * mengikuti entitas, bukan peringkat, sehingga filter tidak mengubah warna seri.
 */
export const SERIES = {
  in: '#2a78d6', // biru  — pemasukan
  out: '#eb6834', // oranye — pengeluaran
  net: '#1baf7a', // aqua  — saldo / laba
  danger: '#e34948',
  grid: '#e7e5e4',
  axis: '#78716c',
} as const;

const AXIS_PROPS = {
  stroke: SERIES.axis,
  tick: { fill: SERIES.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-slate-900">{formatPeriodShort(String(label))}</p>
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-600">{p.name}</span>
            <span className="ml-auto font-medium tabular-nums text-slate-900">
              {formatRupiah(Number(p.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const legendStyle = { fontSize: 12, color: '#52525b', paddingTop: 8 };

export type CashflowPoint = { period: string; masuk: number; keluar: number };

/** Perbandingan pemasukan vs pengeluaran per bulan. */
export function CashflowBarChart({ data, height = 300 }: { data: CashflowPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={SERIES.grid} vertical={false} />
        <XAxis dataKey="period" tickFormatter={formatPeriodShort} {...AXIS_PROPS} />
        <YAxis tickFormatter={formatRupiahShort} width={88} {...AXIS_PROPS} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="masuk" name="Pemasukan" fill={SERIES.in} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="keluar" name="Pengeluaran" fill={SERIES.out} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export type BalancePoint = {
  period: string;
  saldo: number;
  /** Bagian histori atau ramalan — dipakai untuk menandai batas proyeksi. */
  forecast?: boolean;
};

/**
 * Proyeksi saldo kas. Garis batas aman dan garis nol ditampilkan eksplisit
 * agar titik "kas habis" langsung terbaca.
 */
export function CashBalanceChart({
  data,
  buffer,
  splitAt,
  height = 320,
}: {
  data: BalancePoint[];
  buffer?: number;
  /** Periode terakhir data aktual; ditandai garis vertikal. */
  splitAt?: string;
  height?: number;
}) {
  const hasNegative = data.some((d) => d.saldo < 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.net} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES.net} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={SERIES.grid} vertical={false} />
        <XAxis dataKey="period" tickFormatter={formatPeriodShort} {...AXIS_PROPS} />
        <YAxis tickFormatter={formatRupiahShort} width={88} {...AXIS_PROPS} />
        <Tooltip content={<TooltipBox />} />
        <Legend wrapperStyle={legendStyle} />

        {hasNegative && <ReferenceLine y={0} stroke={SERIES.danger} strokeWidth={1.5} />}
        {buffer !== undefined && buffer > 0 && (
          <ReferenceLine
            y={buffer}
            stroke={SERIES.out}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{ value: 'Batas aman', position: 'insideTopRight', fill: SERIES.out, fontSize: 11 }}
          />
        )}
        {splitAt && (
          <ReferenceLine
            x={splitAt}
            stroke={SERIES.axis}
            strokeDasharray="3 3"
            label={{ value: 'Mulai ramalan', position: 'insideTopLeft', fill: SERIES.axis, fontSize: 11 }}
          />
        )}

        <Area
          type="monotone"
          dataKey="saldo"
          name="Saldo kas"
          stroke={SERIES.net}
          strokeWidth={2}
          fill="url(#saldoFill)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type NetPoint = { period: string; net: number };

/** Arus kas bersih per bulan; batang merah menandai bulan defisit. */
export function NetCashChart({ data, height = 260 }: { data: NetPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={SERIES.grid} vertical={false} />
        <XAxis dataKey="period" tickFormatter={formatPeriodShort} {...AXIS_PROPS} />
        <YAxis tickFormatter={formatRupiahShort} width={88} {...AXIS_PROPS} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <ReferenceLine y={0} stroke={SERIES.axis} />
        <Bar dataKey="net" name="Arus kas bersih" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.period} fill={d.net < 0 ? SERIES.danger : SERIES.net} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type UnitPoint = { name: string; laba: number };

/** Perbandingan laba antar cabang. Satu seri — tidak perlu legenda. */
export function UnitProfitChart({ data, height = 260 }: { data: UnitPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={SERIES.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={formatRupiahShort} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="name" width={130} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold text-slate-900">{label}</p>
                <p className="mt-0.5 tabular-nums text-slate-700">{formatRupiah(Number(payload[0].value ?? 0))}</p>
              </div>
            ) : null
          }
        />
        <ReferenceLine x={0} stroke={SERIES.axis} />
        <Bar dataKey="laba" name="Laba bersih" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.laba < 0 ? SERIES.danger : SERIES.in} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
