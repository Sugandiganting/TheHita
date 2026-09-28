'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type PickerOption = {
  value: string;
  /** Nomor akun atau kode singkat, ditampilkan dengan huruf monospace. */
  code: string;
  label: string;
  /** Pengelompokan, mis. jenis akun atau nama cabang. */
  group?: string;
  /** Keterangan tambahan di sisi kanan, mis. saldo rekening. */
  meta?: string;
};

/** Normalisasi untuk pencocokan: abaikan besar kecil huruf dan tanda baca. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Mencari berdasarkan nomor akun maupun namanya sekaligus. Setiap kata yang
 * diketik harus ditemukan, tidak harus berurutan — jadi "listrik 6120" dan
 * "6120 listrik" sama-sama menemukan akun yang sama.
 */
function matches(option: PickerOption, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = norm(`${option.code} ${option.label} ${option.group ?? ''}`);
  return terms.every((t) => hay.includes(t));
}

/**
 * Daftar pilihan yang bisa dicari, pengganti <select> untuk daftar panjang.
 *
 * Daftar dirender lewat portal ke body dengan posisi tetap, supaya tidak
 * terpotong oleh tabel yang bisa digeser ke samping.
 */
export function SearchableSelect({
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder = '— Pilih —',
  searchPlaceholder = 'Ketik nomor atau nama akun…',
  required,
  disabled,
  id,
  invalid,
  showGroup,
}: {
  name?: string;
  options: PickerOption[];
  /** Isi prop ini untuk mode terkendali; kosongkan agar komponen mengurus sendiri. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  /**
   * Tampilkan kelompok pada tombol, bukan hanya di dalam daftar. Dipakai untuk
   * rekening kas, karena satu nomor akun dipakai banyak cabang sehingga tanpa
   * ini dua pilihan berbeda terlihat sama persis.
   */
  showGroup?: boolean;
}) {
  const reactId = useId();
  const listId = `${reactId}-list`;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const selected = value !== undefined ? value : internal;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; below: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const current = byValue.get(selected);

  const filtered = useMemo(() => {
    const terms = norm(query).split(' ').filter(Boolean);
    return options.filter((o) => matches(o, terms));
  }, [options, query]);

  const commit = (v: string) => {
    if (value === undefined) setInternal(v);
    onChange?.(v);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  /** Hitung posisi panel dari tombol pemicu; dipakai ulang saat halaman digulir. */
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const room = window.innerHeight - r.bottom;
    const below = room > 260 || room > r.top;
    setRect({
      top: below ? r.bottom + 4 : r.top - 4,
      left: r.left,
      width: Math.max(r.width, 260),
      below,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Tutup saat menekan di luar tombol maupun panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Jaga agar pilihan yang sedang disorot tetap terlihat saat memakai panah.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open, query]);

  useEffect(() => setActive(0), [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setActive((a) => {
        const next = e.key === 'ArrowDown' ? a + 1 : a - 1;
        return (next + filtered.length) % filtered.length;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[active];
      if (pick) commit(pick.value);
    }
  };

  let lastGroup: string | undefined;

  return (
    <>
      {name && <input type="hidden" name={name} value={selected} />}
      {/* Menjaga validasi bawaan browser tetap bekerja untuk isian wajib. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={selected}
          onChange={() => {}}
          className="sr-only absolute h-0 w-0 opacity-0"
          style={{ position: 'absolute', height: 0, width: 0, opacity: 0, pointerEvents: 'none' }}
          onFocus={() => triggerRef.current?.focus()}
        />
      )}

      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        className={`input flex items-center gap-2 text-left ${invalid ? 'border-red-300' : ''} ${
          disabled ? '' : 'cursor-pointer hover:border-slate-400'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${current ? '' : 'text-slate-400'}`}>
          {current ? (
            <>
              <span className="font-mono text-xs text-slate-500">{current.code}</span>{' '}
              <span className="text-slate-900">{current.label}</span>
              {showGroup && current.group && (
                <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">
                  {current.group.split('—')[0].trim()}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        rect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            className="z-[100] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl"
            style={{
              position: 'fixed',
              left: rect.left,
              width: rect.width,
              ...(rect.below ? { top: rect.top } : { bottom: window.innerHeight - rect.top }),
            }}
          >
            <div className="border-b border-slate-200 p-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                aria-label="Cari akun"
              />
            </div>

            <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain py-1">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-500">
                  Tidak ada akun yang cocok dengan “{query}”.
                </li>
              )}
              {filtered.map((o, i) => {
                const showGroup = o.group && o.group !== lastGroup;
                lastGroup = o.group;
                return (
                  <li key={o.value}>
                    {showGroup && (
                      <p className="sticky top-0 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {o.group}
                      </p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.value === selected}
                      data-active={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => commit(o.value)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                        i === active ? 'bg-brand-50' : ''
                      } ${o.value === selected ? 'font-medium text-brand-700' : 'text-slate-700'}`}
                    >
                      <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{o.code}</span>
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.meta && <span className="shrink-0 text-xs tabular-nums text-slate-500">{o.meta}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
              {filtered.length} dari {options.length} akun · ↑↓ pilih · Enter untuk memilih
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
