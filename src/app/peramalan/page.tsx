import { Suspense } from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { buildForecast, toProjectPlan, type ForecastMethod } from '@/lib/forecast';
import { getCashBalance, getHistoryWindow, getMonthlyActuals } from '@/lib/queries';
import { addMonths, currentPeriod } from '@/lib/period';
import { formatNumber, formatPeriod, formatPeriodShort, formatRupiah } from '@/lib/format';
import type { SearchParams } from '@/lib/search-params';
import { ForecastControls, type ForecastControlValues } from '@/components/forecast-controls';
import { CashBalanceChart, NetCashChart } from '@/components/charts';
import { Alert, Card, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default async function PeramalanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const unit = one(params.unit) ?? '';
  const unitIds = unit ? [unit] : null;

  const [units, allProjects] = await Promise.all([
    prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    prisma.project.findMany({
      where: { status: { in: ['PLANNED', 'ONGOING'] } },
      include: { items: true, unit: { select: { code: true } } },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  const scopedProjects = allProjects.filter((p) => !unitIds || unitIds.includes(p.unitId));
  const projectOptions = scopedProjects.map((p) => ({
    id: p.id,
    name: p.name,
    unitCode: p.unit.code,
    totalCost: p.items.reduce((s, i) => s + i.amount, 0),
  }));

  // Secara bawaan semua proyek aktif ikut dihitung.
  const projectsParam = one(params.projects);
  const selectedProjectIds =
    projectsParam === undefined
      ? scopedProjects.map((p) => p.id)
      : projectsParam.split(',').filter(Boolean);

  const values: ForecastControlValues = {
    unit,
    horizon: num(one(params.horizon), 24),
    method: one(params.method) ?? 'WEIGHTED',
    lookback: num(one(params.lookback), 12),
    seasonal: (one(params.seasonal) ?? '1') === '1',
    growthRevenue: num(one(params.gRev), 0),
    growthExpense: num(one(params.gExp), 0),
    buffer: num(one(params.buffer), 0),
    projects: selectedProjectIds,
  };

  const window = await getHistoryWindow(unitIds);
  if (!window) {
    return (
      <>
        <PageHeader title="Peramalan arus kas" />
        <EmptyState
          title="Belum ada data untuk diramalkan"
          description="Peramalan dihitung dari transaksi yang sudah pernah diinput. Catat minimal beberapa bulan transaksi terlebih dahulu."
          actionHref="/transaksi"
          actionLabel="Catat transaksi"
        />
      </>
    );
  }

  const start = currentPeriod();
  const [history, openingCash] = await Promise.all([
    getMonthlyActuals(window.from, window.to, unitIds),
    getCashBalance(addMonths(start, -1), unitIds),
  ]);

  const activePlans = scopedProjects
    .filter((p) => selectedProjectIds.includes(p.id))
    .map(toProjectPlan);

  const result = buildForecast(history, activePlans, {
    startPeriod: start,
    horizonMonths: values.horizon,
    method: values.method as ForecastMethod,
    lookbackMonths: values.lookback,
    useSeasonality: values.seasonal,
    revenueGrowthPct: values.growthRevenue,
    expenseGrowthPct: values.growthExpense,
    minCashBuffer: values.buffer,
    openingCash,
  });

  // Grafik menggabungkan saldo kas historis dan proyeksi dalam satu garis.
  const historyTail = history.slice(-12);
  let running = openingCash;
  const historyBalances = historyTail
    .map((h) => ({ period: h.period, net: h.cashIn - h.cashOut }))
    .reverse()
    .map((h) => {
      const balance = running;
      running -= h.net;
      return { period: h.period, saldo: balance };
    })
    .reverse();

  const balanceSeries = [
    ...historyBalances,
    ...result.rows.map((r) => ({ period: r.period, saldo: r.cashBalance })),
  ];

  const netSeries = result.rows.map((r) => ({ period: r.period, net: r.netCash }));
  const scopeLabel = unit ? units.find((u) => u.id === unit)?.name ?? '' : 'Seluruh grup';

  const totalCapex = result.rows.reduce((s, r) => s + r.projectCapex, 0);

  return (
    <>
      <PageHeader
        title="Peramalan arus kas"
        description={`${scopeLabel} — proyeksi ${values.horizon} bulan ke depan berdasarkan ${result.historyMonths} bulan data transaksi yang sudah diinput.`}
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="min-w-0 lg:col-span-1">
          <Suspense>
            <ForecastControls units={units} projects={projectOptions} values={values} />
          </Suspense>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-3">
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <Alert key={i} tone={result.firstNegative ? 'danger' : 'warning'}>
                  {w}
                </Alert>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Kapan uang habis"
              value={result.firstNegative ? formatPeriod(result.firstNegative) : 'Tidak habis'}
              hint={
                result.runwayMonths !== null
                  ? `${result.runwayMonths} bulan lagi dari sekarang`
                  : `Dalam ${values.horizon} bulan ke depan kas tetap positif`
              }
              tone={result.firstNegative ? 'negative' : 'positive'}
            />
            <StatCard
              label="Saldo kas sekarang"
              value={formatRupiah(openingCash)}
              hint={`Posisi awal ${formatPeriod(start)}`}
            />
            <StatCard
              label="Saldo terendah"
              value={result.lowestBalance ? formatRupiah(result.lowestBalance.amount) : '—'}
              hint={result.lowestBalance ? `Terjadi ${formatPeriod(result.lowestBalance.period)}` : undefined}
              tone={result.lowestBalance && result.lowestBalance.amount < values.buffer ? 'warning' : 'neutral'}
            />
            <StatCard
              label="Kemampuan belanja proyek"
              value={formatRupiah(result.maxAffordableNow)}
              hint="Dana maksimum yang bisa dikeluarkan sekarang tanpa menembus batas aman"
              tone="neutral"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Rata-rata pemasukan/bulan" value={formatRupiah(result.avgMonthlyIn)} hint="Hasil ramalan" />
            <StatCard label="Rata-rata pengeluaran/bulan" value={formatRupiah(result.avgMonthlyOut)} hint="Hasil ramalan" />
            <StatCard
              label="Surplus/defisit rata-rata"
              value={formatRupiah(result.avgMonthlyNet)}
              tone={result.avgMonthlyNet < 0 ? 'negative' : 'positive'}
              hint="Sebelum belanja proyek"
            />
          </div>

          <Card className="card-pad">
            <SectionTitle
              hint={`Garis putus-putus menandai batas antara data aktual dan ramalan. ${
                values.buffer > 0 ? `Batas aman ${formatRupiah(values.buffer)}.` : ''
              }`}
            >
              Proyeksi saldo kas
            </SectionTitle>
            <CashBalanceChart
              data={balanceSeries}
              buffer={values.buffer}
              splitAt={result.rows[0]?.period}
            />
          </Card>

          <Card className="card-pad">
            <SectionTitle hint="Batang merah menandai bulan dengan pengeluaran melebihi pemasukan.">
              Arus kas bersih per bulan
            </SectionTitle>
            <NetCashChart data={netSeries} />
          </Card>

          <Card className="card-pad">
            <SectionTitle
              hint={
                totalCapex > 0
                  ? `Termasuk belanja proyek ${formatRupiah(totalCapex)} dari ${activePlans.length} proyek.`
                  : 'Belum ada proyek yang diperhitungkan.'
              }
            >
              Rincian bulanan
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="table-compact w-full min-w-[700px] text-xs">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="th">Bulan</th>
                    <th className="th num">Pemasukan</th>
                    <th className="th num">Pengeluaran</th>
                    <th className="th num">Proyek</th>
                    <th className="th num">Dana masuk</th>
                    <th className="th num">Cicilan</th>
                    <th className="th num">Bersih</th>
                    <th className="th num">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((r) => (
                    <tr
                      key={r.period}
                      className={r.negative ? 'bg-red-50' : r.belowBuffer ? 'bg-amber-50' : 'hover:bg-slate-50'}
                    >
                      <td className="td whitespace-nowrap font-medium text-slate-900">{formatPeriodShort(r.period)}</td>
                      <td className="td num">{formatNumber(r.baselineIn + r.projectIn)}</td>
                      <td className="td num">{formatNumber(r.baselineOut + r.projectOpex)}</td>
                      <td className="td num">{r.projectCapex > 0 ? formatNumber(r.projectCapex) : '—'}</td>
                      <td className="td num">{r.fundingIn > 0 ? formatNumber(r.fundingIn) : '—'}</td>
                      <td className="td num">{r.loanPayment > 0 ? formatNumber(r.loanPayment) : '—'}</td>
                      <td className={`td num ${r.netCash < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatNumber(r.netCash)}
                      </td>
                      <td className={`td num font-medium ${r.negative ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatNumber(r.cashBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Semua angka dalam rupiah. Baris kuning = saldo di bawah batas aman, baris merah = saldo minus.
            </p>
          </Card>

          <Card className="card-pad">
            <SectionTitle>Cara membaca angka ini</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>
                Ramalan dihitung dari <strong>{result.historyMonths} bulan</strong> transaksi terakhir
                {result.seasonalityApplied ? ', sudah dikoreksi pola musiman high/low season' : ''}.
              </li>
              <li>
                Pemasukan dan pengeluaran rutin memakai metode{' '}
                <strong>
                  {values.method === 'WEIGHTED'
                    ? 'rata-rata tertimbang'
                    : values.method === 'TREND'
                      ? 'garis tren'
                      : 'rata-rata sederhana'}
                </strong>
                , lalu ditambah asumsi pertumbuhan {values.growthRevenue}%/tahun untuk pendapatan dan{' '}
                {values.growthExpense}%/tahun untuk biaya.
              </li>
              <li>
                Belanja proyek diambil dari jadwal pembayaran di menu{' '}
                <Link href="/proyek" className="text-brand-700 underline">
                  Proyek
                </Link>
                . Item yang sudah ditandai lunas tidak dihitung lagi.
              </li>
              <li>
                Beban penyusutan tidak ikut dihitung karena bukan pengeluaran kas.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
