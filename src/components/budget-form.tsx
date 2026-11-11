'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveBudget, saveBudgetItemLine, saveBudgetLine, type ActionState } from '@/app/actions';
import { ACCOUNT_TYPE_LABEL, type AccountType } from '@/lib/accounting';
import { JENIS_RAB, JENIS_RAB_LABEL, nilaiBarisBarang } from '@/lib/rab';
import { formatRupiah } from '@/lib/format';
import { SearchableSelect, type PickerOption } from './searchable-select';
import { MoneyInput } from './money-input';

const initial: ActionState = { ok: false, message: '' };

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
  values,
  disabled,
  onTutup,
}: {
  budgetId: string;
  accounts: AkunOption[];
  values?: { accountId: string; amount: number; notes: string | null };
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
          placeholder="— Pilih akun —"
          searchPlaceholder="Ketik nomor atau nama akun…"
        />
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
  disabled,
  onTutup,
}: {
  budgetId: string;
  items: BarangOption[];
  disabled?: boolean;
  onTutup?: () => void;
}) {
  const [state, formAction] = useActionState(saveBudgetItemLine, initial);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  /*
   * Dikosongkan sendiri setelah tersimpan.
   *
   * Tiga kolom ini terkendali oleh state, jadi `key` pada <form> tidak
   * mengosongkannya seperti pada formulir yang kolomnya tidak terkendali.
   * Kalau dibiarkan terisi, barang yang baru disimpan masih terpilih saat
   * barang berikutnya diketik — dan menekan simpan sekali lagi tanpa sadar
   * hanya akan menimpa baris yang sudah benar.
   */
  useEffect(() => {
    if (!state.ok) return;
    setItemId('');
    setQuantity('');
    setUnitPrice('');
  }, [state]);

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

      <div>
        <label className="label" htmlFor="rab-barang-notes">Catatan</label>
        <input
          id="rab-barang-notes"
          name="notes"
          className="input"
          placeholder="Opsional"
          key={state.ok ? state.message : 'baru'}
        />
      </div>

      {state.message && (
        <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
      )}

      <SubmitButton label="Simpan ke RAB" onTutup={onTutup} />
    </form>
  );
}
