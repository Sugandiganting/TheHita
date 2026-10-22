import { NAMA_SKENARIO, SKENARIO } from '@/lib/rencana-kas';
import { formatPercent, formatRupiah, formatRupiahShort } from '@/lib/format';
import type { Tren } from '@/lib/tren-masuk';

/**
 * Rincian capaian tiap skenario, dalam angka.
 *
 * Dulu tiap barisnya punya batang sendiri. Begitu grafik di atasnya berubah
 * jadi batang target lawan kenyataan, dua gambar itu menjawab pertanyaan yang
 * sama dengan bentuk berbeda dan bertumpuk — yang di bawah hanya mengulang
 * yang di atas. Jadi yang tersisa di sini angkanya saja, termasuk satu yang
 * tidak bisa dibaca dari grafik mana pun: berapa yang harus masuk tiap hari
 * supaya targetnya kekejar.
 */
export function CapaianTarget({ tren }: { tren: Tren }) {
  const porsi = Math.min(1, tren.porsiHari);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Capaian terhadap target sebulan</p>
        <p className="text-xs text-slate-500">
          Bulan baru berjalan <strong className="text-slate-700">{formatPercent(porsi * 100, 0)}</strong>
        </p>
      </div>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {SKENARIO.map((s) => {
          const c = tren.capaian[s];
          const lebihCepat = c.persen >= porsi;

          return (
            <div key={s} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm">
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

              <span className="ml-auto text-xs text-slate-500">
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
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
