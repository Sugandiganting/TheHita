import Link from 'next/link';
import { riwayatMargin, targetMargin } from '@/lib/queries';
import { currentPeriod } from '@/lib/period';
import { formatPercent, formatPeriod, formatRupiah } from '@/lib/format';
import { golonganMargin, targetLengkap, type SkenarioMargin } from '@/lib/target-margin';
import { NAMA_SKENARIO } from '@/lib/rencana-kas';
import { TargetMarginForm } from '@/components/target-margin-form';
import { Alert, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

const LABEL_GOLONGAN: Record<string, string> = {
  PESIMIS: 'Pesimis', NORMAL: 'Normal', OPTIMIS: 'Optimis',
  DI_BAWAH_PESIMIS: 'Di bawah pesimis',
};

/**
 * Target margin tiap skenario.
 *
 * Satu set untuk seluruh tahun, bukan per bulan: perbedaan antar bulan sudah
 * ditangani pola musim di master Musim, dan mengulanginya di sini berarti dua
 * tempat yang harus sepakat tanpa ada yang menjaganya.
 */
export default async function TargetMarginPage() {
  const [tm, riwayat] = await Promise.all([targetMargin(), riwayatMargin(currentPeriod())]);
  const nilai = Object.fromEntries(tm) as Partial<Record<SkenarioMargin, number>>;
  const lengkap = targetLengkap(tm);

  const denganOperasi = riwayat.filter((r) => r.marginOperasi !== null);
  const rataKas = riwayat.length > 0
    ? riwayat.reduce((t, r) => t + (r.marginKas ?? 0), 0) / riwayat.length
    : null;
  const rataOperasi = denganOperasi.length > 0
    ? denganOperasi.reduce((t, r) => t + (r.marginOperasi ?? 0), 0) / denganOperasi.length
    : null;

  return (
    <>
      <PageHeader
        title="Target Margin"
        description="Tiga angka yang menentukan apa artinya pesimis, normal dan optimis — dan dari ketiganya diturunkan target uang masuk, batas belanja, serta golongan tiap bulan."
      />

      <Alert tone="info" title="Margin operasi, bukan margin kas apa adanya">
        Renovasi, pembelian aset tetap dan cicilan <strong>pokok</strong> utang dikeluarkan lebih
        dulu; bunga pinjaman tetap di dalam karena bunga memang biaya. Tanpa pemisahan itu, bulan
        yang kebetulan berproyek besar akan tergolong pesimis padahal usahanya berjalan baik — dan
        golongan itulah yang nanti menentukan target bulan berikutnya, sehingga satu bulan renovasi
        menarik turun seluruh tahun sesudahnya.
      </Alert>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="card-pad">
            <SectionTitle hint="Ketiganya disimpan sekaligus dan harus berurut naik. Boleh negatif — pesimis memang boleh berarti rugi tipis.">
              Target tiap skenario
            </SectionTitle>
            <div className="mt-3">
              <TargetMarginForm nilai={nilai} />
            </div>
          </Card>

          <Card className="card-pad min-w-0">
            <SectionTitle hint="Diukur dari pergerakan saldo pada laporan posisi kas, bukan dari jurnal — hanya bulan yang terlapor penuh dan yang bulan sebelumnya juga terlapor yang bisa dihitung.">
              Margin yang benar-benar tercapai
            </SectionTitle>

            {riwayat.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Belum ada bulan yang bisa dihitung. Diperlukan laporan posisi kas di akhir bulan,
                dan laporan akhir bulan sebelumnya sebagai pembanding.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Bulan</th>
                      <th className="th num">Uang masuk</th>
                      <th className="th num">Uang keluar</th>
                      <th className="th num">Bukan operasi</th>
                      <th className="th num">Margin kas</th>
                      <th className="th num">Margin operasi</th>
                      <th className="th">Golongan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {riwayat.map((r) => {
                      const g = lengkap ? golonganMargin(r.marginOperasi, tm) : null;
                      return (
                        <tr key={r.period}>
                          <td className="td">{formatPeriod(r.period)}</td>
                          <td className="td num">{formatRupiah(r.masuk)}</td>
                          <td className="td num">{formatRupiah(r.keluar)}</td>
                          <td className="td num text-slate-500">
                            {r.nonOperasi === null ? 'belum diisi' : formatRupiah(r.nonOperasi)}
                          </td>
                          <td className="td num">
                            {r.marginKas === null ? '—' : formatPercent(r.marginKas)}
                          </td>
                          <td className={`td num ${r.marginOperasi === null ? 'text-slate-400' : 'font-medium'}`}>
                            {r.marginOperasi === null ? '—' : formatPercent(r.marginOperasi)}
                          </td>
                          <td className="td">
                            {g === null ? (
                              <span className="text-[11px] text-slate-400">—</span>
                            ) : (
                              <Badge tone={g === 'DI_BAWAH_PESIMIS' ? 'amber' : g === 'OPTIMIS' ? 'green' : 'slate'}>
                                {LABEL_GOLONGAN[g]}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="td" colSpan={4}>Rata-rata</td>
                      <td className="td num">{rataKas === null ? '—' : formatPercent(rataKas)}</td>
                      <td className="td num">{rataOperasi === null ? '—' : formatPercent(rataOperasi)}</td>
                      <td className="td" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {riwayat.length > 0 && denganOperasi.length === 0 && (
              <div className="mt-4">
                <Alert tone="warning" title="Margin operasi belum bisa dihitung">
                  Kolom <strong>Bukan operasi</strong> belum diisi di satu bulan pun, jadi yang
                  terbaca baru margin kas apa adanya. Selama renovasi belum dipisahkan, angka itu
                  menggambarkan jadwal proyek, bukan jalannya usaha. Isi di halaman{' '}
                  <Link href="/rencana-kas" className="font-medium underline">Rencana Kas</Link>{' '}
                  tiap bulannya.
                </Alert>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="card-pad">
            <SectionTitle>Apa yang diturunkan dari ketiganya</SectionTitle>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-900">Target uang masuk</dt>
                <dd className="text-slate-600">
                  Dihitung mundur dari ramalan belanja operasi: masuk = belanja ÷ (1 − margin).
                  Menjawab “supaya {NAMA_SKENARIO.NORMAL.toLowerCase()} tercapai, bulan depan harus
                  masuk berapa”.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Batas belanja operasi</dt>
                <dd className="text-slate-600">
                  Arah sebaliknya: belanja = masuk × (1 − margin). Tidak memblokir apa pun; plafon
                  mingguan tetap dihitung dari likuiditas.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Golongan bulan</dt>
                <dd className="text-slate-600">
                  Pitanya terbentuk sendiri dari ketiga angka. Di bawah target pesimis tidak
                  digolongkan apa pun — bulan seperti itu tidak ada di dalam rencana mana pun, dan
                  menyebutnya pesimis akan membuatnya terbaca seolah masih terkendali.
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Selama ketiganya belum lengkap, Rencana Kas berjalan persis seperti sebelum menu ini
              ada: tidak ada target, tidak ada batas, tidak ada golongan.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
