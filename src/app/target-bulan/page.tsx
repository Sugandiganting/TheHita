import Link from 'next/link';
import { polaMusim, polaTarget } from '@/lib/queries';
import { NAMA_BULAN } from '@/lib/musim';
import { adaTarget } from '@/lib/target-bulan';
import { BarisTarget } from '@/components/target-bulan-form';
import { Alert, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Target tiap bulan: margin kas yang diinginkan, dan lebar sebaran
 * optimis-pesimis di sekitar ramalan normalnya.
 *
 * Satu baris per bulan kalender, bukan per periode. Yang menentukan sebuah
 * bulan bisa menyisakan berapa adalah musimnya, dan musim berulang tiap tahun
 * — jadi angkanya ditetapkan sekali lalu berlaku terus, seperti master musim
 * di sebelahnya. Musim tiap bulan ikut ditampilkan supaya pilihannya tidak
 * dibuat sambil menebak bulan itu ramai atau sepi.
 */
export default async function TargetBulanPage() {
  const [pola, musim] = await Promise.all([polaTarget(), polaMusim()]);
  const sudahAda = adaTarget(pola);

  return (
    <>
      <PageHeader
        title="Target Bulan"
        description="Margin kas yang ingin dicapai tiap bulan, dan seberapa lebar sebaran optimis-pesimis di sekitar ramalan normalnya."
      />

      <Alert tone="info" title="Margin kas, bukan margin laba bersih">
        Dihitung terhadap <strong>uang yang masuk</strong>, bukan terhadap pendapatan di laba rugi.
        Uang masuk memuat hal yang bukan pendapatan bulan itu — deposit tamu, pelunasan piutang,
        setoran modal — jadi angka ini memang tidak akan sama dengan margin di laporan laba rugi,
        dan tidak seharusnya dibandingkan begitu saja. Yang dijawabnya satu hal: dari uang yang
        masuk bulan ini, berapa yang ingin disisakan.
      </Alert>

      {!sudahAda && (
        <div className="mt-4">
          <Alert tone="warning" title="Belum ada bulan yang ditetapkan">
            Selama kosong, Rencana Kas berjalan persis seperti sebelum menu ini ada: tidak ada
            batas margin yang ditarik, dan tidak ada peringatan yang muncul. Isi bulan yang Anda
            inginkan saja — bulan lain boleh tetap kosong.
          </Alert>
        </div>
      )}

      <Card className="card-pad mt-6">
        <SectionTitle hint="Kosongkan kolomnya bila sebuah bulan belum ingin ditetapkan. Kosong berarti belum ditetapkan, bukan nol persen — margin 0% adalah keputusan bahwa seluruh uang masuk boleh dibelanjakan.">
          Target per bulan
        </SectionTitle>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="th">Bulan</th>
                <th className="th">Target margin kas %</th>
                <th className="th">Optimis +%</th>
                <th className="th">Pesimis −%</th>
                <th className="th" />
                <th className="th">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {NAMA_BULAN.map((nama, i) => {
                const bulan = i + 1;
                const m = musim.get(bulan);
                return (
                  <BarisTarget
                    key={bulan}
                    bulan={bulan}
                    nama={nama}
                    musim={m ? `${m.name} ${m.delta >= 0 ? '+' : ''}${m.delta}%` : null}
                    target={pola.get(bulan)!}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-1 text-xs text-slate-500">
          <p>
            <strong>Target margin kas</strong> menjadi batas belanja sebulan: margin 15% dari ramalan
            masuk 400 jt berarti belanja paling banyak 340 jt. Batasnya tidak memblokir — plafon
            mingguan tetap dihitung dari likuiditas seperti biasa, tetapi begitu belanja melewati
            batas itu, peringatannya muncul di halaman{' '}
            <Link href="/rencana-kas" className="font-medium text-brand-600 hover:underline">Rencana Kas</Link>.
          </p>
          <p>
            <strong>Optimis</strong> dan <strong>pesimis</strong> diturunkan dari ramalan normal,
            bukan diketik sendiri-sendiri — tiga angka yang berdiri terpisah bisa bergerak saling
            bertentangan tanpa ada yang menahannya. Yang sudah diketik manual di sebuah bulan tetap
            menang atas turunan ini.
          </p>
          <p>
            Bulan yang semusim boleh diisi angka sama. Musimnya sendiri diatur di{' '}
            <Link href="/musim" className="font-medium text-brand-600 hover:underline">Master Musim</Link>.
          </p>
        </div>
      </Card>
    </>
  );
}
