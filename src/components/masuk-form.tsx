'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { masuk, type ActionState } from '@/app/actions';

const initial: ActionState = { ok: false, message: '' };

function Tombol() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Memeriksa…' : 'Masuk'}
    </button>
  );
}

export function FormMasuk({ lanjut }: { lanjut: string }) {
  const [state, action] = useActionState(masuk, initial);
  // Sesudah aksi server selesai React mengosongkan seluruh isian. Untuk kata
  // sandi itu memang yang diinginkan, tetapi mengetik ulang nama pengguna tiap
  // kali salah ketik satu huruf hanya membuat jengkel.
  const [nama, setNama] = useState('');

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lanjut" value={lanjut} />

      <div>
        <label className="label" htmlFor="masuk-user">Nama pengguna</label>
        <input
          id="masuk-user"
          name="username"
          className="input"
          autoComplete="username"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          autoFocus
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="masuk-sandi">Kata sandi</label>
        <input
          id="masuk-sandi"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>

      <Tombol />

      {state.message && !state.ok && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
