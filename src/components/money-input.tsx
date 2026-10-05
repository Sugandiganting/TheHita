'use client';

import { useEffect, useRef, useState } from 'react';

/** Hanya digit yang disimpan; pemisah ribuan murni tampilan. */
function bersihkan(teks: string): string {
  return teks.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/** 7500000 -> "7.500.000". Kosong tetap kosong supaya placeholder terlihat. */
function format(mentah: string): string {
  return mentah === '' ? '' : mentah.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Nilai awal dari pemanggil bisa berupa angka pecahan hasil hitungan. Kolom ini
 * menerima rupiah penuh, jadi bulatkan dulu daripada membiarkan titik desimal
 * terbaca sebagai pemisah ribuan — "5000000.5" tidak boleh menjadi 50.000.005.
 */
function awalDari(v: string | undefined): string {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(Math.abs(n))) : bersihkan(v);
}

/**
 * Kolom nominal rupiah yang memberi pemisah ribuan sambil diketik.
 *
 * Yang terlihat adalah teks berformat, sedangkan yang dikirim ke server tetap
 * angka polos lewat input tersembunyi — jadi tidak ada pengurai di sisi server
 * yang perlu tahu soal titik ribuan. Posisi kursor dijaga dengan menghitung
 * digit di sebelah kirinya, supaya menyunting di tengah angka tidak melemparkan
 * kursor ke ujung setiap kali sebuah titik muncul atau hilang.
 */
export function MoneyInput({
  name,
  id,
  value,
  defaultValue,
  onChange,
  onBlur,
  className = 'input',
  placeholder,
  required,
  disabled,
  ariaLabel,
}: {
  name?: string;
  id?: string;
  /** Mode terkendali: angka polos, tanpa pemisah. */
  value?: string;
  defaultValue?: string;
  onChange?: (mentah: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [internal, setInternal] = useState(() => awalDari(defaultValue));
  const mentah = value !== undefined ? bersihkan(value) : internal;

  const ref = useRef<HTMLInputElement>(null);
  const kursor = useRef<number | null>(null);

  useEffect(() => {
    if (kursor.current === null || !ref.current) return;
    ref.current.setSelectionRange(kursor.current, kursor.current);
    kursor.current = null;
  });

  const tampil = format(mentah);

  const ubah = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const digitKiri = (el.value.slice(0, el.selectionStart ?? el.value.length).match(/\d/g) ?? []).length;
    const baru = bersihkan(el.value);
    const teksBaru = format(baru);

    // Letakkan kursor tepat setelah digit ke-n, tanpa menghitung titik.
    let n = 0;
    let pos = digitKiri === 0 ? 0 : teksBaru.length;
    for (let i = 0; i < teksBaru.length; i += 1) {
      if (/\d/.test(teksBaru[i])) {
        n += 1;
        if (n === digitKiri) {
          pos = i + 1;
          break;
        }
      }
    }
    kursor.current = pos;

    if (value === undefined) setInternal(baru);
    onChange?.(baru);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={mentah} />}
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={className}
        value={tampil}
        onChange={ubah}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    </>
  );
}
