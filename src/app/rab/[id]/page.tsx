import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getBudgetDetail } from '@/lib/queries';
import { formatPeriod, formatPercent, formatRupiah } from '@/lib/format';
import { JENIS_RAB_LABEL } from '@/lib/rab';
import { type BarangOption } from '@/components/budget-form';
import { TambahAnggaranDialog, TambahBarangRabDialog } from '@/components/budget-dialog';
import { BudgetActions, BudgetItemLineDelete, BudgetLineDelete } from '@/components/budget-actions';
import { Alert, Badge, Card, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rab, accounts, lines, barang] = await Promise.all([
    getBudgetDetail(id),
    prisma.account.findMany({
      where: { isHeader: false, active: true, type: { in: ['EXPENSE', 'COGS'] } },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.budgetLine.findMany({ where: { budgetId: id }, select: { id: true, accountId: true } }),
    prisma.item.findMany({
      where: { active: true },
      orderBy: [{ category: { name: 'asc' } }, { code: 'asc' }],
      select: {
        id: true, code: true, name: true,
        unit: { select: { code: true } },
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        account: { select: { code: true, name: true } },
      },
    }),
  ]);

  if (!rab) notFound();

  const disahkan = rab.status === 'ACTIVE';
  const purchasing = rab.kind === 'PURCHASING';
  const lineIdByAccount = new Map(lines.map((l) => [l.accountId, l.id]));
  const r = rab.ringkasan;

  const opsiBarang: BarangOption[] = barang.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    satuan: b.unit.code,
    kategori: b.category.name,
    subKategori: b.subCategory?.name ?? null,
    accountCode: b.account.code,
    accountName: b.account.name,
  }));

  return (
    <>
      <PageHeader
        title={`RAB ${JENIS_RAB_LABEL[rab.kind]} ${rab.scope} — ${formatPeriod(rab.period)}`}
        description={
          rab.bersama
            ? `Biaya yang ditanggung ${rab.cabang.join(' dan ')} bersama-sama. Tidak masuk RAB cabang mana pun.`
            : `Biaya yang dikendalikan ${rab.scope} sendiri. Porsi beban bersama punya RAB tersendiri.`
        }
        action={
          purchasing ? (
            <TambahBarangRabDialog budgetId={rab.id} items={opsiBarang} disabled={disahkan} />
          ) : (
            <TambahAnggaranDialog budgetId={rab.id} accounts={accounts} disabled={disahkan} />
          )
        }
      />

      <p className="mb-4 text-sm">
        <Link href="/rab" className="text-slate-600 hover:underline">← Kembali ke daftar RAB</Link>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dianggarkan" value={formatRupiah(r.totalAnggaran)} />
        <StatCard label="Realisasi" value={formatRupiah(r.totalRealisasi)} />
        <StatCard
          label="Sisa"
          value={formatRupiah(r.totalSisa)}
          tone={r.totalSisa < 0 ? 'negative' : 'positive'}
          hint={r.totalSisa < 0 ? 'Sudah lewat anggaran' : undefined}
        />
        <StatCard
          label="Terpakai"
          value={r.terpakaiPct === null ? '—' : formatPercent(r.terpakaiPct)}
          hint={disahkan ? 'RAB sudah disahkan' : 'Masih draf, belum disahkan'}
        />
      </div>

      {(r.jumlahLewat > 0 || r.jumlahTakDianggarkan > 0 || rab.akunTumpang.length > 0) && (
        <div className="mt-4 space-y-2">
          {rab.akunTumpang.length > 0 && (
            <Alert tone="warning">
              Akun {rab.akunTumpang.map((a) => `${a.code} ${a.name}`).join(', ')} juga dianggarkan di
              RAB {JENIS_RAB_LABEL[purchasing ? 'UMUM' : 'PURCHASING']} cabang dan bulan yang sama.
              Realisasinya ditampilkan penuh di kedua RAB, karena jurnal tidak mencatat RAB mana yang
              dimaksud sebuah beban — jadi sisa di masing-masing RAB lebih kecil dari yang sebenarnya.
              Bandingkan totalnya di Laporan RAB, yang menghitung tiap akun satu kali.
            </Alert>
          )}
          {r.jumlahLewat > 0 && (
            <Alert tone="warning">
              {r.jumlahLewat} akun sudah melewati anggarannya.
            </Alert>
          )}
          {r.jumlahTakDianggarkan > 0 && (
            <Alert tone="warning">
              {r.jumlahTakDianggarkan} akun terpakai tanpa pernah dianggarkan. Tetap ditampilkan di bawah
              supaya total realisasinya sama dengan beban yang benar-benar terjadi.
            </Alert>
          )}
        </div>
      )}

      <Card className="card-pad mt-6">
        <BudgetActions
          id={rab.id}
          status={rab.status}
          lineCount={purchasing ? rab.barang.length : r.baris.filter((b) => b.anggaran > 0).length}
        />
      </Card>

      <div className="mt-6 space-y-6">
        {purchasing && (
          <Card className="card-pad min-w-0">
            <SectionTitle hint="Akun bebannya ikut dari master barang, jadi satu barang tidak bisa masuk ke dua akun yang berbeda.">
              Rincian per barang
            </SectionTitle>

            {rab.barang.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Belum ada barang. Isi lewat tombol <strong>Tambah barang</strong> di atas: pilih
                barangnya, isi jumlah dan harga satuannya, lalu simpan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Barang</th>
                      <th className="th">Akun beban</th>
                      <th className="th num">Jumlah</th>
                      <th className="th num">Harga satuan</th>
                      <th className="th num">Dianggarkan</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rab.barang.map((b) => (
                      <tr key={b.lineId} className="hover:bg-slate-50">
                        <td className="td">
                          <span className="mr-2 font-mono text-xs text-slate-500">{b.itemCode}</span>
                          {b.itemName}
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {b.subKategori ? `${b.kategori} › ${b.subKategori}` : b.kategori}
                          </span>
                        </td>
                        <td className="td">
                          <span className="mr-2 font-mono text-xs text-slate-500">{b.accountCode}</span>
                          {b.accountName}
                        </td>
                        <td className="td num">
                          {b.quantity.toLocaleString('id-ID')} <span className="text-xs text-slate-500">{b.satuan}</span>
                        </td>
                        <td className="td num">{formatRupiah(b.unitPrice)}</td>
                        <td className="td num">{formatRupiah(b.anggaran)}</td>
                        <td className="td num">
                          <BudgetItemLineDelete id={b.lineId} disabled={disahkan} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="td" colSpan={4}>Total</td>
                      <td className="td num">
                        {formatRupiah(rab.barang.reduce((s, b) => s + b.anggaran, 0))}
                      </td>
                      <td className="td num">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card className="card-pad min-w-0">
          <SectionTitle
            hint={
              purchasing
                ? 'Beberapa barang bisa bermuara ke akun yang sama. Perbandingan dengan jurnal hanya mungkin di tingkat akun, karena jurnal tidak mencatat barangnya.'
                : 'Realisasi diambil dari jurnal bulan ini, mengikuti aturan penanggung yang sama dengan laporan laba rugi.'
            }
          >
            {purchasing ? 'Anggaran dan realisasi per akun' : 'Rincian anggaran'}
          </SectionTitle>

          {r.baris.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              {purchasing
                ? 'Belum ada yang bisa dibandingkan. Isi rincian barangnya dulu di atas.'
                : 'Belum ada baris. Isi lewat formulir Tambah anggaran: pilih akun beban, isi nominalnya, lalu simpan. Ulangi untuk tiap akun yang dianggarkan.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="th">Akun</th>
                    <th className="th num">Dianggarkan</th>
                    <th className="th num">Realisasi</th>
                    <th className="th num">Sisa</th>
                    <th className="th num">Terpakai</th>
                    {!purchasing && <th className="th num">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.baris.map((b) => (
                    <tr key={b.accountId} className={b.takDianggarkan ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                      <td className="td">
                        <span className="mr-2 font-mono text-xs text-slate-500">{b.accountCode}</span>
                        {b.accountName}
                        {b.takDianggarkan && (
                          <span className="mt-0.5 block text-xs text-amber-700">tidak dianggarkan</span>
                        )}
                      </td>
                      <td className="td num">{b.anggaran > 0 ? formatRupiah(b.anggaran) : '—'}</td>
                      <td className="td num">{formatRupiah(b.realisasi)}</td>
                      <td className={`td num ${b.sisa < 0 ? 'font-medium text-red-600' : ''}`}>
                        {formatRupiah(b.sisa)}
                      </td>
                      <td className="td num">{b.terpakaiPct === null ? '—' : formatPercent(b.terpakaiPct)}</td>
                      {!purchasing && (
                        <td className="td num">
                          {lineIdByAccount.has(b.accountId) ? (
                            <BudgetLineDelete id={lineIdByAccount.get(b.accountId)!} disabled={disahkan} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-semibold">
                  <tr>
                    <td className="td">Total</td>
                    <td className="td num">{formatRupiah(r.totalAnggaran)}</td>
                    <td className="td num">{formatRupiah(r.totalRealisasi)}</td>
                    <td className={`td num ${r.totalSisa < 0 ? 'text-red-600' : ''}`}>
                      {formatRupiah(r.totalSisa)}
                    </td>
                    <td className="td num">{r.terpakaiPct === null ? '—' : formatPercent(r.terpakaiPct)}</td>
                    {!purchasing && <td className="td num">—</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
