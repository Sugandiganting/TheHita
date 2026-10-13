import Link from 'next/link';
import { getKendaraan, getUnitPilihan } from '@/lib/queries';
import { labelPengulangan } from '@/lib/kewajiban';
import { formatDate, formatRupiah, toDateInput } from '@/lib/format';
import { TambahJadwal, VehicleDelete, VehicleForm } from '@/components/kewajiban-form';
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

const NAMA_JENIS: Record<string, string> = {
  MOBIL: 'Mobil',
  MOTOR: 'Motor',
  LAINNYA: 'Lainnya',
};

export default async function KendaraanPage() {
  const [daftar, unit] = await Promise.all([getKendaraan(), getUnitPilihan()]);
  const hariIni = toDateInput(new Date());

  return (
    <>
      <PageHeader
        title="Kendaraan"
        description="Kendaraan perusahaan beserta jadwal pajaknya. Satu kendaraan biasanya menanggung dua jadwal: pajak tahunan dan STNK lima tahunan."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {daftar.length === 0 ? (
            <Card className="card-pad">
              <EmptyState
                title="Belum ada kendaraan"
                description="Daftarkan kendaraannya dulu, lalu tambahkan jadwal pajak untuk masing-masing."
              />
            </Card>
          ) : (
            daftar.map((v) => (
              <Card key={v.id} className="card-pad min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-800">
                      {v.plate}
                      {!v.active && <span className="ml-2"><Badge tone="slate">Nonaktif</Badge></span>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {v.name} · {NAMA_JENIS[v.kind] ?? v.kind}
                      {v.unitName && <> · {v.unitName}</>}
                      {v.notes && <> · {v.notes}</>}
                    </p>
                  </div>
                  <VehicleDelete id={v.id} plate={v.plate} jumlahJadwal={v.kewajiban.length} />
                </div>

                {v.kewajiban.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[520px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          <th className="th">Jadwal</th>
                          <th className="th num">Nominal</th>
                          <th className="th">Pengulangan</th>
                          <th className="th">Jatuh tempo berikutnya</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {v.kewajiban.map((k) => (
                          <tr key={k.id} className={k.active ? '' : 'text-slate-400'}>
                            <td className="td">{k.label}</td>
                            <td className="td num">{formatRupiah(k.amount)}</td>
                            <td className="td text-xs">{labelPengulangan(k.repeat, k.repeatEvery)}</td>
                            <td className="td whitespace-nowrap">
                              {!k.active
                                ? 'nonaktif'
                                : k.berikutnya
                                  ? formatDate(k.berikutnya.jatuhTempo)
                                  : 'selesai'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4">
                  <TambahJadwal vehicleId={v.id} hariIni={hariIni} />
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-6">
          <Card className="card-pad">
            <SectionTitle>Tambah kendaraan</SectionTitle>
            <VehicleForm unit={unit} />
          </Card>

          <Card className="card-pad">
            <SectionTitle>Kaitannya dengan kas</SectionTitle>
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                Kendaraan sendiri tidak memengaruhi kas. Yang memengaruhi adalah jadwal pajaknya,
                dan seluruhnya terkumpul di menu{' '}
                <Link href="/kewajiban" className="text-brand-700 hover:underline">
                  Kewajiban Terjadwal
                </Link>{' '}
                bersama PBB dan perizinan.
              </p>
              <p className="text-xs text-slate-500">
                Menghapus kendaraan ikut menghapus jadwal pajaknya. Kalau kendaraannya cuma dijual
                atau berhenti disewakan, nonaktifkan jadwalnya saja agar riwayat pembayarannya tetap
                tersimpan.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
