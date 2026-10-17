'use client';

import type { ComponentProps } from 'react';
import {
  CartesianGrid,
  Label,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRupiah, formatRupiahShort } from '@/lib/format';
import { SERIES } from './charts';

/**
 * Uang masuk kumulatif sepanjang bulan, dibandingkan dengan tiga proyeksinya.
 *
 * Hanya satu seri yang benar-benar data — garis aktual. Tiga garis lainnya
 * acuan, jadi semuanya kelabu, tipis, putus-putus dengan pola berbeda, dan
 * diberi nama langsung di ujung kanannya. Warna tidak dipakai membedakan
 * ketiganya: yang membedakan pola garis dan namanya sendiri.
 */

export type TitikTren = {
  hari: number;
  aktual: number | null;
  pesimis: number;
  normal: number;
  optimis: number;
};

const ACUAN = [
  { kunci: 'optimis', nama: 'Optimis', dash: '2 3' },
  { kunci: 'normal', nama: 'Normal', dash: '6 3' },
  { kunci: 'pesimis', nama: 'Pesimis', dash: '1 4' },
] as const;

const AXIS_PROPS = {
  stroke: SERIES.axis,
  tick: { fill: SERIES.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function Kotak({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const isi = payload.filter((p) => p.value != null);
  if (isi.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-slate-900">Tanggal {label}</p>
      <ul className="space-y-0.5">
        {isi.map((p) => (
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

/**
 * Nama seri acuan, ditulis sekali di ujung kanan garisnya.
 *
 * Recharts memanggil content untuk tiap titik, jadi yang digambar hanya titik
 * terakhir — kalau tidak, namanya tercetak berkali-kali menimpa garisnya
 * sendiri.
 */
function NamaUjung(nama: string, jumlah: number) {
  return function Isi({ x, y, index }: { x?: number; y?: number; index?: number }) {
    if (index !== jumlah - 1 || typeof x !== 'number' || typeof y !== 'number') return null;
    return (
      <text x={x - 4} y={y - 6} textAnchor="end" fontSize={11} fill={SERIES.axis}>
        {nama}
      </text>
    );
  };
}

/**
 * Nama acuan mana saja yang muat ditulis di ujung garisnya.
 *
 * Dua proyeksi yang nilainya berdekatan berakhir di titik yang hampir sama,
 * dan namanya akan saling menimpa sampai dua-duanya tidak terbaca. Yang
 * tertutup dilewati saja — legenda di bawah grafik tetap menyebut semuanya.
 */
function acuanYangMuat(data: TitikTren[]): Set<string> {
  const akhir = data[data.length - 1];
  const muat = new Set<string>();
  if (!akhir) return muat;

  const nilai = (kunci: string) => Number(akhir[kunci as 'normal']) || 0;
  const maks = Math.max(...ACUAN.map((a) => nilai(a.kunci)), 1);

  let sebelumnya: number | null = null;
  for (const a of [...ACUAN].sort((x, y) => nilai(y.kunci) - nilai(x.kunci))) {
    const v = nilai(a.kunci);
    // Jarak minimal 7% tinggi grafik — kira-kira dua kali tinggi hurufnya.
    if (sebelumnya === null || Math.abs(sebelumnya - v) / maks > 0.07) {
      muat.add(a.kunci);
      sebelumnya = v;
    }
  }
  return muat;
}

export function TrenMasukChart({
  data, hariTerakhir, height = 300,
}: {
  data: TitikTren[];
  /** Tanggal laporan terakhir — ditandai garis tegak. */
  hariTerakhir: number;
  height?: number;
}) {
  const berlabel = acuanYangMuat(data);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 16 }}>
        <CartesianGrid stroke={SERIES.grid} vertical={false} />

        <XAxis
          dataKey="hari"
          type="number"
          domain={[0, 'dataMax']}
          ticks={[0, 5, 10, 15, 20, 25, data[data.length - 1]?.hari ?? 31]}
          {...AXIS_PROPS}
        >
          <Label value="Tanggal" position="insideBottom" offset={-12} fill={SERIES.axis} fontSize={11} />
        </XAxis>
        <YAxis tickFormatter={formatRupiahShort} width={88} {...AXIS_PROPS} />

        <Tooltip content={<Kotak />} cursor={{ stroke: SERIES.axis, strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#52525b', paddingTop: 16 }} />

        <ReferenceLine
          x={hariTerakhir}
          stroke={SERIES.axis}
          strokeDasharray="3 3"
          label={{ value: 'laporan terakhir', position: 'top', fill: SERIES.axis, fontSize: 10 }}
        />

        {ACUAN.map((a) => (
          <Line
            key={a.kunci}
            type="linear"
            dataKey={a.kunci}
            name={a.nama}
            stroke={SERIES.axis}
            strokeWidth={1.5}
            strokeDasharray={a.dash}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          >
            {/* Bentuk props dari Recharts jauh lebih longgar daripada yang
                dipakai di sini, jadi hanya bagian yang dipakai yang ditulis. */}
            {berlabel.has(a.kunci) && (
              <LabelList
                dataKey={a.kunci}
                content={NamaUjung(a.nama, data.length) as ComponentProps<typeof LabelList>['content']}
              />
            )}
          </Line>
        ))}

        {/* Satu-satunya seri yang benar-benar data: tebal, berwarna, bertitik. */}
        <Line
          type="linear"
          dataKey="aktual"
          name="Uang masuk sebenarnya"
          stroke={SERIES.in}
          strokeWidth={2}
          dot={{ r: 4, fill: SERIES.in, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
