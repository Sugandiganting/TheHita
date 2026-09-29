import { prisma } from '@/lib/db';
import { ImportWizard } from '@/components/import-wizard';
import { Alert, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ImporPage() {
  const [units, accounts] = await Promise.all([
    prisma.businessUnit.findMany({ where: { active: true }, orderBy: { code: 'asc' }, select: { code: true, name: true } }),
    prisma.account.findMany({ where: { active: true, isHeader: false }, select: { code: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Impor dari GuestPro"
        description="Memasukkan transaksi dari ekspor PMS. Nomor akun GuestPro diterjemahkan otomatis ke COA baru, dan penanda cabang pada nomor akun dipakai untuk menentukan unit usahanya."
      />

      <div className="mb-6">
        <Alert tone="info" title="Cara menyiapkan berkas">
          Ekspor laporan <strong>jurnal</strong> atau <strong>buku besar</strong> dari GuestPro. Bila hasilnya
          berupa berkas <code>.xls</code> lama, buka di Excel atau Numbers lalu <strong>File → Save As → CSV</strong>.
          Berkas perlu memuat setidaknya kolom tanggal, nomor akun, serta debit dan kredit.
        </Alert>
      </div>

      <ImportWizard units={units} accountCodes={accounts.map((a) => a.code)} />

      <Card className="card-pad mt-6">
        <SectionTitle>Yang terjadi saat impor</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Nomor akun lama diterjemahkan memakai tabel padanan — misalnya <code>6120.03-10</code> dan{' '}
            <code>612.01</code> sama-sama menjadi <code>6120.01 Biaya Listrik</code>.
          </li>
          <li>
            Akhiran <code>-10</code> dan <code>-30</code> serta awalan <code>TH -</code>, <code>SK -</code>,{' '}
            <code>IGYT -</code> dipakai menentukan cabang, sehingga kolom cabang tidak wajib ada di berkas.
          </li>
          <li>Baris dikelompokkan menjadi satu bukti berdasarkan nomor bukti; bila tidak ada, memakai tanggal dan keterangan.</li>
          <li>Bukti yang menyentuh lebih dari satu cabang otomatis dilengkapi baris Piutang dan Hutang Antar Unit.</li>
          <li>Hanya bukti yang seimbang yang disimpan. Sisanya dilaporkan agar bisa Anda perbaiki di berkas asal.</li>
          <li>Bukti yang sudah pernah diimpor dikenali dan dilewati, sehingga berkas yang sama tidak masuk dua kali.</li>
        </ul>
      </Card>
    </>
  );
}
