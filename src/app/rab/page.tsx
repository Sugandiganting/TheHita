import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getBudgetList } from '@/lib/queries';
import { currentPeriod } from '@/lib/period';
import { formatPeriod, formatRupiah } from '@/lib/format';
import { PMS_SOURCES, type PmsSource } from '@/lib/coa-legacy';
import { COA_TEMPLATE } from '@/lib/coa-template';
import { namaPenanggung, penanggungBeban } from '@/lib/beban-bersama';
import { BudgetForm, type ScopeOption } from '@/components/budget-form';
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Pemilik RAB yang tersedia: tiap cabang aktif, ditambah tiap kelompok
 * penanggung yang benar-benar dipakai aturan beban bersama. Daftarnya
 * diturunkan dari aturan itu, bukan diketik ulang, supaya tidak pernah
 * berbeda dengan cara realisasinya dikelompokkan.
 */
async function daftarScope(): Promise<ScopeOption[]> {
  const units = await prisma.businessUnit.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
    select: { code: true, name: true },
  });
  const opsi: ScopeOption[] = units.map((u) => ({
    code: u.code,
    label: `${u.code} — ${u.name}`,
    bersama: false,
  }));

  const namaUnit = new Map(units.map((u) => [u.code, u.name]));
  const kelompok = new Set<string>();
  for (const pms of Object.keys(PMS_SOURCES) as PmsSource[]) {
    for (const akun of COA_TEMPLATE) {
      if (akun.isHeader) continue;
      const nama = namaPenanggung(penanggungBeban(akun.code, pms));
      if (nama) kelompok.add(nama);
    }
  }
  for (const k of [...kelompok].sort()) {
    opsi.push({
      code: k,
      label: `${k} — ${k.split('+').map((c) => namaUnit.get(c) ?? c).join(' & ')}`,
      bersama: true,
    });
  }
  return opsi;
}

export default async function RabPage() {
  const [daftar, scopes] = await Promise.all([getBudgetList(), daftarScope()]);

  return (
    <>
      <PageHeader
        title="Input RAB"
        description="Rencana Anggaran Biaya per bulan. Satu RAB dimiliki satu cabang, atau satu kelompok cabang untuk biaya yang ditanggung bersama."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="card-pad min-w-0">
            <SectionTitle hint="Anggaran diisi per akun di dalam RAB — klik nama pemiliknya untuk membuka.">
              Daftar RAB
            </SectionTitle>

            {daftar.length === 0 ? (
              <EmptyState
                title="Belum ada RAB"
                description="Buat RAB pertama lewat formulir di samping, lalu isi rinciannya per akun beban."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Pemilik</th>
                      <th className="th">Bulan</th>
                      <th className="th">Status</th>
                      <th className="th num">Baris</th>
                      <th className="th num">Dianggarkan</th>
                      <th className="th num">Realisasi</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {daftar.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="td">
                          <Link href={`/rab/${r.id}`} className="font-medium text-brand-700 hover:underline">
                            {r.scope}
                          </Link>
                          {r.bersama && <span className="ml-2 text-xs text-slate-500">ditanggung bersama</span>}
                        </td>
                        <td className="td">{formatPeriod(r.period)}</td>
                        <td className="td">
                          <Badge tone={r.status === 'ACTIVE' ? 'brand' : 'slate'}>
                            {r.status === 'ACTIVE' ? 'Disahkan' : 'Draf'}
                          </Badge>
                        </td>
                        <td className="td num">{r.jumlahBaris}</td>
                        <td className="td num">{formatRupiah(r.totalAnggaran)}</td>
                        <td className="td num">{formatRupiah(r.totalRealisasi)}</td>
                        <td className="td num">
                          <Link href={`/rab/${r.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                            {r.jumlahBaris === 0 ? 'Isi anggaran →' : 'Buka →'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="card-pad sticky top-6 max-h-[calc(100vh-6rem)] self-start overflow-y-auto">
          <SectionTitle>RAB baru</SectionTitle>
          <BudgetForm scopes={scopes} defaultPeriod={currentPeriod()} />
        </Card>
      </div>
    </>
  );
}
