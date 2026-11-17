import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getJenisRab } from '@/lib/queries';
import { currentPeriod } from '@/lib/period';
import { formatPeriod } from '@/lib/format';
import { HapusJenisRab } from '@/components/budget-actions';
import { TambahJenisRabDialog, UbahJenisRabDialog } from '@/components/budget-dialog';
import { Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Jenis RAB: Purchasing, Umum, dan yang ditambahkan sendiri — HR, Management.
 *
 * Jenis menentukan dua hal: RAB mana yang boleh dimiliki satu cabang dalam
 * sebulan (satu tiap jenis), dan kategori rencana kas mana yang mengambil
 * jatahnya dari situ. Kategori "Gaji" yang ditautkan ke jenis HR, misalnya,
 * mengambil jatahnya dari seluruh RAB HR bulan itu.
 */
export default async function JenisRabPage() {
  const kini = currentPeriod();
  const [jenis, rab, kategori, tautanKini] = await Promise.all([
    getJenisRab(),
    prisma.budget.groupBy({ by: ['kind'], _count: { _all: true } }),
    prisma.spendCategory.groupBy({ by: ['rabKind'], _count: { _all: true } }),
    // Kategori Rencana Kas bulan berjalan yang jatahnya diambil dari tiap jenis.
    prisma.spendCategory.findMany({
      where: { rabKind: { not: null }, plan: { period: kini } },
      select: { label: true, rabKind: true },
    }),
  ]);
  const jumlahRab = new Map(rab.map((r) => [r.kind, r._count._all]));
  const jumlahKategori = new Map(kategori.map((k) => [k.rabKind, k._count._all]));
  const kategoriKini = new Map<string, string[]>();
  for (const k of tautanKini) kategoriKini.set(k.rabKind!, [...(kategoriKini.get(k.rabKind!) ?? []), k.label]);

  return (
    <>
      <PageHeader
        title="Jenis RAB"
        description="Pengelompokan RAB menurut pemegang anggarannya: Purchasing, HR, Management. Satu cabang boleh punya satu RAB tiap jenis dalam sebulan."
        action={<TambahJenisRabDialog />}
      />

      <Card className="card-pad">
        <SectionTitle hint="Nama boleh diganti kapan saja; RAB dan kategori rencana kas yang memakainya ikut berganti nama. Jenis yang sudah dipakai tidak bisa dihapus.">
          Daftar jenis
        </SectionTitle>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Nama</th>
                <th className="th">Kode</th>
                <th className="th">Diisi</th>
                <th className="th">Rencana Kas {formatPeriod(kini)}</th>
                <th className="th num">Dipakai</th>
                <th className="th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jenis.map((j) => {
                const nRab = jumlahRab.get(j.code) ?? 0;
                const nKategori = jumlahKategori.get(j.code) ?? 0;
                return (
                  <tr key={j.code}>
                    <td className="td font-medium text-slate-900">
                      {j.name}
                      {j.bawaan && <span className="ml-2 text-xs font-normal text-slate-500">bawaan</span>}
                    </td>
                    <td className="td font-mono text-xs text-slate-500">{j.code}</td>
                    <td className="td">
                      <Badge tone={j.perBarang ? 'brand' : 'slate'}>{j.perBarang ? 'per barang' : 'per akun'}</Badge>
                    </td>
                    <td className="td text-sm">
                      {kategoriKini.has(j.code)
                        ? <span className="text-brand-700">jatah {kategoriKini.get(j.code)!.join(', ')}</span>
                        : <span className="text-xs text-slate-400">belum ditautkan</span>}
                    </td>
                    <td className="td num text-slate-500">{nRab} RAB</td>
                    <td className="td">
                      <span className="flex items-center gap-3">
                        <UbahJenisRabDialog nilai={{ code: j.code, name: j.name }} />
                        {!j.bawaan && (
                          <HapusJenisRab code={j.code} nama={j.name} dipakai={nRab + nKategori} />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Kategori di{' '}
          <Link href="/rencana-kas" className="font-medium text-brand-600 hover:underline">Rencana Kas Mingguan</Link>{' '}
          ditautkan ke sebuah jenis lewat pilihan sumber jatah di bawah nama kategorinya; jatahnya
          lalu diambil dari total seluruh RAB jenis itu bulan tersebut. RAB yang sudah ada bisa dipindah jenisnya lewat tombol <strong>Ganti jenis</strong> di
          halaman RAB-nya, selama masih draf. Lihat{' '}
          <Link href="/rab" className="font-medium text-brand-600 hover:underline">Input RAB</Link>.
        </p>
      </Card>
    </>
  );
}
