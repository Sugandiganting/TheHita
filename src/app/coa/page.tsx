import { prisma } from '@/lib/db';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, type AccountType } from '@/lib/accounting';
import { toggleAccountActive } from '@/app/actions';
import { AccountForm } from '@/components/account-form';
import { Alert, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function CoaPage() {
  const accounts = await prisma.account.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { lines: true } } },
  });

  const grouped = ACCOUNT_TYPES.map((type) => ({
    type,
    accounts: accounts.filter((a) => a.type === type),
  })).filter((g) => g.accounts.length > 0);

  return (
    <>
      <PageHeader
        title="Chart of Account (COA)"
        description="Satu daftar akun dipakai bersama oleh seluruh cabang dan jenis usaha. Pemisahan cabang tidak lagi memerlukan penggandaan nomor akun."
      />

      <div className="mb-6">
        <Alert tone="info" title="Kenapa COA-nya cuma satu?">
          Di PMS lama, cabang dipisahkan dengan membuat nomor akun berbeda untuk tiap cabang. Di sini setiap baris
          jurnal membawa penanda unit usaha, sehingga akun yang sama — misalnya 6120.01 Biaya Listrik — bisa dipakai
          Sri Krisna, The Hita Legian, Play Laundry, dan lainnya. Laporan per cabang maupun konsolidasi sama-sama bisa
          dihasilkan tanpa mengubah COA.
        </Alert>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          {grouped.map((group) => (
            <Card key={group.type} className="card-pad">
              <SectionTitle hint={`${group.accounts.length} akun`}>
                {ACCOUNT_TYPE_LABEL[group.type as AccountType]}
              </SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th w-24">Kode</th>
                      <th className="th">Nama akun</th>
                      <th className="th">Kelompok</th>
                      <th className="th num">Dipakai</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.accounts.map((a) => (
                      <tr key={a.id} className={a.isHeader ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50'}>
                        <td className="td font-mono text-xs text-slate-500">{a.code}</td>
                        <td className={`td ${a.isHeader ? 'text-slate-900' : 'pl-6 text-slate-700'}`}>
                          {a.name}
                          {a.isCash && (
                            <Badge tone="green">
                              <span className="ml-1">kas</span>
                            </Badge>
                          )}
                          {a.description && (
                            <span className="block text-xs font-normal text-slate-500">{a.description}</span>
                          )}
                        </td>
                        <td className="td text-xs text-slate-500">{a.subtype ?? '—'}</td>
                        <td className="td num text-xs text-slate-500">
                          {a.isHeader ? '—' : `${a._count.lines}x`}
                        </td>
                        <td className="td">
                          <form action={toggleAccountActive}>
                            <input type="hidden" name="id" value={a.id} />
                            <button type="submit">
                              <Badge tone={a.active ? 'green' : 'slate'}>{a.active ? 'Aktif' : 'Non-aktif'}</Badge>
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <Card className="card-pad sticky top-20">
            <SectionTitle hint="Tambahkan akun baru bila ada jenis pemasukan atau biaya yang belum tertampung.">
              Akun baru
            </SectionTitle>
            <AccountForm />
          </Card>
        </div>
      </div>
    </>
  );
}
