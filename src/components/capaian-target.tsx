import { NAMA_SKENARIO, SKENARIO } from '@/lib/rencana-kas';
import { formatPercent, formatRupiah, formatRupiahShort } from '@/lib/format';
import type { Tren } from '@/lib/tren-masuk';

/**
 * Capaian terhadap target sebulan, satu batang per skenario.
 *
 * Grafik garis menjawab "lajunya bagaimana", tetapi tidak menjawab "masih
 * kurang berapa" — dan itu dua pertanyaan yang berbeda. Di pertengahan bulan,
 * uang masuk yang berlari di atas target pun tetap terlihat jauh di bawah
 * angka sebulan penuh, dan keduanya benar sekaligus.
 *
 * Maka tiap batang membawa dua tanda: isinya bagian target yang sudah masuk,
 * dan garis tegak kecil menandai bagian bulan yang sudah berlalu. Isi yang
 * melewati garis itu berarti berjalan lebih cepat daripada targetnya. Satu
 * bentuk, dua pertanyaan terjawab, tanpa perlu membandingkan dua angka persen
 * di kepala sendiri.
 */
export function CapaianTarget({ tren }: { tren: Tren }) {
  const porsi = Math.min(1, tren.porsiHari);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Capaian terhadap target sebulan</p>
        <p className="text-xs text-slate-500">
          Bulan baru berjalan <strong className="text-slate-700">{formatPercent(porsi * 100, 0)}</strong>
          {' '}&mdash; ditandai garis tegak pada tiap batang
        </p>
      </div>

      <div className="space-y-2.5">
        {SKENARIO.map((s) => {
          const c = tren.capaian[s];
          const isi = Math.min(1, Math.max(0, c.persen));
          const lebihCepat = c.persen >= porsi;

          return (
            <div key={s}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium text-slate-700">
                  {NAMA_SKENARIO[s]}
                  <span className="ml-2 font-normal text-slate-400">{formatRupiahShort(c.target)}</span>
                </span>
                <span className="tabular-nums text-slate-600">
                  <strong className={lebihCepat ? 'text-emerald-700' : 'text-amber-700'}>
                    {formatPercent(c.persen * 100, 0)}
                  </strong>{' '}
                  tercapai
                  {!c.tercapai && (
                    <>
                      {' · '}kurang <strong>{formatRupiah(c.kurang)}</strong>
                    </>
                  )}
                </span>
              </div>

              <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${lebihCepat ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${isi * 100}%` }}
                />
                {/* Penanda laju: di mana isinya seharusnya berada hari ini. */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-slate-500"
                  style={{ left: `calc(${porsi * 100}% - 1px)` }}
                  aria-hidden="true"
                />
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {c.tercapai ? (
                  <>Target sudah terlampaui.</>
                ) : tren.sisaHari > 0 ? (
                  <>
                    Perlu <strong>{formatRupiah(c.perHariSisa)}</strong> per hari selama{' '}
                    {tren.sisaHari} hari tersisa.
                  </>
                ) : (
                  <>Bulan sudah berakhir.</>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
