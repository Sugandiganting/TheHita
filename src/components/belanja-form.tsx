'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { advisePurchase, type PurchaseCadence, type PurchaseContext, type PurchasePlan } from '@/lib/forecast';
import { formatDate, formatPeriod, formatRupiah } from '@/lib/format';
import { MAKS_CICILAN, jadwalCicilan } from '@/lib/rencana-belanja';
import { NAMA_SKENARIO, SKENARIO, type Skenario } from '@/lib/rencana-kas';
import { deletePurchase, savePurchase, setPurchaseStatus, type ActionState } from '@/app/actions';
import { MoneyInput } from './money-input';

const initial: ActionState = { ok: false, message: '' };

/**
 * "Uangnya cukup atau tidak?" — pemeriksa kemampuan beli.
 *
 * Perhitungannya dilakukan di sisi pengguna memakai mesin ramalan yang sama
 * dengan halaman ini, sehingga angkanya langsung berubah saat harga digeser
 * tanpa perlu memuat ulang halaman.
 */

const CADENCE_LABEL: Record<PurchaseCadence, string> = {
  WEEKLY: 'mingguan',
  MONTHLY: 'bulanan',
};

/**
 * Apa artinya memilih satu skenario di sini: bukan sekadar angka yang berbeda,
 * melainkan seberapa berani keputusannya.
 */
const ARTI_SKENARIO: Record<Skenario, string> = {
  PESIMIS: 'Paling hati-hati. Pembelian disebut aman hanya bila tetap aman saat uang masuk seret.',
  NORMAL: 'Memakai perkiraan uang masuk yang wajar — sejalan dengan anggaran mingguan.',
  OPTIMIS: 'Paling longgar. Hanya aman bila uang masuk benar-benar sebaik perkiraan terbaik.',
};

const HARI = 86_400_000;

const tanggalUtc = (teks: string) => {
  const [y, m, d] = teks.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
};

