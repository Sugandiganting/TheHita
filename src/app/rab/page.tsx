import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getBudgetList, getJenisRab } from '@/lib/queries';
import { currentPeriod } from '@/lib/period';
import { formatPeriod, formatPeriodShort, formatRupiah, formatRupiahShort } from '@/lib/format';
import { PMS_SOURCES, type PmsSource } from '@/lib/coa-legacy';
import { COA_TEMPLATE } from '@/lib/coa-template';
import { namaPenanggung, penanggungBeban } from '@/lib/beban-bersama';
import { jenisPerBarang, kodePerBarang, namaJenis, rekapJenisPerBulan, urutkanRabTerdekat } from '@/lib/rab';
import type { SearchParams } from '@/lib/search-params';
import { type ScopeOption } from '@/components/budget-form';
import { RabBaruDialog } from '@/components/budget-dialog';
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { CABANG_SAJA } from '@/lib/penampung-master';

export const dynamic = 'force-dynamic';

/**
 * Pemilik RAB yang tersedia: tiap cabang aktif, ditambah tiap kelompok
 * penanggung yang benar-benar dipakai aturan beban bersama. Daftarnya
 * diturunkan dari aturan itu, bukan diketik ulang, supaya tidak pernah
 * berbeda dengan cara realisasinya dikelompokkan.
 */
async function daftarScope(): Promise<ScopeOption[]> {
  const units = await prisma.businessUnit.findMany({
    where: CABANG_SAJA,
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

export default async function RabPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [semua, scopes, jenis] = await Promise.all([getBudgetList(), daftarScope(), getJenisRab()]);
  // Bulan berjalan di atas, lalu bulan-bulan depan, baru yang sudah lewat.
  const kini = currentPeriod();
  const rekap = rekapJenisPerBulan(semua, jenis.map((j) => j.code));
  const perBarang = kodePerBarang(jenis);
  // Saringan bulan dari tabel rekap; bulan yang tidak punya RAB diabaikan.
  const mintaBulan = Array.isArray(params.bulan) ? params.bulan[0] : params.bulan;
  const bulanDipilih = mintaBulan && rekap.bulan.includes(mintaBulan) ? mintaBulan : null;
  const daftar = urutkanRabTerdekat(
    bulanDipilih ? semua.filter((r) => r.period === bulanDipilih) : semua,
    kini,
    jenis.map((j) => j.code),
  );

  return (
    <>
      <PageHeader
        title="Input RAB"
        description="Rencana Anggaran Biaya per bulan. Satu RAB dimiliki satu cabang, atau satu kelompok cabang untuk biaya yang ditanggung bersama. RAB Purchasing disusun per barang; Umum, HR, dan jenis lain per akun."
        action={<RabBaruDialog scopes={scopes} jenis={jenis} defaultPeriod={currentPeriod()} />}
      />

      {rekap.bulan.length > 0 && (
        <Card className="card-pad mb-6 min-w-0">
          <SectionTitle hint="Total anggaran seluruh pemilik, per jenis RAB dan per bulan — draf maupun yang sudah disahkan. Klik nama bulan untuk menampilkan RAB bulan itu saja di daftar di bawah.">
            Rekap per jenis
          </SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Jenis</th>
                  {rekap.bulan.map((p) => (
                    <th key={p} className={`th num whitespace-nowrap ${p === kini ? 'bg-brand-50/60' : ''}`}>
                      <Link
                        href={bulanDipilih === p ? '/rab' : `/rab?bulan=${p}`}
                        className={`hover:underline ${bulanDipilih === p ? 'text-brand-700 underline' : ''}`}
                        title={bulanDipilih === p ? 'Tampilkan semua bulan' : `Tampilkan RAB ${formatPeriod(p)} saja`}
                      >
                        {formatPeriodShort(p)}
                      </Link>
                      {p === kini && <span className="block text-[10px] font-normal normal-case text-brand-700">bulan ini</span>}
                    </th>
                  ))}
                  <th className="th num">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rekap.baris.map((b) => (
                  <tr key={b.kind}>
                    <td className="td whitespace-nowrap">
                      <Badge tone={jenisPerBarang(b.kind, perBarang) ? 'brand' : 'slate'}>{namaJenis(jenis, b.kind)}</Badge>
                    </td>
                    {rekap.bulan.map((p) => {
                      const sel = b.perBulan.get(p);
                      return (
                        <td
                          key={p}
                          className={`td num whitespace-nowrap ${p === kini ? 'bg-brand-50/60' : ''}`}
                          title={sel ? `${formatRupiah(sel.anggaran)} dari ${sel.jumlah} RAB` : undefined}
                        >
                          {sel ? (
                            <>
                              {formatRupiahShort(sel.anggaran)}
                              <span className="block text-[11px] text-slate-400">{sel.jumlah} RAB</span>
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="td num whitespace-nowrap font-medium">{formatRupiahShort(b.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 font-semibold">
                <tr>
                  <td className="td">Total</td>
                  {rekap.bulan.map((p) => (
                    <td key={p} className={`td num whitespace-nowrap ${p === kini ? 'bg-brand-50/60' : ''}`} title={formatRupiah(rekap.totalBulan.get(p) ?? 0)}>
                      {formatRupiahShort(rekap.totalBulan.get(p) ?? 0)}
                    </td>
                  ))}
                  <td className="td num whitespace-nowrap">{formatRupiahShort(rekap.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <Card className="card-pad min-w-0">
        <SectionTitle hint="Rincian anggaran diisi di dalam RAB — klik nama pemiliknya untuk membuka.">
          Daftar RAB
        </SectionTitle>
        {bulanDipilih && (
          <p className="mb-3 text-sm text-slate-600">
            Menampilkan RAB <strong>{formatPeriod(bulanDipilih)}</strong> saja, {daftar.length} RAB.{' '}
            <Link href="/rab" className="font-medium text-brand-700 hover:underline">Tampilkan semua bulan</Link>
          </p>
        )}

        {daftar.length === 0 ? (
          <EmptyState
            title="Belum ada RAB"
            description="Buat RAB pertama lewat tombol RAB baru di atas, lalu isi rinciannya — per barang untuk Purchasing, per akun untuk yang lain."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Pemilik</th>
                  <th className="th">Jenis</th>
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
                      {r.akunTumpang.length > 0 && (
                        <span className="mt-0.5 block text-xs text-amber-700">
                          {r.akunTumpang.length} akun juga dianggarkan di RAB lain
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <Badge tone={jenisPerBarang(r.kind, perBarang) ? 'brand' : 'slate'}>
                        {namaJenis(jenis, r.kind)}
                      </Badge>
                    </td>
                    <td className="td">
                      {formatPeriod(r.period)}
                      {r.period === kini && (
                        <span className="ml-2 text-xs font-medium text-brand-700">bulan ini</span>
                      )}
                    </td>
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
    </>
  );
}
