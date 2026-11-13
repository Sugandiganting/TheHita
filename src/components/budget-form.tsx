'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveBudget, saveBudgetItemLine, saveBudgetLine,
  simpanRealisasiAkun, simpanRealisasiBarang,
  type ActionState,
} from '@/app/actions';
import { ACCOUNT_TYPE_LABEL, type AccountType } from '@/lib/accounting';
import { JENIS_RAB, JENIS_RAB_LABEL, nilaiBarisBarang } from '@/lib/rab';
import { formatPeriod, formatRupiah } from '@/lib/format';
import { hariDalamBulan } from '@/lib/tren-masuk';
import { SearchableSelect, type PickerOption } from './searchable-select';
import { MoneyInput } from './money-input';

const initial: ActionState = { ok: false, message: '' };

/** Tanggal terakhir sebuah bulan "YYYY-MM", untuk batas atas kolom tanggal. */
const akhirBulan = (period: string) => `${period}-${String(hariDalamBulan(period)).padStart(2, '0')}`;

export type ScopeOption = {
  code: string;
  label: string;
  /** Ditanggung beberapa cabang bersama. */
  bersama: boolean;
};

function SubmitButton({ label, onTutup }: { label: string; onTutup?: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className={`btn-primary ${onTutup ? '' : 'w-full'}`} disabled={pending}>
        {pending ? 'Menyimpan…' : label}
      </button>
      {/* Hanya ada bila formulirnya berada di dalam dialog. */}
      {onTutup && (
        <button type="button" className="btn-secondary" onClick={onTutup}>Tutup</button>
      )}
    </div>
  );
}

