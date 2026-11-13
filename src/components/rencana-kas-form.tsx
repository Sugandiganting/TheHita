'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createCashPlan, deleteCashPlan, deleteCategory, deleteCheckpoint, deleteCommitment,
  deleteSpend, saveAssumptions, saveCashProjection, saveCategory, saveCheckpoint,
  saveCommitment, saveSpend, toggleCommitmentPaid, updateCategoryAccount, updateCategoryBudget,
  updateCategoryRab,
  type ActionState,
} from '@/app/actions';
import { formatPeriod, formatRupiah } from '@/lib/format';
import { MoneyInput } from './money-input';

const initial: ActionState = { ok: false, message: '' };

function Submit({ label, full = true }: { label: string; full?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn-primary ${full ? 'w-full' : ''}`} disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

function Tautan({ label, pendingLabel, bahaya }: { label: string; pendingLabel: string; bahaya?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`text-xs font-medium hover:underline ${bahaya ? 'text-red-600' : 'text-slate-600'}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Pesan({ state }: { state: ActionState }) {
  if (!state.message) return null;
  const warna = !state.ok ? 'text-red-600' : state.warn ? 'text-amber-700' : 'text-emerald-700';
  return <p className={`mt-2 text-sm ${warna}`}>{state.message}</p>;
}

/** Membuat rencana bulan baru; komitmen bulan sebelumnya ikut tersalin. */
export function PlanForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, action] = useActionState(createCashPlan, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="rk-period">Buat bulan baru</label>
        <input id="rk-period" type="month" name="period" className="input" defaultValue={defaultPeriod} required />
      </div>
      <button type="submit" className="btn-primary">Buat rencana</button>
      <Pesan state={state} />
    </form>
  );
}

/**
 * Laporan posisi kas mingguan — satu-satunya hal yang wajib diisi ulang tiap
 * minggu. Angka menurut jurnal ditampilkan sebagai pembanding, bukan sebagai
 * isian, karena saldo bank yang sebenarnya hampir selalu mendahului pembukuan.
 */
export function CheckpointForm({
  planId, defaultDate, menurutJurnal, terakhir,
}: {
  planId: string;
  defaultDate: string;
  menurutJurnal: { saldoKas: number; masukBulanIni: number };
  terakhir: { cashOnHand: number; incomeToDate: number } | null;
}) {
  // Kedua kolom sengaja dibiarkan kosong. Angka minggu lalu memang berguna
  // sebagai pembanding, tetapi kalau diisikan ke kolomnya ia justru berbahaya:
  // ketikan baru menempel di belakangnya, dan kalau pemakai lupa menggantinya
  // sistem menyimpan angka basi tanpa keluhan apa pun.
  const [state, action] = useActionState(saveCheckpoint, initial);
  return (
    <form action={action} className="space-y-4" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />

      <div>
        <label className="label" htmlFor="rk-date">Posisi per tanggal</label>
        <input id="rk-date" type="date" name="date" className="input" defaultValue={defaultDate} required />
      </div>

      <div>
        <label className="label" htmlFor="rk-cash">Saldo kas &amp; bank hari ini</label>
        <MoneyInput
          id="rk-cash"
          name="cashOnHand"
          placeholder="143.458.339"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {terakhir && <>Terakhir dilaporkan {formatRupiah(terakhir.cashOnHand)} · </>}
          menurut jurnal {formatRupiah(menurutJurnal.saldoKas)}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rk-income">Uang masuk bulan ini s.d. tanggal itu</label>
        <MoneyInput
          id="rk-income"
          name="incomeToDate"
          placeholder="154.700.000"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {terakhir && <>Terakhir dilaporkan {formatRupiah(terakhir.incomeToDate)} · </>}
          menurut jurnal {formatRupiah(menurutJurnal.masukBulanIni)}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rk-cnote">Catatan</label>
        <input id="rk-cnote" name="notes" className="input" placeholder="Opsional" />
      </div>

      <Submit label="Simpan posisi kas" />
      <Pesan state={state} />
    </form>
  );
}

/** Tiga proyeksi uang masuk sebulan penuh. Dikosongkan = pakai usulan sistem. */
type TigaSkenario = { PESIMIS: number | null; NORMAL: number | null; OPTIMIS: number | null };

