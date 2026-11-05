'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPayMoney, createReceiveMoney, type ActionState } from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import type { CashAccountBalance } from '@/lib/queries';
import { SearchableSelect, type PickerOption } from './searchable-select';
import { ACCOUNT_TYPE_LABEL, type AccountType } from '@/lib/accounting';
import { MoneyInput } from './money-input';

const initial: ActionState = { ok: false, message: '' };

export type CategoryAccount = { id: string; code: string; name: string; type: string };
export type UnitOption = { id: string; code: string; name: string };

type Row = { key: number; accountId: string; unitId: string; amount: string; memo: string };

let nextKey = 1;
const blank = (unitId: string): Row => ({ key: nextKey++, accountId: '', unitId, amount: '', memo: '' });

const keyOf = (a: { accountId: string; unitId: string }) => `${a.accountId}::${a.unitId}`;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

/**
 * Formulir uang masuk dan uang keluar. Keduanya berbagi bentuk yang sama:
 * satu rekening kas, lalu beberapa baris rincian yang boleh menunjuk cabang
 * berbeda — mis. satu tagihan listrik dibagi ke hotel dan laundry.
 */
export function MoneyForm({
  kind,
  accounts,
  categories,
  units,
  defaultDate,
}: {
  kind: 'RECEIVE' | 'PAY';
  accounts: CashAccountBalance[];
  categories: CategoryAccount[];
  units: UnitOption[];
  defaultDate: string;
}) {
  const action = kind === 'RECEIVE' ? createReceiveMoney : createPayMoney;
  const [state, formAction] = useActionState(action, initial);
  const [cash, setCash] = useState('');
  // Cabang disaring lebih dulu supaya daftar rekening tidak memuat seluruh
  // kombinasi cabang x akun sekaligus — lima cabang dengan sebelas akun kas
  // berarti lima puluh lima baris, dan yang dicari hampir selalu ada di satu
  // cabang saja. Kosong berarti semua, jadi yang terbiasa mengetik langsung
  // nama rekeningnya tidak kehilangan caranya.
  const [unit, setUnit] = useState('');

  const byKey = useMemo(() => new Map(accounts.map((a) => [keyOf(a), a])), [accounts]);
  const cashAcc = byKey.get(cash);
  const cashUnitId = cashAcc?.unitId ?? units[0]?.id ?? '';

  const [rows, setRows] = useState<Row[]>([blank(''), blank('')]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const total = rows.reduce((s, r) => s + (Number(r.amount.replace(/[^\d]/g, '')) || 0), 0);
  const filled = rows.filter((r) => r.accountId && Number(r.amount.replace(/[^\d]/g, '')) > 0);
  const crossUnit = filled.some((r) => (r.unitId || cashUnitId) !== cashUnitId);

  /*
   * Rekening kas dikelompokkan per cabang; saldonya ikut tampil di daftar.
   *
   * Kas penampung tidak ikut disaring saat sebuah cabang dipilih. Ia memang
   * bukan milik cabang mana pun — dananya disetor beberapa cabang lalu
   * dibelanjakan untuk cabang mana pun — jadi menyembunyikannya di balik
   * saringan cabang berarti menyembunyikannya dari semua cabang sekaligus.
   */
  const cashOptions: PickerOption[] = useMemo(
    () =>
      accounts
        .filter((a) => !unit || a.unitId === unit || a.penampung)
        .map((a) => ({
          value: keyOf(a),
          code: a.code,
          label: a.name,
          group: a.penampung ? 'Penampung — bukan milik satu cabang' : `${a.unitCode} — ${a.unitName}`,
          meta: formatRupiah(a.balance),
        })),
    [accounts, unit],
  );

  const adaPenampung = useMemo(() => accounts.some((a) => a.penampung), [accounts]);

  /*
   * Pada kas penampung, cabang tiap baris harus dipilih sendiri.
   *
   * Baris rincian biasanya mewarisi cabang pemilik rekening, dan itu benar
   * untuk rekening cabang. Penampung tidak dimiliki cabang mana pun, jadi
   * tidak ada yang bisa diwarisi — pemegangnya bahkan tidak ada di daftar
   * cabang, sehingga kolomnya akan menampilkan cabang pertama sementara yang
   * terkirim bukan itu.
   */
  const wajibPilihCabang = Boolean(cashAcc?.penampung);

  // Rekening yang terlanjur dipilih dilepas bila cabangnya berganti. Kalau
  // dibiarkan, formulir menyimpan rekening yang tidak lagi terlihat di
  // daftarnya — dan yang tersimpan bukan yang terbaca di layar. Penampung
  // dikecualikan: ia tetap terlihat berapa pun cabang yang disaring.
  const gantiUnit = (baru: string) => {
    setUnit(baru);
    if (baru && cashAcc && !cashAcc.penampung && cashAcc.unitId !== baru) setCash('');
  };

  const categoryOptions: PickerOption[] = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        code: c.code,
        label: c.name,
        group: ACCOUNT_TYPE_LABEL[c.type as AccountType] ?? c.type,
      })),
    [categories],
  );

  const isReceive = kind === 'RECEIVE';

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="cashAccountId" value={cashAcc?.accountId ?? ''} />
      <input type="hidden" name="cashUnitId" value={cashAcc?.unitId ?? ''} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="m-date">Tanggal</label>
          <input id="m-date" name="date" type="date" defaultValue={defaultDate} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="m-unit-kas">Cabang pemilik rekening</label>
          <select
            id="m-unit-kas"
            className="input"
            value={unit}
            onChange={(e) => gantiUnit(e.target.value)}
          >
            <option value="">— Semua cabang —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="m-cash">
          {isReceive ? 'Uang masuk ke rekening' : 'Uang dibayar dari rekening'}
        </label>
        <SearchableSelect
          id="m-cash"
          options={cashOptions}
          value={cash}
          onChange={setCash}
          required
          showGroup={!unit || adaPenampung}
          placeholder={unit ? '— Pilih rekening cabang ini —' : '— Pilih rekening —'}
          searchPlaceholder={unit ? 'Ketik nama rekening…' : 'Ketik nama rekening atau cabang…'}
        />
        {unit && cashOptions.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Cabang ini belum punya rekening kas. Tandai akunnya sebagai kas/bank di menu
            Chart of Account, atau pilih cabang lain.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="m-party">
            {isReceive ? 'Diterima dari' : 'Dibayarkan kepada'}
          </label>
          <input
            id="m-party"
            name="counterparty"
            className="input"
            placeholder={isReceive ? 'Agoda / Tamu / PT ABC' : 'PLN / Supplier / Karyawan'}
          />
        </div>
        <div>
          <label className="label" htmlFor="m-desc">Keterangan</label>
          <input
            id="m-desc"
            name="description"
            className="input"
            placeholder={isReceive ? 'Pencairan OTA Maret' : 'Tagihan listrik Maret'}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="m-ref">No. bukti (opsional)</label>
          <input id="m-ref" name="reference" className="input" placeholder={isReceive ? 'RV-001' : 'PV-001'} />
        </div>
      </div>

      <div>
        <p className="label">Rincian</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">{isReceive ? 'Akun pendapatan' : 'Akun beban / tujuan'}</th>
                <th className="th w-40">Untuk cabang</th>
                <th className="th w-40 text-right">Nominal</th>
                <th className="th w-48">Memo</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="td">
                    <SearchableSelect
                      name="lineAccountId"
                      options={categoryOptions}
                      value={row.accountId}
                      onChange={(v) => update(row.key, { accountId: v })}
                      placeholder="— Pilih akun —"
                    />
                  </td>
                  <td className="td">
                    <select
                      name="lineUnitId"
                      className="input"
                      /*
                       * Hanya baris yang sudah menyebut akun. Formulir ini
                       * selalu menyediakan baris kosong untuk diisi
                       * berikutnya, dan mewajibkan cabang di sana membuat
                       * formulirnya tidak pernah bisa disimpan — baris kosong
                       * itu memang tidak ikut tersimpan.
                       */
                      required={wajibPilihCabang && Boolean(row.accountId)}
                      value={row.unitId || (wajibPilihCabang ? '' : cashUnitId)}
                      onChange={(e) => update(row.key, { unitId: e.target.value })}
                    >
                      {wajibPilihCabang && <option value="" disabled>— Pilih —</option>}
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <MoneyInput
                      name="lineAmount"
                      className="input text-right"
                      ariaLabel="Nominal"
                      value={row.amount}
                      onChange={(v) => update(row.key, { amount: v })}
                    />
                  </td>
                  <td className="td">
                    <input
                      name="lineMemo"
                      className="input"
                      value={row.memo}
                      onChange={(e) => update(row.key, { memo: e.target.value })}
                    />
                  </td>
                  <td className="td text-center">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        aria-label="Hapus baris"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-medium">
              <tr>
                <td className="td" colSpan={2}>Total</td>
                <td className="td num">{formatRupiah(total)}</td>
                <td className="td" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, blank('')])}>
        + Tambah baris
      </button>

      {crossUnit && cashAcc && !cashAcc.penampung && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <p className="font-semibold">Ada baris milik cabang lain</p>
          <p className="mt-0.5">
            Rekening yang dipakai milik {cashAcc.unitCode}, tetapi sebagian rincian ditujukan ke cabang lain.
            Sistem otomatis mencatat piutang dan hutang antar unit agar neraca tiap cabang tetap seimbang.
          </p>
        </div>
      )}

      {/* Pada penampung, membebankan ke cabang lain bukan kekecualian — itu justru cara kerjanya. */}
      {cashAcc?.penampung && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold">{cashAcc.name} adalah kas penampung</p>
          <p className="mt-0.5">
            Satu pot untuk semua cabang, jadi kolom <strong>Untuk cabang</strong> pada tiap baris
            rincian di bawah wajib diisi sendiri — tidak ada cabang yang bisa diwarisi dari
            rekeningnya. Piutang dan hutang antar unit tercatat sendiri,
            dan rekapnya bisa dibaca di{' '}
            <a href="/laporan/penampung" className="font-medium underline">Laporan Kas Penampung</a>.
          </p>
        </div>
      )}

      {state.message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </div>
      )}

      <SubmitButton label={isReceive ? 'Simpan uang masuk' : 'Simpan uang keluar'} />
    </form>
  );
}
