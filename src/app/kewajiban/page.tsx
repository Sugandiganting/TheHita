import Link from 'next/link';
import { getKendaraan, getKewajiban } from '@/lib/queries';
import { labelPengulangan } from '@/lib/kewajiban';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
import {
  ObligationActions, ObligationForm, PayObligation,
} from '@/components/kewajiban-form';
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** Jarak hari dari hari ini, untuk menandai yang sudah dekat. */
function selisihHari(d: Date): number {
  const hariIni = new Date();
  const a = Date.UTC(hariIni.getUTCFullYear(), hariIni.getUTCMonth(), hariIni.getUTCDate());
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export default async function KewajibanPage() {
  const [daftar, kendaraan] = await Promise.all([getKewajiban(), getKendaraan()]);
  const hariIni = toDateInput(new Date());
  const aktif = daftar.filter((k) => k.active);
  const setahun = aktif
    .filter((k) => k.berikutnya && selisihHari(k.berikutnya.jatuhTempo) <= 365)
    .reduce((t, k) => t + (k.berikutnya?.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Kewajiban Terjadwal"
        description="Uang keluar yang tanggalnya sudah diketahui jauh hari — pajak kendaraan, PBB, perpanjangan izin, asuransi tahunan."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {daftar.length === 0 ? (
            <Card className="card-pad">
              <EmptyState
                title="Belum ada kewajiban terjadwal"
                description="Daftarkan yang tanggalnya sudah pasti, lalu Rencana Kas akan menampilkannya jauh sebelum bulannya tiba."
              />
            </Card>
          ) : (
            <>
              <Alert tone="info">
                {aktif.length} kewajiban aktif, dengan {formatRupiah(setahun)} jatuh tempo dalam dua
                belas bulan ke depan. Angka itu sudah ikut menekan{' '}
                <Link href="/rencana-kas" className="font-medium text-brand-700 hover:underline">
                  Rencana Kas Mingguan
                </Link>{' '}
                pada bulannya masing-masing.
              </Alert>

              <Card className="card-pad min-w-0">
                <SectionTitle hint="Jatuh tempo berikutnya dihitung dari pengulangannya. Yang sudah ditandai lunas bergeser sendiri ke tanggal sesudahnya.">
                  Daftar kewajiban
                </SectionTitle>

                <div className="space-y-3">
                  {daftar.map((k) => {
                    const hari = k.berikutnya ? selisihHari(k.berikutnya.jatuhTempo) : null;
                    const dekat = hari !== null && hari <= 45;
                    const lewat = hari !== null && hari < 0;

                    return (
                      <div
                        key={k.id}
                        className={`rounded-lg border p-4 ${
                          k.active ? 'border-slate-200' : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">
                              {k.label}
                              {k.kendaraan && (
                                <span className="ml-2 text-sm font-normal text-slate-500">
                                  {k.kendaraan.plate} · {k.kendaraan.name}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {formatRupiah(k.amount)} · {labelPengulangan(k.repeat, k.repeatEvery)}
                              {k.notes && <> · {k.notes}</>}
                            </p>
                          </div>

                          <div className="text-right">
                            {!k.active ? (
                              <Badge tone="slate">Nonaktif</Badge>
                            ) : k.berikutnya ? (
                              <>
                                <p className={`font-semibold ${lewat ? 'text-red-600' : dekat ? 'text-amber-700' : 'text-slate-800'}`}>
                                  {formatDate(k.berikutnya.jatuhTempo)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {lewat
                                    ? `lewat ${-hari!} hari`
                                    : hari === 0
                                      ? 'jatuh tempo hari ini'
                                      : `${hari} hari lagi`}
                                </p>
                              </>
                            ) : (
                              <Badge tone="green">Selesai</Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          {k.active && k.berikutnya ? (
                            <PayObligation
                              id={k.id}
                              jatuhTempo={k.berikutnya.jatuhTempo}
                              perkiraan={k.berikutnya.amount}
                              hariIni={hariIni}
                            />
                          ) : (
                            <span />
                          )}
                          <ObligationActions
                            id={k.id}
                            active={k.active}
                            adaPelunasan={k.riwayat.length > 0}
                          />
                        </div>

                        {k.riwayat.length > 0 && (
                          <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                            Pernah dibayar:{' '}
                            {k.riwayat
                              .slice(0, 4)
                              .map((r) => `${formatDate(r.paidDate)} ${formatRupiah(r.amount)}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </div>

        <div className="space-y-6">
          <Card className="card-pad">
            <SectionTitle>Tambah kewajiban</SectionTitle>
            <ObligationForm
              kendaraan={kendaraan.map((v) => ({ id: v.id, plate: v.plate, name: v.name }))}
              hariIni={hariIni}
            />
          </Card>

          <Card className="card-pad">
            <SectionTitle>Cara dipakainya</SectionTitle>
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                Yang jatuh tempo <strong>bulan ini</strong> ikut menekan plafon mingguan, seperti
                komitmen biasa — kecuali yang tanggalnya sudah lewat sebelum posisi kas terakhir,
                karena itu sudah tercermin di saldonya.
              </p>
              <p>
                Yang jatuh tempo di <strong>bulan-bulan berikutnya</strong> menurunkan ramalan
                &ldquo;kapan kas habis&rdquo; pada bulannya masing-masing, dan ikut menekan
                kemampuan beli di rencana belanja.
              </p>
              <p className="text-xs text-slate-500">
                Setelah ditandai lunas, nominal sebenarnya tersimpan sebagai riwayat dan jatuh
                temponya bergeser sendiri — pajak biasanya naik sedikit tiap tahun, jadi angka tahun
                lalu adalah tebakan terbaik untuk tahun depan.
              </p>
              <p className="text-xs text-slate-500">
                Kendaraan didaftarkan di menu{' '}
                <Link href="/kendaraan" className="text-brand-700 hover:underline">Kendaraan</Link>.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
