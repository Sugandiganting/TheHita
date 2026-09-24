import { prisma } from '@/lib/db';
import { getCashAccountsByUnit, getRecentCashEntries } from '@/lib/queries';
import { toDateInput } from '@/lib/format';
import { TransferForm } from '@/components/transfer-form';
import { CashEntryList } from '@/components/cash-entry-list';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const [accounts, entries, unitCount] = await Promise.all([
    getCashAccountsByUnit(),
    getRecentCashEntries(['TRANSFER']),
    prisma.businessUnit.count({ where: { active: true } }),
  ]);

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Transfer Money" />
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
        title="Transfer Money"
        description="Memindahkan uang antar rekening milik grup — misalnya dari Bank IGYT ke Bank The Hita Legian, atau dari bank ke Kas Kecil Purchasing. Transfer tidak menambah maupun mengurangi kekayaan grup, hanya memindahkan letaknya."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card className="card-pad">
            <SectionTitle hint={`Tersedia ${accounts.length} kombinasi rekening dari ${unitCount} unit usaha.`}>
              Formulir transfer
            </SectionTitle>
            <TransferForm accounts={accounts} defaultDate={toDateInput(new Date())} />
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <CashEntryList
            entries={entries}
            title="Transfer terakhir"
            hint="Transfer antar cabang otomatis membawa baris piutang dan hutang antar unit."
          />
        </div>
      </div>
    </>
  );
}
