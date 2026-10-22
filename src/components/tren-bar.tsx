'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRupiah, formatRupiahShort } from '@/lib/format';
import type { BatangTren } from '@/lib/tren-masuk';
import { SERIES } from './charts';

/**
 * Uang masuk sebenarnya dibandingkan target, satu kelompok per skenario.
 *
 * Tiap kelompok berisi dua batang bersebelahan. Yang abu adalah targetnya,
 * dipecah dua: bagian gelap yang semestinya sudah masuk sampai tanggal
 * laporan, bagian terang sisanya sampai akhir bulan. Yang biru adalah uang
 * yang benar-benar masuk — tingginya sama di ketiga kelompok, karena memang
 * satu angka yang sedang diuji terhadap tiga target berbeda.
 *
 * Membacanya: batang biru melewati bagian gelap berarti lebih cepat daripada
 * jadwal; setinggi seluruh batang abu berarti target sebulan sudah tercapai.
 */

const ABU_TUA = '#a8a29e';
const ABU_MUDA = '#d6d3d1';

const AXIS_PROPS = {
  stroke: SERIES.axis,
  tick: { fill: SERIES.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/**
 * Batas atas sumbu beserta tandanya, dibulatkan ke angka yang enak dibaca.
 *
 * Dibiarkan otomatis, Recharts membulatkan terlalu jauh ke atas dan seluruh
 * batang terdesak ke bawah; dipatok persis ke data, tandanya berubah ganjil
 * seperti "Rp 414,9 jt". Jadi dicari langkah bulat terkecil yang tandanya
 * tidak lebih dari sepuluh.
 */
function sumbuRapi(tertinggi: number, maksTanda = 8): { maks: number; ticks: number[] } {
  const kasar = Math.max(tertinggi, 1) / maksTanda;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  const langkah = [1, 2, 2.5, 5, 10]
    .map((m) => m * pangkat)
    .find((l) => l >= kasar) ?? pangkat * 10;

  const maks = Math.ceil(tertinggi / langkah) * langkah;
  const ticks: number[] = [];
  for (let v = 0; v <= maks + langkah / 2; v += langkah) ticks.push(v);
  return { maks, ticks };
}

function Kotak({
  active, payload, label, hariTerakhir,
}: {
  active?: boolean;
  payload?: { payload?: BatangTren }[];
  label?: string;
  hariTerakhir: number;
}) {
  const b = payload?.[0]?.payload;
  if (!active || !b) return null;

  const baris: [string, string, string?][] = [
    ['Target sebulan', formatRupiah(b.targetSebulan)],
    [`Target sampai tgl ${hariTerakhir}`, formatRupiah(b.targetKini)],
    ['Sudah masuk', formatRupiah(b.masuk)],
    [
      b.selisih >= 0 ? 'Lebih cepat' : 'Tertinggal',
      formatRupiah(Math.abs(b.selisih)),
      b.selisih >= 0 ? 'text-emerald-700' : 'text-red-600',
    ],
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-slate-900">{label}</p>
      <ul className="space-y-0.5">
        {baris.map(([nama, nilai, warna]) => (
          <li key={nama} className="flex items-center gap-4 text-xs">
            <span className="text-slate-600">{nama}</span>
            <span className={`ml-auto font-medium tabular-nums ${warna ?? 'text-slate-900'}`}>
              {nilai}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrenBarChart({
  data, hariTerakhir, height = 320,
}: {
  data: BatangTren[];
  /** Tanggal laporan terakhir — dipakai menamai target berjalannya. */
  hariTerakhir: number;
  height?: number;
}) {
  const sumbu = sumbuRapi(Math.max(...data.map((b) => Math.max(b.targetSebulan, b.masuk)), 1));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 8 }} barGap={6}>
        <CartesianGrid stroke={SERIES.grid} vertical={false} />
        <XAxis dataKey="nama" {...AXIS_PROPS} />
        <YAxis
          tickFormatter={formatRupiahShort}
          width={84}
          domain={[0, sumbu.maks]}
          ticks={sumbu.ticks}
          {...AXIS_PROPS}
        />

        <Tooltip
          content={<Kotak hariTerakhir={hariTerakhir} />}
          cursor={{ fill: 'rgba(120,113,108,0.06)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#52525b', paddingTop: 8 }} />

        {/* Dua potongan dengan stackId yang sama menumpuk jadi satu batang
            target; batang biru ber-stackId lain, jadi ia berdiri di sebelahnya. */}
        <Bar
          dataKey="targetKini"
          name={`Target sampai tgl ${hariTerakhir}`}
          stackId="target"
          fill={ABU_TUA}
          isAnimationActive={false}
        />
        <Bar
          dataKey="targetSisa"
          name="Sisa target sebulan"
          stackId="target"
          fill={ABU_MUDA}
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
        >
          <LabelList
            dataKey="targetSebulan"
            position="top"
            formatter={formatRupiahShort}
            style={{ fill: SERIES.axis, fontSize: 11 }}
          />
        </Bar>
        <Bar
          dataKey="masuk"
          name="Sudah masuk"
          fill={SERIES.in}
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
        >
          <LabelList
            dataKey="masuk"
            position="top"
            formatter={formatRupiahShort}
            style={{ fill: SERIES.in, fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
