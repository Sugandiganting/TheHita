import Link from 'next/link';
import { getKendaraan, getUnitPilihan } from '@/lib/queries';
import { toDateInput } from '@/lib/format';
import {
  JadwalRow, TambahJadwal, VehicleForm, VehicleHeader,
} from '@/components/kewajiban-form';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';

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
                <VehicleHeader
                  unit={unit}
                  jumlahJadwal={v.kewajiban.length}
                  keterangan={[
                    v.name,
                    NAMA_JENIS[v.kind] ?? v.kind,
                    v.unitName ?? 'Semua cabang',
                    v.notes,
                  ].filter(Boolean).join(' · ')}
                  awal={{
                    id: v.id, plate: v.plate, name: v.name, kind: v.kind,
                    unitId: v.unitId, active: v.active, notes: v.notes,
                  }}
                />

                {v.kewajiban.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[520px]">
                      <thead className="border-b border-slate-200">
                        <tr>
                          {/* Kolom pertama menyerap sisa lebar, sehingga kolom
                              angka dan tanggal rapat di kanan alih-alih
                              terlempar berjauhan. */}
                          <th className="th w-full">Jadwal</th>
                          <th className="th num whitespace-nowrap">Nominal</th>
                          <th className="th whitespace-nowrap">Pengulangan</th>
                          <th className="th whitespace-nowrap">Jatuh tempo</th>
                          <th className="th num">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {v.kewajiban.map((k) => (
                          <JadwalRow
                            key={k.id}
                            aktif={k.active}
                            jatuhTempo={k.berikutnya?.jatuhTempo ?? null}
                            hariIni={hariIni}
                            awal={{
                              id: k.id, label: k.label, amount: k.amount,
                              dueDate: toDateInput(k.dueDate), repeat: k.repeat,
                              repeatEvery: k.repeatEvery, vehicleId: v.id, notes: k.notes,
                            }}
                          />
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
                <strong>Semua cabang</strong> adalah pilihan bawaan penanggungnya. Pilih satu cabang
                hanya bila kendaraannya memang milik cabang itu sendiri; nominal yang keluar dari kas
                sama saja, yang berbeda hanya siapa yang menanggungnya di laporan.
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