export type UsulanRumus = {
  anchor: string;
  masukNyata: number;
  tingkat: 'PESIMIS' | 'NORMAL' | 'OPTIMIS' | null;
  t: number;
  nilai: { PESIMIS: number; NORMAL: number; OPTIMIS: number };
  dariRealisasi: boolean;
  c: number;
};

export function ProjectionForm({
  id, tersimpan, usulan, usulanRumus, usulanMusim, notes,
}: {
  id: string;
  tersimpan: TigaSkenario;
  usulan: { PESIMIS: number; NORMAL: number; OPTIMIS: number } | null;
  /**
   * Target dari rumus, bertumpu pada bulan terakhir yang realisasinya lengkap.
   * Didahulukan daripada turunan musim karena ia berpangkal pada kenyataan,
   * bukan pada angka yang pernah diketik seseorang beberapa bulan lalu.
   */
  usulanRumus: UsulanRumus | null;
  /**
   * Turunan pola musim dari bulan terakhir yang pernah diketik. Didahulukan
   * daripada rata-rata riwayat: ia berpangkal pada angka yang pernah dipilih
   * orang, sedangkan rata-rata riwayat tidak mengenal musim sama sekali.
   */
  usulanMusim: { dari: string; nilai: TigaSkenario } | null;
  notes: string | null;
}) {
  const [state, action] = useActionState(saveCashProjection, initial);
  const baris = [
    { kunci: 'PESIMIS', name: 'pesimis', label: 'Pesimis' },
    { kunci: 'NORMAL', name: 'normal', label: 'Normal' },
    { kunci: 'OPTIMIS', name: 'optimis', label: 'Optimis' },
  ] as const;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      {baris.map((b) => {
        const nilai = tersimpan[b.kunci];
        const dariRumus = usulanRumus?.nilai[b.kunci] ?? null;
        const dariMusim = usulanMusim?.nilai[b.kunci] ?? null;
        const usul = dariRumus ?? dariMusim ?? usulan?.[b.kunci];
        return (
          <div key={b.name}>
            <label className="label" htmlFor={`rk-${b.name}`}>{b.label}</label>
            <MoneyInput
              id={`rk-${b.name}`}
              name={b.name}
              defaultValue={nilai === null ? '' : String(nilai)}
              placeholder={usul === undefined ? '0' : String(Math.round(usul))}
            />
            <p className="mt-1 text-xs text-slate-500">
              {nilai === null
                ? usul === undefined
                  ? 'Belum ada riwayat maupun pola musim untuk diusulkan.'
                  : `Kosong — memakai usulan ${formatRupiah(usul)}`
                : usul === undefined
                  ? 'Angka Anda sendiri.'
                  : `Usulan sistem ${formatRupiah(usul)}`}
              {usul !== undefined && (
                <span className="mt-0.5 block text-slate-400">
                  {dariRumus !== null
                    ? `dari target ${formatPeriod(usulanRumus!.anchor)} beserta separuh kelebihan realisasinya, dikali musim`
                    : dariMusim !== null
                      ? `dari ${formatPeriod(usulanMusim!.dari)} menurut pola musim di Master Data`
                      : 'rata-rata uang masuk beberapa bulan terakhir'}
                </span>
              )}
            </p>
          </div>
        );
      })}

      <div>
        <label className="label" htmlFor="rk-notes">Catatan</label>
        <input id="rk-notes" name="notes" className="input" defaultValue={notes ?? ''} placeholder="Opsional" />
      </div>

      <Submit label="Simpan proyeksi" />
      <Pesan state={state} />
    </form>
  );
}

