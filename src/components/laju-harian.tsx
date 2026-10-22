import { formatPercent, formatPeriodShort, formatRupiah } from '@/lib/format';
import type { LajuHarian } from '@/lib/laju-harian';

/**
 * Tiga laju harian bersebelahan: yang sedang berjalan, yang biasanya, dan yang
 * dibutuhkan.
 *
 * "Rp 15 juta per hari" sendirian tidak berarti apa-apa — bagus atau tidak
 * hanya ketahuan dari pembandingnya. Maka yang kiri laju bulan ini, yang
 * tengah laju beberapa bulan terakhir menurut jurnal, dan yang kanan berapa
 * yang masih harus masuk tiap hari supaya target normal kekejar. Ketiganya
 * satuan yang sama, jadi bisa dibandingkan langsung tanpa menghitung apa pun.
 */
function Kotak({
  judul, rincian, nilai, catatan, nada,
}: {
  judul: string;
  rincian: string;
  nilai: string;
  catatan?: string;
  nada?: 'baik' | 'awas';
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{judul}</p>
      <p className="text-[11px] text-slate-400">{rincian}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{nilai}</p>
      {catatan && (
        <p
          className={`text-xs ${
            nada === 'baik' ? 'text-emerald-700' : nada === 'awas' ? 'text-amber-700' : 'text-slate-500'
          }`}
        >
          {catatan}
        </p>
      )}
    </div>
  );
}

export function LajuHarianBlok({
  laju, perluPerHari, sisaHari, tercapai,
}: {
  laju: LajuHarian;
  /** Yang masih harus masuk tiap hari agar target normal tercapai. */
  perluPerHari: number;
  sisaHari: number;
  /** Target normal sudah terlampaui. */
  tercapai: boolean;
}) {
  const beda = laju.selisihPersen;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Rata-rata uang masuk per hari</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kotak
          judul="Bulan ini"
          rincian={`${laju.hariBulanIni} hari sudah dilaporkan`}
          nilai={formatRupiah(laju.bulanIni)}
          catatan={
            beda === null
              ? undefined
              : `${beda >= 0 ? '+' : ''}${formatPercent(beda, 0)} dibanding biasanya`
          }
          nada={beda === null ? undefined : beda >= 0 ? 'baik' : 'awas'}
        />

        <Kotak
          judul="Biasanya"
          rincian={
            laju.riwayat === null
              ? 'belum ada riwayat di jurnal'
              : `jurnal ${laju.bulanRiwayat} bulan · ${formatPeriodShort(laju.dari!)}`
                + (laju.dari === laju.sampai ? '' : `–${formatPeriodShort(laju.sampai!)}`)
          }
          nilai={laju.riwayat === null ? '—' : formatRupiah(laju.riwayat)}
        />

        <Kotak
          judul="Perlu sampai akhir bulan"
          rincian={sisaHari > 0 ? `${sisaHari} hari tersisa · target normal` : 'bulan sudah berakhir'}
          nilai={tercapai || sisaHari === 0 ? '—' : formatRupiah(perluPerHari)}
          catatan={tercapai ? 'Target normal sudah terlampaui.' : undefined}
          nada={tercapai ? 'baik' : undefined}
        />
      </div>
    </div>
  );
}
