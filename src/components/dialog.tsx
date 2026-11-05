'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tombol yang membuka sebuah dialog, beserta dialognya.
 *
 * Dipakai untuk formulir "tambah" di halaman-halaman yang hampir selalu
 * dibuka untuk membaca daftarnya, bukan untuk menambah. Menaruh formulir di
 * kolom samping memang menghemat satu gulir, tetapi memotong lebar daftarnya
 * — dan daftar itulah yang punya banyak kolom dan terus bertambah panjang,
 * sedangkan formulirnya hanya dipakai sebentar tiap kali.
 *
 * Tidak memakai elemen <dialog> bawaan. Elemen itu dirender di lapisan
 * teratas peramban, di atas segalanya, termasuk daftar pilihan SearchableSelect
 * yang dikirim lewat portal ke body — jadi setiap daftar yang dibuka di
 * dalamnya akan tersembunyi di belakang dialognya sendiri.
 */
export function DialogTombol({
  label,
  judul,
  keterangan,
  lebar = 'md',
  varian = 'tombol',
  disabled,
  title,
  children,
}: {
  /** Teks pada tombol pembukanya. */
  label: string;
  judul: string;
  keterangan?: ReactNode;
  lebar?: 'sm' | 'md' | 'lg';
  /**
   * "tombol" untuk aksi utama di kepala halaman; "tautan" untuk aksi per baris
   * di dalam tabel, di mana tombol penuh akan menenggelamkan isi barisnya.
   */
  varian?: 'tombol' | 'tautan';
  disabled?: boolean;
  /** Alasan tombolnya mati, ditampilkan sebagai tooltip. */
  title?: string;
  /** Isi dialognya. `tutup` diberikan supaya formulirnya bisa menutup sendiri. */
  children: (tutup: () => void) => ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  const pemicuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Esc menutup dialog — kecuali saat sebuah daftar pilihan sedang terbuka,
   * karena di situ Esc sudah punya tugasnya sendiri: menutup daftar itu.
   * Tanpa pengecualian ini satu tekan menutup keduanya sekaligus, dan seluruh
   * isian yang sudah diketik hilang bersama itu.
   *
   * Didengarkan pada tahap capture, bukan bubble. React menyalurkan kejadian
   * papan ketik lewat simpul akarnya, yang berada di dalam document, dan
   * pembaruan dari kejadian semacam ini dijalankan serentak — jadi pada tahap
   * bubble daftarnya sudah tercabut dari DOM, dan pemeriksaan di bawah akan
   * menyimpulkan tidak ada daftar yang terbuka padahal barusan ada.
   */
  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role=listbox]')) return;
      setBuka(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [buka]);

  // Halaman di belakangnya tidak ikut tergulir saat dialog terbuka.
  useEffect(() => {
    if (!buka) return;
    const semula = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = semula; };
  }, [buka]);

  /*
   * Fokus masuk ke isian pertama saat dibuka, dan kembali ke tombolnya saat
   * ditutup — supaya yang memakai papan ketik tidak kehilangan tempatnya.
   *
   * Yang dicari hanya kolom isian, bukan tombol: tombol pertama di dalam
   * panel ini adalah tombol tutupnya, dan memfokuskan itu berarti satu spasi
   * menutup dialog yang baru saja dibuka.
   */
  useEffect(() => {
    if (buka) {
      const pertama = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      (pertama ?? panelRef.current)?.focus();
    } else {
      pemicuRef.current?.focus();
    }
  }, [buka]);

  const maks = lebar === 'sm' ? 'max-w-md' : lebar === 'lg' ? 'max-w-5xl' : 'max-w-3xl';

  return (
    <>
      <button
        ref={pemicuRef}
        type="button"
        className={varian === 'tautan'
          ? 'text-xs font-medium text-brand-600 hover:underline disabled:text-slate-400 disabled:no-underline'
          : 'btn-primary'}
        onClick={() => setBuka(true)}
        disabled={disabled}
        title={title}
      >
        {label}
      </button>

      {buka && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-slate-900/40 p-4 sm:p-8">
          {/* Menekan di luar kartu menutup dialog; di dalamnya tidak. */}
          <div className="absolute inset-0" onClick={() => setBuka(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={judul}
            tabIndex={-1}
            className={`relative mx-auto w-full ${maks} rounded-xl border border-slate-200 bg-white shadow-2xl`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{judul}</h2>
                {keterangan && <p className="mt-0.5 text-xs text-slate-500">{keterangan}</p>}
              </div>
              <button
                type="button"
                onClick={() => setBuka(false)}
                className="-mr-1 shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">{children(() => setBuka(false))}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
