import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatDate, formatRupiah } from '@/lib/format';
import {
  LABEL_KELOMPOK_PROYEK, LABEL_STATUS_PROYEK, itemBerlaku, kelompokProyek, realisasiDibuka, rekapHematProyek,
  rekapRealisasiItem, statusEfektif, type KelompokProyek, type StatusProyek,
} from '@/lib/proyek';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import type { SearchParams } from '@/lib/search-params';
import { hakSaya } from '@/lib/hak-akses-server';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<StatusProyek, string> = {
  DRAFT: 'slate',
  PROPOSED: 'blue',
  FUNDING_REVIEW: 'amber',
  APPROVED: 'brand',
  ONGOING: 'amber',
  ON_HOLD: 'red',
  DONE: 'green',
  REJECTED: 'red',
  CANCELLED: 'red',
};

const KELOMPOK: KelompokProyek[] = ['PENGAJUAN', 'BERJALAN', 'SELESAI', 'MANGKRAK', 'BATAL'];

export default async function ProyekPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const bolehKelola = (await hakSaya()).has('proyek.kelola');
  const mentah = Array.isArray(params.kelompok) ? params.kelompok[0] : params.kelompok;
  const dipilih = KELOMPOK.find((k) => k === mentah) ?? null;
  const semua = await prisma.project.findMany({
    include: {
      items: { include: { pembayaran: { select: { amount: true } }, addendum: { select: { status: true } } } },
      unit: { select: { code: true, name: true } },
      tambahan: { select: { number: true, status: true } },
    },
    orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
  });
  const hariIni = new Date();
  const kelompokDari = (p: (typeof semua)[number]) => kelompokProyek(statusEfektif(p.status, p.startDate, hariIni));
  const jumlah = (k: KelompokProyek) => semua.filter((p) => kelompokDari(p) === k).length;
  const projects = dipilih ? semua.filter((p) => kelompokDari(p) === dipilih) : semua;

  return (
    <>
      <PageHeader
        title="Proyek & belanja modal"
        description="Rencanakan proyek besar seperti penambahan kamar, lalu lihat dampaknya terhadap kas di menu Peramalan."
        action={bolehKelola ? (
          <Link href="/proyek/baru" className="btn-primary">
            Proyek baru
          </Link>
        ) : undefined}
      />

      {semua.length > 0 && (
        <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Saring proyek">
          <Link
            href="/proyek"
            className={`rounded-full border px-3 py-1 ${dipilih === null ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            Semua <span className="tabular-nums opacity-75">{semua.length}</span>
          </Link>
          {KELOMPOK.map((k) => (
            <Link
              key={k}
              href={`/proyek?kelompok=${k}`}
              className={`rounded-full border px-3 py-1 ${dipilih === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
              {LABEL_KELOMPOK_PROYEK[k]} <span className="tabular-nums opacity-75">{jumlah(k)}</span>
            </Link>
          ))}
        </nav>
      )}

      {semua.length > 0 && projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Tidak ada proyek {dipilih ? LABEL_KELOMPOK_PROYEK[dipilih].toLowerCase() : ''}.
        </p>
      ) : projects.length === 0 ? (
        <EmptyState
          title="Belum ada proyek"
          description="Buat rencana proyek beserta jadwal pembayarannya. Peramalan akan menyuntikkan jadwal tersebut ke proyeksi arus kas, sehingga terlihat kapan kas menipis."
          actionHref="/proyek/baru"
          actionLabel="Buat proyek pertama"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            // Hanya item yang berlaku: rencana awal dan tambahan yang sudah Approved.
            const items = p.items.filter(itemBerlaku);
            const total = items.reduce((s, i) => s + i.amount, 0);
            // Yang sungguh sudah dibayar, termasuk pembayaran sebagian.
            const paid = items.reduce((s, i) => s + rekapRealisasiItem(i, i.pembayaran).realisasi, 0);
            const progress = total > 0 ? (paid / total) * 100 : 0;
            const status = statusEfektif(p.status, p.startDate, hariIni);
            // Realisasi baru ditampilkan setelah proyek Approved.
            const dibuka = realisasiDibuka(status);
            const hemat = rekapHematProyek(items);
            const ditinjau = p.tambahan.filter((t) => t.status === 'PROPOSED' || t.status === 'FUNDING_REVIEW');

            return (
              <Card key={p.id} className="card-pad">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/proyek/${p.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {p.name}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge tone="brand">{p.unit.code}</Badge>
                      <Badge tone={STATUS_TONE[status]}>
                        {LABEL_STATUS_PROYEK[status]}
                      </Badge>
                      <span>Mulai {formatDate(p.startDate)}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatRupiah(total)}
                  </p>
                </div>

                {p.description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{p.description}</p>}

                {!dibuka ? (
                  <p className="mt-4 text-xs text-slate-500">
                    {items.length} item · realisasi dibuka setelah Approved
                  </p>
                ) : (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Terbayar {formatRupiah(paid)} dari {items.length} item
                    </span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>
                  {/* Kinerja penghematan: informasi saja, tidak memengaruhi kas maupun plafon. */}
                  <p className="mt-2 text-xs text-slate-500">
                    {hemat.itemSelesai === 0 ? (
                      'Hemat dihitung setelah ada item selesai'
                    ) : (
                      <>
                        {hemat.bersih >= 0 ? (
                          <span className="font-medium text-emerald-700">Hemat {formatRupiah(hemat.bersih)}</span>
                        ) : (
                          <span className="font-medium text-red-600">Lebih {formatRupiah(-hemat.bersih)}</span>
                        )}
                        {hemat.hemat > 0 && hemat.lebih > 0 && (
                          <> (hemat {formatRupiah(hemat.hemat)} − lebih {formatRupiah(hemat.lebih)})</>
                        )}
                        {' '}· {hemat.itemSelesai} dari {hemat.itemTotal} item selesai
                      </>
                    )}
                  </p>
                </div>
                )}

                {ditinjau.length > 0 && (
                  <p className="mt-3 text-xs font-medium text-amber-700">
                    {ditinjau.map((t) => `Tambahan #${t.number}`).join(', ')} menunggu persetujuan
                  </p>
                )}

                {p.fundingAmount > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Pendanaan {p.fundingType === 'LOAN' ? 'pinjaman' : 'setoran modal'}{' '}
                    {formatRupiah(p.fundingAmount)}
                    {p.fundingDate ? ` cair ${formatDate(p.fundingDate)}` : ''}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
