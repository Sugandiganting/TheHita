import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { sesiSekarang } from '@/lib/sesi-server';
import { FormMasuk } from '@/components/masuk-form';
import type { SearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Masuk — The Hita Finance' };

export default async function MasukPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Yang sudah masuk tidak perlu melihat halaman ini lagi.
  if (await sesiSekarang()) redirect('/');

  // Salinan yang baru dipasang belum punya pengguna sama sekali. Tanpa
  // keterangan ini, layarnya hanya meminta kata sandi yang memang belum pernah
  // ada, dan tidak ada petunjuk apa pun tentang cara membuatnya.
  const belumAdaPengguna = (await prisma.user.count()) === 0;

  const params = await searchParams;
  const lanjutMentah = params.lanjut;
  const lanjut = typeof lanjutMentah === 'string' && lanjutMentah.startsWith('/') ? lanjutMentah : '/';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            H
          </span>
          <h1 className="mt-3 text-xl font-semibold text-slate-800">The Hita Finance</h1>
          <p className="text-sm text-slate-500">Akuntansi &amp; Peramalan Kas</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {belumAdaPengguna ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-medium text-slate-800">Belum ada pengguna.</p>
              <p>Buat yang pertama dari server, lalu muat ulang halaman ini:</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
npm run pengguna -- tambah admin &quot;Nama Anda&quot;
              </pre>
              <p className="text-xs text-slate-500">
                Kata sandinya dibuatkan acak dan ditampilkan satu kali saja.
              </p>
            </div>
          ) : (
            <FormMasuk lanjut={lanjut} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Halaman ini hanya untuk pengurus The Hita Hospitality Group.
        </p>
      </div>
    </div>
  );
}
