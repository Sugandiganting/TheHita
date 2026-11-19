'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ubahStatusProyek, type ActionState } from '@/app/actions';
import {
  AKSI_PROYEK, ARTI_STATUS_PROYEK, LABEL_STATUS_PROYEK, aksiTersedia,
  type AksiProyek, type StatusProyek,
} from '@/lib/proyek';

const initial: ActionState = { ok: false, message: '' };

/** Tahapan utama, untuk penanda langkah di atas kartu. */
const TAHAP: StatusProyek[] = ['DRAFT', 'PROPOSED', 'FUNDING_REVIEW', 'APPROVED', 'ONGOING', 'DONE'];

export type RiwayatStatus = {
  id: string;
  fromStatus: string;
  toStatus: string;
  note: string | null;
  userName: string;
  /** "19 Nov 2026 14:05", sudah diformat di server. */
  waktu: string;
};

function Tombol({ aksi, kirim }: { aksi: AksiProyek; kirim: (data: FormData) => void }) {
  const { pending } = useFormStatus();
  const a = AKSI_PROYEK[aksi];
  return (
    <button
      type="submit"
      // Langkahnya ditempelkan ke isian formulir oleh tombol ini sendiri:
      // nama tombol yang ditekan tidak ikut terkirim lewat aksi formulir React.
      formAction={(data) => {
        data.set('aksi', aksi);
        kirim(data);
      }}
      disabled={pending}
      className={a.bahaya ? 'btn-secondary text-red-700' : 'btn-primary'}
    >
      {a.label}
    </button>
  );
}

/**
 * Alur persetujuan sebuah proyek: posisinya sekarang, langkah yang tersedia,
 * dan riwayat siapa memindahkan statusnya kapan.
 */
export function ProjectApproval({
  id,
  status,
  riwayat,
  tanggalMulai,
}: {
  id: string;
  /** Status efektif hari ini — Approved yang sudah lewat tanggal mulai terbaca In Progress. */
  status: StatusProyek;
  riwayat: RiwayatStatus[];
  /** "1 Des 2026", untuk keterangan Approved. */
  tanggalMulai: string;
}) {
  const [state, action] = useActionState(ubahStatusProyek, initial);
  const [catatan, setCatatan] = useState('');
  // Catatan milik satu langkah; setelah tersimpan dikosongkan supaya tidak
  // terbawa ke langkah berikutnya.
  useEffect(() => { if (state.ok) setCatatan(''); }, [state]);
  const aksi = aksiTersedia(status);
  const posisi = TAHAP.indexOf(status);
  const keluar = status === 'REJECTED' || status === 'CANCELLED';

  return (
    <div className="space-y-4">
      {/* Penanda langkah: yang sudah dilewati, yang sekarang, dan yang belum. */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {TAHAP.map((t, i) => {
          const lewat = !keluar && posisi > i;
          const kini = t === status;
          return (
            <li key={t} className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 font-medium ${
                  kini ? 'bg-brand-600 text-white'
                    : lewat ? 'bg-brand-100 text-brand-800'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {LABEL_STATUS_PROYEK[t]}
              </span>
              {i < TAHAP.length - 1 && <span className="text-slate-300" aria-hidden="true">→</span>}
            </li>
          );
        })}
        {keluar && (
          <li className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
            {LABEL_STATUS_PROYEK[status]}
          </li>
        )}
      </ol>

      <p className="text-sm text-slate-700">
        <strong>{LABEL_STATUS_PROYEK[status]}</strong> — {ARTI_STATUS_PROYEK[status]}
        {status === 'APPROVED' && <> Mulai {tanggalMulai}; statusnya berubah sendiri menjadi In Progress pada tanggal itu.</>}
        {(status === 'DRAFT' || status === 'PROPOSED' || status === 'FUNDING_REVIEW') && (
          <span className="mt-1 block text-xs text-slate-500">
            Belum ikut memotong kas di Peramalan — baru dihitung setelah dananya disetujui (Approved).
          </span>
        )}
      </p>

      {aksi.length > 0 && (
        <form action={action} className="space-y-3 rounded-lg border border-slate-200 p-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="label" htmlFor={`catatan-${id}`}>
              Catatan {aksi.some((a) => AKSI_PROYEK[a].butuhCatatan) ? '(wajib untuk Reject dan Cancel)' : '(opsional)'}
            </label>
            <textarea
              id={`catatan-${id}`}
              name="catatan"
              rows={2}
              className="input"
              placeholder="Misalnya: disetujui dengan dana maksimal Rp 150 jt"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {aksi.map((a) => <Tombol key={a} aksi={a} kirim={action} />)}
          </div>
          {state.message && (
            <p className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</p>
          )}
        </form>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Riwayat persetujuan</p>
        {riwayat.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada perpindahan status.</p>
        ) : (
          <ul className="space-y-2">
            {riwayat.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium text-slate-900">
                  {LABEL_STATUS_PROYEK[r.fromStatus as StatusProyek] ?? r.fromStatus} →{' '}
                  {LABEL_STATUS_PROYEK[r.toStatus as StatusProyek] ?? r.toStatus}
                </span>
                <span className="text-slate-500"> · {r.userName} · {r.waktu}</span>
                {r.note && <span className="mt-0.5 block text-slate-600">“{r.note}”</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
