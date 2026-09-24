'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAccount, type ActionState } from '@/app/actions';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, type AccountType } from '@/lib/accounting';

const initial: ActionState = { ok: false, message: '' };

export type AccountValues = {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  parentId: string | null;
  isCash: boolean;
  isHeader: boolean;
  cashflowCategory: string | null;
  /** Berapa baris jurnal memakai akun ini — menentukan apa yang boleh diubah. */
  usage: number;
};

export type ParentOption = { id: string; code: string; name: string; type: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Menyimpan…' : label}
    </button>
  );
}

/**
 * Satu formulir untuk menambah maupun mengubah akun. Mode ubah ditandai
 * kehadiran `values`; halaman menyalurkannya lewat parameter ?edit= di alamat.
 */
export function AccountForm({
  parents,
  values,
}: {
  parents: ParentOption[];
  values?: AccountValues;
}) {
  const [state, formAction] = useActionState(saveAccount, initial);
  const editing = !!values;
  const [type, setType] = useState<string>(values?.type ?? 'EXPENSE');

  // Akun yang sudah punya transaksi dikunci sifat dasarnya.
  const locked = editing && values.usage > 0;

  // Formulir tambah dikosongkan setelah berhasil; formulir ubah dipertahankan.
  const formKey = editing ? `edit-${values.id}` : state.ok ? state.message : 'new';

  return (
    <form action={formAction} className="space-y-4" key={formKey}>
      {editing && <input type="hidden" name="id" value={values.id} />}

      <div>
        <label className="label" htmlFor="a-code">Nomor akun</label>
        <input id="a-code" name="code" className="input" placeholder="6120.10" defaultValue={values?.code} required />
      </div>

      <div>
        <label className="label" htmlFor="a-name">Nama akun</label>
        <input id="a-name" name="name" className="input" placeholder="Biaya Genset & Solar" defaultValue={values?.name} required />
      </div>

      <div>
        <label className="label" htmlFor="a-type">Jenis akun</label>
        <select
          id="a-type"
          name="type"
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={locked}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>
          ))}
        </select>
        {locked && <input type="hidden" name="type" value={type} />}
      </div>

      <div>
        <label className="label" htmlFor="a-parent">Akun induk</label>
        <select id="a-parent" name="parentId" className="input" defaultValue={values?.parentId ?? ''}>
          <option value="">— Tanpa induk —</option>
          {parents
            .filter((p) => p.type === type && p.id !== values?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
        </select>
        <p className="hint mt-1 text-xs text-slate-500">Menentukan posisi akun pada susunan COA.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="a-subtype">Kelompok (opsional)</label>
          <input id="a-subtype" name="subtype" className="input" placeholder="UTILITIES" defaultValue={values?.subtype ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="a-cashflow">Arus kas</label>
          <select id="a-cashflow" name="cashflowCategory" className="input" defaultValue={values?.cashflowCategory ?? 'OPERATING'}>
            <option value="">—</option>
            <option value="OPERATING">Operasional</option>
            <option value="INVESTING">Investasi</option>
            <option value="FINANCING">Pendanaan</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isCash"
            className="mt-0.5"
            defaultChecked={values?.isCash}
            disabled={locked || type !== 'ASSET'}
          />
          <span>
            Akun kas / bank
            <span className="block text-xs text-slate-500">
              Saldo akun bertanda ini yang dipakai mesin peramalan. Hanya untuk akun berjenis Aset.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isHeader" className="mt-0.5" defaultChecked={values?.isHeader} disabled={locked} />
          <span>
            Akun induk (header)
            <span className="block text-xs text-slate-500">Hanya untuk pengelompokan, tidak bisa diposting.</span>
          </span>
        </label>
      </div>

      {/* Kendali yang dinonaktifkan tidak ikut terkirim oleh browser, sehingga
          nilainya akan terbaca kosong di server. Kirim ulang nilai aslinya
          supaya pemeriksaan di server membandingkan angka yang benar. */}
      {locked && values.isCash && <input type="hidden" name="isCash" value="on" />}
      {locked && values.isHeader && <input type="hidden" name="isHeader" value="on" />}

      {locked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Akun ini sudah dipakai di <strong>{values.usage} baris jurnal</strong>. Nomor, nama, kelompok, dan induknya
          masih bisa diubah, tetapi jenis akun dan tanda kas/bank dikunci — mengubahnya akan mengubah seluruh laporan
          yang sudah jadi.
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

      <div className="flex gap-2">
        <SubmitButton label={editing ? 'Simpan perubahan' : 'Tambah akun'} />
        {editing && (
          <Link href="/coa" className="btn-secondary shrink-0">
            Batal
          </Link>
        )}
      </div>
    </form>
  );
}
