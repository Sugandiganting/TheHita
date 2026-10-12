import { getRencanaKas, getRencanaKasPeriods } from '@/lib/queries';
import { currentPeriod } from '@/lib/period';
import { HORIZON_BULAN, NAMA_SKENARIO, SKENARIO, type Skenario } from '@/lib/rencana-kas';
import { formatDate, formatPeriod, formatRupiah, toDateInput } from '@/lib/format';
import type { SearchParams } from '@/lib/search-params';
import {
  AssumptionForm, CategoryDelete, CategoryForm, CheckpointDelete, CheckpointForm, CommitmentForm,
  CommitmentRow, PlanDelete, PlanForm, ProjectionForm, SpendDelete, SpendForm,
} from '@/components/rencana-kas-form';
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

/** "10 – 16 Okt": rentang dalam satu bulan tidak perlu menyebut bulannya dua kali. */
function rentang(mulai: Date, selesai: Date): string {
  return `${mulai.getUTCDate()} – ${selesai.getUTCDate()} ${BULAN[selesai.getUTCMonth()]}`;
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
            description="Buat rencana bulan ini lewat formulir di atas. Komitmen seperti cicilan bank dan gaji akan tersalin dari bulan sebelumnya."
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
  const belumBayar = data.komitmen.filter((k) => !k.paid);

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

              {data.runway && (
                <Card className="card-pad min-w-0">
                  <SectionTitle hint="Bila pola belanja tidak berubah dan plafon mingguan di bawah tidak diikuti. Saldo akhir tiap bulan.">
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
                          <p className="text-xs text-slate-500">
                            {w.arusBersih < 0
                              ? `Berkurang ${formatRupiah(-w.arusBersih)} tiap bulan`
                              : `Bertambah ${formatRupiah(w.arusBersih)} tiap bulan`}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="th">Saldo akhir</th>
                          {SKENARIO.map((sk) => (
                            <th key={sk} className="th num">{NAMA_SKENARIO[sk]}</th>
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
                          return (
                            <tr key={periode}>
                              <td className="td">{formatPeriod(periode)}</td>
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
                                  {!b ? 'habis' : formatRupiah(b.saldoAkhir)}
                                  {b && b.saldoAkhir >= 0 && !b.cukupGaji && (
                                    <span className="block text-[11px]">kurang untuk gaji</span>
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
                    bulan. Bulan berjalan memakai uang masuk yang benar-benar tersisa; bulan berikutnya memakai
                    proyeksi penuh. Ubah asumsinya di panel samping.
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

              {rencana.minggu.length > 0 && (
                <Card className="card-pad min-w-0">
                  <SectionTitle hint="Plafon dasar selalu boleh dipakai. Tambahan baru dibuka bila uang masuk kumulatif sudah mencapai targetnya.">
                    Aturan mingguan
                  </SectionTitle>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="th">Minggu</th>
                          <th className="th num">Plafon dasar</th>
                          <th className="th num">Tambahan</th>
                          <th className="th num">Maksimum</th>
                          <th className="th num">Target masuk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rencana.minggu.map((m) => (
                          <tr key={m.mulai.toISOString()}>
                            <td className="td whitespace-nowrap">
                              {rentang(m.mulai, m.selesai)}
                              <span className="ml-2 text-xs text-slate-400">{m.hari} hari</span>
                            </td>
                            <td className="td num">{formatRupiah(m.plafonDasar)}</td>
                            <td className="td num">{m.tambahan > 0 ? `+${formatRupiah(m.tambahan)}` : '—'}</td>
                            <td className="td num font-medium">{formatRupiah(m.plafonDasar + m.tambahan)}</td>
                            <td className="td num">{m.tambahan > 0 ? formatRupiah(m.targetMasuk) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 font-semibold">
                        <tr>
                          <td className="td">Total</td>
                          <td className="td num">
                            {formatRupiah(rencana.minggu.reduce((s, m) => s + m.plafonDasar, 0))}
                          </td>
                          <td className="td num">
                            +{formatRupiah(rencana.minggu.reduce((s, m) => s + m.tambahan, 0))}
                          </td>
                          <td className="td num">
                            {formatRupiah(rencana.minggu.reduce((s, m) => s + m.plafonDasar + m.tambahan, 0))}
                          </td>
                          <td className="td num">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              )}

              {rencana.kategori.length > 0 && (
                <Card className="card-pad min-w-0">
                  <SectionTitle hint="Jatah dibagi menurut porsi tiap kategori; yang sudah dipakai diambil dari laporan belanja.">
                    Plafon dan realisasi per kategori
                  </SectionTitle>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="th">Kategori</th>
                          <th className="th num">Per minggu</th>
                          <th className="th num">Jatah sisa bulan</th>
                          <th className="th num">Sudah dipakai</th>
                          <th className="th num">Sisa</th>
                          <th className="th num">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rencana.kategori.map((k, i) => {
                          const sumber = data.kategori[i];
                          const terpakai = sumber?.terpakai ?? 0;
                          const sisa = k.sisaBulan - terpakai;
                          return (
                            <tr key={k.label}>
                              <td className="td">
                                {k.label}
                                <span className="ml-2 text-xs text-slate-400">porsi {sumber?.weight ?? '—'}</span>
                              </td>
                              <td className="td num">{formatRupiah(k.perMinggu)}</td>
                              <td className="td num">{formatRupiah(k.sisaBulan)}</td>
                              <td className="td num">{terpakai > 0 ? formatRupiah(terpakai) : '—'}</td>
                              <td className={`td num ${sisa < 0 ? 'font-medium text-red-600' : ''}`}>
                                {formatRupiah(sisa)}
                              </td>
                              <td className="td num">{sumber && <CategoryDelete id={sumber.id} />}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <CategoryForm planId={data.id} />
                  </div>
                </Card>
              )}
            </>
          )}

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
            <SectionTitle hint="Kosongkan untuk memakai usulan dari riwayat uang masuk.">
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
