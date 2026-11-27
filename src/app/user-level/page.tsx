import Link from 'next/link';
import { prisma } from '@/lib/db';
import { KATALOG_HAK, LABEL_HAK, bacaHak } from '@/lib/hak-akses';
import { hakSaya } from '@/lib/hak-akses-server';
import { HapusUserLevel, TambahUserLevelDialog, UbahUserLevelDialog } from '@/components/user-level-form';
import { Alert, Badge, Card, PageHeader } from '@/components/ui';

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
        action={boleh ? <TambahUserLevelDialog /> : undefined}
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

      <div className="grid gap-4 lg:grid-cols-2">
          {levels.length === 0 ? (
            <Card className="card-pad">
              <p className="py-4 text-sm text-slate-500">
                Belum ada user level. Buat lewat tombol <strong>Tambah user level</strong>, misalnya <em>Staff Proyek</em> yang hanya
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
                <div className="mt-3 space-y-3">
                  {KATALOG_HAK.map((m) => {
                    const punya = m.hak.filter((h) => hak.includes(h.kode));
                    const subs = [...new Set(punya.map((h) => h.sub))];
                    return (
                      <div key={m.modul} className="text-xs">
                        <p className="mb-1 font-semibold uppercase tracking-wide text-slate-600">
                          {m.modul} <span className="font-normal normal-case text-slate-400">{punya.length}/{m.hak.length}</span>
                        </p>
                        {punya.length === 0 ? (
                          <p className="text-slate-400">tidak ada akses</p>
                        ) : subs.map((sub) => (
                          <p key={sub} className="flex flex-wrap items-center gap-1.5 py-0.5">
                            <span className="w-28 shrink-0 text-slate-500">{sub}</span>
                            {punya.filter((h) => h.sub === sub).map((h) => (
                              <Badge key={h.kode} tone="brand">{LABEL_HAK[h.kode]}</Badge>
                            ))}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
      </div>
    </>
  );
}