export function CommitmentForm({ planId }: { planId: string }) {
  const [state, action] = useActionState(saveCommitment, initial);
  return (
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />
      <div>
        <label className="label" htmlFor="rk-klabel">Nama komitmen</label>
        <input id="rk-klabel" name="label" className="input" placeholder="Cicilan bank" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="rk-kamount">Nominal</label>
          <MoneyInput id="rk-kamount" name="amount" placeholder="75.600.000" required />
        </div>
        <div>
          <label className="label" htmlFor="rk-kdue">Tanggal</label>
          <input id="rk-kdue" name="dueDay" inputMode="numeric" className="input" placeholder="15" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="recurring" defaultChecked className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" />
        <span>
          Berulang tiap bulan
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Hilangkan centang untuk pengeluaran sekali ini seperti renovasi. Yang sekali ini
            ikut menekan ramalan kas habis; yang berulang sudah termasuk dalam pengeluaran
            rutin bulanan.
          </span>
        </span>
      </label>
      <Submit label="Tambah komitmen" />
      <Pesan state={state} />
    </form>
  );
}

export function CommitmentRow({ id, paid }: { id: string; paid: boolean }) {
  const [bayarState, bayarAction] = useActionState(toggleCommitmentPaid, initial);
  const [hapusState, hapusAction] = useActionState(deleteCommitment, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  return (
    <span className="flex items-center justify-end gap-3">
      <form action={bayarAction}>
        <input type="hidden" name="id" value={id} />
        <Tautan label={paid ? 'Batalkan' : 'Sudah dibayar'} pendingLabel="…" />
      </form>
      {konfirmasi ? (
        <>
          <form action={hapusAction}>
            <input type="hidden" name="id" value={id} />
            <Tautan label="Ya, hapus" pendingLabel="…" bahaya />
          </form>
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
            Batal
          </button>
        </>
      ) : (
        <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setKonfirmasi(true)}>
          Hapus
        </button>
      )}
      {!bayarState.ok && bayarState.message && <span className="text-xs text-red-600">{bayarState.message}</span>}
      {!hapusState.ok && hapusState.message && <span className="text-xs text-red-600">{hapusState.message}</span>}
    </span>
  );
}

export function CategoryForm({ planId }: { planId: string }) {
  const [state, action] = useActionState(saveCategory, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="rk-glabel">Kategori</label>
        <input id="rk-glabel" name="label" className="input" placeholder="Maintenance" required />
      </div>
      <div className="w-56">
        <label className="label" htmlFor="rk-gbudget">Jatah bulan ini</label>
        <MoneyInput id="rk-gbudget" name="budget" placeholder="50.000.000" required />
      </div>
      <button type="submit" className="btn-primary">Tambah</button>
      <Pesan state={state} />
    </form>
  );
}

/**
 * Jatah diubah di tempat. Sebelumnya satu-satunya cara adalah menghapus
 * kategori lalu membuatnya lagi, dan itu ikut membuang seluruh riwayat
 * belanjanya — harga yang terlalu mahal untuk mengganti satu angka.
 *
 * Bila jatahnya belum pernah ditetapkan, isian ini diisi lebih dulu dengan
 * angka yang sedang berlaku — hasil pembagian menurut porsi lama. Jadi yang
 * terbaca di layar tidak berubah sampai tombol simpan ditekan, dan menekannya
 * berarti "mulai sekarang pakai angka ini".
 */