const selisihHari = (a: Date, b: Date) =>
  Math.round((Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
    - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / HARI);

/** "hari ini", "2 minggu lagi", "1 bulan lagi" — dibaca dari selisih hari. */
function kapan(hari: number, cadence: PurchaseCadence): string {
  if (hari === 0) return 'hari ini';
  if (hari < 0) return `${-hari} hari lalu`;
  if (hari < 7) return `${hari} hari lagi`;
  if (cadence === 'WEEKLY') return `${Math.round(hari / 7)} minggu lagi`;
  return `${Math.max(1, Math.round(hari / 30))} bulan lagi`;
}

function JadwalCicilan({
  plan, jadwal, hariIni,
}: {
  plan: PurchasePlan;
  /** Tanggal jatuh tempo tiap cicilan, dihitung dengan aturan yang sama dengan yang disimpan. */
  jadwal: { jatuhTempo: Date }[];
  hariIni: Date;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[24rem] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="td">Cicilan</th>
            <th className="td whitespace-nowrap">Jatuh tempo</th>
            <th className="td num whitespace-nowrap">Dibayar</th>
            <th className="td num whitespace-nowrap">Sisa kas</th>
          </tr>
        </thead>
        <tbody>
          {plan.schedule.map((c, i) => (
            <tr key={c.index} className="border-t border-slate-100">
              <td className="td">ke-{c.index}</td>
              <td className="td">
                {jadwal[i] ? (
                  <>
                    <span className="whitespace-nowrap">{formatDate(jadwal[i].jatuhTempo)}</span>{' '}
                    <span className="whitespace-nowrap text-xs text-slate-400">
                      ({kapan(selisihHari(jadwal[i].jatuhTempo, hariIni), plan.cadence)})
                    </span>
                  </>
                ) : (
                  <span className="whitespace-nowrap text-xs text-slate-400">{formatPeriod(c.period)}</span>
                )}
              </td>
              <td className="td num whitespace-nowrap">{formatRupiah(c.amount)}</td>
              <td className={`td num whitespace-nowrap ${c.safe ? '' : 'font-semibold text-red-600'}`}>
                {formatRupiah(c.balanceAfter)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PurchaseCalculator({
  konteks, defaultDate, tanggalPosisi,
}: {
  /** Satu konteks penilaian untuk tiap skenario; yang dipakai dipilih di layar. */
  konteks: Record<Skenario, PurchaseContext>;
  /** Tanggal cicilan pertama; biasanya hari ini. */
  defaultDate: string;
  /** Tanggal posisi kas terakhir — titik nol seluruh hitungan hari. */
  tanggalPosisi: string;
}) {
  // Pesimis sebagai bawaan: keputusan belanja sebaiknya diuji pada keadaan
  // terburuk dulu, bukan pada keadaan yang diharapkan.
  const [skenario, setSkenario] = useState<Skenario>('PESIMIS');
  const context = konteks[skenario];
  const [harga, setHarga] = useState(0);
  const [cicilan, setCicilan] = useState(1);
  const [cadence, setCadence] = useState<PurchaseCadence>('WEEKLY');
  const [nama, setNama] = useState('');
  const [mulai, setMulai] = useState(defaultDate);
  const [state, kirim] = useActionState(savePurchase, initial);
  const [pending, mulaiTransition] = useTransition();

  const simpan = () => {
    const data = new FormData();
    data.set('label', nama);
    data.set('amount', String(harga));
    data.set('cadence', cadence);
    data.set('instalments', String(cicilan));
    data.set('startDate', mulai);
    mulaiTransition(() => kirim(data));
  };

  // Jarak hari dari posisi kas ke cicilan pertama. Mesin penilaian menghitung
  // hari sejak posisi kas, sedangkan tanggal mulai boleh dipilih sendiri —
  // tanpa pergeseran ini, jadwal yang disimpan dan jadwal yang dinilai berbeda.
  const mulaiPada = useMemo(
    () => Math.max(0, selisihHari(tanggalUtc(mulai), tanggalUtc(tanggalPosisi))),
    [mulai, tanggalPosisi],
  );

  const saran = useMemo(
    () => (harga > 0 ? advisePurchase(context, harga, cicilan, cadence, mulaiPada) : null),
    [context, harga, cicilan, cadence, mulaiPada],
  );

  // Tanggalnya disusun dengan fungsi yang sama dengan yang dipakai saat
  // menyimpan, sehingga pratinjau dan rencana tersimpan tidak bisa berselisih.
  const jadwal = useMemo(
    () => (harga > 0 ? jadwalCicilan(harga, cicilan, cadence, tanggalUtc(mulai)) : []),
    [harga, cicilan, cadence, mulai],
  );
  const hariIni = useMemo(() => tanggalUtc(defaultDate), [defaultDate]);

  const rencana = saran?.requested;
  const usulanBeda =
    saran?.recommended && saran.minimumInstalments !== null && saran.minimumInstalments !== cicilan
      ? saran
      : null;

  return (
    <div className="space-y-4">
      <div>
        <span className="label">Dinilai dengan skenario</span>
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" role="group">
          {SKENARIO.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === skenario}
              onClick={() => setSkenario(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                s === skenario
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {NAMA_SKENARIO[s]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">{ARTI_SKENARIO[skenario]}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="beli-harga">Harga barang</label>
          <MoneyInput
            id="beli-harga"
            placeholder="150.000.000"
            value={harga === 0 ? '' : String(harga)}
            onChange={(v) => setHarga(Number(v) || 0)}
          />
          <p className="mt-1 text-xs text-slate-500">
            {harga > 0 ? formatRupiah(harga) : 'Isi harga barang atau proyek yang ingin dibeli.'}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="beli-cicilan">Dipecah berapa kali</label>
          <div className="flex items-center gap-2">
            <input
              id="beli-cicilan"
              type="number"
              min={1}
              max={MAKS_CICILAN}
              className="input w-20 shrink-0"
              value={cicilan}
              onChange={(e) => setCicilan(Math.max(1, Math.min(MAKS_CICILAN, Number(e.target.value) || 1)))}
            />
            <select
              aria-label="Jarak antar cicilan"
              className="input min-w-0 flex-1"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as PurchaseCadence)}
            >
              <option value="WEEKLY">mingguan</option>
              <option value="MONTHLY">bulanan</option>
            </select>
          </div>
          <p className="mt-1 text-xs text-slate-500">1 berarti dibayar sekaligus.</p>
        </div>
      </div>

      {/*
        Ruang belanja nol berarti garis kasnya sendiri sudah menembus batas aman,
        bahkan sebelum ada pembelian. Tanpa dikatakan, jawaban "belum cukup" akan
        terbaca seolah barangnya yang kemahalan — padahal barang seharga sejuta
        pun akan ditolak.
      */}
      {context.maxAffordableNow === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Pada skenario {NAMA_SKENARIO[skenario].toLowerCase()}, kas sudah berada di bawah batas aman
          bahkan tanpa pembelian apa pun, jadi berapa pun harganya akan dinilai belum aman. Yang
          perlu dibereskan lebih dulu adalah kasnya sendiri, bukan rencana belanjanya.
          {skenario === 'PESIMIS' && ' Coba lihat skenario normal untuk membandingkan.'}
        </div>
      )}

      {!rencana && context.maxAffordableNow > 0 && (
        <p className="text-sm text-slate-500">
          Sekali dibayar sekaligus sekarang, kemampuan belanja maksimum{' '}
          <strong>{formatRupiah(context.maxAffordableNow)}</strong> tanpa menembus batas aman.
        </p>
      )}

      {rencana && saran && (
        <>
          <div
            className={`rounded-lg border p-4 ${
              rencana.affordable
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <p className={`text-xs font-medium uppercase tracking-wide ${
              rencana.affordable ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              Menurut skenario {NAMA_SKENARIO[skenario].toLowerCase()}
            </p>
            <p className={`mt-1 font-semibold ${rencana.affordable ? 'text-emerald-800' : 'text-amber-900'}`}>
              {rencana.affordable
                ? cicilan === 1
                  ? 'Cukup — bisa dibayar sekaligus sekarang.'
                  : `Cukup bila dipecah ${cicilan} kali ${CADENCE_LABEL[cadence]}.`
                : 'Belum cukup dengan rencana ini.'}
            </p>

            {!rencana.affordable && (
              <p className="mt-1 text-sm text-amber-900">
                Pada titik terendah, kas kurang <strong>{formatRupiah(rencana.shortfall)}</strong> dari
                batas aman
                {rencana.lowest ? ` (${formatPeriod(rencana.lowest.period)})` : ''}.
              </p>
            )}

            {/* Usulan yang sama bisa berarti dua hal yang berlawanan: memecah
                lebih banyak supaya cukup, atau justru tidak perlu dipecah
                sebanyak itu. Keduanya harus berbunyi berbeda. */}
            {usulanBeda && (rencana.affordable ? (
              <p className="mt-2 text-sm text-emerald-800">
                Sebenarnya cukup{' '}
                <strong>
                  {saran.minimumInstalments === 1
                    ? 'dibayar sekaligus'
                    : `dipecah ${saran.minimumInstalments} kali ${CADENCE_LABEL[cadence]}`}
                </strong>
                {' '}&mdash; tidak harus {cicilan} kali.
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-900">
                Pecah jadi <strong>{saran.minimumInstalments} kali {CADENCE_LABEL[cadence]}</strong>
                {' '}&mdash; masing-masing sekitar{' '}
                <strong>{formatRupiah(saran.recommended!.amount / saran.minimumInstalments!)}</strong>
                {' '}&mdash; dan kasnya cukup.
              </p>
            ))}

            {!rencana.affordable && saran.minimumInstalments === null && (
              <p className="mt-2 text-sm text-amber-900">
                Dipecah berapa kali pun tetap tidak cukup, karena pada akhirnya seluruh harga keluar
                dari kas. Harga tertinggi yang masih aman bila dibayar sekaligus sekarang{' '}
                <strong>{formatRupiah(context.maxAffordableNow)}</strong>.
              </p>
            )}
          </div>

          <JadwalCicilan plan={rencana} jadwal={jadwal} hariIni={hariIni} />

          {/*
            Menyimpan lewat FormData yang disusun sendiri, bukan lewat <form>:
            setelah aksi server selesai React mengosongkan isian formulir, dan
            seluruh angka yang baru dihitung ikut hilang bersamanya.
          */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-medium text-slate-700">Simpan rencana ini</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="beli-nama">Nama rencana</label>
                <input
                  id="beli-nama"
                  className="input"
                  placeholder="Renovasi kamar Uluwatu"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="beli-mulai">Cicilan pertama</label>
                <input
                  id="beli-mulai"
                  type="date"
                  className="input"
                  value={mulai}
                  onChange={(e) => setMulai(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={simpan}
              disabled={pending || !nama.trim()}
              className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Menyimpan…' : 'Simpan sebagai draf'}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Tersimpan sebagai draf dulu. Anggaran baru terpotong setelah disetujui.
            </p>
            {state.message && (
              <p className={`mt-2 text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {state.message}
              </p>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Diperiksa bukan hanya saat tiap cicilan dibayar, tetapi juga bulan-bulan sesudahnya &mdash;
            pembelian menurunkan saldo kas seterusnya, jadi bisa saja tiap cicilan terlihat aman tetapi
            kasnya jebol beberapa bulan kemudian. Di dalam satu bulan, arus kas dianggap mengalir rata
            tiap hari, padahal gaji dan tagihan besar biasanya menumpuk di tanggal tertentu. Untuk
            pembelian yang mepet dengan batas aman, jangan bersandar pada selisih beberapa hari.
          </p>
        </>
      )}
    </div>
  );
}

/** Setujui atau kembalikan ke draf, dan hapus. */
export function PurchaseActions({ id, status }: { id: string; status: string }) {
  const [statusState, statusAction] = useActionState(setPurchaseStatus, initial);
  const [hapusState, hapusAction] = useActionState(deletePurchase, initial);
  const [pending, mulaiTransition] = useTransition();
  const [konfirmasi, setKonfirmasi] = useState(false);
  const draf = status === 'DRAFT';

  const jalankan = (aksi: (fd: FormData) => void, tambahan?: Record<string, string>) => {
    const data = new FormData();
    data.set('id', id);
    for (const [k, v] of Object.entries(tambahan ?? {})) data.set(k, v);
    mulaiTransition(() => aksi(data));
  };

  return (
    <span className="flex items-center justify-end gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => jalankan(statusAction, { status: draf ? 'APPROVED' : 'DRAFT' })}
        className="text-xs font-medium text-slate-600 hover:underline"
      >
        {pending ? '…' : draf ? 'Setujui' : 'Kembalikan ke draf'}
      </button>

      {konfirmasi ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => jalankan(hapusAction)}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Ya, hapus
          </button>
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
            Batal
          </button>
        </>
      ) : (
        <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setKonfirmasi(true)}>
          Hapus
        </button>
      )}

      {[statusState, hapusState].map((s, i) => (
        !s.ok && s.message ? <span key={i} className="text-xs text-red-600">{s.message}</span> : null
      ))}
    </span>
  );
}

/** Jadwal cicilan sebuah rencana yang sudah tersimpan. */
export function JadwalTersimpan({ jadwal }: { jadwal: { ke: number; jatuhTempo: Date; amount: number }[] }) {
  return (
    <span className="text-xs text-slate-500">
      {jadwal.map((c) => `${formatDate(c.jatuhTempo)} ${formatRupiah(c.amount)}`).join(' · ')}
    </span>
  );
}
