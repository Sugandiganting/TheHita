import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
import {
  LABEL_STATUS_PROYEK, STATUS_MEMOTONG_KAS, itemBaruLewatTambahan, itemBerlaku, realisasiDibuka, rekapHematProyek,
  rekapRealisasiItem, statusEfektif, statusTambahan,
} from '@/lib/proyek';
import { HapusTambahanTombol, ProjectApproval } from '@/components/project-approval';
import { monthlyInstallment } from '@/lib/forecast';
import { HapusProyekTombol, ProjectForm } from '@/components/project-form';
import { CostItemForm } from '@/components/cost-item-form';
import { TabelItemProyek } from '@/components/tabel-item-proyek';
import { hakSaya } from '@/lib/hak-akses-server';
import { Alert, Badge, Card, PageHeader, SectionTitle, StatCard } from '@/components/ui';
import { CABANG_SAJA } from '@/lib/penampung-master';

export const dynamic = 'force-dynamic';

export default async function ProyekDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [project, units, capexAccounts] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        unit: { select: { code: true, name: true } },
        items: {
          orderBy: { plannedDate: 'asc' },
          include: {
            account: { select: { code: true, name: true } },
            pembayaran: { orderBy: { date: 'asc' } },
            addendum: { select: { status: true } },
          },
        },
        // Riwayat proyeknya sendiri; riwayat tiap pengajuan tambahan tampil di panelnya.
        riwayatStatus: { where: { addendumId: null }, orderBy: { createdAt: 'desc' } },
        tambahan: {
          orderBy: { number: 'asc' },
          include: { riwayat: { orderBy: { createdAt: 'desc' } } },
        },
      },
    }),
    prisma.businessUnit.findMany({ where: CABANG_SAJA, orderBy: { code: 'asc' } }),
    prisma.account.findMany({
      where: { active: true, isHeader: false, OR: [{ subtype: 'FIXED_ASSET' }, { type: 'EXPENSE' }] },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
  ]);

  if (!project) notFound();
  const hak = await hakSaya();
  const daftarHak = [...hak];
  const bolehKelola = hak.has('proyek.kelola');
  const bolehRealisasi = hak.has('proyek.realisasi');
  const status = statusEfektif(project.status, project.startDate, new Date());
  const waktu = (d: Date) => new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
  }).format(d);

  // Rencana awal, dan item yang berlaku: rencana awal ditambah item tambahan
  // yang pengajuannya sudah Approved. Angka di kartu atas memakai yang berlaku.
  const rencanaAwal = project.items.filter((i) => i.addendumId === null);
  const berlaku = project.items.filter(itemBerlaku);
  const items = berlaku.map((i) => ({ ...i, real: rekapRealisasiItem(i, i.pembayaran) }));
  const total = items.reduce((s, i) => s + i.amount, 0);
  const paid = items.reduce((s, i) => s + i.real.realisasi, 0);
  // Yang masih akan keluar — inilah yang dihitung peramalan.
  const outstanding = items.reduce((s, i) => s + i.real.sisaAkanKeluar, 0);
  // Hemat bersih dari item yang sudah selesai (RAB − realisasi): positif hemat,
  // negatif lebih mahal. Informasi kinerja saja — tidak memengaruhi kas.
  const selisihSelesai = rekapHematProyek(berlaku).bersih;
  const menunggu = project.items.filter((i) => !itemBerlaku(i) && i.addendum?.status !== 'REJECTED');
  const totalMenunggu = menunggu.reduce((s, i) => s + i.amount, 0);
  const hariIni = toDateInput(new Date());
  // Realisasi baru dibuka setelah dana disetujui (Approved dan sesudahnya).
  const dibuka = realisasiDibuka(status);
  const adaPembayaran = rencanaAwal.some((i) => i.pembayaran.length > 0 || i.paid);
  const masukPeramalan = (STATUS_MEMOTONG_KAS as readonly string[]).includes(status);
  // Ke mana item baru masuk: rencana awal (sebelum Approved), pengajuan
  // tambahan (sesudahnya), atau tidak ada (proyek sudah berhenti).
  const jalurItemBaru = itemBaruLewatTambahan(status);
  const tambahanDraf = project.tambahan.find((t) => t.status === 'DRAFT');
  const nomorBerikut = tambahanDraf?.number ?? (project.tambahan.reduce((m, t) => Math.max(m, t.number), 0) + 1);
  const riwayatTampil = (r: { id: string; fromStatus: string; toStatus: string; note: string | null; userName: string; createdAt: Date }) => ({
    id: r.id, fromStatus: r.fromStatus, toStatus: r.toStatus, note: r.note, userName: r.userName, waktu: waktu(r.createdAt),
  });
  const tampilPanelTambahan = project.tambahan.length > 0 || jalurItemBaru === 'TAMBAHAN';
  const installment =
    project.fundingType === 'LOAN'
      ? monthlyInstallment(project.fundingAmount, project.loanRatePct, project.loanTenorMonths)
      : 0;

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.unit.code} — ${project.unit.name} · Mulai ${formatDate(project.startDate)}`}
        action={
          <div className="flex gap-2">
            <Link href="/peramalan" className="btn-secondary">
              Lihat dampak di peramalan
            </Link>
            {bolehKelola && <HapusProyekTombol id={project.id} nama={project.name} />}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total biaya proyek"
          value={formatRupiah(total)}
          hint={totalMenunggu > 0
            ? `${berlaku.length} item · +${formatRupiah(totalMenunggu)} tambahan menunggu persetujuan`
            : `${berlaku.length} item`}
        />
        <StatCard
          label="Sudah dibayar"
          value={dibuka ? formatRupiah(paid) : '—'}
          tone={dibuka ? 'positive' : 'neutral'}
          hint={!dibuka
            ? 'Realisasi dibuka setelah proyek Approved'
            : selisihSelesai === 0
            ? undefined
            : selisihSelesai > 0
              ? `Hemat ${formatRupiah(selisihSelesai)} dari item yang selesai`
              : `Lebih mahal ${formatRupiah(-selisihSelesai)} dari item yang selesai`}
        />
        <StatCard
          label="Belum dibayar"
          value={formatRupiah(outstanding)}
          hint={masukPeramalan ? 'Inilah yang dihitung di peramalan' : 'Belum masuk peramalan sebelum Approved'}
          tone={outstanding > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Pendanaan"
          value={project.fundingAmount > 0 ? formatRupiah(project.fundingAmount) : 'Dana sendiri'}
          hint={installment > 0 ? `Cicilan ${formatRupiah(installment)}/bulan` : undefined}
        />
      </div>

      {outstanding > project.fundingAmount && project.fundingAmount > 0 && (
        <div className="mb-6">
          <Alert tone="warning" title="Dana pinjaman tidak menutup seluruh biaya">
            Sisa {formatRupiah(outstanding - project.fundingAmount)} akan diambil dari kas operasional.
            Periksa menu Peramalan untuk memastikan kas mencukupi.
          </Alert>
        </div>
      )}

      <Card className="card-pad mb-6">
        <SectionTitle hint="Proposed → Funding Review → Approved. Setiap perpindahan dicatat oleh siapa dan kapan; pembatasan siapa yang boleh menyetujui menyusul bersama hak akses pengguna.">
          Approval
        </SectionTitle>
        <ProjectApproval
          id={project.id}
          status={status}
          tanggalMulai={formatDate(project.startDate)}
          riwayat={project.riwayatStatus.map(riwayatTampil)}
          hak={daftarHak}
        />
      </Card>

      {/* Selebar halaman: sembilan kolom tidak muat di kolom kiri. */}
      <Card className="card-pad mb-6 min-w-0">
        <SectionTitle hint="Jadwal ini yang disuntikkan ke proyeksi arus kas bulan demi bulan.">
          Rincian biaya &amp; jadwal pembayaran
        </SectionTitle>

        {rencanaAwal.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Belum ada item biaya. Tambahkan lewat formulir di samping.
          </p>
        ) : (
          <TabelItemProyek
            items={rencanaAwal}
            accounts={capexAccounts}
            realisasi={dibuka}
            bolehUbah={bolehKelola}
            bolehRealisasi={bolehRealisasi}
            hariIni={hariIni}
          />
        )}
        {!dibuka && rencanaAwal.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Realisasi pembayaran dan status selesai per item muncul setelah proyek <strong>Approved</strong> (sesudah Funding Review).
            {adaPembayaran && ' Pembayaran yang sempat dicatat sebelumnya tetap tersimpan dan tampil lagi saat itu.'}
          </p>
        )}
      </Card>

      {tampilPanelTambahan && (
        <Card className="card-pad mb-6 min-w-0" id="tambahan">
          <SectionTitle hint="Item yang ditambahkan setelah proyek Approved. Beberapa item dikumpulkan dalam satu pengajuan, lalu melewati alur yang sama dengan proyek baru. Itemnya baru memotong kas dan bisa direalisasikan setelah pengajuannya Approved.">
            Item tambahan
          </SectionTitle>
          {project.tambahan.length === 0 && (
            <p className="py-4 text-sm text-slate-500">
              Belum ada item tambahan. Item yang ditambahkan lewat formulir di samping akan masuk{' '}
              <strong>Tambahan #{nomorBerikut}</strong> dan perlu disetujui dulu sebelum dihitung.
            </p>
          )}
          <div className="space-y-6">
            {project.tambahan.map((t) => {
              const st = statusTambahan(t.status);
              const itemT = project.items.filter((i) => i.addendumId === t.id);
              const totalT = itemT.reduce((s, i) => s + i.amount, 0);
              const bisaUbah = st === 'DRAFT' || st === 'REJECTED';
              return (
                <section key={t.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-medium text-slate-900">
                      Tambahan #{t.number}
                      <Badge tone={st === 'APPROVED' ? 'green' : st === 'REJECTED' ? 'red' : st === 'DRAFT' ? 'slate' : 'amber'}>
                        {LABEL_STATUS_PROYEK[st]}
                      </Badge>
                    </h3>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums text-slate-700">
                        {itemT.length} item · <strong>{formatRupiah(totalT)}</strong>
                      </span>
                      {bisaUbah && bolehKelola && <HapusTambahanTombol id={t.id} nomor={t.number} />}
                    </span>
                  </div>
                  {itemT.length === 0 ? (
                    <p className="mb-3 text-sm text-slate-500">Belum ada item. Tambahkan lewat formulir di samping.</p>
                  ) : (
                    <div className="mb-4">
                      <TabelItemProyek
                        items={itemT}
                        accounts={capexAccounts}
                        realisasi={dibuka && st === 'APPROVED'}
                        bolehUbah={bisaUbah && bolehKelola}
                        bolehRealisasi={bolehRealisasi}
                        hariIni={hariIni}
                      />
                    </div>
                  )}
                  <ProjectApproval
                    jenis="tambahan"
                    id={t.id}
                    status={st}
                    riwayat={t.riwayat.map(riwayatTampil)}
                    hak={daftarHak}
                  />
                </section>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card className="card-pad">
            <SectionTitle hint="Perubahan tersimpan langsung dan ikut memperbarui peramalan.">
              Ubah data proyek
            </SectionTitle>
            {bolehKelola ? (
            <ProjectForm
              units={units}
              values={{
                id: project.id,
                name: project.name,
                unitId: project.unitId,
                status: project.status,
                startDate: toDateInput(project.startDate),
                endDate: project.endDate ? toDateInput(project.endDate) : '',
                description: project.description ?? '',
                fundingType: project.fundingType,
                fundingAmount: project.fundingAmount,
                fundingDate: project.fundingDate ? toDateInput(project.fundingDate) : '',
                loanRatePct: project.loanRatePct,
                loanTenorMonths: project.loanTenorMonths,
                upliftRevenueMonthly: project.upliftRevenueMonthly,
                upliftExpenseMonthly: project.upliftExpenseMonthly,
                upliftStartDate: project.upliftStartDate ? toDateInput(project.upliftStartDate) : '',
              }}
            />
            ) : (
              <p className="text-sm text-slate-500">
                User level Anda tidak punya hak &ldquo;Buat &amp; ubah proyek&rdquo;, jadi data proyek hanya bisa dilihat.
              </p>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="card-pad">
            {!bolehKelola ? (
              <>
                <SectionTitle>Tambah item biaya</SectionTitle>
                <p className="text-sm text-slate-500">
                  User level Anda tidak punya hak &ldquo;Buat &amp; ubah proyek&rdquo;, jadi item tidak bisa ditambah.
                </p>
              </>
            ) : jalurItemBaru === 'DITUTUP' ? (
              <>
                <SectionTitle>Tambah item biaya</SectionTitle>
                <p className="text-sm text-slate-500">
                  Proyek {LABEL_STATUS_PROYEK[status]} tidak menerima item baru.
                  {status === 'ON_HOLD' && ' Lanjutkan proyeknya dulu (Resume Project) untuk menambah item.'}
                </p>
              </>
            ) : jalurItemBaru === 'TAMBAHAN' ? (
              <>
                <SectionTitle hint="Proyek sudah Approved, jadi item baru diajukan terpisah dan baru dihitung setelah disetujui.">
                  Tambah item tambahan
                </SectionTitle>
                <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  Masuk ke <strong>Tambahan #{nomorBerikut}</strong>
                  {tambahanDraf ? ' (draf)' : ' (pengajuan baru)'}. Setelah itemnya lengkap, ajukan lewat panel{' '}
                  <a href="#tambahan" className="underline">Item tambahan</a>.
                </p>
                <CostItemForm projectId={project.id} accounts={capexAccounts} />
              </>
            ) : (
              <>
                <SectionTitle>Tambah item biaya</SectionTitle>
                <CostItemForm projectId={project.id} accounts={capexAccounts} />
              </>
            )}
          </Card>

          <Card className="card-pad mt-6">
            <SectionTitle>Ringkasan</SectionTitle>
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={LABEL_STATUS_PROYEK[status]} />
              <Row label="Target selesai" value={project.endDate ? formatDate(project.endDate) : '—'} />
              <Row
                label="Tambahan pendapatan"
                value={
                  project.upliftRevenueMonthly > 0
                    ? `${formatRupiah(project.upliftRevenueMonthly)}/bulan`
                    : '—'
                }
              />
              <Row
                label="Tambahan biaya"
                value={
                  project.upliftExpenseMonthly > 0
                    ? `${formatRupiah(project.upliftExpenseMonthly)}/bulan`
                    : '—'
                }
              />
              <Row
                label="Mulai beroperasi"
                value={project.upliftStartDate ? formatDate(project.upliftStartDate) : '—'}
              />
            </dl>

            {project.upliftRevenueMonthly > 0 && outstanding > 0 && (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Dengan tambahan laba{' '}
                {formatRupiah(project.upliftRevenueMonthly - project.upliftExpenseMonthly)}/bulan, biaya proyek
                sebesar {formatRupiah(total)} diperkirakan kembali dalam{' '}
                <strong>
                  {Math.ceil(total / Math.max(1, project.upliftRevenueMonthly - project.upliftExpenseMonthly))} bulan
                </strong>{' '}
                setelah beroperasi.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
