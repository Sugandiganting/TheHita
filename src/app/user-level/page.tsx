import Link from 'next/link';
import { prisma } from '@/lib/db';
import { KATALOG_HAK, LABEL_HAK, bacaHak } from '@/lib/hak-akses';
import { hakSaya } from '@/lib/hak-akses-server';
import { HapusUserLevel, UbahUserLevelDialog, UserLevelForm } from '@/components/user-level-form';
import { Alert, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Master data user level: kumpulan hak akses yang diberikan kepada pengguna.
 * Untuk sekarang mengatur menu Proyek dan pengelolaan pengguna.
 */
export default async function UserLevelPage() {
  const boleh = (await hakSaya()).has('pengguna.kelola');
  const [levels, tanpaLevel] = await Promise.all([
    prisma.userLevel.findMany({
      orderBy: { name: 'asc' },
      include: { users: { select: { name: true, active: true }, orderBy: { name: 'asc' } } },
    }),
    prisma.user.count({ where: { levelId: null, active: true } }),
  ]);
  const jumlahHak = KATALOG_HAK.reduce((t, m) => t + m.hak.length, 0);

  return (
    <>
      <PageHeader
        title="User Level"
        description="Hak akses tiap kelompok pengguna. Pasang levelnya ke pengguna di menu Pengguna."
      />

      {!boleh && (
        <div className="mb-6">
          <Alert tone="warning">
            User level Anda tidak punya hak &ldquo;Kelola pengguna &amp; user level&rdquo;, jadi halaman ini hanya bisa dilihat.
          </Alert>
        </div>
      )}

      {tanpaLevel > 0 && (
        <div className="mb-6">
          <Alert tone="info">
            {tanpaLevel} pengguna aktif belum diberi level dan untuk sementara berakses penuh. Pasang levelnya di{' '}
            <Link href="/pengguna" className="font-medium underline">menu Pengguna</Link>.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {levels.length === 0 ? (
            <Card className="card-pad">
              <p className="py-4 text-sm text-slate-500">
                Belum ada user level. Buat lewat formulir di samping, misalnya <em>Staff Proyek</em> yang hanya
                boleh menyusun dan mengajukan, <em>Manajer</em> yang menyetujui rencana, dan <em>Direktur</em> yang
                menyetujui dana.
              </p>
            </Card>
          ) : levels.map((l) => {
            const hak = bacaHak(l.permissions);
            const aktif = l.users.filter((u) => u.active);
            return (
              <Card key={l.id} className="card-pad">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium text-slate-900">{l.name}</h2>
                    {l.description && <p className="text-sm text-slate-500">{l.description}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      {hak.length} dari {jumlahHak} hak ·{' '}
                      {aktif.length === 0 ? 'belum dipakai pengguna' : `${aktif.length} pengguna: ${aktif.map((u) => u.name).join(', ')}`}
                    </p>
                  </div>
                  {boleh && (
                    <span className="flex items-center gap-3">
                      <UbahUserLevelDialog nilai={{ id: l.id, name: l.name, description: l.description, hak }} />
                      <HapusUserLevel id={l.id} nama={l.name} />
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {KATALOG_HAK.map((m) => {
                    const punya = m.hak.filter((h) => hak.includes(h.kode));
                    return (
                      <p key={m.modul} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="w-20 shrink-0 font-medium text-slate-600">{m.modul}</span>
                        {punya.length === 0
                          ? <span className="text-slate-400">tidak ada akses</span>
                          : punya.map((h) => <Badge key={h.kode} tone="brand">{LABEL_HAK[h.kode]}</Badge>)}
                      </p>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        {boleh && (
          <div className="min-w-0">
            <Card className="card-pad">
              <SectionTitle hint="Centang apa saja yang boleh dilakukan pengguna di level ini.">
                Tambah user level
              </SectionTitle>
              <div className="mt-3">
                <UserLevelForm />
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
