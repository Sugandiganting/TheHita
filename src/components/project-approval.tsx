'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { hapusTambahan, ubahStatusProyek, ubahStatusTambahan, type ActionState } from '@/app/actions';
import {
  AKSI_PROYEK, AKSI_TAMBAHAN, ARTI_STATUS_PROYEK, ARTI_STATUS_TAMBAHAN, LABEL_STATUS_PROYEK, aksiTambahanTersedia,
  aksiTersedia, statusTambahan, type StatusProyek,
} from '@/lib/proyek';
import { HAK_AKSI_PROYEK, HAK_AKSI_TAMBAHAN } from '@/lib/hak-akses';

const initial: ActionState = { ok: false, message: '' };

/** Tahapan utama, untuk penanda langkah di atas kartu. */
const TAHAP: StatusProyek[] = ['DRAFT', 'PROPOSED', 'FUNDING_REVIEW', 'APPROVED', 'ONGOING', 'DONE'];
/** Pengajuan tambahan berhenti di Approved: itemnya lalu menjadi bagian proyek. */
const TAHAP_TAMBAHAN: StatusProyek[] = ['DRAFT', 'PROPOSED', 'FUNDING_REVIEW', 'APPROVED'];

type AturanAksi = { label: string; butuhCatatan: boolean; bahaya?: boolean };

export type RiwayatStatus = {
  id: string;
  fromStatus: string;
  toStatus: string;
  note: string | null;
  userName: string;
  /** "19 Nov 2026 14:05", sudah diformat di server. */
  waktu: string;
};

function Tombol({ aksi, a, kirim }: { aksi: string; a: AturanAksi; kirim: (data: FormData) => void }) {
  const { pending } = useFormStatus();
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
  jenis = 'proyek',
  hak,
}: {
  /** Id proyek, atau id pengajuan tambahan bila jenis = 'tambahan'. */
  id: string;
  /** Status efektif hari ini — Approved yang sudah lewat tanggal mulai terbaca In Progress. */
  status: StatusProyek;
  riwayat: RiwayatStatus[];
  /** "1 Des 2026", untuk keterangan Approved. */
  tanggalMulai?: string;
  /** Proyeknya sendiri, atau satu pengajuan item tambahan. Alurnya sama. */
  jenis?: 'proyek' | 'tambahan';
  /** Kode hak akses pengguna yang sedang masuk; langkah tanpa hak tidak ditampilkan. */
  hak: string[];
}) {
  const tambahan = jenis === 'tambahan';
  const [state, action] = useActionState(tambahan ? ubahStatusTambahan : ubahStatusProyek, initial);
  const [catatan, setCatatan] = useState('');
  // Catatan milik satu langkah; setelah tersimpan dikosongkan supaya tidak
  // terbawa ke langkah berikutnya.
  useEffect(() => { if (state.ok) setCatatan(''); }, [state]);
  const aturan: Record<string, AturanAksi> = tambahan ? AKSI_TAMBAHAN : AKSI_PROYEK;
  const peta: Record<string, string> = tambahan ? HAK_AKSI_TAMBAHAN : HAK_AKSI_PROYEK;
  const semuaAksi: string[] = tambahan ? aksiTambahanTersedia(statusTambahan(status)) : aksiTersedia(status);
  // Langkah yang boleh dilakukan pengguna ini, dan yang menunggu orang lain.
  const aksi = semuaAksi.filter((a) => hak.includes(peta[a]));
  const menunggu = semuaAksi.filter((a) => !hak.includes(peta[a]));
  const tahap = tambahan ? TAHAP_TAMBAHAN : TAHAP;
  const posisi = tahap.indexOf(status);
  const keluar = status === 'REJECTED' || status === 'CANCELLED' || status === 'ON_HOLD';
  const wajibCatatan = aksi.filter((a) => aturan[a].butuhCatatan).map((a) => aturan[a].label);
  const arti = tambahan ? ARTI_STATUS_TAMBAHAN[statusTambahan(status)] : ARTI_STATUS_PROYEK[status];

  return (
    <div className="space-y-4">
      {/* Penanda langkah: yang sudah dilewati, yang sekarang, dan yang belum. */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {tahap.map((t, i) => {
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
              {i < tahap.length - 1 && <span className="text-slate-300" aria-hidden="true">→</span>}
            </li>
          );
        })}
        {keluar && (
          <li className={`rounded-full px-2.5 py-1 font-medium ${
            status === 'ON_HOLD' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
          }`}>
            {LABEL_STATUS_PROYEK[status]}
          </li>
        )}
      </ol>

      <p className="text-sm text-slate-700">
        <strong>{LABEL_STATUS_PROYEK[status]}</strong> — {arti}
        {!tambahan && status === 'APPROVED' && tanggalMulai && (
          <> Mulai {tanggalMulai}; statusnya berubah sendiri menjadi In Progress pada tanggal itu.</>
        )}
        {(status === 'DRAFT' || status === 'PROPOSED' || status === 'FUNDING_REVIEW') && (
          <span className="mt-1 block text-xs text-slate-500">
            Belum ikut memotong kas di Peramalan — baru dihitung setelah dananya disetujui (Approved).
          </span>
        )}
      </p>

      {menunggu.length > 0 && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {aksi.length === 0 ? 'Langkah berikutnya' : 'Langkah lain'} —{' '}
          <strong>{menunggu.map((a) => aturan[a].label).join(', ')}</strong> — menunggu pengguna yang
          user level-nya punya hak itu.
        </p>
      )}

      {aksi.length > 0 && (
        <form action={action} className="space-y-3 rounded-lg border border-slate-200 p-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="label" htmlFor={`catatan-${id}`}>
              Catatan {wajibCatatan.length > 0 ? `(wajib untuk ${wajibCatatan.join(', ')})` : '(opsional)'}
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
            {aksi.map((a) => <Tombol key={a} aksi={a} a={aturan[a]} kirim={action} />)}
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

/** Menghapus pengajuan tambahan yang masih Draft atau ditolak, dua langkah. */
export function HapusTambahanTombol({ id, nomor }: { id: string; nomor: number }) {
  const [state, action] = useActionState(hapusTambahan, initial);
  const [yakin, setYakin] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      {yakin ? (
        <form action={action} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-slate-600">Hapus Tambahan #{nomor} beserta itemnya?</span>
          <button type="submit" className="font-medium text-red-600 hover:underline">Ya, hapus</button>
          <button type="button" className="text-slate-500 hover:underline" onClick={() => setYakin(false)}>Batal</button>
        </form>
      ) : (
        <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setYakin(true)}>
          Hapus pengajuan
        </button>
      )}
      {!state.ok && state.message && <span className="text-red-600">{state.message}</span>}
    </span>
  );
}
