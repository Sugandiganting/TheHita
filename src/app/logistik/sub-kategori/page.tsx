import Link from 'next/link';
import { prisma } from '@/lib/db';
import { HapusSubKategori } from '@/components/barang-form';
import { TambahSubKategoriDialog } from '@/components/barang-dialog';
import { Alert, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Sub kategori barang.
 *
 * Selalu milik satu kategori, jadi kodenya hanya perlu unik di dalam
 * kategorinya sendiri — "CHEM" boleh ada di operasional dan di proyek.
 */
export default async function SubKategoriBarangPage() {
  const [kategori, sub] = await Promise.all([
    prisma.itemCategory.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.itemSubCategory.findMany({
      orderBy: [{ category: { code: 'asc' } }, { code: 'asc' }],
      select: {
        id: true, code: true, name: true,
        category: { select: { code: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Sub Kategori Barang"
        description="Perincian di dalam sebuah kategori. Kodenya hanya perlu unik di dalam kategorinya sendiri, jadi nama yang sama boleh dipakai di kategori lain."
        action={<TambahSubKategoriDialog kategori={kategori} />}
      />

      {kategori.length === 0 && (
        <Alert tone="warning" title="Belum ada kategori">
          Sub kategori harus berada di dalam salah satu kategori.{' '}
          <Link href="/logistik/kategori" className="font-medium underline">Buat kategori lebih dulu</Link>.
        </Alert>
      )}

      <Card className={kategori.length === 0 ? 'card-pad mt-6' : 'card-pad'}>
        <SectionTitle hint="Sub kategori yang sudah dipakai barang tidak bisa dihapus.">
          Daftar sub kategori
        </SectionTitle>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Kategori</th>
                <th className="th">Kode</th>
                <th className="th">Nama</th>
                <th className="th num">Dipakai</th>
                <th className="th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sub.length === 0 && (
                <tr><td className="td text-slate-500" colSpan={5}>Belum ada sub kategori.</td></tr>
              )}
              {sub.map((s) => (
                <tr key={s.id}>
                  <td className="td text-slate-600">
                    <span className="font-mono text-xs">{s.category.code}</span>
                    <span className="block text-[11px] text-slate-400">{s.category.name}</span>
                  </td>
                  <td className="td font-mono">{s.code}</td>
                  <td className="td">{s.name}</td>
                  <td className="td num text-slate-500">{s._count.items} barang</td>
                  <td className="td"><HapusSubKategori id={s.id} kode={s.code} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Lihat juga{' '}
          <Link href="/logistik/kategori" className="font-medium text-brand-600 hover:underline">Kategori</Link>,{' '}
          <Link href="/logistik/satuan" className="font-medium text-brand-600 hover:underline">Satuan</Link>, dan{' '}
          <Link href="/logistik/barang" className="font-medium text-brand-600 hover:underline">Master Barang</Link>.
        </p>
      </Card>
    </>
  );
}
