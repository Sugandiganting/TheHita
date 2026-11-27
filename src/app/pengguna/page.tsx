import { prisma } from '@/lib/db';
import { sesiSekarang } from '@/lib/sesi-server';
import { formatDate } from '@/lib/format';
import { FormTambahPengguna, SetelAktif, SetelSandi } from '@/components/pengguna-form';
import { SetelLevel } from '@/components/user-level-form';
import { hakMenuMaster } from '@/lib/hak-akses-server';
import { TanpaAkses } from '@/components/tanpa-akses';
import Link from 'next/link';
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
  const hak = await hakMenuMaster('pengguna');
  if (!hak.lihat) return <TanpaAkses nama="Pengguna" />;
  const [daftar, levels] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: 'desc' }, { username: 'asc' }],
      select: {
        id: true, username: true, name: true, active: true, lastLogin: true, createdAt: true,
        levelId: true, level: { select: { name: true } },
      },
    }),
    prisma.userLevel.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const aktif = daftar.filter((u) => u.active).length;
  const tanpaLevel = daftar.filter((u) => u.active && !u.levelId).length;

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Siapa saja yang bisa masuk ke sistem ini."
      />

      {tanpaLevel > 0 ? (
        <Alert tone="warning" title={`${tanpaLevel} pengguna aktif belum diberi user level`}>
          Pengguna tanpa level berakses penuh: bisa menyetujui proyek di semua tahap dan mengubah
          seluruh Master Data. Pasang levelnya di kolom <strong>User level</strong>; hak tiap level diatur di{' '}
          <Link href="/user-level" className="font-medium underline">Master Data › User Level</Link>.
          Hak akses saat ini mengatur menu Proyek dan Master Data; menu lain masih terbuka untuk
          semua pengguna yang bisa masuk.
        </Alert>
      ) : (
        <Alert tone="info">
          Hak akses mengikuti user level masing-masing (atur di{' '}
          <Link href="/user-level" className="font-medium underline">Master Data › User Level</Link>).
          Saat ini yang diatur adalah menu Proyek dan Master Data; menu lain masih terbuka untuk semua
          pengguna yang bisa masuk.
        </Alert>
      )}

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
                    <th className="th">User level</th>
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
                      <td className="td min-w-[180px]">
                        {hak.ubah && u.active ? (
                          <SetelLevel id={u.id} levelId={u.levelId} levels={levels} />
                        ) : (
                          <span className="text-sm text-slate-600">{u.level?.name ?? 'Tanpa level (akses penuh)'}</span>
                        )}
                      </td>
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
                          {/* Menonaktifkan = hak Hapus; mengaktifkan lagi dan setel sandi = hak Ubah. */}
                          {(u.active ? hak.hapus : hak.ubah) && (
                            <SetelAktif
                              id={u.id}
                              username={u.username}
                              aktif={u.active}
                              diriSendiri={u.id === sesi?.id}
                            />
                          )}
                          {u.active && hak.ubah && <SetelSandi id={u.id} username={u.username} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {hak.tambah && (
          <div className="min-w-0">
            <Card className="card-pad">
              <SectionTitle hint="Nama pengguna tidak bisa diubah setelah dibuat.">
                Tambah pengguna
              </SectionTitle>
              <div className="mt-3">
                <FormTambahPengguna levels={levels} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
