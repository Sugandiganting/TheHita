import { Suspense } from 'react';
import Link from 'next/link';
import { getArusKas } from '@/lib/queries';
import { formatDate, formatPeriod, formatRupiah } from '@/lib/format';
import { addMonths } from '@/lib/period';
import { resolveRange, type SearchParams } from '@/lib/search-params';
import { ReportFilters } from '@/components/filters';
import { CashflowBarChart } from '@/components/charts';
import { Alert, Card, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Arus kas bulanan: masuk, keluar, dan selisihnya.
 *
 * Halaman tersendiri, bukan satu kartu lagi di Rencana Kas, karena kebiasaan
 * memakainya berbeda: Rencana Kas dibuka tiap minggu untuk menatap ke depan,
 * halaman ini tiap tutup bulan untuk menatap ke belakang. Lagipula yang
 * berguna di sini dua belas baris berderet — pola bulan sepi baru terlihat
 * kalau bulannya berjajar, dan itu tidak muat sebagai kartu.
 */
export default async function ArusKasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { from, to } = resolveRange(await searchParams, 12);
  const arus = await getArusKas(from, to);
  const lengkap = arus.filter((a) => a.net !== null);
  // Bulan terakhir yang ada, bukan bulan terakhir yang lengkap: uang masuknya
  // sudah diketahui walau netnya belum, dan menyembunyikannya hanya membuat
  // halaman terbaca kosong padahal datanya ada.
  const terbaru = arus[arus.length - 1] ?? null;
  const minus = lengkap.filter((a) => (a.net ?? 0) < 0);
  // Bulan yang saldo akhirnya dibutuhkan agar baris teratas punya pembanding.
  const kurangBulan = arus.length > 0 && arus[0].net === null
    ? addMonths(arus[0].period, -1)
    : null;

  return (
    <>
      <PageHeader
        title="Arus Kas Bulanan"
        description="Uang masuk dikurangi uang keluar, dari laporan posisi kas yang diisi tiap minggu."
      />

      {/* Tanpa pilihan unit: posisi kas dilaporkan satu angka untuk seluruh
          grup, jadi saringan per cabang hanya akan menjanjikan yang tidak ada. */}
      <Suspense fallback={null}>
        <ReportFilters units={[]} showUnit={false} />
      </Suspense>

      {arus.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={`Belum ada laporan posisi kas ${formatPeriod(from)} – ${formatPeriod(to)}`}
            description="Geser rentang bulannya, atau isi saldo kas dan uang masuk kumulatif di Rencana Kas Mingguan. Begitu ada dua bulan berturut-turut yang terisi, arus kasnya muncul sendiri di sini."
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={terbaru ? `Net cash ${formatPeriod(terbaru.period)}` : 'Net cash'}
              value={terbaru?.net == null ? '—' : formatRupiah(terbaru.net)}
              hint={
                terbaru?.net == null
                  ? `Butuh saldo akhir ${kurangBulan ? formatPeriod(kurangBulan) : 'bulan sebelumnya'}`
                  : terbaru.net < 0 ? 'Kas menyusut bulan itu' : 'Kas bertambah bulan itu'
              }
              tone={terbaru?.net != null && terbaru.net < 0 ? 'negative' : 'positive'}
            />
            <StatCard
              label={terbaru ? `Uang masuk ${formatPeriod(terbaru.period)}` : 'Uang masuk'}
              value={terbaru ? formatRupiah(terbaru.masuk) : '—'}
              hint={terbaru ? `Sampai laporan ${formatDate(terbaru.tanggal)}` : ''}
            />
            <StatCard
              label={terbaru ? `Uang keluar ${formatPeriod(terbaru.period)}` : 'Uang keluar'}
              value={terbaru?.keluar == null ? '—' : formatRupiah(terbaru.keluar)}
              hint={
                terbaru?.keluar == null
                  ? 'Ikut menunggu saldo pembandingnya'
                  : 'Semua yang keluar dari bank, termasuk gaji dan cicilan'
              }
              tone="warning"
            />
          </div>

          {minus.length > 0 && (
            <p className="mt-4 text-sm text-amber-700">
              <strong>{minus.length} dari {lengkap.length} bulan</strong> kasnya menyusut:{' '}
              {minus.map((a) => formatPeriod(a.period)).join(', ')}.
            </p>
          )}

          {/* Grafik kosong lebih buruk daripada tidak ada grafik: ia terbaca
              seperti kerusakan, padahal yang terjadi hanya belum ada
              pembandingnya. Jadi diganti keterangan yang menyebut bulan mana
              yang kurang dan apa yang harus diisi. */}
          {lengkap.length === 0 ? (
            <div className="mt-6">
              <Alert tone="info" title="Net cash belum bisa dihitung">
                Uang keluar diturunkan dari perubahan saldo, jadi perlu dua titik: saldo akhir{' '}
                <strong>{kurangBulan ? formatPeriod(kurangBulan) : 'bulan sebelumnya'}</strong> dan
                saldo sekarang. Yang ada baru satu.
                <span className="mt-2 block">
                  Dua jalan keluarnya: lebarkan rentang bulannya ke belakang bila bulan
                  sebelumnya memang sudah pernah dilaporkan, atau buat bulan itu di{' '}
                  <Link href="/rencana-kas" className="font-medium text-brand-700 hover:underline">
                    Rencana Kas Mingguan
                  </Link>{' '}
                  lalu isi satu posisi kas bertanggal akhir bulannya. Sesudah itu halaman ini
                  terisi sendiri.
                </span>
              </Alert>
            </div>
          ) : (
            <Card className="card-pad mt-6 min-w-0">
              <SectionTitle hint="Batang biru uang masuk, oranye uang keluar. Bulan yang oranyenya lebih tinggi berarti kasnya menyusut.">
                Masuk dan keluar tiap bulan
              </SectionTitle>
              <CashflowBarChart
                data={lengkap.map((a) => ({
                  period: a.period,
                  masuk: a.masuk,
                  keluar: a.keluar ?? 0,
                }))}
              />
            </Card>
          )}

          <Card className="card-pad mt-6 min-w-0">
            <SectionTitle hint="Net cash = saldo akhir bulan ini dikurangi saldo akhir bulan sebelumnya. Uang keluar diturunkan dari masuk dikurangi net, jadi ketiganya tidak mungkin tidak cocok.">
              Rincian per bulan
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="th">Bulan</th>
                    <th className="th">Dihitung dari</th>
                    <th className="th num">Uang masuk</th>
                    <th className="th num">Uang keluar</th>
                    <th className="th num">Net cash</th>
                    <th className="th num">Saldo akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...arus].reverse().map((a) => (
                    <tr key={a.period} className={(a.net ?? 0) < 0 ? 'bg-red-50/40' : ''}>
                      <td className="td whitespace-nowrap font-medium">{formatPeriod(a.period)}</td>
                      {/* Satu baris bukan persis bulan kalender melainkan jarak
                          antar laporan, jadi tanggalnya ditulis apa adanya. */}
                      <td className="td whitespace-nowrap text-xs text-slate-500">
                        {a.tanggalAwal
                          ? `${formatDate(a.tanggalAwal)} → ${formatDate(a.tanggal)}`
                          : `laporan ${formatDate(a.tanggal)}`}
                      </td>
                      <td className="td num">{formatRupiah(a.masuk)}</td>
                      <td className="td num">{a.keluar === null ? '—' : formatRupiah(a.keluar)}</td>
                      <td className={`td num font-medium ${
                        a.net === null ? 'text-slate-300'
                          : a.net < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                      >
                        {a.net === null ? '—' : formatRupiah(a.net)}
                        {a.net !== null && a.net < 0 && (
                          <span className="mt-0.5 block text-[11px] font-normal">kas menyusut</span>
                        )}
                      </td>
                      <td className="td num text-slate-500">{formatRupiah(a.saldoAkhir)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Angkanya dari laporan posisi kas yang diisi di{' '}
              <Link href="/rencana-kas" className="text-brand-700 hover:underline">
                Rencana Kas Mingguan
              </Link>
              , bukan dari jurnal. Uang keluar tidak perlu diketik — ia sudah tersirat pada
              perubahan saldo, dan karena diturunkan, ia mencakup segala yang keluar dari bank.
              Yang tidak bisa dijawab di sini hanyalah rinciannya: keluar untuk apa. Baris yang
              netnya bertanda &mdash; berarti bulan sebelumnya belum pernah dilaporkan, jadi tidak
              ada pembandingnya.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
