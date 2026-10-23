import Link from 'next/link';
import { getRencanaKas, getRencanaKasPeriods } from '@/lib/queries';
import { addMonths, currentPeriod } from '@/lib/period';
import { HORIZON_BULAN, NAMA_SKENARIO, SKENARIO, type Skenario } from '@/lib/rencana-kas';
import { NAMA_KADENS } from '@/lib/rencana-belanja';
import {
  formatDate, formatPercent, formatPeriod, formatPeriodShort, formatRupiah, formatRupiahShort,
  toDateInput,
} from '@/lib/format';
import { barisMinggu } from '@/lib/minggu';
import { pastikanBulanBerjalan } from '@/lib/rencana-berjalan';
import { dariJurnal, lajuHarian } from '@/lib/laju-harian';
import { batangTren } from '@/lib/tren-masuk';
import { TrenBarChart } from '@/components/tren-bar';
import { CapaianTarget } from '@/components/capaian-target';
import { LajuHarianBlok } from '@/components/laju-harian';
import type { SearchParams } from '@/lib/search-params';
import {
  AssumptionForm, CategoryBudget, CategoryDelete, CategoryForm, CheckpointDelete, CheckpointForm,
  CommitmentForm, CommitmentRow, PlanDelete, PlanForm, ProjectionForm, SpendDelete, SpendForm,
} from '@/components/rencana-kas-form';
import { JadwalTersimpan, PurchaseActions, PurchaseCalculator } from '@/components/belanja-form';
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const TONE: Record<Skenario, 'negative' | 'neutral' | 'positive'> = {
  PESIMIS: 'negative',
  NORMAL: 'neutral',
  OPTIMIS: 'positive',
};

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Gaji sebuah bulan dibayar di awalnya, jadi yang harus menutupinya adalah
 * saldo akhir bulan sebelumnya. Penandanya menyebut bulan gajinya, bukan bulan
 * saldonya — tanpa itu "kurang untuk gaji" di baris Oktober terbaca seolah gaji
 * Oktober yang bermasalah, padahal gaji itu sudah lewat.
 */
