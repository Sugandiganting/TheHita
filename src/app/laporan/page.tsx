import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { getAccountBalances, getCashAccountBreakdown, getMonthlyActuals, getProfitLoss } from '@/lib/queries';
import { formatPeriod, formatPercent, formatRupiah } from '@/lib/format';
import { ACCOUNT_TYPE_LABEL, type AccountType } from '@/lib/accounting';
import { resolveRange, resolveUnit, type SearchParams } from '@/lib/search-params';
import { ReportFilters } from '@/components/filters';
import { CashflowBarChart } from '@/components/charts';
import { Card, PageHeader, SectionTitle, StatCard } from '@/components/ui';
import type { AccountBalance } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function LaporanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { from, to } = resolveRange(params, 12);
  const unitIds = resolveUnit(params);

  const [units, pl, balances, cashBreakdown, actuals] = await Promise.all([
    prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    getProfitLoss(from, to, unitIds),
    getAccountBalances(from, to, unitIds),
    getCashAccountBreakdown(to, unitIds),
    getMonthlyActuals(from, to, unitIds),
  ]);

  const totalDebit = balances.reduce((s, b) => s + b.debit, 0);
  const totalCredit = balances.reduce((s, b) => s + b.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 1;

  return (
    <>
      <PageHeader
        title="Laporan keuangan"
        description={`Periode ${formatPeriod(from)} s/d ${formatPeriod(to)}. Pilih satu cabang untuk laporan per unit, atau biarkan kosong untuk laporan konsolidasi seluruh grup.`}
      />

      <Suspense>
        <ReportFilters units={units} />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pendapatan" value={formatRupiah(pl.totalRevenue)} />
        <StatCard label="Laba kotor" value={formatRupiah(pl.grossProfit)} hint={`HPP ${formatRupiah(pl.totalCogs)}`} />
        <StatCard label="Beban operasional" value={formatRupiah(pl.totalExpense)} />
        <StatCard
          label="Laba bersih"
          value={formatRupiah(pl.netProfit)}
          hint={`Margin ${formatPercent(pl.netMarginPct)}`}
          tone={pl.netProfit < 0 ? 'negative' : 'positive'}
        />
      </div>

      <Card className="card-pad mt-6 min-w-0">
        <SectionTitle hint="Perbandingan pendapatan dan beban tiap bulan pada periode terpilih.">
          Tren bulanan
        </SectionTitle>
        <CashflowBarChart data={actuals.map((a) => ({ period: a.period, masuk: a.revenue, keluar: a.expense }))} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="card-pad min-w-0 lg:col-span-2">
          <SectionTitle hint="Disusun mengikuti struktur COA. Akun tanpa mutasi tidak ditampilkan.">
            Laba rugi
          </SectionTitle>

          <table className="w-full">
            <tbody>
              <GroupRows title="Pendapatan" rows={pl.revenue} total={pl.totalRevenue} />
              <GroupRows title="Harga pokok penjualan" rows={pl.cogs} total={pl.totalCogs} />
              <tr className="border-y-2 border-slate-200 font-semibold">
                <td className="td" colSpan={2}>Laba kotor</td>
                <td className="td num">{formatRupiah(pl.grossProfit)}</td>
              </tr>
              <GroupRows title="Beban operasional" rows={pl.expense} total={pl.totalExpense} />
              <tr className="border-t-2 border-slate-300 text-base font-bold">
                <td className="td" colSpan={2}>Laba bersih</td>
                <td className={`td num ${pl.netProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {formatRupiah(pl.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        <div className="space-y-6">
          <Card className="card-pad">
            <SectionTitle hint={`Posisi akhir ${formatPeriod(to)}, belum termasuk saldo awal unit.`}>
              Saldo kas &amp; bank
            </SectionTitle>
            {cashBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada mutasi kas.</p>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  {cashBreakdown.map((c) => (
                    <tr key={c.code}>
                      <td className="td">
                        <span className="mr-2 font-mono text-xs text-slate-400">{c.code}</span>
                        {c.name}
                      </td>
                      <td className="td num">{formatRupiah(c.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-semibold">
                  <tr>
                    <td className="td">Total</td>
                    <td className="td num">
                      {formatRupiah(cashBreakdown.reduce((s, c) => s + c.balance, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>

          <Card className="card-pad">
            <SectionTitle hint="Pemeriksaan keseimbangan seluruh jurnal pada periode ini.">
              Neraca saldo
            </SectionTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Total debit</dt>
                <dd className="font-medium tabular-nums">{formatRupiah(totalDebit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Total kredit</dt>
                <dd className="font-medium tabular-nums">{formatRupiah(totalCredit)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <dt className="text-slate-500">Selisih</dt>
                <dd className={`font-semibold ${balanced ? 'text-emerald-600' : 'text-red-600'}`}>
                  {balanced ? 'Balance ✓' : formatRupiah(totalDebit - totalCredit)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card className="card-pad mt-6 min-w-0">
        <SectionTitle hint="Seluruh akun yang memiliki mutasi pada periode terpilih.">
          Neraca saldo rinci
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Kode</th>
                <th className="th">Nama akun</th>
                <th className="th">Jenis</th>
                <th className="th num">Debit</th>
                <th className="th num">Kredit</th>
                <th className="th num">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map((b) => (
                <tr key={b.accountId} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs text-slate-500">{b.code}</td>
                  <td className="td">{b.name}</td>
                  <td className="td text-xs text-slate-500">
                    {ACCOUNT_TYPE_LABEL[b.type as AccountType] ?? b.type}
                  </td>
                  <td className="td num">{b.debit > 0 ? formatRupiah(b.debit) : '—'}</td>
                  <td className="td num">{b.credit > 0 ? formatRupiah(b.credit) : '—'}</td>
                  <td className="td num font-medium">{formatRupiah(b.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold">
              <tr>
                <td className="td" colSpan={3}>Total</td>
                <td className="td num">{formatRupiah(totalDebit)}</td>
                <td className="td num">{formatRupiah(totalCredit)}</td>
                <td className="td num">{balanced ? 'Balance ✓' : formatRupiah(totalDebit - totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

function GroupRows({ title, rows, total }: { title: string; rows: AccountBalance[]; total: number }) {
  if (rows.length === 0) return null;
  return (
    <>
      <tr className="bg-slate-50">
        <td className="td font-semibold text-slate-700" colSpan={3}>
          {title}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.accountId} className="border-b border-slate-100">
          <td className="td w-20 font-mono text-xs text-slate-400">{r.code}</td>
          <td className="td">{r.name}</td>
          <td className="td num">{formatRupiah(r.balance)}</td>
        </tr>
      ))}
      <tr className="border-b border-slate-200 font-medium">
        <td className="td" colSpan={2}>
          Total {title.toLowerCase()}
        </td>
        <td className="td num">{formatRupiah(total)}</td>
      </tr>
    </>
  );
}
