import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, INTERUNIT_PAYABLE, INTERUNIT_RECEIVABLE, type AccountType } from '@/lib/accounting';
import { toggleAccountActive } from '@/app/actions';
import { AccountForm } from '@/components/account-form';
import { CoaRowActions } from '@/components/coa-row-actions';
import { Alert, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';
import type { SearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

const SYSTEM_CODES = [INTERUNIT_RECEIVABLE, INTERUNIT_PAYABLE];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CoaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const editId = one(params.edit);

  const [accounts, editing] = await Promise.all([
    prisma.account.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { lines: true, children: true, costItems: true } } },
    }),
    editId
      ? prisma.account.findUnique({
          where: { id: editId },
          include: { _count: { select: { lines: true } } },
        })
      : null,
  ]);

  if (editId && !editing) notFound();

  const parents = accounts
    .filter((a) => a.isHeader)
    .map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }));

  const grouped = ACCOUNT_TYPES.map((type) => ({
    type,
    accounts: accounts.filter((a) => a.type === type),
  })).filter((g) => g.accounts.length > 0);

  const postable = accounts.filter((a) => !a.isHeader).length;
  const unused = accounts.filter((a) => !a.isHeader && a._count.lines === 0).length;

  return (
    <>
      <PageHeader
        title="Chart of Account (COA)"
        description={`${postable} akun bisa diposting dan ${accounts.length - postable} akun induk, dipakai bersama seluruh cabang dan jenis usaha.`}
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
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th w-24">Kode</th>
                      <th className="th">Nama akun</th>
                      <th className="th">Kelompok</th>
                      <th className="th num">Dipakai</th>
                      <th className="th">Status</th>
                      <th className="th text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.accounts.map((a) => {
                      const isSystem = SYSTEM_CODES.includes(a.code);
                      const isEditing = a.id === editId;
                      return (
                        <tr
                          key={a.id}
                          className={
                            isEditing
                              ? 'bg-brand-50'
                              : a.isHeader
                                ? 'bg-slate-50 font-medium'
                                : 'hover:bg-slate-50'
                          }
                        >
                          <td className="td font-mono text-xs text-slate-500">{a.code}</td>
                          <td className={`td ${a.isHeader ? 'text-slate-900' : 'pl-6 text-slate-700'}`}>
                            {a.name}
                            {a.isCash && <Badge tone="green"><span className="ml-1">kas</span></Badge>}
                            {isSystem && <Badge tone="blue"><span className="ml-1">sistem</span></Badge>}
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
                          <td className="td">
                            <CoaRowActions
                              id={a.id}
                              editHref={`/coa?edit=${a.id}`}
                              usage={a._count.lines}
                              childCount={a._count.children}
                              costItems={a._count.costItems}
                              isSystem={isSystem}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <Card className="card-pad sticky top-20">
            <SectionTitle
              hint={
                editing
                  ? `Mengubah akun ${editing.code}. Tekan Batal untuk kembali menambah akun baru.`
                  : `${unused} akun belum pernah dipakai — akun seperti itu boleh dihapus bila memang tidak diperlukan.`
              }
            >
              {editing ? 'Ubah akun' : 'Akun baru'}
            </SectionTitle>
            {/* Kunci ini memaksa formulir dipasang ulang saat berpindah akun,
                supaya state di dalamnya ikut mengambil nilai akun yang dipilih. */}
            <AccountForm
              key={editing?.id ?? 'baru'}
              parents={parents}
              values={
                editing
                  ? {
                      id: editing.id,
                      code: editing.code,
                      name: editing.name,
                      type: editing.type,
                      subtype: editing.subtype,
                      parentId: editing.parentId,
                      isCash: editing.isCash,
                      isHeader: editing.isHeader,
                      cashflowCategory: editing.cashflowCategory,
                      usage: editing._count.lines,
                    }
                  : undefined
              }
            />
          </Card>
        </div>
      </div>
    </>
  );
}
