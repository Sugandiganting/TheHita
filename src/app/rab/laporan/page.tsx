import Link from 'next/link';
import { getBudgetDetail, getBudgetList } from '@/lib/queries';
import { formatPeriod, formatPercent, formatRupiah } from '@/lib/format';
import type { SearchParams } from '@/lib/search-params';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LaporanRabPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const semua = await getBudgetList();

  if (semua.length === 0) {
    return (
      <>
        <PageHeader title="Laporan RAB" />
        <EmptyState
          title="Belum ada RAB"
          description="Buat dan isi RAB terlebih dahulu, laporannya akan muncul di sini."
          actionHref="/rab"
          actionLabel="Buat RAB"
        />
      </>
    );
  }

  const periode = [...new Set(semua.map((r) => r.period))].sort().reverse();
  const dipilih = one(params.periode) ?? periode[0];
  const bulanIni = semua.filter((r) => r.period === dipilih);

  // Rincian tiap RAB bulan terpilih, supaya laporan menampilkan sampai ke akun.
  const rinci = await Promise.all(bulanIni.map((r) => getBudgetDetail(r.id)));
  const terisi = rinci.filter((r): r is NonNullable<typeof r> => r !== null);

  const totalAnggaran = terisi.reduce((s, r) => s + r.ringkasan.totalAnggaran, 0);
  const totalRealisasi = terisi.reduce((s, r) => s + r.ringkasan.totalRealisasi, 0);
  const totalSisa = totalAnggaran - totalRealisasi;
  const totalLewat = terisi.reduce((s, r) => s + r.ringkasan.jumlahLewat, 0);
  const totalTak = terisi.reduce((s, r) => s + r.ringkasan.jumlahTakDianggarkan, 0);

  return (
    <>
      <PageHeader
        title="Laporan RAB"
        description={`Anggaran, realisasi, dan sisanya untuk ${formatPeriod(dipilih)}.`}
      />

      <Card className="card-pad">
        <label className="label" htmlFor="periode">Bulan</label>
        <form method="get" className="flex flex-wrap items-center gap-3">
          <select id="periode" name="periode" className="input max-w-xs" defaultValue={dipilih}>
            {periode.map((p) => (
              <option key={p} value={p}>{formatPeriod(p)}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">Tampilkan</button>
        </form>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dianggarkan" value={formatRupiah(totalAnggaran)} hint={`${terisi.length} RAB`} />
        <StatCard label="Realisasi" value={formatRupiah(totalRealisasi)} />
        <StatCard
          label="Sisa"
          value={formatRupiah(totalSisa)}
          tone={totalSisa < 0 ? 'negative' : 'positive'}
        />
        <StatCard
          label="Perlu diperhatikan"
          value={`${totalLewat + totalTak}`}
          hint={`${totalLewat} akun lewat anggaran, ${totalTak} tidak dianggarkan`}
          tone={totalLewat + totalTak > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {terisi.map((r) => (
        <Card key={r.id} className="card-pad mt-6 min-w-0">
          <SectionTitle
            hint={
              r.bersama
                ? `Ditanggung ${r.cabang.join(' dan ')} bersama — bukan tanggung jawab satu cabang.`
                : `Biaya yang dikendalikan ${r.scope} sendiri.`
            }
          >
            {r.scope}
          </SectionTitle>

          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge tone={r.status === 'ACTIVE' ? 'brand' : 'slate'}>
              {r.status === 'ACTIVE' ? 'Disahkan' : 'Draf'}
            </Badge>
            <span className="text-slate-600">
              Dianggarkan <strong>{formatRupiah(r.ringkasan.totalAnggaran)}</strong>, terpakai{' '}
              <strong>{formatRupiah(r.ringkasan.totalRealisasi)}</strong>, sisa{' '}
              <strong className={r.ringkasan.totalSisa < 0 ? 'text-red-600' : ''}>
                {formatRupiah(r.ringkasan.totalSisa)}
              </strong>
            </span>
            <Link href={`/rab/${r.id}`} className="text-xs text-slate-600 hover:underline">Buka RAB →</Link>
          </div>

          {r.ringkasan.baris.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">RAB ini belum ada isinya.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="th">Akun</th>
                    <th className="th num">Dianggarkan</th>
                    <th className="th num">Realisasi</th>
                    <th className="th num">Sisa</th>
                    <th className="th num">Terpakai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.ringkasan.baris.map((b) => (
                    <tr key={b.accountId} className={b.takDianggarkan ? 'bg-amber-50/60' : ''}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </>
  );
}
