import Link from 'next/link';
import { formatDate, formatRupiah } from '@/lib/format';
import {
  LABEL_SUMBER, keluarItem, type ItemBelanja, type RekapBelanja, type SumberBelanja,
} from '@/lib/belanja-bulan';
import { CommitmentRow } from './rencana-kas-form';
import { Badge, Card, SectionTitle } from './ui';

const NADA_SUMBER: Record<SumberBelanja, string> = {
  RAB: 'brand',
  PROYEK: 'blue',
  KOMITMEN: 'amber',
  KEWAJIBAN: 'slate',
  CICILAN: 'slate',
};

const LABEL_STATUS = { BELUM: 'Belum dibayar', SEBAGIAN: 'Sebagian', SELESAI: 'Selesai' } as const;
const NADA_STATUS = { BELUM: 'amber', SEBAGIAN: 'blue', SELESAI: 'green' } as const;

/**
 * Seluruh uang yang harus keluar bulan ini, dari sumbernya masing-masing.
 * Realisasinya dicatat di tempat asalnya — menu RAB, menu Proyek, atau tanda
 * dibayar komitmen di sini — bukan diketik ulang di Rencana Kas.
 */
export function BelanjaBulanPanel({
  items, rekap, rabDraf, cabangTanpaRab, tanggalPosisi,
}: {
  items: ItemBelanja[];
  rekap: RekapBelanja;
  rabDraf: { id: string; nama: string; total: number }[];
  cabangTanpaRab: string[];
  tanggalPosisi: Date | null;
}) {
  const perSumber = (Object.keys(LABEL_SUMBER) as SumberBelanja[])
    .map((s) => ({ s, keluar: items.filter((i) => i.sumber === s).reduce((t, i) => t + keluarItem(i), 0) }))
    .filter((x) => items.some((i) => i.sumber === x.s));

  return (
    <Card className="card-pad min-w-0" id="belanja-bulan">
      <SectionTitle hint="Diambil langsung dari RAB yang sudah disahkan, item proyek Approved, komitmen, kewajiban terjadwal, dan cicilan rencana belanja. Yang belum selesai dihitung sisanya; yang sudah selesai hanya realisasinya. Pembayaran sebelum atau pada tanggal posisi kas sudah ada di saldo, jadi tidak dihitung lagi. Realisasi dicatat di menu asalnya.">
        Belanja bulan ini
      </SectionTitle>

      {perSumber.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {perSumber.map(({ s, keluar }) => (
            <span key={s} className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
              {LABEL_SUMBER[s]} <strong className="tabular-nums text-slate-900">{formatRupiah(keluar)}</strong>
            </span>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">
          Belum ada yang harus dibayar bulan ini. Sahkan RAB bulan ini di menu RAB, atau tambahkan komitmen
          lewat panel di samping.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Tanggal</th>
                <th className="th">Item</th>
                <th className="th num">Rencana</th>
                <th className="th num">Dibayar</th>
                <th className="th num">Akan keluar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => {
                const keluar = keluarItem(i);
                const hemat = i.status === 'SELESAI' && i.sumber !== 'KOMITMEN' ? i.anggaran - i.dibayar : null;
                return (
                  <tr key={i.kunci} className={i.diSaldo ? 'text-slate-400' : ''}>
                    <td className="td whitespace-nowrap">
                      {i.tanggal ? formatDate(i.tanggal) : <span className="text-xs text-slate-400">belum ditentukan</span>}
                      {i.terlambat && (
                        <span className="mt-0.5 block whitespace-normal text-[11px] font-medium leading-tight text-amber-700">lewat, belum dicatat</span>
                      )}
                    </td>
                    <td className="td min-w-[180px]">
                      <span className={i.diSaldo ? '' : 'text-slate-900'}>{i.label}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <Badge tone={NADA_SUMBER[i.sumber]}>{LABEL_SUMBER[i.sumber]}</Badge>
                        <Badge tone={NADA_STATUS[i.status]}>{LABEL_STATUS[i.status]}</Badge>
                        {i.href ? (
                          <Link href={i.href} className="hover:text-brand-700 hover:underline">{i.asal}</Link>
                        ) : (
                          i.asal
                        )}
                        {/* Realisasi dicatat di tempat asalnya; komitmen ditandai di sini. */}
                        {i.komitmenId ? (
                          <CommitmentRow id={i.komitmenId} paid={i.status === 'SELESAI'} />
                        ) : i.href && (i.sumber === 'RAB' || i.sumber === 'PROYEK') ? (
                          <Link href={i.href} className="font-medium text-brand-700 hover:underline">Catat realisasi →</Link>
                        ) : null}
                      </span>
                    </td>
                    <td className="td num whitespace-nowrap">{formatRupiah(i.anggaran)}</td>
                    <td className="td num whitespace-nowrap">
                      {i.dibayar > 0 ? formatRupiah(i.dibayar) : <span className="text-slate-400">—</span>}
                      {hemat !== null && hemat !== 0 && (
                        <span className={`mt-0.5 block text-[11px] ${hemat > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {hemat > 0 ? 'hemat' : 'lebih'} {formatRupiah(Math.abs(hemat))}
                        </span>
                      )}
                    </td>
                    <td className="td num whitespace-nowrap font-medium">
                      {keluar > 0 ? formatRupiah(keluar) : <span className="font-normal text-slate-400">—</span>}
                      {i.sesudahPosisi > 0 && (
                        <span className="mt-0.5 block whitespace-normal text-[11px] font-normal leading-tight text-slate-500">
                          {formatRupiah(i.sesudahPosisi)} belum di saldo
                        </span>
                      )}
                      {i.diSaldo && keluar === 0 && i.dibayar > 0 && (
                        <span className="mt-0.5 block text-[11px] font-normal">sudah di saldo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold">
              <tr>
                <td className="td" colSpan={2}>Total</td>
                <td className="td num whitespace-nowrap">{formatRupiah(rekap.anggaran)}</td>
                <td className="td num whitespace-nowrap">{formatRupiah(rekap.dibayar)}</td>
                <td className="td num whitespace-nowrap">{formatRupiah(rekap.keluar)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        <strong>Akan keluar</strong> = sisa yang belum dibayar, ditambah yang sudah dibayar sesudah posisi kas
        {tanggalPosisi ? ` ${formatDate(tanggalPosisi)}` : ''} karena belum tercermin di saldo. Jumlahnya
        dikurangkan dari boleh belanja, dari saldo bulan ini di &ldquo;Kapan kas habis&rdquo;, dan dari kemampuan
        beli di rencana belanja. Hemat hanya informasi dan tidak ikut dihitung.
      </p>

      {(rabDraf.length > 0 || cabangTanpaRab.length > 0) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {rabDraf.length > 0 && (
            <p>
              RAB yang masih draf <strong>belum dihitung</strong>:{' '}
              {rabDraf.map((r, n) => (
                <span key={r.id}>
                  {n > 0 && ', '}
                  <Link href={`/rab/${r.id}`} className="underline">{r.nama}</Link> ({formatRupiah(r.total)})
                </span>
              ))}
              . Sahkan di menu RAB supaya ikut dihitung.
            </p>
          )}
          {cabangTanpaRab.length > 0 && (
            <p className={rabDraf.length > 0 ? 'mt-2' : ''}>
              Belum ada RAB yang disahkan bulan ini untuk <strong>{cabangTanpaRab.join(', ')}</strong> — belanja
              cabang itu belum terhitung sama sekali.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
