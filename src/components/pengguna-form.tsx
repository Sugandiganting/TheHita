'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  setelAktifPengguna, setelSandiPengguna, tambahPengguna, type ActionState,
} from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

function Tombol({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'tipis' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={tone === 'primary'
        ? 'btn-primary'
        : 'text-xs font-medium text-brand-600 hover:underline disabled:opacity-50'}
    >
      {pending ? '…' : label}
    </button>
  );
}

/**
 * Pesan yang memuat kata sandi sengaja tidak hilang sendiri.
 *
 * Kata sandi yang dibuatkan hanya ditampilkan sekali, dan pesan yang lenyap
 * beberapa detik kemudian berarti orangnya harus menyetel ulang hanya karena
 * belum sempat menyalin.
 */
function Pesan({ state }: { state: ActionState }) {
  if (!state.message) return null;
  const sandi = state.ok && state.message.includes('Kata sandinya:');
  return (
    <p
      className={`mt-2 rounded-md px-3 py-2 text-sm ${
        !state.ok ? 'bg-red-50 text-red-700'
          : sandi ? 'bg-amber-50 font-medium text-amber-900'
            : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {state.message}
    </p>
  );
}

export function FormTambahPengguna() {
  const [state, action] = useActionState(tambahPengguna, initial);
  const [sendiri, setSendiri] = useState(false);

  return (
    // Formulir dikosongkan setelah berhasil, kecuali saat kata sandinya
    // dibuatkan: pesannya ikut terbawa oleh key, dan satu-satunya salinan
    // kata sandi itu akan hilang sebelum sempat dibaca.
    <form action={action} className="space-y-3" key={state.ok ? state.message : 'isi'}>
      <div>
        <label className="label" htmlFor="pg-nama">Nama lengkap</label>
        <input id="pg-nama" name="name" className="input" placeholder="Sugandi" required />
      </div>

      <div>
        <label className="label" htmlFor="pg-username">Nama pengguna</label>
        <input
          id="pg-username"
          name="username"
          className="input font-mono"
          placeholder="sugandi"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Huruf kecil, angka, titik, garis bawah atau strip. Tanpa spasi. Dipakai untuk masuk,
          dan tidak bisa diubah lagi setelah dibuat.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={sendiri}
          onChange={(e) => setSendiri(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Tentukan kata sandinya sendiri
      </label>

      {sendiri ? (
        <>
          <div>
            <label className="label" htmlFor="pg-sandi">Kata sandi</label>
            <input
              id="pg-sandi" name="password" type="password" className="input"
              autoComplete="new-password" required minLength={8}
            />
            <p className="mt-1 text-xs text-slate-500">Minimal 8 karakter.</p>
          </div>
          <div>
            <label className="label" htmlFor="pg-ulangi">Ketik ulang</label>
            <input
              id="pg-ulangi" name="ulangi" type="password" className="input"
              autoComplete="new-password" required minLength={8}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          Kata sandinya akan dibuatkan acak dan ditampilkan satu kali setelah tersimpan.
          Penggunanya bisa menggantinya sendiri di menu Akun.
        </p>
      )}

      <Tombol label="Tambah pengguna" />
      <Pesan state={state} />
    </form>
  );
}

export function SetelSandi({ id, username }: { id: string; username: string }) {
  const [state, action] = useActionState(setelSandiPengguna, initial);
  const [yakin, setYakin] = useState(false);

  if (state.message) return <Pesan state={state} />;

  if (!yakin) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-brand-600 hover:underline"
        onClick={() => setYakin(true)}
      >
        Setel ulang sandi
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-slate-500">Buatkan sandi baru untuk {username}?</span>
      <Tombol label="Ya" tone="tipis" />
      <button
        type="button"
        className="text-xs text-slate-500 hover:underline"
        onClick={() => setYakin(false)}
      >
        Batal
      </button>
    </form>
  );
}

export function SetelAktif({
  id, username, aktif, diriSendiri,
}: {
  id: string; username: string; aktif: boolean; diriSendiri: boolean;
}) {
  const [state, action] = useActionState(setelAktifPengguna, initial);

  if (diriSendiri) {
    return <span className="text-xs text-slate-400">akun Anda</span>;
  }

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="aktif" value={aktif ? 'false' : 'true'} />
      <button
        type="submit"
        className={`text-xs font-medium hover:underline ${aktif ? 'text-red-600' : 'text-emerald-700'}`}
      >
        {aktif ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      {!state.ok && state.message && (
        <span className="mt-1 block text-[11px] text-red-600">{state.message}</span>
      )}
      <span className="sr-only">{username}</span>
    </form>
  );
}