/** Membuat RAB baru: tinggal pilih pemilik dan bulannya, rinciannya menyusul. */
export function BudgetForm({
  scopes, defaultPeriod, onTutup,
}: {
  scopes: ScopeOption[];
  defaultPeriod: string;
  onTutup?: () => void;
}) {
  const [state, formAction] = useActionState(saveBudget, initial);

  return (
    <form action={formAction} className="space-y-4" key={state.ok ? state.message : 'baru'}>
      <fieldset>
        <legend className="label">Jenis RAB</legend>
        <div className="space-y-2">
          {JENIS_RAB.map((j) => (
            <label key={j} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-2 hover:bg-slate-50">
              <input
                type="radio"
                name="kind"
                value={j}
                required
                defaultChecked={j === 'UMUM'}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium">{JENIS_RAB_LABEL[j]}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {j === 'PURCHASING'
                    ? 'Diisi per barang: pilih barangnya, jumlah, dan harga satuan. Akun bebannya ikut dari master barang.'
                    : 'Diisi per akun: gaji, listrik, dan biaya lain yang tidak berupa barang.'}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Satu cabang boleh punya keduanya dalam satu bulan. Jenisnya tidak bisa diganti
          setelah RAB dibuat, karena isinya tersimpan dengan bentuk yang berbeda.
        </p>
      </fieldset>

      <div>
        <label className="label" htmlFor="rab-scope">Pemilik anggaran</label>
        <select id="rab-scope" name="scope" className="input" required defaultValue="">
          <option value="" disabled>Pilih cabang atau kelompok…</option>
          <optgroup label="Cabang">
            {scopes.filter((s) => !s.bersama).map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </optgroup>
          <optgroup label="Ditanggung bersama">
            {scopes.filter((s) => s.bersama).map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </optgroup>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Kelompok bersama dipakai untuk biaya yang ditanggung beberapa cabang sekaligus —
          gaji staf yang bekerja di dua lokasi, listrik satu meteran. Biaya seperti itu
          tidak masuk RAB cabang mana pun.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rab-period">Bulan</label>
        <input id="rab-period" type="month" name="period" className="input" defaultValue={defaultPeriod} required />
      </div>

      <div>
        <label className="label" htmlFor="rab-notes">Catatan</label>
        <input id="rab-notes" name="notes" className="input" placeholder="Opsional" />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label="Buat RAB" onTutup={onTutup} />
    </form>
  );
}

export type AkunOption = { id: string; code: string; name: string; type: string };

/** Menambah atau mengubah satu baris anggaran di dalam sebuah RAB. */
export function BudgetLineForm({
  budgetId,
  accounts,
  periode,
  values,
  disabled,
  onTutup,
}: {
  budgetId: string;
  accounts: AkunOption[];
  periode: string;
  values?: { accountId: string; amount: number; notes: string | null; planDate: string | null };
  disabled?: boolean;
  onTutup?: () => void;
}) {
  const [state, formAction] = useActionState(saveBudgetLine, initial);

  const opsiAkun: PickerOption[] = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        code: a.code,
        label: a.name,
        group: ACCOUNT_TYPE_LABEL[a.type as AccountType] ?? a.type,
      })),
    [accounts],
  );

  if (disabled) {
    return (
      <p className="text-sm text-slate-500">
        RAB ini sudah disahkan. Kembalikan ke draf dulu bila ingin mengubah anggarannya.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4" key={values?.accountId ?? (state.ok ? state.message : 'baru')}>
      <input type="hidden" name="budgetId" value={budgetId} />

      <div>
        <label className="label" htmlFor="rab-akun">Akun beban</label>
        <SearchableSelect
          id="rab-akun"
          name="accountId"
          options={opsiAkun}
          defaultValue={values?.accountId ?? ''}
          required
          disabled={values !== undefined}
          placeholder="— Pilih akun —"
          searchPlaceholder="Ketik nomor atau nama akun…"
        />
        {values && (
          <p className="mt-1 text-xs text-slate-500">
            Akunnya tidak bisa diganti di sini, karena baris RAB dikenali dari akunnya. Kalau yang
            terpilih memang keliru, hapus barisnya lalu tambahkan yang benar.
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="rab-amount">Dianggarkan</label>
        <MoneyInput
          id="rab-amount"
          name="amount"
          placeholder="5.000.000"
          defaultValue={values ? String(values.amount) : ''}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Titik ribuan muncul sendiri sambil diketik.
        </p>
      </div>

      {/* Perkiraan tanggal belanja — bukan realisasi.
          Rancangan kas mingguan memakainya untuk menempatkan rencana belanja
          ini pada minggunya. Dibiarkan kosong pun tidak apa-apa: barisnya
          disebar rata sepanjang sisa bulan, karena "belum tahu kapan" bukan
          hal yang sama dengan "awal bulan". */}
      <div>
        <label className="label" htmlFor="rab-line-plan">Perkiraan tanggal belanja</label>
        <input
          id="rab-line-plan"
          name="planDate"
          type="date"
          className="input"
          min={`${periode}-01`}
          max={akhirBulan(periode)}
          defaultValue={values?.planDate ?? ''}
        />
        <p className="mt-1 text-xs text-slate-500">
          Opsional, dan harus di dalam {formatPeriod(periode)}. Dipakai rancangan kas mingguan
          untuk tahu di minggu mana uangnya dibutuhkan; dikosongkan berarti disebar rata.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rab-line-notes">Catatan</label>
        <input id="rab-line-notes" name="notes" className="input" placeholder="Opsional" defaultValue={values?.notes ?? ''} />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label={values ? 'Perbarui anggaran' : 'Tambah ke RAB'} onTutup={onTutup} />
    </form>
  );
}

export type BarangOption = {
  id: string;
  code: string;
  name: string;
  satuan: string;
  kategori: string;
  subKategori: string;
  accountCode: string;
  accountName: string;
};

/**
 * Menambah atau mengubah satu baris barang di RAB Purchasing.
 *
 * Akun beban barangnya ditampilkan begitu barangnya dipilih, bukan diminta
 * dari yang mengisi. Akun itu sudah ditetapkan sekali di master barang, dan
 * menanyakannya lagi di sini hanya membuka peluang satu barang masuk ke dua
 * akun yang berbeda di dua RAB.
 */
export function BudgetItemLineForm({
  budgetId,
  items,
  periode,
  values,
  disabled,
  onTutup,
}: {
  budgetId: string;
  items: BarangOption[];
  periode: string;
  /** Diisi saat mengoreksi baris yang sudah ada. */
  values?: {
    itemId: string; quantity: number; unitPrice: number;
    catatan: string | null; planDate: string | null;
  };
  disabled?: boolean;
  onTutup?: () => void;
}) {
  const [state, formAction] = useActionState(saveBudgetItemLine, initial);
  const [itemId, setItemId] = useState(values?.itemId ?? '');
  const [quantity, setQuantity] = useState(values ? String(values.quantity) : '');
  const [unitPrice, setUnitPrice] = useState(values ? String(values.unitPrice) : '');
  const mengubah = values !== undefined;

  /*
   * Dikosongkan sendiri setelah tersimpan — tetapi hanya saat menambah.
   *
   * Tiga kolom ini terkendali oleh state, jadi `key` pada <form> tidak
   * mengosongkannya seperti pada formulir yang kolomnya tidak terkendali.
   * Kalau dibiarkan terisi, barang yang baru disimpan masih terpilih saat
   * barang berikutnya diketik — dan menekan simpan sekali lagi tanpa sadar
   * hanya akan menimpa baris yang sudah benar.
   *
   * Saat mengoreksi justru sebaliknya: yang baru disimpan adalah keadaan yang
   * benar, dan mengosongkannya membuat dialog yang masih terbuka menampilkan
   * baris kosong seolah-olah datanya hilang.
   */
  useEffect(() => {
    if (!state.ok || mengubah) return;
    setItemId('');
    setQuantity('');
    setUnitPrice('');
  }, [state, mengubah]);

  const opsiBarang: PickerOption[] = useMemo(
    () =>
      items.map((b) => ({
        value: b.id,
        code: b.code,
        label: b.name,
        // Dikelompokkan per departemen, karena itulah cara penyusun RAB
        // mencarinya: ia tahu sedang menyusun belanja House Keeping, bukan
        // sedang mencari satu nama di antara seratus.
        group: `${b.kategori} › ${b.subKategori}`,
        meta: b.satuan,
      })),
    [items],
  );

  const terpilih = items.find((b) => b.id === itemId) ?? null;
  const jumlah = Number(quantity.replace(',', '.'));
  const harga = Number(unitPrice);
  const nilai =
    Number.isFinite(jumlah) && jumlah > 0 && Number.isFinite(harga) && harga > 0
      ? nilaiBarisBarang({ quantity: jumlah, unitPrice: harga })
      : null;

  if (disabled) {
    return (
      <p className="text-sm text-slate-500">
        RAB ini sudah disahkan. Kembalikan ke draf dulu bila ingin mengubah anggarannya.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Belum ada barang di master. Daftarkan barangnya dulu di{' '}
        <a href="/logistik/barang" className="text-brand-700 hover:underline">Master Barang</a>,
        lengkap dengan satuan dan akun bebannya.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="budgetId" value={budgetId} />

      <div>
        <label className="label" htmlFor="rab-barang">Barang</label>
        <SearchableSelect
          id="rab-barang"
          name="itemId"
          options={opsiBarang}
          value={itemId}
          onChange={setItemId}
          required
          disabled={mengubah}
          placeholder="— Pilih barang —"
          searchPlaceholder="Ketik kode atau nama barang…"
          noun="barang"
          showGroup
        />
        {terpilih && (
          <p className="mt-1 text-xs text-slate-600">
            Akun bebannya{' '}
            <span className="font-mono">{terpilih.accountCode}</span> {terpilih.accountName}
            {' — '}satuan {terpilih.satuan}
          </p>
        )}
        {/*
          * Barangnya tidak bisa diganti di sini.
          *
          * Satu baris RAB dikenali dari barangnya, jadi mengganti barang
          * berarti membuat baris lain — dan baris lamanya akan tertinggal
          * tanpa ada yang melihatnya pergi.
          */}
        {mengubah && (
          <p className="mt-1 text-xs text-slate-500">
            Barangnya tidak bisa diganti di sini, karena baris RAB dikenali dari barangnya. Kalau
            yang terpilih memang keliru, hapus barisnya lalu tambahkan yang benar.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rab-jumlah">
            Jumlah{terpilih ? ` (${terpilih.satuan})` : ''}
          </label>
          <input
            id="rab-jumlah"
            name="quantity"
            className="input"
            inputMode="decimal"
            placeholder="20"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="rab-harga">Harga satuan</label>
          <MoneyInput
            id="rab-harga"
            name="unitPrice"
            placeholder="65.000"
            value={unitPrice}
            onChange={setUnitPrice}
            required
          />
        </div>
      </div>

      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm">
        Dianggarkan{' '}
        <strong>{nilai === null ? '—' : formatRupiah(nilai)}</strong>
        <span className="mt-0.5 block text-xs text-slate-500">
          Jumlah kali harga satuan. Dihitung, bukan diketik, jadi tidak bisa berbeda dengan keduanya.
        </span>
      </p>

      {/* Perkiraan tanggal belanja — bukan realisasi.
          Rancangan kas mingguan memakainya untuk menempatkan rencana belanja
          ini pada minggunya. Dibiarkan kosong pun tidak apa-apa: barisnya
          disebar rata sepanjang sisa bulan, karena "belum tahu kapan" bukan
          hal yang sama dengan "awal bulan". */}
      <div>
        <label className="label" htmlFor="rab-barang-plan">Perkiraan tanggal belanja</label>
        <input
          id="rab-barang-plan"
          name="planDate"
          type="date"
          className="input"
          min={`${periode}-01`}
          max={akhirBulan(periode)}
          defaultValue={values?.planDate ?? ''}
        />
        <p className="mt-1 text-xs text-slate-500">
          Opsional, dan harus di dalam {formatPeriod(periode)}. Dipakai rancangan kas mingguan
          untuk tahu di minggu mana uangnya dibutuhkan; dikosongkan berarti disebar rata.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="rab-barang-notes">Catatan</label>
        <input
          id="rab-barang-notes"
          name="notes"
          className="input"
          placeholder="Opsional"
          defaultValue={values?.catatan ?? ''}
          key={values?.itemId ?? (state.ok ? state.message : 'baru')}
        />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label={mengubah ? 'Perbarui baris' : 'Simpan ke RAB'} onTutup={onTutup} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Realisasi — hanya pada RAB yang sudah disahkan                      */
/* ------------------------------------------------------------------ */

/**
 * Mencatat realisasi satu baris RAB Purchasing.
 *
 * Barang, jumlah dan harga yang DIRENCANAKAN tidak bisa disentuh di sini:
 * begitu RAB disahkan, rencananya berhenti bergerak supaya ada yang bisa
 * dibandingkan. Yang terbuka justru kebalikannya — apa yang sungguh terjadi.
 */
export function RealisasiBarangForm({
  lineId, nama, satuan, anggaran, nilai, defaultDate, onTutup,
}: {
  lineId: string;
  nama: string;
  satuan: string;
  anggaran: number;
  nilai: {
    quantity: number | null; unitPrice: number | null;
    tanggal: string | null; selesai: boolean; catatan: string | null;
  };
  defaultDate: string;
  onTutup?: () => void;
}) {
  const [state, formAction] = useActionState(simpanRealisasiBarang, initial);
  const [quantity, setQuantity] = useState(nilai.quantity === null ? '' : String(nilai.quantity));
  const [unitPrice, setUnitPrice] = useState(nilai.unitPrice === null ? '' : String(nilai.unitPrice));
  const [selesai, setSelesai] = useState(nilai.selesai);

  const jumlah = Number(quantity.replace(',', '.'));
  const harga = Number(unitPrice);
  const terisi = quantity.trim() !== '' && unitPrice.trim() !== ''
    && Number.isFinite(jumlah) && Number.isFinite(harga);
  const realisasi = terisi ? nilaiBarisBarang({ quantity: jumlah, unitPrice: harga }) : null;
  const hemat = realisasi === null ? null : anggaran - realisasi;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={lineId} />
      <input type="hidden" name="realDone" value={selesai ? 'true' : 'false'} />

      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {nama} — dianggarkan <strong className="text-slate-900">{formatRupiah(anggaran)}</strong>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rl-jumlah">Jumlah yang dibeli ({satuan})</label>
          <input
            id="rl-jumlah"
            name="realQuantity"
            className="input"
            inputMode="decimal"
            placeholder="20"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="rl-harga">Harga satuan sebenarnya</label>
          <MoneyInput id="rl-harga" name="realUnitPrice" placeholder="65.000"
            value={unitPrice} onChange={setUnitPrice} />
        </div>
      </div>

      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm">
        Realisasi <strong>{realisasi === null ? '—' : formatRupiah(realisasi)}</strong>
        {hemat !== null && (
          <span className={`ml-2 ${hemat < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {hemat < 0 ? 'lewat ' : 'hemat '}
            {formatRupiah(Math.abs(hemat))}
          </span>
        )}
        <span className="mt-0.5 block text-xs text-slate-500">
          Dikosongkan berarti belum dilaporkan, dan anggarannya tetap dihitung akan keluar. Isi{' '}
          <strong>0</strong> lalu tandai selesai bila barangnya tidak jadi dibeli.
        </span>
      </p>

      <div>
        <label className="label" htmlFor="rl-tanggal">Tanggal realisasi</label>
        <input id="rl-tanggal" type="date" name="realDate" className="input"
          defaultValue={nilai.tanggal ?? defaultDate} />
      </div>

      <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={selesai}
          onChange={(e) => setSelesai(e.target.checked)}
        />
        <span>
          <span className="font-medium text-slate-900">Selesai dibeli</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Hanya yang selesai dihitung sebagai penghematan, dan berhenti dihitung akan keluar.
            Yang baru dibeli separuh masih mungkin menghabiskan sisa anggarannya.
          </span>
        </span>
      </label>

      <div>
        <label className="label" htmlFor="rl-catatan">Catatan</label>
        <input id="rl-catatan" name="realNotes" className="input" placeholder="Opsional"
          defaultValue={nilai.catatan ?? ''} />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label="Simpan realisasi" onTutup={onTutup} />
    </form>
  );
}

/** Mencatat realisasi satu baris RAB per akun. Tanpa jumlah dan satuan. */
export function RealisasiAkunForm({
  lineId, nama, anggaran, nilai, defaultDate, onTutup,
}: {
  lineId: string;
  nama: string;
  anggaran: number;
  nilai: { amount: number | null; tanggal: string | null; selesai: boolean; catatan: string | null };
  defaultDate: string;
  onTutup?: () => void;
}) {
  const [state, formAction] = useActionState(simpanRealisasiAkun, initial);
  const [amount, setAmount] = useState(nilai.amount === null ? '' : String(nilai.amount));
  const [selesai, setSelesai] = useState(nilai.selesai);

  const nominal = Number(amount);
  const terisi = amount.trim() !== '' && Number.isFinite(nominal);
  const hemat = terisi ? anggaran - nominal : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={lineId} />
      <input type="hidden" name="realDone" value={selesai ? 'true' : 'false'} />

      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {nama} — dianggarkan <strong className="text-slate-900">{formatRupiah(anggaran)}</strong>
      </p>

      <div>
        <label className="label" htmlFor="rl-nominal">Nominal yang sungguh keluar</label>
        <MoneyInput id="rl-nominal" name="realAmount" placeholder="5.000.000"
          value={amount} onChange={setAmount} />
        <p className="mt-1 text-xs text-slate-500">
          Dikosongkan berarti belum dilaporkan. Isi <strong>0</strong> lalu tandai selesai bila
          tidak jadi keluar.
        </p>
      </div>

      {hemat !== null && (
        <p className={`text-sm ${hemat < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
          {hemat < 0 ? 'Lewat ' : 'Hemat '}{formatRupiah(Math.abs(hemat))}
        </p>
      )}

      <div>
        <label className="label" htmlFor="rl-tanggal-akun">Tanggal realisasi</label>
        <input id="rl-tanggal-akun" type="date" name="realDate" className="input"
          defaultValue={nilai.tanggal ?? defaultDate} />
      </div>

      <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm">
        <input type="checkbox" className="mt-0.5" checked={selesai}
          onChange={(e) => setSelesai(e.target.checked)} />
        <span>
          <span className="font-medium text-slate-900">Selesai</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Hanya yang selesai dihitung sebagai penghematan, dan berhenti dihitung akan keluar.
          </span>
        </span>
      </label>

      <div>
        <label className="label" htmlFor="rl-catatan-akun">Catatan</label>
        <input id="rl-catatan-akun" name="realNotes" className="input" placeholder="Opsional"
          defaultValue={nilai.catatan ?? ''} />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label="Simpan realisasi" onTutup={onTutup} />
    </form>
  );
}
