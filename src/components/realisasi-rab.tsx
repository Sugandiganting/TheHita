'use client';

import { useActionState } from 'react';
import {
  hapusPembayaranRab, hapusRealisasiLamaRab, setSelesaiRab, tambahPembayaranRab, type ActionState,
} from '@/app/actions';
import { formatRupiah } from '@/lib/format';
import { DialogTombol } from './dialog';
import { IsianBayar } from './cost-item-form';

const initial: ActionState = { ok: false, message: '' };
const angkaQty = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

export type EntriRealisasiTampil = {
  /** null untuk realisasi lama. */
  id: string | null;
  tanggal: string | null;
  amount: number;
  quantity: number | null;
  note: string | null;
  lama: boolean;
};

type Bentuk = 'akun' | 'barang';

function HapusEntri({ entri, bentuk, lineId }: { entri: EntriRealisasiTampil; bentuk: Bentuk; lineId: string }) {
  const [state, action] = useActionState(entri.lama ? hapusRealisasiLamaRab : hapusPembayaranRab, initial);
  return (
    <form action={action} className="inline">
      {entri.lama ? (
        <>
          <input type="hidden" name="bentuk" value={bentuk} />
          <input type="hidden" name="lineId" value={lineId} />
        </>
      ) : (
        <input type="hidden" name="id" value={entri.id ?? ''} />
      )}
      <button type="submit" className="text-xs text-slate-400 hover:text-red-600">Hapus</button>
      {!state.ok && state.message && <span className="ml-2 text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

/**
 * Realisasi satu baris RAB, dengan logika yang sama seperti item proyek:
 * pembayaran dicatat per tanggal (boleh sebagian-sebagian), lalu baris
 * ditandai selesai bila belanjanya tuntas, berapa pun totalnya.
 */
export function RealisasiRabDialog({
  bentuk, lineId, nama, anggaran, qtyRencana, hargaSatuan, satuan, realisasi, qtyDibeli, selesai, entri, tanggalBawaan,
}: {
  bentuk: Bentuk;
  lineId: string;
  nama: string;
  anggaran: number;
  /** Hanya RAB per barang. */
  qtyRencana?: number;
  hargaSatuan?: number;
  satuan?: string;
  realisasi: number;
  qtyDibeli: number | null;
  selesai: boolean;
  entri: EntriRealisasiTampil[];
  tanggalBawaan: string;
}) {
  const [stateBayar, bayar] = useActionState(tambahPembayaranRab, initial);
  const [stateSelesai, tandai] = useActionState(setSelesaiRab, initial);
  const perBarang = bentuk === 'barang';
  const sisa = Math.max(0, anggaran - realisasi);
  const selisih = anggaran - realisasi;
  const unit = satuan ?? 'qty';

  return (
    <DialogTombol
      label="Realisasi"
      varian="tautan"
      lebar="sm"
      judul={`Realisasi ${nama}`}
      keterangan="Catat setiap pembayaran, boleh sebagian-sebagian. Tandai selesai bila belanjanya sudah tuntas, berapa pun totalnya."
    >
      {(tutup) => (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Anggaran</dt>
              <dd className="font-medium tabular-nums">{formatRupiah(anggaran)}</dd>
              {perBarang && qtyRencana !== undefined && (
                <dd className="text-[11px] text-slate-500">{angkaQty(qtyRencana)} {unit}</dd>
              )}
            </div>
            <div>
              <dt className="text-xs text-slate-500">Sudah dibayar</dt>
              <dd className="font-medium tabular-nums">{formatRupiah(realisasi)}</dd>
              {perBarang && qtyRencana !== undefined && (
                <dd className="text-[11px] text-slate-500">
                  {qtyDibeli === null ? 'qty belum dicatat' : `${angkaQty(qtyDibeli)} dari ${angkaQty(qtyRencana)} ${unit}`}
                </dd>
              )}
            </div>
            <div>
              <dt className="text-xs text-slate-500">{selesai ? (selisih >= 0 ? 'Hemat' : 'Lebih mahal') : 'Sisa'}</dt>
              <dd className={`font-medium tabular-nums ${selesai ? (selisih >= 0 ? 'text-emerald-700' : 'text-red-600') : ''}`}>
                {formatRupiah(selesai ? Math.abs(selisih) : sisa)}
              </dd>
            </div>
          </dl>

          {entri.length > 0 && (
            <ul className="divide-y divide-slate-100 text-sm">
              {entri.map((e, i) => (
                <li key={e.id ?? `lama-${i}`} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span>
                    <span className="tabular-nums">{e.tanggal ?? 'tanpa tanggal'}</span>
                    {e.quantity != null && <span className="ml-2 text-xs text-slate-600">{angkaQty(e.quantity)} {unit}</span>}
                    {e.lama && <span className="ml-2 text-xs text-slate-400">realisasi lama</span>}
                    {e.note && <span className="ml-2 text-xs text-slate-500">{e.note}</span>}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="font-medium tabular-nums">{formatRupiah(e.amount)}</span>
                    <HapusEntri entri={e} bentuk={bentuk} lineId={lineId} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <form action={bayar} className="space-y-3 rounded-lg border border-slate-200 p-3" key={stateBayar.ok ? stateBayar.message : 'bayar'}>
            <input type="hidden" name="bentuk" value={bentuk} />
            <input type="hidden" name="lineId" value={lineId} />
            <IsianBayar
              itemId={lineId}
              tanggalBawaan={tanggalBawaan}
              hargaSatuan={hargaSatuan ?? 0}
              sisa={sisa}
              sisaQty={Math.max(0, (qtyRencana ?? 0) - (qtyDibeli ?? 0))}
              pakaiQty={perBarang}
              satuan={unit}
            />
            <button type="submit" className="btn-primary">Catat pembayaran</button>
            {stateBayar.message && (
              <p className={`text-sm ${stateBayar.ok ? 'text-emerald-700' : 'text-red-600'}`}>{stateBayar.message}</p>
            )}
          </form>

          <form action={tandai} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="bentuk" value={bentuk} />
            <input type="hidden" name="lineId" value={lineId} />
            <input type="hidden" name="selesai" value={selesai ? 'tidak' : 'ya'} />
            <button type="submit" className={selesai ? 'btn-secondary' : 'btn-primary'}>
              {selesai ? 'Buka lagi (belum selesai)' : 'Tandai belanja selesai'}
            </button>
            <button type="button" className="btn-secondary" onClick={tutup}>Tutup</button>
            {stateSelesai.message && (
              <p className={`w-full text-sm ${stateSelesai.ok ? 'text-emerald-700' : 'text-red-600'}`}>{stateSelesai.message}</p>
            )}
          </form>
        </div>
      )}
    </DialogTombol>
  );
}
