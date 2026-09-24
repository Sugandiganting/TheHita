import { prisma } from '@/lib/db';
import { getCashAccountsByUnit, getRecentCashEntries } from '@/lib/queries';
import { toDateInput } from '@/lib/format';
import { MoneyForm } from '@/components/money-form';
import { CashEntryList } from '@/components/cash-entry-list';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PayMoneyPage() {
  const [accounts, categories, units, entries] = await Promise.all([
    getCashAccountsByUnit(),
    // Uang keluar bisa menjadi beban, HPP, pembelian aset, pelunasan hutang,
    // atau prive pemilik.
    prisma.account.findMany({
      where: {
        active: true,
        isHeader: false,
        isCash: false,
        subtype: { not: 'INTERUNIT' },
        type: { in: ['EXPENSE', 'COGS', 'ASSET', 'LIABILITY', 'EQUITY'] },
      },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.businessUnit.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    getRecentCashEntries(['PAY']),
  ]);

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Pay Money" />
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
        title="Pay Money"
        description="Mencatat setiap uang yang keluar — tagihan, gaji, pembelian, pelunasan hutang. Satu pembayaran boleh dipecah ke beberapa akun beban, dan dibagi ke beberapa cabang sekaligus."
      />

      <div className="space-y-6">
        <Card className="card-pad">
          <SectionTitle hint="Contoh: satu tagihan listrik satu meteran dibagi ke hotel dan laundry sesuai porsinya.">
            Formulir uang keluar
          </SectionTitle>
          <MoneyForm
            kind="PAY"
            accounts={accounts}
            categories={categories}
            units={units}
            defaultDate={toDateInput(new Date())}
          />
        </Card>

        <CashEntryList
          entries={entries}
          title="Uang keluar terakhir"
          hint="Menampilkan 12 bukti terbaru beserta rincian debit dan kreditnya."
        />
      </div>
    </>
  );
}
