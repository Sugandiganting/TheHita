import { prisma } from '@/lib/db';
import { getCashAccountsByUnit, getRecentCashEntries } from '@/lib/queries';
import { toDateInput } from '@/lib/format';
import { MoneyForm } from '@/components/money-form';
import { CashEntryList } from '@/components/cash-entry-list';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ReceiveMoneyPage() {
  const [accounts, categories, units, entries] = await Promise.all([
    getCashAccountsByUnit(),
    // Uang masuk biasanya diakui sebagai pendapatan, pelunasan piutang,
    // atau penerimaan titipan seperti deposit tamu.
    prisma.account.findMany({
      where: {
        active: true,
        isHeader: false,
        isCash: false,
        subtype: { not: 'INTERUNIT' },
        type: { in: ['REVENUE', 'ASSET', 'LIABILITY', 'EQUITY'] },
      },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.businessUnit.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    getRecentCashEntries(['RECEIVE']),
  ]);

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Receive Money" />
        <EmptyState
          title="Belum ada rekening kas"
          description="Tandai akun sebagai kas/bank di menu Chart of Account terlebih dahulu."
          actionHref="/coa"
          actionLabel="Buka COA"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Receive Money"
        description="Mencatat setiap uang yang masuk ke rekening atau kas grup — pencairan OTA, pembayaran tamu, pelunasan piutang, atau pendapatan lain. Satu penerimaan boleh dipecah ke beberapa akun sekaligus."
      />

      <div className="space-y-6">
        <Card className="card-pad">
          <SectionTitle hint="Kolom “Untuk cabang” memungkinkan satu bukti dibagi ke beberapa unit usaha sekaligus.">
            Formulir uang masuk
          </SectionTitle>
          <MoneyForm
            kind="RECEIVE"
            accounts={accounts}
            categories={categories}
            units={units}
            defaultDate={toDateInput(new Date())}
          />
        </Card>

        <CashEntryList
          entries={entries}
          title="Uang masuk terakhir"
          hint="Menampilkan 12 bukti terbaru beserta rincian debit dan kreditnya."
        />
      </div>
    </>
  );
}
