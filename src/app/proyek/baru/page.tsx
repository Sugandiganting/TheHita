import { prisma } from '@/lib/db';
import { ProjectForm } from '@/components/project-form';
import { Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ProyekBaruPage() {
  const units = await prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' } });

  return (
    <>
      <PageHeader
        title="Proyek baru"
        description="Isi rencana proyek. Rincian jadwal pembayaran ditambahkan setelah proyek disimpan."
      />
      <Card className="card-pad max-w-3xl">
        <ProjectForm units={units} />
      </Card>
    </>
  );
}
