import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
import { periodEndExclusive, periodStart } from '@/lib/period';
import { resolveRange, resolveUnit, type SearchParams } from '@/lib/search-params';
import { deleteEntry } from '@/app/actions';
import { EntryTabs } from '@/components/entry-tabs';
import { ReportFilters } from '@/components/filters';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function TransaksiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { from, to } = resolveRange(params, 3);
  const unitIds = resolveUnit(params);

  const where = {
    date: { gte: periodStart(from), lt: periodEndExclusive(to) },
    ...(unitIds ? { lines: { some: { unitId: { in: unitIds } } } } : {}),
  };

  const [units, accounts, entries, total] = await Promise.all([
    prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    prisma.account.findMany({
      where: { active: true, isHeader: false },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true, isCash: true },
    }),
    prisma.journalEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: PAGE_SIZE,
      include: {
        unit: { select: { code: true, name: true } },
        lines: {
          include: {
            account: { select: { code: true, name: true, type: true } },
            unit: { select: { code: true } },
          },
        },
      },
    }),
    prisma.journalEntry.count({ where }),
  ]);

  const today = toDateInput(new Date());

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Catat pemasukan dan pengeluaran. Setiap transaksi tersimpan sebagai jurnal double-entry berbasis COA, dengan penanda unit usaha pada tiap baris."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <EntryTabs units={units} accounts={accounts} defaultDate={today} />
        </div>

        <div className="min-w-0 lg:col-span-3">
          <Suspense>
            <ReportFilters units={units} />
          </Suspense>

          <Card className="card-pad">
            <SectionTitle hint={`Menampilkan ${entries.length} dari ${total} bukti pada rentang periode terpilih.`}>
              Daftar transaksi
            </SectionTitle>

            {entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Belum ada transaksi pada periode ini.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
                  return (
                    <li key={entry.id} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{entry.description}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{formatDate(entry.date)}</span>
                            <Badge tone="brand">{entry.unit.code}</Badge>
                            {entry.reference && <span className="font-mono">{entry.reference}</span>}
                            <Badge>{entry.source}</Badge>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium tabular-nums text-slate-900">{formatRupiah(totalDebit)}</span>
                          <form action={deleteEntry}>
                            <input type="hidden" name="id" value={entry.id} />
                            <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                              Hapus
                            </button>
                          </form>
                        </div>
                      </div>

                      <table className="mt-2 w-full text-xs">
                        <tbody>
                          {entry.lines.map((line) => (
                            <tr key={line.id} className="text-slate-600">
                              <td className="py-0.5 pr-2 font-mono text-slate-400">{line.account.code}</td>
                              <td className="py-0.5 pr-2">{line.account.name}</td>
                              <td className="py-0.5 pr-2 text-slate-400">{line.unit.code}</td>
                              <td className="py-0.5 pr-2 text-right tabular-nums">
                                {line.debit > 0 ? formatRupiah(line.debit) : ''}
                              </td>
                              <td className="py-0.5 text-right tabular-nums">
                                {line.credit > 0 ? formatRupiah(line.credit) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
