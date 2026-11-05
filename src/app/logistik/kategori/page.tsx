import Link from 'next/link';
import { prisma } from '@/lib/db';
import { HapusKategori } from '@/components/barang-form';
import { TambahKategoriDialog } from '@/components/barang-dialog';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Kategori barang.
 *
 * Kategori bukan sekadar label: ia yang mengunci keunikan sebuah barang. Kode
 * dan nama yang sama boleh dipakai lagi asal kategorinya berbeda, dan itulah
 * yang memungkinkan satu barang didaftarkan terpisah untuk operasional dan
 * untuk proyek, masing-masing dengan akun COA sendiri.
 */
export default async function KategoriBarangPage() {
  const kategori = await prisma.itemCategory.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, _count: { select: { items: true, subs: true } } },
  });

  return (
    <>
      <PageHeader
        title="Kategori Barang"
        description="Kategori mengunci keunikan barang: kode dan nama yang sama boleh dipakai lagi asal kategorinya berbeda. Ditetapkan sekali, lalu jarang disentuh lagi."
        action={<TambahKategoriDialog />}
      />

      <Card className="card-pad">
        <SectionTitle hint="Kategori yang sudah dipakai barang tidak bisa dihapus — barangnya akan kehilangan tempatnya.">
          Daftar kategori
        </SectionTitle>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Kode</th>
                <th className="th">Nama</th>
                <th className="th num">Barang</th>
                <th className="th num">Sub kategori</th>
                <th className="th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kategori.length === 0 && (
                <tr><td className="td text-slate-500" colSpan={5}>Belum ada kategori.</td></tr>
              )}
              {kategori.map((k) => (
                <tr key={k.id}>
                  <td className="td font-mono">{k.code}</td>
                  <td className="td">{k.name}</td>
                  <td className="td num text-slate-500">{k._count.items}</td>
                  <td className="td num text-slate-500">{k._count.subs}</td>
                  <td className="td"><HapusKategori id={k.id} kode={k.code} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Lihat juga{' '}
          <Link href="/logistik/sub-kategori" className="font-medium text-brand-600 hover:underline">Sub Kategori</Link>,{' '}
          <Link href="/logistik/satuan" className="font-medium text-brand-600 hover:underline">Satuan</Link>, dan{' '}
          <Link href="/logistik/barang" className="font-medium text-brand-600 hover:underline">Master Barang</Link>.
        </p>
      </Card>
    </>
  );
}
