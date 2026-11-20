import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
import { LABEL_STATUS_PROYEK, STATUS_MEMOTONG_KAS, statusEfektif } from '@/lib/proyek';
import { ProjectApproval } from '@/components/project-approval';
import { monthlyInstallment } from '@/lib/forecast';
import { deleteCostItem } from '@/app/actions';
import { HapusProyekTombol, ProjectForm } from '@/components/project-form';
import { CostItemAccount, CostItemForm, RealisasiItemDialog, UbahItemProyekDialog } from '@/components/cost-item-form';
import { LABEL_REALISASI_ITEM, hargaSatuanItem, realisasiDibuka, rekapRealisasiItem } from '@/lib/proyek';
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
          },
        },
        riwayatStatus: { orderBy: { createdAt: 'desc' } },
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
  const status = statusEfektif(project.status, project.startDate, new Date());
  const waktu = (d: Date) => new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar',
  }).format(d);

  const items = project.items.map((i) => ({ ...i, real: rekapRealisasiItem(i, i.pembayaran) }));
  const total = items.reduce((s, i) => s + i.amount, 0);
  const paid = items.reduce((s, i) => s + i.real.realisasi, 0);
  // Yang masih akan keluar — inilah yang dihitung peramalan.
  const outstanding = items.reduce((s, i) => s + i.real.sisaAkanKeluar, 0);
  // Selisih item yang sudah selesai: positif hemat, negatif lebih mahal.
  const selisihSelesai = items.reduce((s, i) => s + (i.real.selisih ?? 0), 0);
  const hariIni = toDateInput(new Date());
  // Realisasi baru dibuka setelah dana disetujui (Approved dan sesudahnya).
  const dibuka = realisasiDibuka(status);
  const adaPembayaran = items.some((i) => i.pembayaran.length > 0 || i.real.dariLunasLama);
  const masukPeramalan = (STATUS_MEMOTONG_KAS as readonly string[]).includes(status);
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
            <HapusProyekTombol id={project.id} nama={project.name} />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total biaya proyek" value={formatRupiah(total)} hint={`${project.items.length} item`} />
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
          riwayat={project.riwayatStatus.map((r) => ({
            id: r.id, fromStatus: r.fromStatus, toStatus: r.toStatus, note: r.note,
            userName: r.userName, waktu: waktu(r.createdAt),
          }))}
        />
      </Card>

      {/* Selebar halaman: sembilan kolom tidak muat di kolom kiri. */}
      <Card className="card-pad mb-6 min-w-0">
        <SectionTitle hint="Jadwal ini yang disuntikkan ke proyeksi arus kas bulan demi bulan.">
          Rincian biaya &amp; jadwal pembayaran
        </SectionTitle>

        {project.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Belum ada item biaya. Tambahkan lewat formulir di samping.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${dibuka ? 'min-w-[900px]' : 'min-w-[620px]'}`}>
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Item</th>
                  <th className="th">Jadwal bayar</th>
                  <th className="th num">Qty</th>
                  <th className="th num">Harga satuan</th>
                  <th className="th num">Total</th>
                  {dibuka && <th className="th num">Realisasi</th>}
                  {dibuka && <th className="th num">Selisih</th>}
                  {dibuka && <th className="th">Status</th>}
                  <th className="th num">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className={dibuka && item.real.selesai ? 'text-slate-500' : ''}>
                    <td className="td">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      {/* Akunnya di bawah nama, supaya kolom realisasi muat. */}
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {item.account
                          ? `${item.account.code} ${item.account.name}`
                          : <CostItemAccount id={item.id} accounts={capexAccounts} />}
                      </span>
                    </td>
                    <td className="td whitespace-nowrap">{formatDate(item.plannedDate)}</td>
                    <td className="td num">{item.quantity.toLocaleString('id-ID')}</td>
                    <td className="td num whitespace-nowrap">{formatRupiah(hargaSatuanItem(item))}</td>
                    <td className="td num whitespace-nowrap font-medium">{formatRupiah(item.amount)}</td>
                    {dibuka && (
                      <>
                        <td className="td num whitespace-nowrap">
                          {item.real.realisasi > 0 ? formatRupiah(item.real.realisasi) : <span className="text-slate-400">—</span>}
                          {item.pembayaran.length > 1 && (
                            <span className="block text-[11px] text-slate-400">{item.pembayaran.length} kali bayar</span>
                          )}
                          {item.real.dariLunasLama && (
                            <span className="block text-[11px] text-slate-400">dari tanda Lunas lama</span>
                          )}
                        </td>
                        <td className="td num whitespace-nowrap">
                          {item.real.selisih === null || item.real.selisih === 0 ? (
                            item.real.selisih === 0 ? <span className="text-slate-400">pas</span>
                              : <span className="text-[11px] text-slate-400">sisa {formatRupiah(item.real.sisaAkanKeluar)}</span>
                          ) : item.real.selisih > 0 ? (
                            <span className="text-emerald-700">hemat {formatRupiah(item.real.selisih)}</span>
                          ) : (
                            <span className="text-red-600">lebih {formatRupiah(-item.real.selisih)}</span>
                          )}
                        </td>
                        <td className="td">
                          <Badge tone={item.real.status === 'SELESAI' ? 'green' : item.real.status === 'SEBAGIAN' ? 'blue' : 'amber'}>
                            {LABEL_REALISASI_ITEM[item.real.status]}
                          </Badge>
                        </td>
                      </>
                    )}
                    <td className="td">
                      <span className="flex items-center justify-end gap-3">
                        {dibuka && <RealisasiItemDialog
                          itemId={item.id}
                          nama={item.name}
                          total={item.amount}
                          realisasi={item.real.realisasi}
                          selesai={item.real.selesai}
                          tanggalBawaan={hariIni}
                          pembayaran={item.pembayaran.map((p) => ({
                            id: p.id, tanggal: formatDate(p.date), amount: p.amount, note: p.note,
                          }))}
                        />}
                        <UbahItemProyekDialog
                          accounts={capexAccounts}
                          nilai={{
                            id: item.id,
                            name: item.name,
                            quantity: item.quantity,
                            unitPrice: hargaSatuanItem(item),
                            plannedDate: toDateInput(item.plannedDate),
                            accountId: item.accountId,
                          }}
                        />
                        <form action={deleteCostItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                            Hapus
                          </button>
                        </form>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 font-semibold">
                <tr>
                  <td className="td" colSpan={4}>
                    Total
                  </td>
                  <td className="td num whitespace-nowrap">{formatRupiah(total)}</td>
                  {dibuka && <td className="td num whitespace-nowrap">{formatRupiah(paid)}</td>}
                  {dibuka && (
                    <td className="td num whitespace-nowrap">
                      {selisihSelesai > 0 ? <span className="text-emerald-700">hemat {formatRupiah(selisihSelesai)}</span>
                        : selisihSelesai < 0 ? <span className="text-red-600">lebih {formatRupiah(-selisihSelesai)}</span>
                          : '—'}
                    </td>
                  )}
                  <td className="td" colSpan={dibuka ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {!dibuka && project.items.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Realisasi pembayaran dan status selesai per item muncul setelah proyek <strong>Approved</strong> (sesudah Funding Review).
            {adaPembayaran && ' Pembayaran yang sempat dicatat sebelumnya tetap tersimpan dan tampil lagi saat itu.'}
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card className="card-pad">
            <SectionTitle hint="Perubahan tersimpan langsung dan ikut memperbarui peramalan.">
              Ubah data proyek
            </SectionTitle>
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
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="card-pad">
            <SectionTitle>Tambah item biaya</SectionTitle>
            <CostItemForm projectId={project.id} accounts={capexAccounts} />
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
