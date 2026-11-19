import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ProjectForm } from '@/components/project-form';
import { Card, PageHeader } from '@/components/ui';
import { CABANG_SAJA } from '@/lib/penampung-master';

export const dynamic = 'force-dynamic';

export default async function ProyekBaruPage() {
  const units = await prisma.businessUnit.findMany({ where: CABANG_SAJA, orderBy: { code: 'asc' } });

  return (
    <>
      <PageHeader
        title="Proyek baru"
        description="Isi rencana proyek. Rincian jadwal pembayaran ditambahkan setelah proyek disimpan."
      />
      <p className="mb-4 text-sm">
        <Link href="/proyek" className="text-slate-600 hover:underline">← Kembali ke daftar proyek</Link>
      </p>
      <Card className="card-pad max-w-3xl">
        <ProjectForm units={units} />
      </Card>
    </>
  );
}
