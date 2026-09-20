import { prisma } from '@/lib/db';
import { UNIT_TYPE_LABEL } from '@/lib/accounting';
import { formatRupiah } from '@/lib/format';
import { toggleUnitActive } from '@/app/actions';
import { UnitForm } from '@/components/unit-form';
import { Alert, Badge, Card, PageHeader, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function UnitPage() {
  const [units, groups] = await Promise.all([
    prisma.businessUnit.findMany({
      orderBy: { code: 'asc' },
      include: { group: true, _count: { select: { lines: true, projects: true } } },
    }),
    prisma.businessGroup.findMany(),
  ]);

  // Kelompokkan berdasarkan PMS lama untuk memperlihatkan rencana migrasi.
  const byPms = units.reduce<Record<string, typeof units>>((acc, u) => {
    const key = u.legacyPms ?? 'Belum dipetakan';
    (acc[key] ??= []).push(u);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Unit usaha"
        description="Daftar cabang dan jenis usaha dalam grup. Setiap transaksi wajib menunjuk salah satu unit, itulah yang memungkinkan laporan dipisah per cabang."
      />

      <div className="mb-6">
        <Alert tone="success" title="Satu sistem untuk semua cabang">
          Jawaban atas pertanyaan “apakah satu sistem bisa mengatur semuanya?” — bisa. Unit usaha di bawah ini
          semuanya berjalan di satu database dengan satu COA. Tidak ada lagi batasan jumlah properti per sistem,
          sehingga Sri Krisna, The Hita Legian, The Hita Uluwatu, Play Laundry, dan IGYT Coffee &amp; Eatery bisa
          digabung tanpa kehilangan kemampuan melihat angka masing-masing.
        </Alert>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card className="card-pad">
            <SectionTitle hint={`${units.length} unit dalam grup ${groups[0]?.name ?? ''}`}>
              Daftar unit
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="th">Kode</th>
                    <th className="th">Nama</th>
                    <th className="th">Jenis</th>
                    <th className="th num">Kamar</th>
                    <th className="th num">Saldo kas awal</th>
                    <th className="th num">Baris jurnal</th>
                    <th className="th">PMS lama</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {units.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="td font-mono text-xs text-slate-500">{u.code}</td>
                      <td className="td font-medium text-slate-900">{u.name}</td>
                      <td className="td">
                        <Badge tone={u.type === 'HOTEL' ? 'brand' : u.type === 'CAFE' ? 'amber' : 'blue'}>
                          {UNIT_TYPE_LABEL[u.type] ?? u.type}
                        </Badge>
                      </td>
                      <td className="td num">{u.roomCount > 0 ? u.roomCount : '—'}</td>
                      <td className="td num">{formatRupiah(u.openingCash)}</td>
                      <td className="td num text-xs text-slate-500">{u._count.lines}</td>
                      <td className="td text-xs text-slate-500">{u.legacyPms ?? '—'}</td>
                      <td className="td">
                        <form action={toggleUnitActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit">
                            <Badge tone={u.active ? 'green' : 'slate'}>{u.active ? 'Aktif' : 'Non-aktif'}</Badge>
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="card-pad">
            <SectionTitle hint="Pemetaan dari sistem lama ke sistem ini — berguna saat memindahkan data.">
              Asal data di PMS lama
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(byPms).map(([pms, list]) => (
                <div key={pms} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">{pms}</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {list.map((u) => (
                      <li key={u.id} className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{u.code}</span>
                        {u.name}
                        <span className="text-xs text-slate-400">({UNIT_TYPE_LABEL[u.type] ?? u.type})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Di sistem ini pengelompokan di atas tidak lagi membatasi apa pun — semuanya sudah berada dalam satu
              database. Kolom ini hanya menjadi catatan asal data.
            </p>
          </Card>
        </div>

        <div>
          <Card className="card-pad sticky top-20">
            <SectionTitle hint="Menambah cabang atau lini usaha baru cukup lewat formulir ini.">
              Unit baru
            </SectionTitle>
            <UnitForm />
          </Card>
        </div>
      </div>
    </>
  );
}
