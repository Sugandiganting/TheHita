import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ProjectForm } from '@/components/project-form';
import { Alert, Card, PageHeader } from '@/components/ui';
import { hakSaya } from '@/lib/hak-akses-server';
import { CABANG_SAJA } from '@/lib/penampung-master';

export const dynamic = 'force-dynamic';

export default async function ProyekBaruPage() {
  const units = await prisma.businessUnit.findMany({ where: CABANG_SAJA, orderBy: { code: 'asc' } });
  const boleh = (await hakSaya()).has('proyek.kelola');

  return (
    <>
      <PageHeader
        title="Proyek baru"
        description="Isi rencana proyek. Rincian jadwal pembayaran ditambahkan setelah proyek disimpan."
      />
      <p className="mb-4 text-sm">
        <Link href="/proyek" className="text-slate-600 hover:underline">← Kembali ke daftar proyek</Link>
      </p>
      {boleh ? (
        <Card className="card-pad max-w-3xl">
          <ProjectForm units={units} />
        </Card>
      ) : (
        <Alert tone="warning">
          User level Anda tidak punya hak &ldquo;Buat &amp; ubah proyek&rdquo;, jadi tidak bisa membuat proyek baru.
        </Alert>
      )}
    </>
  );
}
