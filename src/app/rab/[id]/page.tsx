import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getBudgetDetail } from '@/lib/queries';
import { formatDate, formatPeriod, formatPercent, formatRupiah } from '@/lib/format';
import { JENIS_RAB_LABEL, penghematanBaris, type BarisBarangRab } from '@/lib/rab';
import { type BarangOption } from '@/components/budget-form';
import {
  RealisasiAkunDialog, RealisasiBarangDialog,
  TambahAnggaranDialog, TambahBarangRabDialog, UbahAnggaranDialog, UbahBarangRabDialog,
} from '@/components/budget-dialog';
import { BudgetActions, BudgetItemLineDelete, BudgetLineDelete } from '@/components/budget-actions';
import { Alert, Badge, Card, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rab, accounts, lines, barang] = await Promise.all([
    getBudgetDetail(id),
    prisma.account.findMany({
      where: { isHeader: false, active: true, type: { in: ['EXPENSE', 'COGS'] } },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.budgetLine.findMany({
      where: { budgetId: id },
      select: {
        id: true, accountId: true, amount: true, notes: true, planDate: true,
        realAmount: true, realDate: true, realDone: true, realNotes: true,
      },
    }),
    prisma.item.findMany({
      where: { active: true },
      orderBy: [{ category: { name: 'asc' } }, { code: 'asc' }],
      select: {
        id: true, code: true, name: true,
        unit: { select: { code: true } },
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        account: { select: { code: true, name: true } },
      },
    }),
  ]);

  if (!rab) notFound();

  const disahkan = rab.status === 'ACTIVE';
  // Tanggal bawaan realisasi: hari ini bila RAB-nya bulan berjalan, selain itu
  // tanggal 1 bulan RAB-nya — supaya realisasi bulan lalu tidak tanpa sengaja
  // tercatat di bulan ini.
  const hariIni = new Date().toISOString().slice(0, 10);
  const tanggalBawaanRealisasi = hariIni.startsWith(rab.period) ? hariIni : `${rab.period}-01`;
  const hematBaris = (b: BarisBarangRab) => penghematanBaris(b);
  const keIsoTanggal = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
  const purchasing = rab.kind === 'PURCHASING';
  // Pada RAB purchasing, realisasi dilaporkan per barang di tabel di atas;
  // tabel per akun di bawahnya hanya rangkuman menurut jurnal. Baru pada RAB
  // selain purchasing baris akun itulah rinciannya, jadi di sanalah
  // realisasinya dicatat.
  const realisasiAkun = disahkan && !purchasing;
  const barisPerAkun = new Map(lines.map((l) => [l.accountId, l]));
  const r = rab.ringkasan;

  const opsiBarang: BarangOption[] = barang.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    satuan: b.unit.code,
    kategori: b.category.name,
    subKategori: b.subCategory.name,
    accountCode: b.account.code,
    accountName: b.account.name,
  }));

  return (
    <>
      <PageHeader
        title={`RAB ${JENIS_RAB_LABEL[rab.kind]} ${rab.scope} — ${formatPeriod(rab.period)}`}
        description={
          rab.bersama
            ? `Biaya yang ditanggung ${rab.cabang.join(' dan ')} bersama-sama. Tidak masuk RAB cabang mana pun.`
            : `Biaya yang dikendalikan ${rab.scope} sendiri. Porsi beban bersama punya RAB tersendiri.`
        }
        action={
          purchasing ? (
            <TambahBarangRabDialog
              budgetId={rab.id} items={opsiBarang} periode={rab.period} disabled={disahkan}
            />
          ) : (
            <TambahAnggaranDialog
              budgetId={rab.id} accounts={accounts} periode={rab.period} disabled={disahkan}
            />
          )
        }
      />

      <p className="mb-4 text-sm">
        <Link href="/rab" className="text-slate-600 hover:underline">← Kembali ke daftar RAB</Link>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dianggarkan" value={formatRupiah(r.totalAnggaran)} />
        <StatCard label="Realisasi" value={formatRupiah(r.totalRealisasi)} />
        <StatCard
          label="Sisa"
          value={formatRupiah(r.totalSisa)}
          tone={r.totalSisa < 0 ? 'negative' : 'positive'}
          hint={r.totalSisa < 0 ? 'Sudah lewat anggaran' : undefined}
        />
        <StatCard
          label="Terpakai"
          value={r.terpakaiPct === null ? '—' : formatPercent(r.terpakaiPct)}
          hint={disahkan ? 'RAB sudah disahkan' : 'Masih draf, belum disahkan'}
        />
      </div>

      {(r.jumlahLewat > 0 || r.jumlahTakDianggarkan > 0 || rab.akunTumpang.length > 0) && (
        <div className="mt-4 space-y-2">
          {rab.akunTumpang.length > 0 && (
            <Alert tone="warning">
              Akun {rab.akunTumpang.map((a) => `${a.code} ${a.name}`).join(', ')} juga dianggarkan di
              RAB {JENIS_RAB_LABEL[purchasing ? 'UMUM' : 'PURCHASING']} cabang dan bulan yang sama.
              Realisasinya ditampilkan penuh di kedua RAB, karena jurnal tidak mencatat RAB mana yang
              dimaksud sebuah beban — jadi sisa di masing-masing RAB lebih kecil dari yang sebenarnya.
              Bandingkan totalnya di Laporan RAB, yang menghitung tiap akun satu kali.
            </Alert>
          )}
          {r.jumlahLewat > 0 && (
            <Alert tone="warning">
              {r.jumlahLewat} akun sudah melewati anggarannya.
            </Alert>
          )}
          {r.jumlahTakDianggarkan > 0 && (
            <Alert tone="warning">
              {r.jumlahTakDianggarkan} akun terpakai tanpa pernah dianggarkan. Tetap ditampilkan di bawah
              supaya total realisasinya sama dengan beban yang benar-benar terjadi.
            </Alert>
          )}
        </div>
      )}

      <Card className="card-pad mt-6">
        <BudgetActions
          id={rab.id}
          status={rab.status}
          lineCount={purchasing ? rab.barang.length : r.baris.filter((b) => b.anggaran > 0).length}
        />
      </Card>

      <div className="mt-6 space-y-6">
        {purchasing && (
          <Card className="card-pad min-w-0">
            <SectionTitle hint="Akun bebannya ikut dari master barang, jadi satu barang tidak bisa masuk ke dua akun yang berbeda.">
              Rincian per barang
            </SectionTitle>

            {rab.barang.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Belum ada barang. Isi lewat tombol <strong>Tambah barang</strong> di atas: pilih
                barangnya, isi jumlah dan harga satuannya, lalu simpan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="th">Barang</th>
                      <th className="th">Akun beban</th>
                      <th className="th num">Jumlah</th>
                      <th className="th num">Harga satuan</th>
                      <th className="th num">Dianggarkan</th>
                      {/* Perkiraan tanggal belanja ada sejak draf — justru di
                          sanalah gunanya, karena rancangan kas mingguan
                          memakainya untuk tahu kapan uangnya dibutuhkan. */}
                      <th className="th">Rencana belanja</th>
                      {/* Kolom realisasi hanya ada artinya setelah rencananya
                          berhenti bergerak, jadi ia baru muncul begitu RAB
                          disahkan. Sebelum itu tidak ada yang bisa dibandingkan. */}
                      {disahkan && <th className="th num">Realisasi dilaporkan</th>}
                      {disahkan && <th className="th num">Hemat</th>}
                      <th className="th num">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rab.barang.map((b) => (
                      <tr key={b.lineId} className="hover:bg-slate-50">
                        <td className="td">
                          <span className="mr-2 font-mono text-xs text-slate-500">{b.itemCode}</span>
                          {b.itemName}
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {b.kategori} › {b.subKategori}
                          </span>
                        </td>
                        <td className="td">
                          <span className="mr-2 font-mono text-xs text-slate-500">{b.accountCode}</span>
                          {b.accountName}
                        </td>
                        <td className="td num">
                          {b.quantity.toLocaleString('id-ID')} <span className="text-xs text-slate-500">{b.satuan}</span>
                        </td>
                        <td className="td num">{formatRupiah(b.unitPrice)}</td>
                        <td className="td num">{formatRupiah(b.anggaran)}</td>
                        <td className="td">
                          {b.rencanaTanggal
                            ? formatDate(b.rencanaTanggal)
                            : <span className="text-xs text-slate-400">belum ditentukan</span>}
                        </td>
                        {disahkan && (
                          <td className="td num">
                            {b.realisasi.nilai === null ? (
                              <span className="text-xs text-slate-400">belum</span>
                            ) : (
                              <>
                                {formatRupiah(b.realisasi.nilai)}
                                <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                                  {b.realisasi.quantity} {b.satuan}
                                  {!b.realisasi.selesai && ' · sebagian'}
                                </span>
                              </>
                            )}
                          </td>
                        )}
                        {disahkan && (
                          <td className="td num">
                            {hematBaris(b) === null ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              <span className={hematBaris(b)! < 0 ? 'font-medium text-red-600' : 'text-emerald-700'}>
                                {formatRupiah(hematBaris(b)!)}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="td num">
                          <span className="flex items-center justify-end gap-3">
                            {disahkan && (
                              <RealisasiBarangDialog
                                lineId={b.lineId}
                                nama={`${b.itemCode} ${b.itemName}`}
                                satuan={b.satuan}
                                anggaran={b.anggaran}
                                sudahAda={b.realisasi.nilai !== null}
                                defaultDate={tanggalBawaanRealisasi}
                                nilai={{
                                  quantity: b.realisasi.quantity,
                                  unitPrice: b.realisasi.unitPrice,
                                  tanggal: b.realisasi.tanggal
                                    ? b.realisasi.tanggal.toISOString().slice(0, 10)
                                    : null,
                                  selesai: b.realisasi.selesai,
                                  catatan: b.realisasi.catatan,
                                }}
                              />
                            )}
                            <UbahBarangRabDialog
                              budgetId={rab.id}
                              items={opsiBarang}
                              nama={`${b.itemCode} ${b.itemName}`}
                              periode={rab.period}
                              nilai={{
                                itemId: b.itemId, quantity: b.quantity,
                                unitPrice: b.unitPrice, catatan: b.catatan,
                                planDate: keIsoTanggal(b.rencanaTanggal),
                              }}
                              disabled={disahkan}
                            />
                            <BudgetItemLineDelete id={b.lineId} disabled={disahkan} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="td" colSpan={4}>Total</td>
                      <td className="td num">
                        {formatRupiah(rab.barang.reduce((s, b) => s + b.anggaran, 0))}
                      </td>
                      {disahkan && (
                        <td className="td num">
                          {formatRupiah(rab.barang.reduce((s, b) => s + (b.realisasi.nilai ?? 0), 0))}
                        </td>
                      )}
                      {disahkan && (
                        <td className="td num">
                          {formatRupiah(rab.barang.reduce((s, b) => s + (hematBaris(b) ?? 0), 0))}
                        </td>
                      )}
                      <td className="td num">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card className="card-pad min-w-0">
          <SectionTitle
            hint={
              purchasing
                ? 'Beberapa barang bisa bermuara ke akun yang sama. Perbandingan dengan jurnal hanya mungkin di tingkat akun, karena jurnal tidak mencatat barangnya. Realisasi di sini datang dari JURNAL — berbeda dari kolom "realisasi dilaporkan" di tabel barang, yang Anda catat sendiri per barang.'
                : 'Kolom "jurnal" datang dari pembukuan bulan ini, mengikuti aturan penanggung yang sama dengan laporan laba rugi. Kolom "dilaporkan" Anda catat sendiri per baris setelah RAB disahkan, lengkap dengan status selesai — dari situlah penghematan dihitung. Keduanya sengaja berdiri sendiri: jurnal mencatat uang yang keluar, laporan mencatat apa yang sudah tuntas dibeli.'
            }
          >
            {purchasing ? 'Anggaran dan realisasi per akun — menurut jurnal' : 'Rincian anggaran'}
          </SectionTitle>

          {r.baris.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              {purchasing
                ? 'Belum ada yang bisa dibandingkan. Isi rincian barangnya dulu di atas.'
                : 'Belum ada baris. Isi lewat formulir Tambah anggaran: pilih akun beban, isi nominalnya, lalu simpan. Ulangi untuk tiap akun yang dianggarkan.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="th">Akun</th>
                    <th className="th num">Dianggarkan</th>
                    {/* Hanya pada RAB selain purchasing: di sanalah baris akun
                        memang rinciannya, jadi di sanalah tanggalnya diisi. Pada
                        RAB purchasing tabel ini cuma rangkuman, dan tanggalnya
                        ada di tabel barang. */}
                    {!purchasing && <th className="th">Rencana belanja</th>}
                    <th className="th num">{realisasiAkun ? 'Realisasi (jurnal)' : 'Realisasi'}</th>
                    {/* Dua kolom tambahan hanya setelah RAB disahkan, sama seperti
                        di tabel barang: sebelum itu tidak ada yang bisa dicatat. */}
                    {realisasiAkun && <th className="th num">Realisasi dilaporkan</th>}
                    {realisasiAkun && <th className="th num">Hemat</th>}
                    <th className="th num">Sisa</th>
                    <th className="th num">Terpakai</th>
                    {!purchasing && <th className="th num">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.baris.map((b) => (
                    <tr key={b.accountId} className={b.takDianggarkan ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                      <td className="td">
                        <span className="mr-2 font-mono text-xs text-slate-500">{b.accountCode}</span>
                        {b.accountName}
                        {b.takDianggarkan && (
                          <span className="mt-0.5 block text-xs text-amber-700">tidak dianggarkan</span>
                        )}
                      </td>
                      <td className="td num">{b.anggaran > 0 ? formatRupiah(b.anggaran) : '—'}</td>
                      {!purchasing && (
                        <td className="td">
                          {barisPerAkun.get(b.accountId)?.planDate
                            ? formatDate(barisPerAkun.get(b.accountId)!.planDate!)
                            : <span className="text-xs text-slate-400">belum ditentukan</span>}
                        </td>
                      )}
                      <td className="td num">{formatRupiah(b.realisasi)}</td>
                      {realisasiAkun && (
                        <td className="td num">
                          {(() => {
                            const l = barisPerAkun.get(b.accountId);
                            if (!l || l.realAmount === null) {
                              return <span className="text-xs text-slate-400">belum dilaporkan</span>;
                            }
                            return (
                              <>
                                {formatRupiah(l.realAmount)}
                                <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                                  {l.realDone ? 'selesai' : 'sebagian'}
                                </span>
                              </>
                            );
                          })()}
                        </td>
                      )}
                      {realisasiAkun && (
                        <td className="td num">
                          {(() => {
                            const l = barisPerAkun.get(b.accountId);
                            const hemat = l && l.realDone && l.realAmount !== null
                              ? l.amount - l.realAmount
                              : null;
                            if (hemat === null) return <span className="text-xs text-slate-400">—</span>;
                            return (
                              <span className={hemat < 0 ? 'font-medium text-red-600' : 'text-emerald-700'}>
                                {formatRupiah(hemat)}
                              </span>
                            );
                          })()}
                        </td>
                      )}
                      <td className={`td num ${b.sisa < 0 ? 'font-medium text-red-600' : ''}`}>
                        {formatRupiah(b.sisa)}
                      </td>
                      <td className="td num">{b.terpakaiPct === null ? '—' : formatPercent(b.terpakaiPct)}</td>
                      {!purchasing && (
                        <td className="td num">
                          {barisPerAkun.has(b.accountId) ? (
                            <span className="flex items-center justify-end gap-3">
                              <UbahAnggaranDialog
                                budgetId={rab.id}
                                accounts={accounts}
                                nama={`${b.accountCode} ${b.accountName}`}
                                periode={rab.period}
                                nilai={{
                                  accountId: b.accountId,
                                  amount: barisPerAkun.get(b.accountId)!.amount,
                                  notes: barisPerAkun.get(b.accountId)!.notes,
                                  planDate: keIsoTanggal(barisPerAkun.get(b.accountId)!.planDate),
                                }}
                                disabled={disahkan}
                              />
                              <BudgetLineDelete id={barisPerAkun.get(b.accountId)!.id} disabled={disahkan} />
                              {realisasiAkun && (
                                <RealisasiAkunDialog
                                  lineId={barisPerAkun.get(b.accountId)!.id}
                                  nama={`${b.accountCode} ${b.accountName}`}
                                  anggaran={barisPerAkun.get(b.accountId)!.amount}
                                  nilai={{
                                    amount: barisPerAkun.get(b.accountId)!.realAmount,
                                    tanggal: barisPerAkun.get(b.accountId)!.realDate
                                      ?.toISOString().slice(0, 10) ?? null,
                                    selesai: barisPerAkun.get(b.accountId)!.realDone,
                                    catatan: barisPerAkun.get(b.accountId)!.realNotes,
                                  }}
                                  defaultDate={tanggalBawaanRealisasi}
                                  sudahAda={barisPerAkun.get(b.accountId)!.realAmount !== null}
                                />
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-semibold">
                  <tr>
                    <td className="td">Total</td>
                    <td className="td num">{formatRupiah(r.totalAnggaran)}</td>
                    {!purchasing && <td className="td">—</td>}
                    <td className="td num">{formatRupiah(r.totalRealisasi)}</td>
                    {realisasiAkun && (
                      <td className="td num">
                        {formatRupiah(lines.reduce((t, l) => t + (l.realAmount ?? 0), 0))}
                      </td>
                    )}
                    {realisasiAkun && (
                      <td className="td num">
                        {(() => {
                          const hemat = lines.reduce(
                            (t, l) => t + (l.realDone && l.realAmount !== null ? l.amount - l.realAmount : 0),
                            0,
                          );
                          return (
                            <span className={hemat < 0 ? 'text-red-600' : hemat > 0 ? 'text-emerald-700' : ''}>
                              {formatRupiah(hemat)}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    <td className={`td num ${r.totalSisa < 0 ? 'text-red-600' : ''}`}>
                      {formatRupiah(r.totalSisa)}
                    </td>
                    <td className="td num">{r.terpakaiPct === null ? '—' : formatPercent(r.terpakaiPct)}</td>
                    {!purchasing && <td className="td num">—</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
