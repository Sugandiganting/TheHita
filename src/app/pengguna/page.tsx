import { prisma } from '@/lib/db';
import { sesiSekarang } from '@/lib/sesi-server';
import { formatDate } from '@/lib/format';
import { FormTambahPengguna, SetelAktif, SetelSandi } from '@/components/pengguna-form';
import { Alert, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Daftar pengguna dan penambahannya.
 *
 * Sampai ada pembedaan hak akses, tiap orang yang bisa masuk memegang seluruh
 * kewenangan — termasuk membuat akun baru. Itu disebut terang-terangan di
 * layar, bukan disimpan di komentar kode: yang menanggung akibatnya adalah
 * orang yang memberi akses, dan ia perlu tahu apa yang sedang diberikannya.
 */
export default async function PenggunaPage() {
  const sesi = await sesiSekarang();
  const daftar = await prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { username: 'asc' }],
    select: { id: true, username: true, name: true, active: true, lastLogin: true, createdAt: true },
  });
  const aktif = daftar.filter((u) => u.active).length;

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Siapa saja yang bisa masuk ke sistem ini."
      />

      <Alert tone="warning" title="Semua pengguna punya akses penuh">
        Belum ada pembedaan hak akses: setiap orang yang bisa masuk dapat melihat seluruh angka
        keuangan, mengubahnya, dan menambah pengguna baru — termasuk untuk dirinya sendiri.
        Jadi menambah satu orang di sini sama dengan menyerahkan seluruh pembukuan kepadanya.
        Tambahkan hanya orang yang memang berhak atas semuanya.
      </Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="card-pad">
            <SectionTitle hint={`${aktif} aktif dari ${daftar.length} akun. Akun tidak dihapus, hanya dinonaktifkan — riwayat siapa mengerjakan apa tetap bisa ditelusuri.`}>
              Daftar pengguna
            </SectionTitle>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="th">Nama</th>
                    <th className="th">Nama pengguna</th>
                    <th className="th">Masuk terakhir</th>
                    <th className="th">Status</th>
                    <th className="th">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {daftar.map((u) => (
                    <tr key={u.id} className={u.active ? '' : 'bg-slate-50/60'}>
                      <td className="td font-medium">{u.name}</td>
                      <td className="td font-mono text-slate-600">{u.username}</td>
                      <td className="td text-slate-500">
                        {u.lastLogin ? formatDate(u.lastLogin) : 'belum pernah'}
                      </td>
                      <td className="td">
                        <Badge tone={u.active ? 'brand' : 'amber'}>
                          {u.active ? 'aktif' : 'nonaktif'}
                        </Badge>
                      </td>
                      <td className="td">
                        <div className="flex flex-col gap-1">
                          <SetelAktif
                            id={u.id}
                            username={u.username}
                            aktif={u.active}
                            diriSendiri={u.id === sesi?.id}
                          />
                          {u.active && <SetelSandi id={u.id} username={u.username} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="min-w-0">
          <Card className="card-pad">
            <SectionTitle hint="Nama pengguna tidak bisa diubah setelah dibuat.">
              Tambah pengguna
            </SectionTitle>
            <div className="mt-3">
              <FormTambahPengguna />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