function bulanSesudah(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** "+Rp 52 jt" / "-Rp 40 jt": arah angkanya harus terbaca tanpa menghitung. */
function bertanda(value: number): string {
  return `${value > 0 ? '+' : ''}${formatRupiahShort(value)}`;
}

/** "10 – 16 Okt": rentang dalam satu bulan tidak perlu menyebut bulannya dua kali. */
function rentang(mulai: Date, selesai: Date): string {
  // Bulannya ditulis sekali di ujung, kecuali barisnya menyeberang pergantian
  // bulan — "28 – 3 Nov" tanpa bulan awalnya terbaca seperti salah ketik.
  const awal = mulai.getUTCMonth() === selesai.getUTCMonth()
    ? `${mulai.getUTCDate()}`
    : `${mulai.getUTCDate()} ${BULAN[mulai.getUTCMonth()]}`;
  return `${awal} – ${selesai.getUTCDate()} ${BULAN[selesai.getUTCMonth()]}`;
}

/** Satu angka berlabel di dalam baris perhitungan. */
function Suku({ label, value, tebal }: { label: string; value: number; tebal?: boolean }) {
  return (
    <span className="min-w-0 text-center">
      <span className={`block tabular-nums ${tebal ? 'text-base font-semibold text-slate-900' : 'text-sm text-slate-700'}`}>
        {formatRupiah(value)}
      </span>
      <span className="block text-[11px] text-slate-500">{label}</span>
    </span>
  );
}

function Operator({ children }: { children: string }) {
  return <span className="pt-0.5 text-sm text-slate-400">{children}</span>;
}

export default async function RencanaKasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  // Bulan berjalan tidak perlu dibuat sendiri. Begitu halamannya dibuka ia
  // sudah ada, melanjutkan bulan terakhir — kategori, komitmen berulang dan
  // asumsinya ikut terbawa. Ini satu-satunya tempat halaman ini menulis ke
  // basis data saat dibuka, dan hanya untuk bulan yang sedang berjalan.
  await pastikanBulanBerjalan(currentPeriod());
  const daftar = await getRencanaKasPeriods();
  const dipilih = one(params.periode) ?? daftar[0] ?? currentPeriod();
  const data = await getRencanaKas(dipilih);

  const pemilih = (
    <Card className="card-pad">
      <div className="flex flex-wrap items-end gap-6">
        {daftar.length > 0 && (
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="periode">Lihat bulan</label>
              <select id="periode" name="periode" className="input max-w-xs" defaultValue={dipilih}>
                {daftar.map((p) => (
                  <option key={p} value={p}>{formatPeriod(p)}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">Tampilkan</button>
          </form>
        )}
        <div className="border-slate-200 sm:border-l sm:pl-6">
          <PlanForm defaultPeriod={currentPeriod()} />
        </div>
      </div>
    </Card>
  );

  if (!data) {
    return (
      <>
        <PageHeader
          title="Rencana Kas Mingguan"
          description="Dari posisi kas hari ini sampai akhir bulan: berapa yang boleh dibelanjakan bila uang masuk seret, wajar, atau baik."
        />
        {pemilih}
        <div className="mt-6">
          <EmptyState
            title={`Belum ada rencana untuk ${formatPeriod(dipilih)}`}
            description="Buat rencana lewat formulir di atas. Setelah bulan pertama ada, bulan-bulan berikutnya muncul sendiri — kategori, komitmen berulang dan asumsinya tersalin."
          />
        </div>
      </>
    );
  }

  const { rencana, terakhir } = data;
  // Lihat komentar di tabel ramalan di bawah.
  const barisRunway = data.runway
    ? Math.min(
        Math.max(...SKENARIO.map((sk) => data.runway![sk].bulan.length)),
        Math.max(6, ...SKENARIO.filter((sk) => data.runway![sk].habisPada)
          .map((sk) => data.runway![sk].bulan.length)),
      )
    : 0;
  // Hari ini bila bulannya memang sedang berjalan; selain itu hari terakhir
  // bulan itu, karena server menolak tanggal di luar bulan rencananya.
  const hariIni = new Date();
  const tanggalBawaan = currentPeriod(hariIni) === data.period
    ? toDateInput(hariIni)
    : toDateInput(new Date(Date.UTC(Number(data.period.slice(0, 4)), Number(data.period.slice(5, 7)), 0)));
  // Baris mingguan: ke belakang dari laporan posisi kas, ke depan dari rencana,
  // disambung melewati pergantian bulan supaya selalu ada empat minggu terlihat.
  const mingguan = rencana
    ? barisMinggu({
        period: data.period,
        hariIni,
        minggu: rencana.minggu,
        laporan: data.checkpoint,
        proyeksi: [
          { period: data.period, normal: data.dipakai.NORMAL },
          { period: addMonths(data.period, 1), normal: data.dipakaiBerikutnya.NORMAL },
        ],
      })
    : null;
  // Bulan yang isinya terbawa dari bulan sebelumnya dan belum disentuh sama
  // sekali. Diturunkan dari keadaan, bukan dari penanda sesaat, supaya
  // keterangannya tetap muncul kalau halamannya dimuat ulang.
  const lanjutanDari = data.checkpoint.length === 0 && data.belanja.length === 0
    ? daftar[daftar.indexOf(dipilih) + 1] ?? null
    : null;
  const belumBayar = data.komitmen.filter((k) => !k.paid);
  // Komitmen sekali ini tidak termasuk dalam pengeluaran rutin bulanan, jadi
  // hanya yang ini yang betul-betul menambah tekanan di bulan berjalan.
  const sekaliIni = belumBayar.filter((k) => !k.recurring).reduce((t, k) => t + k.amount, 0);

  return (
    <>
      <PageHeader
        title={`Rencana Kas — ${formatPeriod(data.period)}`}
        description={
          terakhir
            ? `Posisi kas per ${formatDate(terakhir.date)}. Perbarui tiap minggu lewat panel di samping.`
            : 'Isi posisi kas terlebih dahulu agar anggarannya bisa dihitung.'
        }
      />
      {pemilih}

      {!rencana && (
        <div className="mt-6">
          <Alert tone="warning">
            {/* Bulan yang baru berjalan isinya sudah terbawa dari bulan lalu, dan itu
                perlu disebut: tanpa ini, kategori dan komitmen yang tiba-tiba sudah
                terisi terbaca seperti sisa bulan kemarin yang lupa dibersihkan. */}
            {lanjutanDari && (
              <>
                Rencana {formatPeriod(dipilih)} melanjutkan {formatPeriod(lanjutanDari)} — kategori,
                komitmen berulang, pengeluaran rutin dan kebutuhan gaji sudah tersalin.{' '}
              </>
            )}
            Belum ada laporan posisi kas untuk bulan ini. Isi saldo kas dan uang masuk kumulatif di panel
            <strong> Posisi kas minggu ini</strong>, lalu angkanya akan muncul di sini.
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {rencana && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {SKENARIO.map((s) => {
                  const h = rencana.skenario[s];
                  return (
                    <StatCard
                      key={s}
                      label={`${NAMA_SKENARIO[s]} · masuk ${formatRupiah(h.proyeksi)}`}
                      value={formatRupiah(h.bolehBelanja)}
                      hint={
                        rencana.minggu.length > 0
                          ? `±${formatRupiah(h.perMinggu)} per minggu${s === 'NORMAL' ? ' · rekomendasi' : ''}`
                          : 'Bulan ini sudah habis'
                      }
                      tone={h.bolehBelanja < 0 ? 'negative' : TONE[s]}
                    />
                  );
                })}
              </div>

              {rencana.skenario.NORMAL.bolehBelanja < 0 && (
                <Alert tone="danger">
                  Pada skenario normal, kas tidak cukup menutup komitmen yang belum dibayar — kurang{' '}
                  <strong>{formatRupiah(-rencana.skenario.NORMAL.bolehBelanja)}</strong>. Tidak ada ruang belanja
                  sampai ada uang masuk tambahan atau komitmen digeser.
                </Alert>
              )}

              {data.tren && (
                <Card className="card-pad min-w-0">
                  <SectionTitle hint="Uang masuk sampai laporan terakhir, dibandingkan dengan target ketiga skenario — target sampai tanggal itu, dan target sebulan penuhnya.">
                    Sedang mengarah ke mana
                  </SectionTitle>

                  {(() => {
                    const t = data.tren!;
                    const nada = t.posisi === 'DI_ATAS'
                      ? { kotak: 'border-emerald-200 bg-emerald-50', teks: 'text-emerald-800', mini: 'text-emerald-700' }
                      : t.posisi === 'DI_BAWAH'
                        ? { kotak: 'border-red-200 bg-red-50', teks: 'text-red-800', mini: 'text-red-700' }
                        : { kotak: 'border-slate-200 bg-slate-50', teks: 'text-slate-800', mini: 'text-slate-600' };

                    const judul = t.posisi === 'DI_ATAS'
                      ? 'Di atas skenario optimis'
                      : t.posisi === 'DI_BAWAH'
                        ? 'Di bawah skenario pesimis'
                        : `Paling dekat ke ${NAMA_SKENARIO[t.terdekat].toLowerCase()}`;

                    return (
                      <div className={`mb-4 rounded-lg border p-4 ${nada.kotak}`}>
                        <p className={`text-xs font-medium uppercase tracking-wide ${nada.mini}`}>
                          Tanggal {t.hariTerakhir} dari {t.hariSebulan} · {formatPercent(t.porsiHari * 100, 0)} bulan berjalan
                        </p>
                        <p className={`mt-1 text-lg font-semibold ${nada.teks}`}>{judul}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Sudah masuk <strong>{formatRupiah(t.masukTerakhir)}</strong> —{' '}
                          <strong>{formatPercent(t.capaian.NORMAL.persen * 100, 0)}</strong> dari
                          target normal, padahal bulan baru berjalan{' '}
                          <strong>{formatPercent(t.porsiHari * 100, 0)}</strong>.
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Bila lajunya bertahan, sebulan penuh menjadi{' '}
                          <strong>{formatRupiah(t.lajuAkhirBulan)}</strong> —{' '}
                          {t.selisihNormal >= 0 ? 'lebih cepat' : 'lebih lambat'}{' '}
                          <strong>{formatRupiah(Math.abs(t.selisihNormal))}</strong> daripada yang
                          diperkirakan skenario normal sampai tanggal ini.
                        </p>
                      </div>
                    );
                  })()}

                  <TrenBarChart data={batangTren(data.tren)} hariTerakhir={data.tren.hariTerakhir} />

                  <div className="mt-4">
                    <CapaianTarget tren={data.tren} />
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <LajuHarianBlok
                      laju={lajuHarian(
                        data.tren.masukTerakhir,
                        data.tren.hariTerakhir,
                        {
                          laporan: data.riwayatLaporan,
                          jurnal: dariJurnal(data.riwayatMasuk),
                        },
                      )}
                      perluPerHari={data.tren.capaian.NORMAL.perHariSisa}
                      sisaHari={data.tren.sisaHari}
                      tercapai={data.tren.capaian.NORMAL.tercapai}
                    />
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Batang abu adalah targetnya: bagian gelap yang semestinya sudah masuk sampai
                    tanggal laporan, bagian terang sisanya sampai akhir bulan. Batang biru melewati
                    bagian gelap berarti berjalan lebih cepat daripada jadwal. Targetnya dianggap
                    datang rata tiap hari, padahal uang masuk tidak begitu — akhir pekan, hari raya
                    dan jadwal pembayaran OTA membuatnya bergelombang — jadi bacalah selisih yang
                    lumayan, bukan beberapa juta. Pergerakan tiap minggunya ada di tabel{' '}
                    <strong>Aturan mingguan</strong> di bawah.
                  </p>
                </Card>
              )}

              {data.runway && (
                <Card className="card-pad min-w-0">
                  <SectionTitle hint="Bila pola belanja tidak berubah dan plafon mingguan di bawah tidak diikuti. Saldo akhir sebuah bulan harus menutup gaji yang jatuh tempo awal bulan berikutnya. Uang keluarnya sama untuk ketiga skenario — yang membedakan hanya uang masuknya.">
                    Kapan kas habis
                  </SectionTitle>

                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    {SKENARIO.map((sk) => {
                      const w = data.runway![sk];
                      return (
                        <div key={sk} className="rounded-lg border border-slate-200 px-3 py-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {NAMA_SKENARIO[sk]}
                          </p>
                          <p className={`mt-0.5 font-semibold ${w.habisPada ? 'text-red-600' : 'text-emerald-600'}`}>
                            {w.habisPada ? formatPeriod(w.habisPada) : 'Tidak habis'}
                          </p>
                          {/* Kas yang tidak pernah habis masih bisa tidak menutup gaji di
                              satu bulan. Tanpa baris ini, kartu hijau menutupi peringatan
                              kuning yang ada tepat di tabel bawahnya. */}
                          {w.gajiTerancam && (
                            <p className="text-xs font-medium text-amber-600">
                              Gaji {formatPeriodShort(bulanSesudah(w.gajiTerancam))} kurang{' '}
                              <span className="whitespace-nowrap">
                                {formatRupiahShort(
                                  w.bulan.find((b) => !b.cukupGaji)?.kurangGaji ?? 0,
                                )}
                              </span>
                            </p>
                          )}
                          {/* Laju satu bulan saja menyesatkan sejak ada pola musim:
                              bulan depan bisa ramai dan menambah kas, sementara
                              bulan-bulan sepi sesudahnya yang menghabiskannya —
                              dan kartu ini akan berbunyi "bertambah" tepat di
                              bawah tanggal kas habis. Jadi: rata-rata sepanjang
                              ramalan, dengan ayunan musimnya disebut terpisah. */}
                          <p className="text-xs text-slate-500">
                            Rata-rata {w.arusRata < 0 ? 'berkurang' : 'bertambah'}{' '}
                            <span className="whitespace-nowrap">{formatRupiah(Math.abs(w.arusRata))}</span>{' '}
                            tiap bulan
                          </p>
                          {Math.round(w.arusTerendah.arus) !== Math.round(w.arusTertinggi.arus) && (
                            <p className="text-xs text-slate-400">
                              <span className="block">
                                Paling sepi{' '}
                                <span className="whitespace-nowrap">
                                  {formatPeriodShort(w.arusTerendah.period)} {bertanda(w.arusTerendah.arus)}
                                </span>
                              </span>
                              <span className="block">
                                Paling ramai{' '}
                                <span className="whitespace-nowrap">
                                  {formatPeriodShort(w.arusTertinggi.period)} {bertanda(w.arusTertinggi.arus)}
                                </span>
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto">
                    {/* Uang keluar berdiri sebagai kolomnya sendiri karena angkanya
                        sama persis untuk ketiga skenario — yang membedakan skenario
                        hanya uang masuknya. Mengulangnya tiga kali hanya menambah
                        angka yang harus dibaca tanpa menambah satu pun keterangan. */}
                    <table className="w-full min-w-[700px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="th">Bulan</th>
                          <th className="th num">Uang keluar</th>
                          {SKENARIO.map((sk) => (
                            <th key={sk} className="th num">
                              {NAMA_SKENARIO[sk]}
                              <span className="block text-[11px] font-normal normal-case tracking-normal text-slate-400">
                                masuk · saldo akhir
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Tiap skenario berhenti di bulan yang berbeda. Mengikuti yang
                            terpendek akan menyembunyikan bulan-bulan skenario optimis;
                            mengikuti yang terpanjang menghasilkan belasan baris yang
                            seluruhnya berbunyi "habis". Jadi: sampai skenario terakhir
                            yang memang habis, dengan beberapa bulan sebagai lantai. */}
                        {Array.from({ length: barisRunway }).map((_, i) => {
                          const kolom = SKENARIO.map((sk) => data.runway![sk].bulan[i] ?? null);
                          const periode = kolom.find((b) => b)?.period;
                          if (!periode) return null;
                          const keluar = kolom.find((b) => b)?.keluar ?? 0;
                          return (
                            <tr key={periode}>
                              <td className="td whitespace-nowrap">{formatPeriod(periode)}</td>
                              <td className="td num text-slate-500">{formatRupiah(keluar)}</td>
                              {kolom.map((b, j) => (
                                <td
                                  key={SKENARIO[j]}
                                  className={`td num ${
                                    !b ? 'text-slate-300'
                                      : b.saldoAkhir < 0 ? 'font-medium text-red-600'
                                      : !b.cukupGaji ? 'text-amber-600'
                                      : ''
                                  }`}
                                >
                                  {!b ? (
                                    'habis'
                                  ) : (
                                    <>
                                      <span className="block text-[11px] font-normal text-slate-400">
                                        masuk {formatRupiahShort(b.masuk)}
                                      </span>
                                      <span className="whitespace-nowrap">
                                        {formatRupiah(b.saldoAkhir)}
                                      </span>
                                    </>
                                  )}
                                  {b && b.saldoAkhir >= 0 && !b.cukupGaji && (
                                    <span className="block text-[11px]">
                                      kurang {formatRupiahShort(b.kurangGaji)} untuk gaji{' '}
                                      {formatPeriodShort(bulanSesudah(b.period))}
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {SKENARIO.some((sk) => !data.runway![sk].habisPada) && (
                    <p className="mt-3 text-xs text-slate-500">
                      Skenario yang tidak muncul angka habisnya tetap positif sepanjang{' '}
                      {HORIZON_BULAN} bulan ke depan.
                    </p>
                  )}
                  <p className="mt-4 text-xs text-slate-500">
                    Pengeluaran rutin {formatRupiah(data.asumsi.monthlyOutflow ?? data.asumsi.usulanOutflow ?? 0)} per
                    bulan, kebutuhan gaji {formatRupiah(data.asumsi.salaryNeed ?? data.asumsi.usulanGaji ?? 0)} per
                    bulan — ubah di panel samping.{' '}
                    <strong>Bulan berjalan</strong> dikurangi komitmen yang belum dibayar{' '}
                    {formatRupiah(rencana.komitmenBelumBayar)}
                    {sekaliIni > 0 && <> — di antaranya {formatRupiah(sekaliIni)} sekali ini saja</>}, lalu
                    belanja operasional sisa bulan.{' '}
                    <strong>Bulan-bulan berikutnya</strong> memakai proyeksinya masing-masing dikurangi
                    pengeluaran rutin
                    {data.musim.aktif ? (
                      <>
                        , menurut{' '}
                        <Link href="/musim" className="text-brand-700 hover:underline">pola musim</Link>
                        {data.musim.bulanDepan && (
                          <> — {formatPeriod(addMonths(data.period, 1))} {data.musim.bulanDepan.name.toLowerCase()}</>
                        )}.
                      </>
                    ) : (
                      <>
                        {' '}— saat ini sama dengan bulan berjalan, karena{' '}
                        <Link href="/musim" className="text-brand-700 hover:underline">pola musim</Link>{' '}
                        belum disiapkan.
                      </>
                    )}
                  </p>
                </Card>
              )}

              {!data.runway && (
                <Alert tone="info">
                  Isi <strong>pengeluaran rutin per bulan</strong> di panel samping agar sistem bisa menghitung
                  kapan kas habis.
                </Alert>
              )}

              <Card className="card-pad min-w-0">
                <SectionTitle hint="Skenario normal. Angka yang sama bisa dihitung ulang dengan tangan saat rapat.">
                  Cara menghitungnya
                </SectionTitle>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  <Suku label={`Saldo ${terakhir ? formatDate(terakhir.date) : ''}`} value={terakhir?.cashOnHand ?? 0} />
                  <Operator>+</Operator>
                  <Suku label="Sisa uang masuk" value={rencana.skenario.NORMAL.sisaMasuk} />
                  {belumBayar.map((k) => (
                    <span key={k.id} className="flex items-start gap-4">
                      <Operator>−</Operator>
                      <Suku label={k.dueDay ? `${k.label} tgl ${k.dueDay}` : k.label} value={k.amount} />
                    </span>
                  ))}
                  {rencana.cicilanBelanja > 0 && (
                    <span className="flex items-start gap-4">
                      <Operator>−</Operator>
                      <Suku label="Cicilan rencana belanja" value={rencana.cicilanBelanja} />
                    </span>
                  )}
                  {rencana.kewajiban > 0 && (
                    <span className="flex items-start gap-4">
                      <Operator>−</Operator>
                      <Suku label="Kewajiban terjadwal" value={rencana.kewajiban} />
                    </span>
                  )}
                  {rencana.terpakai > 0 && (
                    <span className="flex items-start gap-4">
                      <Operator>−</Operator>
                      <Suku label="Sudah dibelanjakan" value={rencana.terpakai} />
                    </span>
                  )}
                  <Operator>=</Operator>
                  <Suku label="Boleh belanja" value={rencana.skenario.NORMAL.bolehBelanja} tebal />
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Sisa uang masuk = proyeksi normal {formatRupiah(data.dipakai.NORMAL)} − yang sudah masuk{' '}
                  {formatRupiah(terakhir?.incomeToDate ?? 0)}. Di luar gaji, service, dan cicilan.
                </p>
              </Card>

              {mingguan && mingguan.baris.length > 0 && (
                <Card className="card-pad min-w-0">
                  <SectionTitle hint="Baris yang sudah lewat memakai laporan posisi kas, jadi uang masuknya angka nyata — bukan hasil membagi rata. Plafon dasar selalu boleh dipakai; tambahan baru dibuka bila uang masuk kumulatif sudah mencapai ambangnya.">
                    Aturan mingguan
                  </SectionTitle>

                  {/* Perbandingan yang sudah terjadi, satu kalimat, sebelum tabelnya.
                      Yang ingin diketahui tiap minggu bukan daftar angka, melainkan
                      satu hal: sedang di depan target atau di belakangnya. */}
                  {mingguan.baris.some((b) => b.lalu) && (
                    <p
                      className={`mb-4 rounded-lg border p-3 text-sm ${
                        mingguan.selisihLalu >= 0
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-amber-200 bg-amber-50 text-amber-900'
                      }`}
                    >
                      Sampai {terakhir ? formatDate(terakhir.date) : 'laporan terakhir'} masuk{' '}
                      <strong>{formatRupiah(mingguan.masukLalu)}</strong>, targetnya{' '}
                      <strong>{formatRupiah(mingguan.targetLalu)}</strong> —{' '}
                      {mingguan.selisihLalu >= 0 ? 'lebih cepat' : 'tertinggal'}{' '}
                      <strong>{formatRupiah(Math.abs(mingguan.selisihLalu))}</strong>.
                    </p>
                  )}

                  <div className="overflow-x-auto">
                    {/* Tambahan tidak berdiri sebagai kolom sendiri: ia selalu dibaca
                        bersama maksimumnya, dan tujuh kolom membuat perbandingan target
                        lawan kenyataan — yang justru jadi inti tabel ini — terdorong
                        keluar layar. */}
                    <table className="w-full min-w-[720px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="th">Minggu</th>
                          <th className="th num">Plafon dasar</th>
                          <th className="th num">Maksimum</th>
                          <th className="th num">Target masuk</th>
                          <th className="th num">Masuk nyata</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mingguan.baris.map((b, i) => {
                          const selisih = b.masuk === null ? null : b.masuk - b.target;
                          // Garis tebal sekali saja, tepat di batas antara yang sudah
                          // terjadi dan yang masih rencana.
                          const batas = !b.lalu && i > 0 && mingguan.baris[i - 1].lalu;
                          return (
                            <tr
                              key={b.mulai.toISOString()}
                              className={[
                                b.lalu ? 'bg-slate-50/70' : '',
                                b.berjalan ? 'bg-brand-50/40' : '',
                                batas ? 'border-t-2 border-slate-300' : '',
                              ].join(' ')}
                            >
                              <td className="td whitespace-nowrap">
                                {rentang(b.mulai, b.selesai)}
                                <span className="ml-2 text-xs text-slate-400">{b.hari} hari</span>
                                {b.berjalan && (
                                  <span className="ml-2 text-xs text-brand-700">berjalan</span>
                                )}
                                {!b.dalamBulan && (
                                  <span className="ml-2 text-xs text-slate-400">bulan depan</span>
                                )}
                                {/* Barisnya tidak selalu tujuh hari, jadi rupiahnya saja
                                    belum bisa diadu antar baris. Lajunya bisa. */}
                                {b.masukPerHari !== null && (
                                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                                    {formatRupiah(b.masukPerHari)} per hari
                                  </span>
                                )}
                              </td>
                              <td className="td num">
                                {b.plafonDasar === null ? '—' : formatRupiah(b.plafonDasar)}
                              </td>
                              <td className="td num font-medium">
                                {b.plafonDasar === null
                                  ? '—'
                                  : formatRupiah(b.plafonDasar + (b.tambahan ?? 0))}
                                {/* Diringkas: kolomnya sempit, dan angka pastinya tidak
                                    diperlukan untuk mengenali syaratnya. */}
                                {b.targetKumulatif !== null && b.tambahan ? (
                                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                                    +{formatRupiahShort(b.tambahan)} bila masuk ≥{' '}
                                    {formatRupiahShort(b.targetKumulatif)}
                                  </span>
                                ) : null}
                              </td>
                              <td className="td num text-slate-500">{formatRupiah(b.target)}</td>
                              {/* Selisihnya menempel pada angka nyatanya, bukan jadi kolom
                                  sendiri: satu kolom lagi mendorong seluruh perbandingan
                                  keluar layar, padahal justru itu isi tabel ini. */}
                              <td className="td num">
                                {/* Tanpa ini angka minus pecah: tanda "-" tertinggal di
                                    baris sendiri karena kolomnya sempit. */}
                                <span className="whitespace-nowrap">
                                  {b.masuk === null ? '—' : formatRupiah(b.masuk)}
                                </span>
                                {selisih !== null && (
                                  <span
                                    className={`mt-0.5 block text-[11px] font-medium ${
                                      selisih >= 0 ? 'text-emerald-700' : 'text-red-600'
                                    }`}
                                  >
                                    {selisih > 0 ? '+' : ''}
                                    {formatRupiahShort(selisih)} dari target
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 font-semibold">
                        <tr>
                          <td className="td whitespace-nowrap">Sisa {formatPeriod(data.period)}</td>
                          <td className="td num">
                            {formatRupiah(rencana.minggu.reduce((s, m) => s + m.plafonDasar, 0))}
                          </td>
                          <td className="td num">
                            {formatRupiah(rencana.minggu.reduce((s, m) => s + m.plafonDasar + m.tambahan, 0))}
                          </td>
                          <td className="td num">
                            {formatRupiah(
                              mingguan.baris
                                .filter((b) => !b.lalu && b.dalamBulan)
                                .reduce((s, b) => s + b.target, 0),
                            )}
                          </td>
                          <td className="td num">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Target masuk adalah laju harian skenario normal dikalikan jumlah hari barisnya,
                    jadi baris yang tidak tepat tujuh hari dan baris yang menyeberang pergantian
                    bulan tetap dibandingkan dengan angka yang setara. Baris bulan depan belum punya
                    plafon karena jatahnya baru dihitung setelah posisi kas bulan itu dilaporkan.
                  </p>
                </Card>
              )}

              {rencana.kategori.length > 0 && (
                <Card className="card-pad min-w-0">
                  <SectionTitle hint="Jatah tiap departemen diketik sendiri dari RAB-nya. Yang dipotong hanya belanja sesudah tanggal posisi kas: jatah − dipakai = sisa. Belanja sebelum tanggal itu sudah keluar dari saldo yang dilaporkan, jadi tidak dipotong dua kali.">
                    Plafon dan realisasi per kategori
                  </SectionTitle>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px]">
                      {/* Urutannya mengikuti hitungannya: jatah − dipakai = sisa, bersebelahan
                          dan terbaca dari kiri ke kanan. Belanja yang sudah tercermin di saldo
                          tidak jadi kolom tersendiri — ia hampir selalu sama dengan kolom
                          sebelahnya, dan dua angka kembar bersebelahan membuat seluruh tabel
                          terbaca seperti teka-teki. Tempatnya di baris kecil, hanya saat berbeda —
                          dan baris itu menyebut akibatnya, bukan hanya keberadaannya, karena yang
                          membacanya justru sedang bertanya mengapa sisa tidak ikut berkurang. */}
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="th">Kategori</th>
                          <th className="th num">Jatah bulan ini</th>
                          <th className="th num">Dipakai sejak posisi kas</th>
                          <th className="th num">Sisa</th>
                          <th className="th num">Plafon/minggu</th>
                          <th className="th num">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rencana.kategori.map((k, i) => {
                          const sumber = data.kategori[i];
                          const sisa = k.sisa;
                          const sudahDiSaldo = (sumber?.terpakaiBulanIni ?? 0) - k.terpakai;
                          return (
                            <tr key={k.label} className={sisa < 0 ? 'bg-red-50/40' : ''}>
                              <td className="td">{k.label}</td>
                              <td className="td num">
                                {sumber
                                  ? <CategoryBudget id={sumber.id} jatah={k.jatah} />
                                  : formatRupiah(k.jatah)}
                                {!k.ditetapkan && (
                                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                                    belum ditetapkan — masih ikut porsi lama
                                  </span>
                                )}
                              </td>
                              <td className="td num">
                                {k.terpakai > 0 ? formatRupiah(k.terpakai) : '—'}
                                {sudahDiSaldo > 0 && (
                                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                                    {formatRupiah(sudahDiSaldo)} sebelum itu, tidak memotong sisa
                                  </span>
                                )}
                              </td>
                              <td className={`td num ${sisa < 0 ? 'font-semibold text-red-600' : ''}`}>
                                {formatRupiah(sisa)}
                                {sisa < 0 && (
                                  <span className="mt-0.5 block text-[11px] font-normal text-red-600">
                                    lewat jatah
                                  </span>
                                )}
                              </td>
                              <td className="td num text-slate-500">{formatRupiah(k.perMinggu)}</td>
                              <td className="td num">
                                {sumber && (
                                  <CategoryDelete
                                    id={sumber.id}
                                    jumlahBelanja={data.belanja.filter((e) => e.categoryId === sumber.id).length}
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 font-semibold">
                        <tr>
                          <td className="td">Total</td>
                          <td className="td num">{formatRupiah(rencana.jatahKategori)}</td>
                          <td className="td num">{formatRupiah(rencana.terpakai)}</td>
                          <td className="td num">
                            {formatRupiah(rencana.kategori.reduce((t, k) => t + k.sisa, 0))}
                          </td>
                          <td className="td num" colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {/* Sejak jatahnya diketik sendiri, jumlahnya tidak lagi otomatis
                      sama dengan yang kas sanggup — dan itu justru angka yang perlu
                      dilihat. RAB menjawab "berapa yang direncanakan", kas menjawab
                      "berapa yang ada"; keduanya memang bisa berbeda, asal bedanya
                      tidak diam-diam. */}
                  {rencana.jatahKategori > rencana.jatahKas ? (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Jumlah jatah <strong>{formatRupiah(rencana.jatahKategori)}</strong>, sedangkan
                      kas bulan ini hanya sanggup{' '}
                      <strong>{formatRupiah(rencana.jatahKas)}</strong> menurut skenario normal
                      &mdash; kelebihan <strong>{formatRupiah(rencana.jatahKategori - rencana.jatahKas)}</strong>.
                      Plafon mingguan di bawah tetap mengikuti jatah yang Anda tetapkan, jadi
                      selisih itu perlu ditutup dari uang masuk yang melebihi perkiraan, atau
                      jatahnya yang diturunkan.
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">
                      Jumlah jatah <strong>{formatRupiah(rencana.jatahKategori)}</strong>, masih di
                      dalam kemampuan kas bulan ini{' '}
                      <strong>{formatRupiah(rencana.jatahKas)}</strong> menurut skenario normal.
                    </p>
                  )}

                  <p className="mt-3 text-xs text-slate-500">
                    Seluruh belanja {formatPeriod(data.period)}{' '}
                    <strong>
                      {formatRupiah(data.kategori.reduce((s2, k) => s2 + k.terpakaiBulanIni, 0))}
                    </strong>
                    . Yang memotong kolom sisa hanya{' '}
                    <strong>{formatRupiah(rencana.terpakai)}</strong>, yaitu yang terjadi setelah
                    tanggal posisi kas. Belanja sebelum tanggal itu sudah keluar dari saldo yang
                    dilaporkan, jadi memotongnya di sini berarti menghitung uang yang sama dua kali.
                  </p>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <CategoryForm planId={data.id} />
                  </div>
                </Card>
              )}
            </>
          )}

          <Card className="card-pad min-w-0">
            <SectionTitle hint="Skenario penilaian bisa dipilih; batas amannya satu kali gaji. Hanya rencana yang disetujui yang memotong anggaran.">
              Rencana belanja
            </SectionTitle>

            {data.rencanaBelanja.length > 0 && (
              <div className="mb-6 overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Rencana</th>
                      <th className="th">Status</th>
                      <th className="th num">Harga</th>
                      <th className="th">Cicilan</th>
                      <th className="th num">Jatuh tempo bulan ini</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rencanaBelanja.map((b) => (
                      <tr key={b.id} className={b.status === 'APPROVED' ? '' : 'text-slate-500'}>
                        <td className="td">
                          {b.label}
                          <span className="mt-0.5 block">
                            <JadwalTersimpan jadwal={b.jadwal} />
                          </span>
                        </td>
                        <td className="td">
                          <Badge tone={b.status === 'APPROVED' ? 'brand' : 'slate'}>
                            {b.status === 'APPROVED' ? 'Disetujui' : 'Draf'}
                          </Badge>
                        </td>
                        <td className="td num">{formatRupiah(b.amount)}</td>
                        <td className="td whitespace-nowrap text-xs">
                          {b.instalments === 1
                            ? 'sekali bayar'
                            : `${b.instalments}× ${NAMA_KADENS[b.cadence]}`}
                        </td>
                        <td className="td num">
                          {b.cicilanBulanIni > 0 ? formatRupiah(b.cicilanBulanIni) : '—'}
                        </td>
                        <td className="td num"><PurchaseActions id={b.id} status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.konteksBeli ? (
              <PurchaseCalculator
                konteks={data.konteksBeli}
                defaultDate={tanggalBawaan}
                tanggalPosisi={toDateInput(terakhir!.date)}
              />
            ) : (
              <Alert tone="info">
                Isi posisi kas dan pengeluaran rutin dulu — pemeriksa kemampuan beli membutuhkan
                keduanya untuk tahu sampai mana kas sanggup.
              </Alert>
            )}
          </Card>

          {data.belanja.length > 0 && (
            <Card className="card-pad min-w-0">
              <SectionTitle hint="Urut menurut tanggal. SETEL membuang seluruh laporan sebelumnya di kategori itu.">
                Laporan belanja
              </SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Tanggal</th>
                      <th className="th">Kategori</th>
                      <th className="th">Cara</th>
                      <th className="th num">Nominal</th>
                      <th className="th">Catatan</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.belanja.map((e) => (
                      <tr key={e.id} className={e.sebelumPosisi ? 'text-slate-400' : ''}>
                        <td className="td whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="td">{e.categoryLabel}</td>
                        <td className="td">
                          <Badge tone={e.mode === 'SETEL' ? 'amber' : 'slate'}>
                            {e.mode === 'SETEL' ? 'Setel ulang' : 'Tambah'}
                          </Badge>
                        </td>
                        <td className="td num">{formatRupiah(e.amount)}</td>
                        <td className="td text-xs">
                          {e.sebelumPosisi
                            ? 'Sudah termasuk di saldo kas yang dilaporkan'
                            : e.notes ?? '—'}
                        </td>
                        <td className="td num"><SpendDelete id={e.id} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="td" colSpan={3}>Terpakai sejak posisi kas terakhir</td>
                      <td className="td num">{formatRupiah(rencana?.terpakai ?? 0)}</td>
                      <td className="td" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          <Card className="card-pad min-w-0">
            <SectionTitle hint="Pengeluaran yang sudah pasti. Yang ditandai sudah dibayar tidak lagi mengurangi anggaran.">
              Komitmen bulan ini
            </SectionTitle>
            {data.komitmen.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">
                Belum ada komitmen. Tambahkan cicilan bank, gaji, dan service lewat panel di samping.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Komitmen</th>
                      <th className="th">Jatuh tempo</th>
                      <th className="th">Status</th>
                      <th className="th num">Nominal</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.komitmen.map((k) => (
                      <tr key={k.id} className={k.paid ? 'text-slate-400' : ''}>
                        <td className="td">
                          {k.label}
                          {!k.recurring && <span className="ml-2 text-xs text-slate-400">sekali ini</span>}
                        </td>
                        <td className="td">{k.dueDay ? `Tanggal ${k.dueDay}` : '—'}</td>
                        <td className="td">
                          <Badge tone={k.paid ? 'slate' : 'brand'}>{k.paid ? 'Sudah dibayar' : 'Belum'}</Badge>
                        </td>
                        <td className="td num">{formatRupiah(k.amount)}</td>
                        <td className="td num"><CommitmentRow id={k.id} paid={k.paid} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="td" colSpan={3}>Belum dibayar</td>
                      <td className="td num">
                        {formatRupiah(belumBayar.reduce((s, k) => s + k.amount, 0))}
                      </td>
                      <td className="td num">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {(data.kewajiban.bulanIni.length > 0 || data.kewajiban.mendatang.length > 0) && (
            <Card className="card-pad min-w-0">
              <SectionTitle hint="Berasal dari master data Kewajiban Terjadwal — pajak kendaraan, PBB, perizinan. Tidak perlu diketik ulang tiap bulan.">
                Kewajiban terjadwal
              </SectionTitle>

              {data.kewajiban.bulanIni.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="mb-2 text-sm font-medium text-slate-700">Bulan ini</p>
                  <table className="w-full min-w-[560px]">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="th">Jatuh tempo</th>
                        <th className="th">Kewajiban</th>
                        <th className="th num">Nominal</th>
                        <th className="th">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.kewajiban.bulanIni.map((e) => (
                        <tr key={`${e.id}-${e.jatuhTempo.toISOString()}`} className={e.sebelumPosisi ? 'text-slate-400' : ''}>
                          <td className="td whitespace-nowrap">{formatDate(e.jatuhTempo)}</td>
                          <td className="td">{e.label}</td>
                          <td className="td num">{formatRupiah(e.amount)}</td>
                          <td className="td text-xs">
                            {e.sebelumPosisi ? 'Sudah termasuk di saldo kas yang dilaporkan' : 'Menekan plafon bulan ini'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 font-semibold">
                      <tr>
                        <td className="td" colSpan={2}>Masih akan keluar bulan ini</td>
                        <td className="td num">{formatRupiah(data.kewajiban.belumKeluar)}</td>
                        <td className="td" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {data.kewajiban.mendatang.length > 0 && (
                <div className={data.kewajiban.bulanIni.length > 0 ? 'mt-6' : ''}>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    {HORIZON_BULAN} bulan ke depan
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px]">
                      <tbody className="divide-y divide-slate-100">
                        {data.kewajiban.mendatang.map((e) => (
                          <tr key={`${e.id}-${e.jatuhTempo.toISOString()}`}>
                            <td className="td whitespace-nowrap text-slate-500">{formatDate(e.jatuhTempo)}</td>
                            <td className="td">{e.label}</td>
                            <td className="td num">{formatRupiah(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 font-semibold">
                        <tr>
                          <td className="td" colSpan={2}>Jumlah</td>
                          <td className="td num">
                            {formatRupiah(data.kewajiban.mendatang.reduce((t, e) => t + e.amount, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Sudah ikut menurunkan saldo di &ldquo;Kapan kas habis&rdquo; pada bulannya
                    masing-masing, dan menekan kemampuan beli di rencana belanja.
                  </p>
                </div>
              )}

              <p className="mt-4 text-xs text-slate-500">
                Daftarnya diurus di{' '}
                <Link href="/kewajiban" className="text-brand-700 hover:underline">
                  Kewajiban Terjadwal
                </Link>.
              </p>
            </Card>
          )}

          {data.checkpoint.length > 0 && (
            <Card className="card-pad min-w-0">
              <SectionTitle hint="Riwayat laporan mingguan. Baris teratas yang dipakai menghitung.">
                Pergerakan posisi kas
              </SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Tanggal</th>
                      <th className="th num">Saldo kas</th>
                      <th className="th num">Uang masuk kumulatif</th>
                      <th className="th">Catatan</th>
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.checkpoint.map((c, i) => (
                      <tr key={c.id} className={i === 0 ? 'bg-brand-50/40' : ''}>
                        <td className="td">
                          {formatDate(c.date)}
                          {i === 0 && <span className="ml-2 text-xs text-brand-700">dipakai</span>}
                        </td>
                        <td className="td num">{formatRupiah(c.cashOnHand)}</td>
                        <td className="td num">{formatRupiah(c.incomeToDate)}</td>
                        <td className="td text-xs text-slate-500">{c.notes ?? '—'}</td>
                        <td className="td num"><CheckpointDelete id={c.id} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="pt-2">
            <PlanDelete id={data.id} period={formatPeriod(data.period)} />
          </div>
        </div>

        <div className="space-y-6">
          <Card className="card-pad">
            <SectionTitle hint="Satu-satunya yang perlu diisi ulang tiap minggu.">
              Posisi kas minggu ini
            </SectionTitle>
            <CheckpointForm
              planId={data.id}
              defaultDate={tanggalBawaan}
              menurutJurnal={data.menurutJurnal}
              terakhir={terakhir}
            />
          </Card>

          <Card className="card-pad">
            <SectionTitle hint="Untuk bulan berjalan. Bulan-bulan sesudahnya mengikuti pola musim.">
              Proyeksi uang masuk
            </SectionTitle>
            <ProjectionForm
              id={data.id}
              tersimpan={data.tersimpan}
              usulan={data.usulan}
              notes={data.notes}
            />
            {data.riwayatMasuk.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Riwayat uang masuk</p>
                <ul className="space-y-0.5 text-xs text-slate-600">
                  {data.riwayatMasuk.map((r) => (
                    <li key={r.period} className="flex justify-between gap-3">
                      <span>{formatPeriod(r.period)}</span>
                      <span className="tabular-nums">{formatRupiah(r.cashIn)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <SectionTitle hint="Berapa yang sudah dibelanjakan sejak posisi kas terakhir.">
              Catat belanja
            </SectionTitle>
            <SpendForm
              planId={data.id}
              kategori={data.kategori.map((k) => ({ id: k.id, label: k.label, terpakai: k.terpakai }))}
              defaultDate={tanggalBawaan}
            />
          </Card>

          <Card className="card-pad">
            <SectionTitle hint="Hanya dipakai untuk meramalkan kapan kas habis, tidak memengaruhi plafon.">
              Asumsi bulanan
            </SectionTitle>
            <AssumptionForm id={data.id} asumsi={data.asumsi} />
          </Card>

          <Card className="card-pad">
            <SectionTitle>Tambah komitmen</SectionTitle>
            <CommitmentForm planId={data.id} />
          </Card>
        </div>
      </div>
    </>
  );
}
