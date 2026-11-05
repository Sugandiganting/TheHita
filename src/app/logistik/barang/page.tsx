import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AktifItem, FormItem } from '@/components/barang-form';
import { SaringKategori } from '@/components/barang-saring';
import { Alert, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Master barang.
 *
 * Tiap barang membawa akun COA-nya sendiri, jadi penyusun RAB cukup memilih
 * barangnya dan akuntansinya mengikuti — tidak ada yang perlu menghafal nomor
 * akun. Itu juga sebabnya akun di sini wajib diisi.
 *
 * Formulirnya di atas, daftarnya di bawah, keduanya selebar halaman. Menaruh
 * formulir di kolom samping memang menghemat satu gulir, tetapi memotong lebar
 * daftarnya — dan daftar inilah yang punya enam kolom dan akan terus bertambah
 * panjang, sedangkan formulirnya hanya dipakai sebentar tiap kali.
 */
export default async function BarangPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const cariKategori = one(params.kategori) ?? '';
  const cari = (one(params.cari) ?? '').trim();

  const [kategori, sub, satuan, akun, barang] = await Promise.all([
    prisma.itemCategory.findMany({ where: { active: true }, orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true } }),
    prisma.itemSubCategory.findMany({ where: { active: true }, orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, categoryId: true } }),
    prisma.itemUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true } }),
    prisma.account.findMany({
      where: {
        isHeader: false, active: true,
        OR: [
          { type: { in: ['EXPENSE', 'COGS'] } },
          // Aset: hanya persediaan dan aset tetap. Piutang dan kas tidak pernah
          // menjadi akun sebuah barang — menawarkannya hanya menambah pilihan
          // yang salah di daftar yang harus ditelusuri seseorang.
          { type: 'ASSET', subtype: { in: ['INVENTORY', 'FIXED_ASSET'] } },
        ],
      },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.item.findMany({
      where: {
        ...(cariKategori ? { categoryId: cariKategori } : {}),
        ...(cari ? { OR: [{ code: { contains: cari } }, { name: { contains: cari } }] } : {}),
      },
      orderBy: [{ active: 'desc' }, { category: { code: 'asc' } }, { code: 'asc' }],
      select: {
        id: true, code: true, name: true, active: true,
        category: { select: { code: true, name: true } },
        subCategory: { select: { code: true } },
        unit: { select: { code: true } },
        account: { select: { code: true, name: true } },
      },
    }),
  ]);

  const siap = kategori.length > 0 && satuan.length > 0;

  return (
    <>
      <PageHeader
        title="Master Barang"
        description="Daftar barang yang dibeli, lengkap dengan satuan dan akun COA-nya. Dipakai menyusun RAB Purchasing, dan nanti oleh Receiving serta Issuing."
      />

      {!siap && (
        <Alert tone="warning" title="Klasifikasinya belum siap">
          Barang membutuhkan kategori dan satuan sebelum bisa didaftarkan.
          {kategori.length === 0 && (
            <>
              {' '}Belum ada kategori —{' '}
              <Link href="/logistik/kategori" className="font-medium underline">buat di Kategori Barang</Link>.
            </>
          )}
          {satuan.length === 0 && (
            <>
              {' '}Belum ada satuan —{' '}
              <Link href="/logistik/satuan" className="font-medium underline">buat di Satuan Barang</Link>.
            </>
          )}
        </Alert>
      )}

      <Card className="card-pad mt-6">
        <SectionTitle hint="Kode dirapikan sendiri jadi huruf besar tanpa spasi, supaya satu barang tidak terdaftar dua kali karena beda cara mengetik. Semua pilihan bisa dicari — ketik nomor akun atau namanya.">
          Tambah barang
        </SectionTitle>
        <div className="mt-3">
          {siap ? (
            <FormItem kategori={kategori} sub={sub} satuan={satuan} akun={akun} />
          ) : (
            <p className="text-sm text-slate-500">
              Tersedia setelah kategori dan satuan dibuat.
            </p>
          )}
        </div>
      </Card>

      <Card className="card-pad mt-6">
        <SectionTitle hint={`${barang.length} barang ditampilkan. Barang tidak dihapus, hanya dinonaktifkan — RAB bulan-bulan lalu tetap bisa menyebut barang yang sudah tidak dibeli lagi.`}>
          Daftar barang
        </SectionTitle>

        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="label" htmlFor="f-cari">Cari kode atau nama</label>
            <input id="f-cari" name="cari" className="input" defaultValue={cari} placeholder="chemical" />
          </div>
          <div className="min-w-[14rem]">
            <label className="label" htmlFor="f-kat">Kategori</label>
            <SaringKategori kategori={kategori} terpilih={cariKategori} />
          </div>
          <button type="submit" className="btn-primary">Tampilkan</button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Kode</th>
                <th className="th">Nama</th>
                <th className="th">Kategori</th>
                <th className="th">Satuan</th>
                <th className="th">Akun COA</th>
                <th className="th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {barang.length === 0 && (
                <tr>
                  <td className="td text-slate-500" colSpan={6}>
                    {cari || cariKategori ? 'Tidak ada yang cocok dengan saringan ini.' : 'Belum ada barang.'}
                  </td>
                </tr>
              )}
              {barang.map((b) => (
                <tr key={b.id} className={b.active ? '' : 'bg-slate-50/60'}>
                  <td className="td font-mono">{b.code}</td>
                  <td className="td">
                    {b.name}
                    {!b.active && <Badge tone="amber">nonaktif</Badge>}
                  </td>
                  <td className="td text-slate-600">
                    {b.category.code}
                    {b.subCategory && (
                      <span className="block text-[11px] text-slate-400">{b.subCategory.code}</span>
                    )}
                  </td>
                  <td className="td text-slate-500">{b.unit.code}</td>
                  <td className="td text-slate-600">
                    <span className="font-mono text-xs">{b.account.code}</span>
                    <span className="block text-[11px] text-slate-400">{b.account.name}</span>
                  </td>
                  <td className="td"><AktifItem id={b.id} kode={b.code} aktif={b.active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          {kategori.length} kategori · {sub.length} sub kategori · {satuan.length} satuan —
          dikelola di{' '}
          <Link href="/logistik/kategori" className="font-medium text-brand-600 hover:underline">Kategori</Link>,{' '}
          <Link href="/logistik/sub-kategori" className="font-medium text-brand-600 hover:underline">Sub Kategori</Link>, dan{' '}
          <Link href="/logistik/satuan" className="font-medium text-brand-600 hover:underline">Satuan</Link>.
        </p>
      </Card>
    </>
  );
}
