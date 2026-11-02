import Link from 'next/link';
import { getCashAccounts, getRekapPenampung } from '@/lib/queries';
import { formatPeriod, formatRupiah } from '@/lib/format';
import { currentPeriod } from '@/lib/period';
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Rekonsiliasi kas penampung.
 *
 * Halaman tersendiri karena pertanyaannya memang lain dari laporan kas yang
 * lain. Yang lain menanyakan "berapa uangnya"; yang ini menanyakan "uangnya
 * punya siapa" — dan jawabannya cuma ada di sini, karena hanya penampung yang
 * memegang uang beberapa cabang sekaligus.
 */
export default async function PenampungPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const akun = await getCashAccounts();
  const dipilih = one(params.akun) ?? akun[0]?.id ?? '';
  const period = one(params.periode) ?? currentPeriod();

  if (akun.length === 0) {
    return (
      <>
        <PageHeader title="Kas Penampung" />
        <EmptyState
          title="Belum ada rekening kas"
          description="Tandai akun sebagai kas/bank di menu Chart of Account terlebih dahulu."
          actionHref="/coa"
          actionLabel="Buka COA"
        />
      </>
    );
  }

  const rekap = await getRekapPenampung(dipilih, period);
  const nama = akun.find((a) => a.id === dipilih)?.label ?? '';
  const menalangi = rekap.posisi.filter((p) => p.net > 0);
  const ditalangi = rekap.posisi.filter((p) => p.net < 0);
  const timpang = Math.round(rekap.selisih);

  return (
    <>
      <PageHeader
        title="Kas Penampung"
        description="Uang yang disetor beberapa cabang lalu dibelanjakan untuk cabang mana pun — misalnya kas Purchasing. Menjawab dua hal: berapa uang yang harus ada di tangan, dan cabang mana sedang menalangi cabang mana."
      />

      <Card className="card-pad">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="akun">Rekening penampung</label>
            <select id="akun" name="akun" className="input max-w-sm" defaultValue={dipilih}>
              {akun.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="periode">Bulan</label>
            <input id="periode" name="periode" type="month" className="input" defaultValue={period} />
          </div>
          <button type="submit" className="btn-primary">Tampilkan</button>
        </form>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Saldo awal" value={formatRupiah(rekap.saldoAwal)} />
        <StatCard label="Dana masuk" value={formatRupiah(rekap.totalMasuk)} />
        <StatCard label="Dibelanjakan" value={formatRupiah(rekap.totalKeluar)} />
        <StatCard
          label="Saldo akhir"
          value={formatRupiah(rekap.saldoAkhir)}
          hint="Harus sama dengan uang yang dihitung fisik"
        />
      </div>

      {timpang !== 0 && (
        <div className="mt-6">
        <Alert tone="warning">
          Ada <strong>{formatRupiah(timpang)}</strong> yang tidak terjelaskan. Jumlah seluruh
          klaim cabang seharusnya sama persis dengan mutasi bersih penampung bulan ini, dan di
          sini tidak. Artinya ada bukti yang baris lawannya tidak menyebut cabang — biasanya
          belanja dari penampung yang pos bebannya masih memikul kode penampung, bukan kode
          cabang pemakainya.
        </Alert>
        </div>
      )}

      <Card className="card-pad mt-6">
        <SectionTitle hint="Disetor dikurangi dipakai — klaim cabang itu atas penampung. Jumlah seluruh klaim sama dengan uang yang masih mengendap di penampung, bukan nol: setoran yang belum terbelanjakan tetap milik penyetornya. Begitu penampungnya kosong, klaim yang tersisa pasti sudah terpakai cabang lain — dan saat itulah ia benar-benar utang.">
          Posisi tiap cabang — {nama}, {formatPeriod(period)}
        </SectionTitle>

        {rekap.posisi.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Belum ada mutasi pada rekening ini di {formatPeriod(period)}. Setoran dicatat di{' '}
            <Link href="/kas/transfer" className="font-medium text-brand-600 hover:underline">
              Transfer Money
            </Link>
            , belanjanya di{' '}
            <Link href="/kas/bayar" className="font-medium text-brand-600 hover:underline">
              Pay Money
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="th">Cabang</th>
                  <th className="th num">Disetor</th>
                  <th className="th num">Dipakai</th>
                  <th className="th num">Posisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rekap.posisi.map((p) => (
                  <tr key={p.unit}>
                    <td className="td font-medium">{p.unit}</td>
                    <td className="td num text-slate-500">
                      {p.disetor > 0 ? formatRupiah(p.disetor) : '—'}
                    </td>
                    <td className="td num text-slate-500">
                      {p.dipakai > 0 ? formatRupiah(p.dipakai) : '—'}
                    </td>
                    <td className={`td num ${p.net > 0 ? 'text-emerald-700' : p.net < 0 ? 'text-amber-700' : ''}`}>
                      {formatRupiah(p.net)}
                      {p.net !== 0 && (
                        <span className="mt-0.5 block text-[11px] font-normal">
                          {p.net > 0
                            ? (rekap.saldoAkhir === 0 ? 'menalangi' : 'kelebihan setoran')
                            : 'ditalangi'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(menalangi.length > 0 || ditalangi.length > 0) && (
        <Card className="card-pad mt-6">
          <SectionTitle hint="Angka ini bukan kesalahan yang harus dicari, melainkan utang yang sudah tercatat. Boleh diselesaikan dengan satu transfer penyeimbang, boleh juga dibiarkan berjalan.">
            Ringkasnya
          </SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {rekap.saldoAkhir !== 0 && (
              <>
                Masih ada <strong>{formatRupiah(rekap.saldoAkhir)}</strong> mengendap di
                penampung, jadi klaim di bawah belum seluruhnya berupa talangan — sebagian
                uangnya memang belum dibelanjakan. Yang pasti talangan hanya yang negatif.
                <br />
              </>
            )}
            {menalangi.length > 0 && (
              <>
                Klaim terbesar:{' '}
                {menalangi.map((p) => (
                  <span key={p.unit} className="mr-2 inline-block">
                    <Badge tone="brand">{p.unit}</Badge> {formatRupiah(p.net)}
                  </span>
                ))}
                <br />
              </>
            )}
            {ditalangi.length > 0 && (
              <>
                Sedang ditalangi:{' '}
                {ditalangi.map((p) => (
                  <span key={p.unit} className="mr-2 inline-block">
                    <Badge tone="amber">{p.unit}</Badge> {formatRupiah(-p.net)}
                  </span>
                ))}
              </>
            )}
          </p>
        </Card>
      )}
    </>
  );
}
