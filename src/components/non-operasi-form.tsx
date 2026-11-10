'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { simpanNonOperasi, type ActionState } from '@/app/actions';
import { MoneyInput } from './money-input';
import { formatRupiah } from '@/lib/format';

const initial: ActionState = { ok: false, message: '' };

function Simpan() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending}>
      {pending ? '…' : 'Simpan'}
    </button>
  );
}

/**
 * Uang keluar bulan ini yang bukan biaya operasi.
 *
 * Diketik, bukan selalu dihitung dari jurnal, karena jurnalnya belum tentu
 * memuat seluruhnya — dan margin yang dihitung dari renovasi yang separuh
 * tercatat akan terbaca jauh lebih baik daripada kenyataannya. Usulan dari
 * jurnal tetap ditawarkan di sampingnya supaya yang mengetik punya pembanding.
 */
export function NonOperasiForm({ id, nilai, usulan, dipakai }: {
  id: string;
  nilai: number | null;
  usulan: number | null;
  dipakai: number | null;
}) {
  const [state, action] = useActionState(simpanNonOperasi, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-[12rem]">
        <label className="label" htmlFor="non-operasi">
          Uang keluar bukan operasi bulan ini
        </label>
        <MoneyInput
          id="non-operasi"
          name="nonOperatingOutflow"
          placeholder={usulan === null ? 'Kosongkan bila tidak ada' : String(usulan)}
          defaultValue={nilai === null ? '' : String(nilai)}
        />
      </div>
      <Simpan />
      <p className="w-full text-xs text-slate-500">
        Renovasi, pembelian aset tetap, dan cicilan <strong>pokok</strong> utang — bukan bunganya.
        Dikeluarkan lebih dulu sebelum margin dihitung, supaya bulan yang kebetulan berproyek besar
        tidak terbaca sebagai bulan yang usahanya buruk.
        {usulan !== null && (
          <> Usulan dari jurnal bulan ini <strong>{formatRupiah(usulan)}</strong>.</>
        )}
        {usulan === null && nilai === null && (
          <> Jurnal bulan ini belum memuat apa pun yang bisa diusulkan, jadi angkanya perlu diketik
            sendiri — dibiarkan kosong berarti tidak ada, dan margin operasinya sama dengan margin
            kas apa adanya.</>
        )}
        {dipakai !== null && nilai === null && usulan !== null && (
          <> Yang sedang dipakai menghitung: <strong>{formatRupiah(dipakai)}</strong>.</>
        )}
      </p>
      {state.message && (
        <p className={`w-full text-xs ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
