import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { getCashBalance, getHistoryWindow, getMonthlyActuals, getProfitLoss, getUnitPerformance } from '@/lib/queries';
import { buildForecast, toProjectPlan } from '@/lib/forecast';
import { addMonths, currentPeriod } from '@/lib/period';
import { formatPeriod, formatRupiah, formatPercent } from '@/lib/format';
import { UNIT_TYPE_LABEL } from '@/lib/accounting';
import { resolveRange, resolveUnit, type SearchParams } from '@/lib/search-params';
import { ReportFilters } from '@/components/filters';
import { CashflowBarChart, UnitProfitChart } from '@/components/charts';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { from, to } = resolveRange(params, 12);
  const unitIds = resolveUnit(params);

  const [units, pl, cash, actuals, unitPerf, entryCount] = await Promise.all([
    prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    getProfitLoss(from, to, unitIds),
    getCashBalance(to, unitIds),
    getMonthlyActuals(from, to, unitIds),
    getUnitPerformance(from, to),
    prisma.journalEntry.count(),
  ]);

  if (entryCount === 0) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Ringkasan keuangan seluruh cabang dan unit usaha."
        />
        <EmptyState
          title="Belum ada transaksi"
          description="Mulai dengan mencatat pemasukan atau pengeluaran pertama. Setelah beberapa bulan data terkumpul, menu Peramalan akan bisa memproyeksikan arus kas."
          actionHref="/transaksi"
          actionLabel="Catat transaksi pertama"
        />
      </>
    );
  }

  const thisMonth = currentPeriod();
  const lastMonth = addMonths(thisMonth, -1);
  const [current, previous] = await Promise.all([
    getProfitLoss(thisMonth, thisMonth, unitIds),
    getProfitLoss(lastMonth, lastMonth, unitIds),
  ]);

  const revenueDelta =
    previous.totalRevenue > 0 ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0;

  const chartData = actuals.map((a) => ({ period: a.period, masuk: a.revenue, keluar: a.expense }));

  const scopeLabel = unitIds
    ? units.find((u) => u.id === unitIds[0])?.name ?? 'Unit terpilih'
    : 'Seluruh grup (konsolidasi)';

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${scopeLabel} — periode ${formatPeriod(from)} s/d ${formatPeriod(to)}.`}
        action={
          <Link href="/transaksi" className="btn-primary">
            Catat transaksi
          </Link>
        }
      />

      <Suspense>
        <ReportFilters units={units} />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo kas & bank"
          value={formatRupiah(cash)}
          hint={`Posisi akhir ${formatPeriod(to)}`}
          tone={cash < 0 ? 'negative' : 'neutral'}
        />
        <StatCard
          label="Pendapatan periode"
          value={formatRupiah(pl.totalRevenue)}
          hint={`${actuals.length} bulan`}
        />
        <StatCard
          label="Beban + HPP periode"
          value={formatRupiah(pl.totalCogs + pl.totalExpense)}
          hint={`HPP ${formatRupiah(pl.totalCogs)}`}
        />
        <StatCard
          label="Laba bersih periode"
          value={formatRupiah(pl.netProfit)}
          hint={`Margin ${formatPercent(pl.netMarginPct)}`}
          tone={pl.netProfit < 0 ? 'negative' : 'positive'}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Pendapatan ${formatPeriod(thisMonth)}`}
          value={formatRupiah(current.totalRevenue)}
          hint={
            current.totalRevenue === 0
              ? 'Belum ada transaksi bulan ini'
              : previous.totalRevenue > 0
                ? `${revenueDelta >= 0 ? '▲' : '▼'} ${formatPercent(Math.abs(revenueDelta))} vs bulan lalu`
                : 'Bulan berjalan'
          }
          tone={current.totalRevenue > 0 && revenueDelta < 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label={`Laba ${formatPeriod(thisMonth)}`}
          value={formatRupiah(current.netProfit)}
          tone={current.netProfit < 0 ? 'negative' : 'positive'}
          hint="Bulan berjalan (belum tentu lengkap)"
        />
        <ForecastTeaser unitIds={unitIds} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="card-pad min-w-0 lg:col-span-3">
          <SectionTitle hint="Angka bulanan dari jurnal yang sudah diinput — inilah dasar perhitungan peramalan.">
            Pemasukan vs pengeluaran
          </SectionTitle>
          <CashflowBarChart data={chartData} />
        </Card>

        <Card className="card-pad min-w-0 lg:col-span-2">
          <SectionTitle hint="Laba bersih tiap cabang pada periode terpilih.">Kinerja antar cabang</SectionTitle>
          <UnitProfitChart data={unitPerf.map((u) => ({ name: u.name, laba: u.profit }))} />
        </Card>
      </div>

      <Card className="card-pad mt-6 min-w-0">
        <SectionTitle hint="Semua unit memakai satu COA yang sama; pemisahan terjadi lewat dimensi unit pada setiap baris jurnal.">
          Rincian per unit usaha
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Unit</th>
                <th className="th">Jenis</th>
                <th className="th num">Pendapatan</th>
                <th className="th num">Beban</th>
                <th className="th num">Laba</th>
                <th className="th num">Margin</th>
                <th className="th num">Saldo kas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unitPerf.map((u) => (
                <tr key={u.unitId} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900">
                    <span className="mr-2 font-mono text-xs text-slate-500">{u.code}</span>
                    {u.name}
                  </td>
                  <td className="td">
                    <Badge tone={u.type === 'HOTEL' ? 'brand' : u.type === 'CAFE' ? 'amber' : 'blue'}>
                      {UNIT_TYPE_LABEL[u.type] ?? u.type}
                    </Badge>
                  </td>
                  <td className="td num">{formatRupiah(u.revenue)}</td>
                  <td className="td num">{formatRupiah(u.expense)}</td>
                  <td className={`td num font-medium ${u.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatRupiah(u.profit)}
                  </td>
                  <td className="td num">{formatPercent(u.marginPct)}</td>
                  <td className="td num">{formatRupiah(u.cash)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold">
              <tr>
                <td className="td" colSpan={2}>
                  Total konsolidasi
                </td>
                <td className="td num">{formatRupiah(unitPerf.reduce((s, u) => s + u.revenue, 0))}</td>
                <td className="td num">{formatRupiah(unitPerf.reduce((s, u) => s + u.expense, 0))}</td>
                <td className="td num">{formatRupiah(unitPerf.reduce((s, u) => s + u.profit, 0))}</td>
                <td className="td num">—</td>
                <td className="td num">{formatRupiah(unitPerf.reduce((s, u) => s + u.cash, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

/** Ringkasan singkat hasil peramalan, ditampilkan di dashboard sebagai peringatan dini. */
async function ForecastTeaser({ unitIds }: { unitIds: string[] | null }) {
  const window = await getHistoryWindow(unitIds);
  if (!window) {
    return <StatCard label="Peramalan kas" value="—" hint="Butuh data transaksi" />;
  }

  const start = currentPeriod();
  const [history, projects, openingCash] = await Promise.all([
    getMonthlyActuals(window.from, window.to, unitIds),
    prisma.project.findMany({
      where: { status: { in: ['PLANNED', 'ONGOING'] }, ...(unitIds ? { unitId: { in: unitIds } } : {}) },
      include: { items: true },
    }),
    getCashBalance(addMonths(start, -1), unitIds),
  ]);

  const result = buildForecast(history, projects.map(toProjectPlan), {
    startPeriod: start,
    horizonMonths: 24,
    method: 'WEIGHTED',
    lookbackMonths: 12,
    useSeasonality: true,
    revenueGrowthPct: 0,
    expenseGrowthPct: 0,
    minCashBuffer: 0,
    openingCash,
  });

  const runway = result.runwayMonths;

  return (
    <div className="card card-pad">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Peramalan kas 24 bulan</p>
      {runway === null ? (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">Aman</p>
          <p className="mt-1 text-xs text-slate-500">
            Kas tidak diproyeksikan minus. Saldo akhir {formatRupiah(result.endingCash)}.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-600">{runway} bulan</p>
          <p className="mt-1 text-xs text-slate-500">
            Kas diperkirakan minus pada {formatPeriod(result.firstNegative!)}.
          </p>
        </>
      )}
      <Link href="/peramalan" className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">
        Buka peramalan →
      </Link>
    </div>
  );
}
