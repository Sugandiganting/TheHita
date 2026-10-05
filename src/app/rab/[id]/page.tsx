import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getBudgetDetail } from '@/lib/queries';
import { formatPeriod, formatPercent, formatRupiah } from '@/lib/format';
import { BudgetLineForm } from '@/components/budget-form';
import { BudgetActions, BudgetLineDelete } from '@/components/budget-actions';
import { Alert, Badge, Card, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rab, accounts, lines] = await Promise.all([
    getBudgetDetail(id),
    prisma.account.findMany({
      where: { isHeader: false, active: true, type: { in: ['EXPENSE', 'COGS'] } },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.budgetLine.findMany({ where: { budgetId: id }, select: { id: true, accountId: true } }),
  ]);

  if (!rab) notFound();

  const disahkan = rab.status === 'ACTIVE';
  const lineIdByAccount = new Map(lines.map((l) => [l.accountId, l.id]));
  const r = rab.ringkasan;

  return (
    <>
      <PageHeader
        title={`RAB ${rab.scope} — ${formatPeriod(rab.period)}`}
        description={
          rab.bersama
            ? `Biaya yang ditanggung ${rab.cabang.join(' dan ')} bersama-sama. Tidak masuk RAB cabang mana pun.`
            : `Biaya yang dikendalikan ${rab.scope} sendiri. Porsi beban bersama punya RAB tersendiri.`
        }
      />

      <p className="mb-4 text-sm">
        <Link href="/rab" className="text-slate-600 hover:underline">← Kembali ke daftar RAB</Link>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dianggarkan" value={formatRupiah(r.totalAnggaran)} />
        <StatCard label="Realisasi" value={formatRupiah(r.totalRealisasi)} />
        <StatCard
          label="Sisa"
          value={formatRupiah(r.totalSisa)}
          tone={r.totalSisa < 0 ? 'negative' : 'positive'}
          hint={r.totalSisa < 0 ? 'Sudah lewat anggaran' : undefined}
        />
        <StatCard
          label="Terpakai"
          value={r.terpakaiPct === null ? '—' : formatPercent(r.terpakaiPct)}
          hint={disahkan ? 'RAB sudah disahkan' : 'Masih draf, belum disahkan'}
        />
      </div>

      {(r.jumlahLewat > 0 || r.jumlahTakDianggarkan > 0) && (
        <div className="mt-4 space-y-2">
          {r.jumlahLewat > 0 && (
            <Alert tone="warning">
              {r.jumlahLewat} akun sudah melewati anggarannya.
            </Alert>
          )}
          {r.jumlahTakDianggarkan > 0 && (
            <Alert tone="warning">
              {r.jumlahTakDianggarkan} akun terpakai tanpa pernah dianggarkan. Tetap ditampilkan di bawah
              supaya total realisasinya sama dengan beban yang benar-benar terjadi.
            </Alert>
          )}
        </div>
      )}

      <Card className="card-pad mt-6">
        <BudgetActions id={rab.id} status={rab.status} lineCount={r.baris.filter((b) => b.anggaran > 0).length} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="card-pad min-w-0">
            <SectionTitle hint="Realisasi diambil dari jurnal bulan ini, mengikuti aturan penanggung yang sama dengan laporan laba rugi.">
              Rincian anggaran
            </SectionTitle>

            {r.baris.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Belum ada baris. Isi lewat formulir <strong>Tambah anggaran</strong>: pilih akun
                beban, isi nominalnya, lalu simpan. Ulangi untuk tiap akun yang dianggarkan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Akun</th>
                      <th className="th num">Dianggarkan</th>
                      <th className="th num">Realisasi</th>
                      <th className="th num">Sisa</th>
                      <th className="th num">Terpakai</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.baris.map((b) => (
                      <tr key={b.accountId} className={b.takDianggarkan ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                        <td className="td">
                          <span className="mr-2 font-mono text-xs text-slate-500">{b.accountCode}</span>
                          {b.accountName}
                          {b.takDianggarkan && (
                            <span className="mt-0.5 block text-xs text-amber-700">tidak dianggarkan</span>
                          )}
                        </td>
                        <td className="td num">{b.anggaran > 0 ? formatRupiah(b.anggaran) : '—'}</td>
                        <td className="td num">{formatRupiah(b.realisasi)}</td>
                        <td className={`td num ${b.sisa < 0 ? 'font-medium text-red-600' : ''}`}>
                          {formatRupiah(b.sisa)}
                        </td>
                        <td className="td num">{b.terpakaiPct === null ? '—' : formatPercent(b.terpakaiPct)}</td>
                        <td className="td num">
                          {lineIdByAccount.has(b.accountId) ? (
                            <BudgetLineDelete id={lineIdByAccount.get(b.accountId)!} disabled={disahkan} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="td">Total</td>
                      <td className="td num">{formatRupiah(r.totalAnggaran)}</td>
                      <td className="td num">{formatRupiah(r.totalRealisasi)}</td>
                      <td className={`td num ${r.totalSisa < 0 ? 'text-red-600' : ''}`}>
                        {formatRupiah(r.totalSisa)}
                      </td>
                      <td className="td num">{r.terpakaiPct === null ? '—' : formatPercent(r.terpakaiPct)}</td>
                      <td className="td num">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="card-pad sticky top-6 max-h-[calc(100vh-6rem)] self-start overflow-y-auto">
          <SectionTitle>Tambah anggaran</SectionTitle>
          <BudgetLineForm budgetId={rab.id} accounts={accounts} disabled={disahkan} />
        </Card>
      </div>
    </>
  );
}