export function CategoryBudget({ id, jatah }: { id: string; jatah: number }) {
  const [state, action] = useActionState(updateCategoryBudget, initial);
  const [nilai, setNilai] = useState(String(Math.round(jatah)));
  const berubah = nilai.trim() !== String(Math.round(jatah));

  return (
    <form action={action} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="id" value={id} />
      <MoneyInput
        name="budget"
        value={nilai}
        onChange={setNilai}
        ariaLabel="Jatah bulan ini"
        className="w-36 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      {berubah && <Tautan label="Simpan" pendingLabel="…" />}
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

/**
 * Menautkan kategori ke akun kas departemennya.
 *
 * Disimpan begitu pilihannya berubah, tanpa tombol simpan: pilihannya cuma
 * satu dan akibatnya langsung terlihat di kolom sebelahnya, jadi tombol
 * tambahan hanya menambah langkah tanpa menambah kejelasan.
 */
export function CategoryAccount({
  id, cashAccountId, akun,
}: {
  id: string;
  cashAccountId: string | null;
  akun: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(updateCategoryAccount, initial);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={form} className="mt-0.5">
      <input type="hidden" name="id" value={id} />
      <select
        name="cashAccountId"
        defaultValue={cashAccountId ?? ''}
        aria-label="Kas departemen"
        onChange={() => form.current?.requestSubmit()}
        className="w-full max-w-[13rem] rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-500 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">— diketik manual —</option>
        {akun.map((a) => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </select>
      {!state.ok && state.message && (
        <span className="mt-0.5 block text-[11px] text-red-600">{state.message}</span>
      )}
    </form>
  );
}

/**
 * Menautkan jatah kategori ke RAB bulan yang sama.
 *
 * Disebut terang-terangan di barisnya, bukan ditebak dari nama kategorinya,
 * supaya yang membacanya tahu angka di sebelahnya datang dari mana — dan tahu
 * bahwa ia akan ikut berubah saat RAB-nya diubah.
 */
export function CategoryRab({
  id, rabKind, jenis,
}: {
  id: string;
  rabKind: string | null;
  jenis: { nilai: string; label: string }[];
}) {
  const [state, action] = useActionState(updateCategoryRab, initial);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={form} className="mt-0.5">
      <input type="hidden" name="id" value={id} />
      <select
        name="rabKind"
        defaultValue={rabKind ?? ''}
        aria-label="Sumber jatah"
        onChange={() => form.current?.requestSubmit()}
        className="w-full max-w-[13rem] rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-500 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        <option value="">jatah — diketik sendiri</option>
        {jenis.map((j) => (
          <option key={j.nilai} value={j.nilai}>jatah — dari RAB {j.label}</option>
        ))}
      </select>
      {state.message && (
        <span className={`mt-0.5 block text-[11px] ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function CategoryDelete({ id, jumlahBelanja }: { id: string; jumlahBelanja: number }) {
  const [state, action] = useActionState(deleteCategory, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  if (!konfirmasi) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-red-600 hover:underline"
        onClick={() => setKonfirmasi(true)}
      >
        Hapus
      </button>
    );
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <span className="text-xs text-slate-600">
        {jumlahBelanja > 0
          ? `Hapus beserta ${jumlahBelanja} laporan belanjanya?`
          : 'Hapus kategori ini?'}
      </span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Tautan label="Ya" pendingLabel="…" bahaya />
      </form>
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
        Batal
      </button>
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}

export function CheckpointDelete({ id }: { id: string }) {
  const [state, action] = useActionState(deleteCheckpoint, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Tautan label="Hapus" pendingLabel="…" bahaya />
      {!state.ok && state.message && <span className="ml-2 text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

export function PlanDelete({ id, period }: { id: string; period: string }) {
  const [state, action] = useActionState(deleteCashPlan, initial);
  const [konfirmasi, setKonfirmasi] = useState(false);

  if (!konfirmasi) {
    return (
      <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setKonfirmasi(true)}>
        Hapus rencana {period}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-3">
      <span className="text-xs text-slate-600">Hapus rencana {period} beserta seluruh isinya?</span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Tautan label="Ya, hapus" pendingLabel="Menghapus…" bahaya />
      </form>
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setKonfirmasi(false)}>
        Batal
      </button>
      {!state.ok && state.message && <span className="text-xs text-red-600">{state.message}</span>}
    </span>
  );
}

/**
 * Laporan belanja. Dua cara mencatat, dan perbedaannya penting: TAMBAH untuk
 * pengeluaran baru, SETEL bila angka yang dilaporkan adalah total terbaru —
 * misalnya setelah purchasing merekap ulang, atau setelah posisi kas diperbarui
 * sehingga hitungan sebelumnya sudah termasuk di saldo.
 */
export function SpendForm({
  planId, kategori, defaultDate,
}: {
  planId: string;
  kategori: { id: string; label: string; terpakai: number }[];
  defaultDate: string;
}) {
  const [state, action] = useActionState(saveSpend, initial);
  const [mode, setMode] = useState<'TAMBAH' | 'SETEL'>('TAMBAH');

  if (kategori.length === 0) {
    // Menyebut tempatnya, bukan hanya syaratnya. Formulirnya ada di kartu lain
    // yang letaknya jauh di halaman yang sama, dan tanpa tautan ini orang
    // membaca "tambahkan kategori" lalu tidak menemukan di mana.
    return (
      <p className="text-sm text-slate-500">
        Bulan ini belum punya kategori belanja. Tambahkan dulu di{' '}
        <a href="#kategori" className="font-medium text-brand-600 hover:underline">
          Plafon dan realisasi per kategori
        </a>{' '}
        — biasanya Purchasing, HR dan Bank Perusahaan.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4" key={state.ok ? state.message : 'baru'}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="mode" value={mode} />

      <div>
        <label className="label" htmlFor="rk-skat">Dibelanjakan oleh</label>
        <select id="rk-skat" name="categoryId" className="input" required defaultValue="">
          <option value="" disabled>Pilih kategori…</option>
          {kategori.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} — terpakai {formatRupiah(k.terpakai)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="label">Cara mencatat</span>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['TAMBAH', 'Tambah', 'Ditumpuk ke total sebelumnya'],
            ['SETEL', 'Setel ulang', 'Mengganti total jadi angka ini'],
          ] as const).map(([nilai, judul, jelas]) => (
            <button
              key={nilai}
              type="button"
              onClick={() => setMode(nilai)}
              aria-pressed={mode === nilai}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                mode === nilai
                  ? 'border-brand-500 bg-brand-50 text-brand-800'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >
              <span className="block font-medium">{judul}</span>
              <span className="block text-[11px] text-slate-500">{jelas}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="rk-samount">
          {mode === 'SETEL' ? 'Total belanja terbaru' : 'Nominal belanja'}
        </label>
        <MoneyInput id="rk-samount" name="amount" placeholder="14.000.000" required />
        {mode === 'SETEL' && (
          <p className="mt-1 text-xs text-slate-500">Isi 0 untuk mengosongkan hitungan kategori ini.</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="rk-sdate">Tanggal</label>
        <input id="rk-sdate" type="date" name="date" className="input" defaultValue={defaultDate} required />
      </div>

      <div>
        <label className="label" htmlFor="rk-snote">Catatan</label>
        <input id="rk-snote" name="notes" className="input" placeholder="Opsional" />
      </div>

      <Submit label={mode === 'SETEL' ? 'Setel ulang total' : 'Catat belanja'} />
      <Pesan state={state} />
    </form>
  );
}

export function SpendDelete({ id }: { id: string }) {
  const [state, action] = useActionState(deleteSpend, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Tautan label="Hapus" pendingLabel="…" bahaya />
      {!state.ok && state.message && <span className="ml-2 text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

/** Dua angka yang hanya dipakai meramalkan kapan kas habis. */
export function AssumptionForm({
  id, asumsi,
}: {
  id: string;
  asumsi: {
    monthlyOutflow: number | null; salaryNeed: number | null;
    usulanOutflow: number | null; usulanGaji: number | null;
  };
}) {
  const [state, action] = useActionState(saveAssumptions, initial);
  const baris = [
    {
      name: 'monthlyOutflow', label: 'Pengeluaran rutin per bulan',
      nilai: asumsi.monthlyOutflow, usul: asumsi.usulanOutflow,
      jelas: 'Seluruh uang keluar sebulan termasuk gaji, service, dan cicilan bank.',
    },
    {
      name: 'salaryNeed', label: 'Kebutuhan gaji per bulan',
      nilai: asumsi.salaryNeed, usul: asumsi.usulanGaji,
      jelas: 'Dipakai menandai bulan yang saldonya tidak lagi menutup gaji.',
    },
  ];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {baris.map((b) => (
        <div key={b.name}>
          <label className="label" htmlFor={`rk-${b.name}`}>{b.label}</label>
          <MoneyInput
            id={`rk-${b.name}`}
            name={b.name}
            defaultValue={b.nilai === null ? '' : String(b.nilai)}
            placeholder={b.usul === null ? '402.800.000' : String(Math.round(b.usul))}
          />
          <p className="mt-1 text-xs text-slate-500">
            {b.jelas}
            {b.nilai === null && b.usul !== null && ` Kosong — memakai ${formatRupiah(b.usul)}.`}
          </p>
        </div>
      ))}
      <Submit label="Simpan asumsi" />
      <Pesan state={state} />
    </form>
  );
}
