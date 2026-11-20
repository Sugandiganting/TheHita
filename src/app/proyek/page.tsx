import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatDate, formatRupiah } from '@/lib/format';
import { LABEL_STATUS_PROYEK, realisasiDibuka, rekapRealisasiItem, statusEfektif, type StatusProyek } from '@/lib/proyek';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<StatusProyek, string> = {
  DRAFT: 'slate',
  PROPOSED: 'blue',
  FUNDING_REVIEW: 'amber',
  APPROVED: 'brand',
  ONGOING: 'amber',
  DONE: 'green',
  REJECTED: 'red',
  CANCELLED: 'red',
};

export default async function ProyekPage() {
  const projects = await prisma.project.findMany({
    include: { items: { include: { pembayaran: { select: { amount: true } } } }, unit: { select: { code: true, name: true } } },
    orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
  });

  return (
    <>
      <PageHeader
        title="Proyek & belanja modal"
        description="Rencanakan proyek besar seperti penambahan kamar, lalu lihat dampaknya terhadap kas di menu Peramalan."
        action={
          <Link href="/proyek/baru" className="btn-primary">
            Proyek baru
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Belum ada proyek"
          description="Buat rencana proyek beserta jadwal pembayarannya. Peramalan akan menyuntikkan jadwal tersebut ke proyeksi arus kas, sehingga terlihat kapan kas menipis."
          actionHref="/proyek/baru"
          actionLabel="Buat proyek pertama"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const total = p.items.reduce((s, i) => s + i.amount, 0);
            // Yang sungguh sudah dibayar, termasuk pembayaran sebagian.
            const paid = p.items.reduce((s, i) => s + rekapRealisasiItem(i, i.pembayaran).realisasi, 0);
            const progress = total > 0 ? (paid / total) * 100 : 0;
            const status = statusEfektif(p.status, p.startDate, new Date());
            // Realisasi baru ditampilkan setelah proyek Approved.
            const dibuka = realisasiDibuka(status);

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
                    {p.items.length} item · realisasi dibuka setelah Approved
                  </p>
                ) : (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Terbayar {formatRupiah(paid)} dari {p.items.length} item
                    </span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>
                </div>
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
