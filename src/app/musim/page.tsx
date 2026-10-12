import Link from 'next/link';
import { getSeasons, polaMusim } from '@/lib/queries';
import { NAMA_BULAN, musimAcuan, pengali, polaBervariasi } from '@/lib/musim';
import { formatPercent } from '@/lib/format';
import {
  MonthSeason, SeasonDelete, SeasonDelta, SeasonForm, SeedSeasons,
} from '@/components/musim-form';
import { Alert, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function MusimPage() {
  const [daftar, pola] = await Promise.all([getSeasons(), polaMusim()]);
  const acuan = musimAcuan(daftar);
  const bervariasi = polaBervariasi(pola);
  const belumBermusim = NAMA_BULAN.map((_, i) => i + 1).filter((m) => !pola.has(m));

  // Kode musim tiap bulan, untuk mencocokkan kembali ke id pilihannya.
  const idPerBulan = new Map(
    daftar.flatMap((s) => s.bulan.map((b) => [b, s.id] as const)),
  );

  return (
    <>
      <PageHeader
        title="Musim"
        description="Pola naik turunnya pendapatan sepanjang tahun, dipakai meramalkan bulan yang belum berjalan."
      />

      {daftar.length === 0 ? (
        <Card className="card-pad">
          <EmptyState
            title="Belum ada musim"
            description="Tentukan musim beserta selisih persennya terhadap musim acuan, lalu tetapkan musim untuk tiap bulan."
          />
          <div className="mt-4 flex justify-center">
            <SeedSeasons />
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {!acuan && (
              <Alert tone="warning">
                Belum ada musim dengan selisih <strong>0%</strong>. Seluruh musim diukur terhadap
                satu musim acuan, jadi tentukan satu di antaranya sebagai 0% — biasanya mid season.
              </Alert>
            )}

            {!bervariasi && (
              <Alert tone="info">
                Seluruh bulan masih bermusim sama, sehingga ramalan belum berubah apa pun.
                Tetapkan musim yang berbeda untuk bulan ramai dan bulan sepi di bawah.
              </Alert>
            )}

            {belumBermusim.length > 0 && (
              <Alert tone="warning">
                {belumBermusim.length} bulan belum punya musim
                {belumBermusim.length <= 6 && (
                  <> ({belumBermusim.map((m) => NAMA_BULAN[m - 1]).join(', ')})</>
                )}
                . Bulan tanpa musim diramalkan seperti musim acuan.
              </Alert>
            )}

            <Card className="card-pad min-w-0">
              <SectionTitle hint="Selisih diukur terhadap musim acuan, yaitu yang bernilai 0%. Ubah angkanya lalu simpan.">
                Daftar musim
              </SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Musim</th>
                      <th className="th">Kode</th>
                      <th className="th num">Selisih</th>
                      <th className="th num">Pengali</th>
                      <th className="th">Bulan</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {daftar.map((s) => (
                      <tr key={s.id} className={s.delta === 0 ? 'bg-brand-50/40' : ''}>
                        <td className="td">
                          {s.name}
                          {s.delta === 0 && <span className="ml-2 text-xs text-brand-700">acuan</span>}
                        </td>
                        <td className="td font-mono text-xs text-slate-500">{s.code}</td>
                        <td className="td num">
                          <SeasonDelta id={s.id} code={s.code} name={s.name} delta={s.delta} />
                        </td>
                        <td className="td num text-slate-500">{pengali(s).toFixed(2)}&times;</td>
                        <td className="td text-xs text-slate-600">
                          {s.bulan.length === 0
                            ? '—'
                            : s.bulan.map((b) => NAMA_BULAN[b - 1].slice(0, 3)).join(', ')}
                        </td>
                        <td className="td num">
                          <SeasonDelete id={s.id} jumlahBulan={s.bulan.length} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="card-pad min-w-0">
              <SectionTitle hint="Berlaku berulang tiap tahun. Perubahan langsung tersimpan.">
                Musim tiap bulan
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {NAMA_BULAN.map((nama, i) => (
                  <div key={nama}>
                    <label className="label" htmlFor={`musim-bulan-${i + 1}`}>{nama}</label>
                    <MonthSeason
                      month={i + 1}
                      seasonId={idPerBulan.get(i + 1) ?? null}
                      seasons={daftar}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="card-pad">
              <SectionTitle>Tambah musim</SectionTitle>
              <SeasonForm />
            </Card>

            <Card className="card-pad">
              <SectionTitle>Cara dipakainya</SectionTitle>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Sistem menyimpulkan pendapatan musim acuan dari proyeksi bulan berjalan di menu{' '}
                  <Link href="/rencana-kas" className="text-brand-700 hover:underline">Rencana Kas</Link>,
                  dibagi pengali musim bulan itu.
                </p>
                <p>
                  Bulan-bulan sesudahnya lalu diramalkan dengan mengalikan angka acuan tadi dengan
                  pengali musimnya masing-masing.
                </p>
                <p className="text-xs text-slate-500">
                  Contoh: Oktober {acuan ? acuan.name.toLowerCase() : 'acuan'} dengan proyeksi
                  Rp 391 juta, November {formatPercent(30, 0)} lebih ramai, maka November
                  diramalkan Rp 508 juta.
                </p>
                <p className="text-xs text-slate-500">
                  Angka yang diketik langsung pada kolom &ldquo;bulan berikutnya&rdquo; di Rencana Kas
                  tetap menang atas pola ini.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
