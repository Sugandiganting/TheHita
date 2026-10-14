import { sesiSekarang } from '@/lib/sesi-server';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { FormKataSandi, UnduhCadangan } from '@/components/akun-form';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AkunPage() {
  const sesi = await sesiSekarang();
  const pengguna = sesi ? await prisma.user.findUnique({ where: { id: sesi.id } }) : null;
  const jumlah = await prisma.user.count({ where: { active: true } });

  return (
    <>
      <PageHeader title="Akun" description="Identitas Anda di sistem ini dan salinan basis datanya." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-pad">
          <SectionTitle>Pengguna</SectionTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Nama</dt>
              <dd className="font-medium text-slate-800">{pengguna?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Nama pengguna</dt>
              <dd className="font-mono text-slate-800">{pengguna?.username ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Masuk terakhir</dt>
              <dd className="text-slate-800">
                {pengguna?.lastLogin ? formatDate(pengguna.lastLogin) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Pengguna aktif</dt>
              <dd className="text-slate-800">{jumlah} orang</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Pengguna baru ditambahkan dari server dengan perintah{' '}
            <code className="rounded bg-slate-100 px-1">npm run pengguna</code>.
          </p>
        </Card>

        <Card className="card-pad">
          <SectionTitle hint="Mengganti kata sandi tidak memutus sesi yang sedang berjalan di perangkat lain.">
            Ganti kata sandi
          </SectionTitle>
          <FormKataSandi />
        </Card>

        <Card className="card-pad lg:col-span-2">
          <SectionTitle hint="Salinan diambil dengan cara yang aman meski sistem sedang dipakai.">
            Cadangan basis data
          </SectionTitle>
          <p className="mb-4 text-sm text-slate-600">
            Seluruh isi sistem ini ada di dalam satu berkas. Itu membuatnya mudah disalin — dan juga
            berarti satu berkas yang bisa hilang. Server sudah menyalinnya tiap malam, tetapi
            salinan yang ada di tangan Anda sendiri adalah satu-satunya yang selamat kalau servernya
            yang bermasalah.
          </p>
          <UnduhCadangan />
        </Card>
      </div>
    </>
  );
}
