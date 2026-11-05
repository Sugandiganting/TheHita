import Link from 'next/link';
import { prisma } from '@/lib/db';
import {
  FormKategori, FormSatuan, FormSubKategori, HapusKategori, HapusSatuan, HapusSubKategori,
} from '@/components/barang-form';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Kategori, sub kategori dan satuan — tiga daftar yang mengunci bentuk master
 * barang.
 *
 * Dipisah dari daftar barangnya karena beda irama: barang bertambah tiap
 * minggu, ketiga daftar ini hampir tidak pernah berubah setelah ditetapkan.
 * Menaruhnya di satu halaman membuat yang jarang berubah selalu menghalangi
 * yang sering.
 */
export default async function KlasifikasiPage() {
  const [satuan, kategori, sub] = await Promise.all([
    prisma.itemUnit.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, _count: { select: { items: true } } },
    }),
    prisma.itemCategory.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true,
                _count: { select: { items: true, subs: true } } },
    }),
    prisma.itemSubCategory.findMany({
      orderBy: [{ category: { code: 'asc' } }, { code: 'asc' }],
      select: { id: true, code: true, name: true,
                category: { select: { code: true, name: true } },
                _count: { select: { items: true } } },
    }),
  ]);

  const pilihanKategori = kategori.map((k) => ({ id: k.id, label: `${k.code} — ${k.name}` }));

  return (
    <>
      <PageHeader
        title="Klasifikasi Barang"
        description="Kategori, sub kategori dan satuan. Ketiganya mengunci bentuk master barang, jadi ditetapkan sekali lalu jarang disentuh lagi."
      />

      <p className="mb-6 text-sm text-slate-600">
        Daftar barangnya sendiri ada di{' '}
        <Link href="/logistik/barang" className="font-medium text-brand-600 hover:underline">
          Master Barang
        </Link>
        .
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-pad">
          <SectionTitle hint="Kategori menentukan keunikan kode barang: kode dan nama yang sama boleh dipakai lagi asal kategorinya berbeda. Itu yang memungkinkan satu barang didaftarkan terpisah untuk operasional dan untuk proyek, masing-masing dengan akun COA sendiri.">
            Kategori
          </SectionTitle>
          <div className="mt-3"><FormKategori /></div>

          <table className="mt-4 w-full">
            <thead className="border-b border-slate-200">
              <tr><th className="th">Kode</th><th className="th">Nama</th>
                  <th className="th num">Isi</th><th className="th">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kategori.length === 0 && (
                <tr><td className="td text-slate-500" colSpan={4}>Belum ada kategori.</td></tr>
              )}
              {kategori.map((k) => (
                <tr key={k.id}>
                  <td className="td font-mono">{k.code}</td>
                  <td className="td">{k.name}</td>
                  <td className="td num text-slate-500">
                    {k._count.items} barang
                    {k._count.subs > 0 && <span className="block text-[11px]">{k._count.subs} sub</span>}
                  </td>
                  <td className="td"><HapusKategori id={k.id} kode={k.code} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="card-pad">
          <SectionTitle hint="Satuan dipisah jadi daftar tersendiri supaya ejaannya tidak bercabang — kg, Kg dan kilogram pada tiga barang berbeda membuat rekapnya tidak bisa dijumlahkan.">
            Satuan
          </SectionTitle>
          <div className="mt-3"><FormSatuan /></div>

          <table className="mt-4 w-full">
            <thead className="border-b border-slate-200">
              <tr><th className="th">Kode</th><th className="th">Nama</th>
                  <th className="th num">Dipakai</th><th className="th">Aksi</th></tr>
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
                  <td className="td"><HapusSatuan id={s.id} kode={s.code} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="card-pad lg:col-span-2">
          <SectionTitle hint="Sub kategori selalu milik satu kategori, jadi kodenya hanya perlu unik di dalam kategorinya sendiri.">
            Sub Kategori
          </SectionTitle>
          <div className="mt-3"><FormSubKategori kategori={pilihanKategori} /></div>

          {kategori.length === 0 && (
            <p className="mt-3 text-sm text-amber-700">
              Buat kategori lebih dulu — sub kategori harus berada di dalam salah satunya.
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="border-b border-slate-200">
                <tr><th className="th">Kategori</th><th className="th">Kode</th>
                    <th className="th">Nama</th><th className="th num">Dipakai</th>
                    <th className="th">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sub.length === 0 && (
                  <tr><td className="td text-slate-500" colSpan={5}>Belum ada sub kategori.</td></tr>
                )}
                {sub.map((s) => (
                  <tr key={s.id}>
                    <td className="td text-slate-500">{s.category.code}</td>
                    <td className="td font-mono">{s.code}</td>
                    <td className="td">{s.name}</td>
                    <td className="td num text-slate-500">{s._count.items} barang</td>
                    <td className="td"><HapusSubKategori id={s.id} kode={s.code} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
