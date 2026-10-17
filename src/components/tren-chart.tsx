'use client';

import {
  CartesianGrid,
  Customized,
  Label,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
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

/** Lebar pias kanan tempat nama acuan ditulis, di luar bidang gambar. */
const PIAS_KANAN = 62;
/** Jarak tegak terkecil antara dua nama supaya keduanya tetap terbaca. */
const JARAK_NAMA = 14;

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

/** Bidang gambar di dalam bingkai, diberikan Recharts kepada lapisan Customized. */
type Bidang = { top: number; left: number; width: number; height: number };

/**
 * Nama tiap acuan, ditulis di pias kanan sejajar ujung garisnya.
 *
 * Dua proyeksi yang nilainya berdekatan berakhir di titik yang nyaris sama,
 * dan namanya akan saling menimpa. Yang dekat digeser secukupnya lalu ditarik
 * garis halus ke tempat aslinya — bukan dibuang, karena nama yang hilang
 * membuat garisnya tak bisa dikenali sama sekali.
 *
 * Kedudukannya dihitung sendiri dari tinggi bidang dan batas atas sumbu, yang
 * dipatok di bawah, jadi tidak perlu menebak isi skala bawaan Recharts.
 */
function PenulisNama(daftar: { kunci: string; nama: string; nilai: number }[], maks: number) {
  return function Lapisan({ offset }: { offset?: Bidang }) {
    if (!offset?.width || !offset.height || maks <= 0) return null;
    const { top, left, width, height } = offset;
    const xGaris = left + width;
    const xTeks = xGaris + 8;

    const urut = [...daftar].sort((a, b) => b.nilai - a.nilai);
    const asli = urut.map((a) => top + height * (1 - Math.min(a.nilai, maks) / maks));

    // Dari atas ke bawah: yang terlalu rapat didorong turun. Bila barisan
    // terakhirnya terdorong melewati dasar, seluruhnya digeser naik.
    const y = asli.map((v) => v);
    for (let i = 1; i < y.length; i += 1) y[i] = Math.max(y[i], y[i - 1] + JARAK_NAMA);
    const lewat = y[y.length - 1] - (top + height);
    if (lewat > 0) for (let i = 0; i < y.length; i += 1) y[i] -= lewat;

    return (
      <g>
        {urut.map((a, i) => (
          <g key={a.kunci}>
            {Math.abs(y[i] - asli[i]) > 1 && (
              <line
                x1={xGaris} y1={asli[i]} x2={xTeks - 3} y2={y[i]}
                stroke={SERIES.grid} strokeWidth={1}
              />
            )}
            <text x={xTeks} y={y[i]} dominantBaseline="middle" fontSize={11} fill={SERIES.axis}>
              {a.nama}
            </text>
          </g>
        ))}
      </g>
    );
  };
}

/**
 * Batas atas sumbu beserta tanda-tandanya, dibulatkan ke angka yang enak dibaca.
 *
 * Dibiarkan otomatis, Recharts membulatkan terlalu jauh ke atas — sumbu sampai
 * Rp 600 jt untuk data yang berhenti di Rp 485 jt — dan seluruh garis terdesak
 * ke bawah sampai bedanya tidak terbaca. Dipatok persis ke data, tandanya
 * berubah ganjil seperti "Rp 414,9 jt". Jadi dicari langkah bulat terkecil yang
 * tandanya tidak lebih dari sepuluh: untuk angka ratusan juta itu jatuh ke
 * kelipatan Rp 50 jt, cukup rapat untuk membaca kedudukan garis tanpa menebak.
 */
function sumbuRapi(tertinggi: number, maksTanda = 10): { maks: number; ticks: number[] } {
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

export function TrenMasukChart({
  data, hariTerakhir, height = 340,
}: {
  data: TitikTren[];
  /** Tanggal laporan terakhir — ditandai garis tegak. */
  hariTerakhir: number;
  height?: number;
}) {
  const akhir = data[data.length - 1];
  const tertinggi = Math.max(
    akhir?.optimis ?? 0, akhir?.normal ?? 0, akhir?.pesimis ?? 0,
    ...data.map((d) => d.aktual ?? 0),
    1,
  );
  const sumbu = sumbuRapi(tertinggi);
  const nama = ACUAN.map((a) => ({
    kunci: a.kunci,
    nama: a.nama,
    nilai: akhir ? Number(akhir[a.kunci]) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: PIAS_KANAN, left: 8, bottom: 16 }}>
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
        <YAxis
          tickFormatter={formatRupiahShort}
          width={88}
          domain={[0, sumbu.maks]}
          ticks={sumbu.ticks}
          {...AXIS_PROPS}
        />

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
          />
        ))}

        {/* Titik kecil pada tanggal laporan terakhir: di sinilah tiap skenario
            seharusnya berada hari ini. Tanpa ini, perbandingannya harus ditaksir
            sendiri dari jarak garis. */}
        {ACUAN.map((a) => {
          const pada = data.find((d) => d.hari === hariTerakhir);
          const y = pada ? Number(pada[a.kunci]) : null;
          return y === null ? null : (
            <ReferenceDot
              key={`titik-${a.kunci}`}
              x={hariTerakhir}
              y={y}
              r={3}
              fill={SERIES.axis}
              stroke="#fff"
              strokeWidth={1.5}
              isFront
            />
          );
        })}

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

        {/* Ditulis terakhir supaya berada di atas garis-garisnya. */}
        <Customized component={PenulisNama(nama, sumbu.maks)} />
      </LineChart>
    </ResponsiveContainer>
  );
}
