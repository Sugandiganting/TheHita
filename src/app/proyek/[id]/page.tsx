import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
import { PROJECT_STATUS_LABEL } from '@/lib/accounting';
import { monthlyInstallment } from '@/lib/forecast';
import { deleteCostItem, deleteProject, toggleCostItemPaid } from '@/app/actions';
import { ProjectForm } from '@/components/project-form';
import { CostItemForm } from '@/components/cost-item-form';
import { Alert, Badge, Card, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ProyekDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [project, units, capexAccounts] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        unit: { select: { code: true, name: true } },
        items: { orderBy: { plannedDate: 'asc' }, include: { account: { select: { code: true, name: true } } } },
      },
    }),
    prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    prisma.account.findMany({
      where: { active: true, isHeader: false, OR: [{ subtype: 'FIXED_ASSET' }, { type: 'EXPENSE' }] },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
  ]);

  if (!project) notFound();

  const total = project.items.reduce((s, i) => s + i.amount, 0);
  const paid = project.items.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0);
  const outstanding = total - paid;
  const installment =
    project.fundingType === 'LOAN'
      ? monthlyInstallment(project.fundingAmount, project.loanRatePct, project.loanTenorMonths)
      : 0;

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.unit.code} — ${project.unit.name} · Mulai ${formatDate(project.startDate)}`}
        action={
          <div className="flex gap-2">
            <Link href="/peramalan" className="btn-secondary">
              Lihat dampak di peramalan
            </Link>
            <form action={deleteProject}>
              <input type="hidden" name="id" value={project.id} />
              <button type="submit" className="btn-danger">
                Hapus proyek
              </button>
            </form>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total biaya proyek" value={formatRupiah(total)} hint={`${project.items.length} item`} />
        <StatCard label="Sudah dibayar" value={formatRupiah(paid)} tone="positive" />
        <StatCard
          label="Belum dibayar"
          value={formatRupiah(outstanding)}
          hint="Inilah yang dihitung di peramalan"
          tone={outstanding > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Pendanaan"
          value={project.fundingAmount > 0 ? formatRupiah(project.fundingAmount) : 'Dana sendiri'}
          hint={installment > 0 ? `Cicilan ${formatRupiah(installment)}/bulan` : undefined}
        />
      </div>

      {outstanding > project.fundingAmount && project.fundingAmount > 0 && (
        <div className="mb-6">
          <Alert tone="warning" title="Dana pinjaman tidak menutup seluruh biaya">
            Sisa {formatRupiah(outstanding - project.fundingAmount)} akan diambil dari kas operasional.
            Periksa menu Peramalan untuk memastikan kas mencukupi.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card className="card-pad">
            <SectionTitle hint="Jadwal ini yang disuntikkan ke proyeksi arus kas bulan demi bulan.">
              Rincian biaya &amp; jadwal pembayaran
            </SectionTitle>

            {project.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Belum ada item biaya. Tambahkan lewat formulir di samping.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Item</th>
                      <th className="th">Akun</th>
                      <th className="th">Jadwal bayar</th>
                      <th className="th num">Nominal</th>
                      <th className="th">Status</th>
                      <th className="th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {project.items.map((item) => (
                      <tr key={item.id} className={item.paid ? 'text-slate-400' : ''}>
                        <td className="td font-medium">{item.name}</td>
                        <td className="td text-xs">
                          {item.account ? `${item.account.code} ${item.account.name}` : '—'}
                        </td>
                        <td className="td whitespace-nowrap">{formatDate(item.plannedDate)}</td>
                        <td className="td num">{formatRupiah(item.amount)}</td>
                        <td className="td">
                          <form action={toggleCostItemPaid}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit">
                              <Badge tone={item.paid ? 'green' : 'amber'}>
                                {item.paid ? 'Lunas' : 'Belum bayar'}
                              </Badge>
                            </button>
                          </form>
                        </td>
                        <td className="td">
                          <form action={deleteCostItem}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                              Hapus
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="td" colSpan={3}>
                        Total
                      </td>
                      <td className="td num">{formatRupiah(total)}</td>
                      <td className="td" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <SectionTitle hint="Perubahan tersimpan langsung dan ikut memperbarui peramalan.">
              Ubah data proyek
            </SectionTitle>
            <ProjectForm
              units={units}
              values={{
                id: project.id,
                name: project.name,
                unitId: project.unitId,
                status: project.status,
                startDate: toDateInput(project.startDate),
                endDate: project.endDate ? toDateInput(project.endDate) : '',
                description: project.description ?? '',
                fundingType: project.fundingType,
                fundingAmount: project.fundingAmount,
                fundingDate: project.fundingDate ? toDateInput(project.fundingDate) : '',
                loanRatePct: project.loanRatePct,
                loanTenorMonths: project.loanTenorMonths,
                upliftRevenueMonthly: project.upliftRevenueMonthly,
                upliftExpenseMonthly: project.upliftExpenseMonthly,
                upliftStartDate: project.upliftStartDate ? toDateInput(project.upliftStartDate) : '',
              }}
            />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="card-pad">
            <SectionTitle>Tambah item biaya</SectionTitle>
            <CostItemForm projectId={project.id} accounts={capexAccounts} />
          </Card>

          <Card className="card-pad mt-6">
            <SectionTitle>Ringkasan</SectionTitle>
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={PROJECT_STATUS_LABEL[project.status] ?? project.status} />
              <Row label="Target selesai" value={project.endDate ? formatDate(project.endDate) : '—'} />
              <Row
                label="Tambahan pendapatan"
                value={
                  project.upliftRevenueMonthly > 0
                    ? `${formatRupiah(project.upliftRevenueMonthly)}/bulan`
                    : '—'
                }
              />
              <Row
                label="Tambahan biaya"
                value={
                  project.upliftExpenseMonthly > 0
                    ? `${formatRupiah(project.upliftExpenseMonthly)}/bulan`
                    : '—'
                }
              />
              <Row
                label="Mulai beroperasi"
                value={project.upliftStartDate ? formatDate(project.upliftStartDate) : '—'}
              />
            </dl>

            {project.upliftRevenueMonthly > 0 && outstanding > 0 && (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Dengan tambahan laba{' '}
                {formatRupiah(project.upliftRevenueMonthly - project.upliftExpenseMonthly)}/bulan, biaya proyek
                sebesar {formatRupiah(total)} diperkirakan kembali dalam{' '}
                <strong>
                  {Math.ceil(total / Math.max(1, project.upliftRevenueMonthly - project.upliftExpenseMonthly))} bulan
                </strong>{' '}
                setelah beroperasi.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
