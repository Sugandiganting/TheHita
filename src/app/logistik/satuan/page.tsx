import Link from 'next/link';
import { prisma } from '@/lib/db';
import { HapusSatuan } from '@/components/barang-form';
import { TambahSatuanDialog, UbahSatuanDialog } from '@/components/barang-dialog';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Satuan barang.
 *
 * Dibuat jadi daftar tersendiri supaya ejaannya tidak bercabang — kg, Kg dan
 * kilogram pada tiga barang berbeda membuat rekap pemakaiannya tidak bisa
 * dijumlahkan, dan selisih semacam itu tidak terlihat sampai seseorang
 * mencoba menjumlahkannya.
 */
export default async function SatuanBarangPage() {
  const satuan = await prisma.itemUnit.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, _count: { select: { items: true } } },
  });

  return (
    <>
      <PageHeader
        title="Satuan Barang"
        description="Satuan yang dipakai master barang — sak, liter, kilogram. Satu ejaan untuk satu satuan, supaya pemakaiannya bisa dijumlahkan."
        action={<TambahSatuanDialog />}
      />

      <Card className="card-pad">
        <SectionTitle hint="Satuan yang sudah dipakai barang tidak bisa dihapus, tetapi namanya tetap boleh diubah.">
          Daftar satuan
        </SectionTitle>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[460px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Kode</th>
                <th className="th">Nama</th>
                <th className="th num">Dipakai</th>
                <th className="th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {satuan.length === 0 && (
                <tr><td className="td text-slate-500" colSpan={4}>Belum ada satuan.</td></tr>
              )}
              {satuan.map((s) => (
                <tr key={s.id}>
                  <td className="td font-mono">{s.code}</td>
                  <td className="td">{s.name}</td>
                  <td className="td num text-slate-500">{s._count.items} barang</td>
                  <td className="td">
                    <span className="flex items-center gap-3">
                      <UbahSatuanDialog nilai={{ id: s.id, code: s.code, name: s.name }} />
                      <HapusSatuan id={s.id} kode={s.code} dipakai={s._count.items} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Lihat juga{' '}
          <Link href="/logistik/kategori" className="font-medium text-brand-600 hover:underline">Kategori</Link>,{' '}
          <Link href="/logistik/sub-kategori" className="font-medium text-brand-600 hover:underline">Sub Kategori</Link>, dan{' '}
          <Link href="/logistik/barang" className="font-medium text-brand-600 hover:underline">Master Barang</Link>.
        </p>
      </Card>
    </>
  );
}
