import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCashAccountsByUnit, getInterUnitPositions, getRecentCashEntries } from '@/lib/queries';
import { formatRupiah } from '@/lib/format';
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui';
import { CashEntryList } from '@/components/cash-entry-list';

export const dynamic = 'force-dynamic';

export default async function KasPage() {
  const [rows, interUnit, entries, units] = await Promise.all([
    getCashAccountsByUnit(),
    getInterUnitPositions(),
    getRecentCashEntries(['TRANSFER', 'RECEIVE', 'PAY'], 8),
    prisma.businessUnit.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, openingCash: true },
    }),
  ]);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Cash and Bank" />
        <EmptyState
          title="Belum ada rekening kas"
          description="Tandai akun sebagai kas/bank di menu Chart of Account terlebih dahulu."
          actionHref="/coa"
          actionLabel="Buka COA"
        />
      </>
    );
  }

  // Hanya tampilkan rekening yang pernah dipakai, agar tabel tidak penuh baris nol.
  const used = rows.filter((r) => Math.abs(r.balance) >= 1);
  const totalMovement = used.reduce((s, r) => s + r.balance, 0);
  const totalOpening = units.reduce((s, u) => s + u.openingCash, 0);

  const byUnit = units.map((u) => ({
    ...u,
    accounts: used.filter((r) => r.unitId === u.id),
    total: used.filter((r) => r.unitId === u.id).reduce((s, r) => s + r.balance, 0) + u.openingCash,
  }));

  const seimbang = Math.abs(interUnit.total) < 1;

  return (
    <>
      <PageHeader
        title="Cash and Bank"
        description="Posisi seluruh kas dan rekening bank grup, dipisah per cabang. Satu nomor akun bisa dipakai banyak cabang — yang membedakan adalah kolom unit usahanya."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/kas/terima" className="btn-primary">Receive Money</Link>
            <Link href="/kas/bayar" className="btn-secondary">Pay Money</Link>
            <Link href="/kas/transfer" className="btn-secondary">Transfer Money</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total kas & bank"
          value={formatRupiah(totalOpening + totalMovement)}
          hint={`Termasuk saldo awal ${formatRupiah(totalOpening)}`}
          tone={totalOpening + totalMovement < 0 ? 'negative' : 'neutral'}
        />
        <StatCard label="Rekening terpakai" value={String(used.length)} hint={`dari ${rows.length} kombinasi rekening × cabang`} />
        <StatCard label="Unit usaha" value={String(units.length)} hint="Semua memakai COA yang sama" />
        <StatCard
          label="Posisi antar unit"
          value={seimbang ? 'Seimbang' : formatRupiah(interUnit.total)}
          hint={seimbang ? 'Piutang dan hutang antar unit saling meniadakan' : 'Ada selisih yang perlu diperiksa'}
          tone={seimbang ? 'positive' : 'negative'}
        />
      </div>

      {!seimbang && (
        <div className="mt-4">
          <Alert tone="danger" title="Posisi antar unit tidak seimbang">
            Jumlah Piutang Antar Unit dan Hutang Antar Unit seharusnya selalu saling meniadakan. Selisih{' '}
            {formatRupiah(interUnit.total)} menandakan ada jurnal lintas cabang yang dicatat manual tanpa akun
            penghubung. Periksa di menu Jurnal Transaksi.
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {byUnit.map((unit) => (
          <Card key={unit.id} className="card-pad">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{unit.name}</p>
                <Badge tone="brand">{unit.code}</Badge>
              </div>
              <p className={`text-right font-semibold tabular-nums ${unit.total < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {formatRupiah(unit.total)}
              </p>
            </div>

            {unit.accounts.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada mutasi kas. Saldo awal {formatRupiah(unit.openingCash)}.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {unit.openingCash !== 0 && (
                    <tr className="text-slate-500">
                      <td className="py-1.5 text-xs">Saldo awal</td>
                      <td className="py-1.5 text-right text-xs tabular-nums">{formatRupiah(unit.openingCash)}</td>
                    </tr>
                  )}
                  {unit.accounts.map((a) => (
                    <tr key={a.accountId}>
                      <td className="py-1.5">
                        <span className="mr-1.5 font-mono text-xs text-slate-400">{a.code}</span>
                        {a.name}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums ${a.balance < 0 ? 'text-red-600' : ''}`}>
                        {formatRupiah(a.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ))}
      </div>

      {interUnit.rows.length > 0 && (
        <Card className="card-pad mt-6">
          <SectionTitle hint="Angka positif berarti cabang tersebut sedang menalangi cabang lain; negatif berarti sedang ditalangi.">
            Posisi antar cabang
          </SectionTitle>
          <table className="w-full max-w-lg">
            <tbody className="divide-y divide-slate-100">
              {interUnit.rows.map((r) => (
                <tr key={r.unitId}>
                  <td className="td">
                    <span className="mr-2 font-mono text-xs text-slate-500">{r.unitCode}</span>
                    {r.unitName}
                  </td>
                  <td className="td num">
                    <span className={r.net < 0 ? 'text-amber-700' : 'text-emerald-700'}>{formatRupiah(r.net)}</span>
                  </td>
                  <td className="td text-xs text-slate-500">{r.net < 0 ? 'ditalangi' : 'menalangi'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold">
              <tr>
                <td className="td">Total</td>
                <td className="td num">{formatRupiah(interUnit.total)}</td>
                <td className="td text-xs text-slate-500">{seimbang ? 'seimbang ✓' : 'perlu diperiksa'}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <div className="mt-6">
        <CashEntryList
          entries={entries}
          title="Aktivitas kas terakhir"
          hint="Gabungan dari Transfer Money, Receive Money, dan Pay Money."
        />
      </div>
    </>
  );
}
