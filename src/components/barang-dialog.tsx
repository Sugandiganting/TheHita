'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormItem, type Pilihan, type Sub } from './barang-form';

/**
 * Tombol "Tambah barang" beserta dialognya.
 *
 * Formulirnya disembunyikan sampai diminta supaya halaman yang dibuka
 * menampilkan daftar barangnya saja — itulah yang dicari hampir setiap kali
 * halaman ini dibuka, sedangkan mendaftarkan barang baru jauh lebih jarang.
 *
 * Dialognya tidak memakai elemen <dialog> bawaan. Elemen itu dirender di
 * lapisan teratas peramban, di atas segalanya, termasuk daftar pilihan
 * SearchableSelect yang dikirim lewat portal ke body — jadi setiap daftar
 * yang dibuka di dalamnya akan tersembunyi di belakang dialognya sendiri.
 */
export function TambahBarangDialog({
  kategori, sub, satuan, akun, bisa,
}: {
  kategori: Pilihan[];
  sub: Sub[];
  satuan: Pilihan[];
  akun: Pilihan[];
  /** Akun COA sudah ada. Tanpa itu barang tidak bisa didaftarkan sama sekali. */
  bisa: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const pemicuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Esc menutup dialog — kecuali saat sebuah daftar pilihan sedang terbuka,
   * karena di situ Esc sudah punya tugasnya sendiri: menutup daftar itu.
   * Tanpa pengecualian ini satu tekan menutup keduanya sekaligus, dan yang
   * hendak membatalkan pilihan akunnya kehilangan seluruh isian formulirnya.
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

  // Fokus masuk ke isian pertama saat dibuka, dan kembali ke tombolnya saat
  // ditutup — supaya yang memakai papan ketik tidak kehilangan tempatnya.
  useEffect(() => {
    if (buka) panelRef.current?.querySelector<HTMLInputElement>('#it-code')?.focus();
    else pemicuRef.current?.focus();
  }, [buka]);

  return (
    <>
      <button
        ref={pemicuRef}
        type="button"
        className="btn-primary"
        onClick={() => setBuka(true)}
        disabled={!bisa}
        title={bisa ? undefined : 'Belum ada akun COA yang bisa dipakai barang.'}
      >
        + Tambah barang
      </button>

      {buka && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-slate-900/40 p-4 sm:p-8">
          {/* Menekan di luar kartu menutup dialog; di dalamnya tidak. */}
          <div className="absolute inset-0" onClick={() => setBuka(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-tambah-barang"
            className="relative mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="judul-tambah-barang" className="text-base font-semibold text-slate-900">
                  Tambah barang
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Kode dirapikan sendiri jadi huruf besar tanpa spasi. Semua pilihan bisa dicari,
                  dan kategori, sub kategori atau satuan yang belum ada bisa dibuat di sini juga
                  lewat tombol <span className="font-medium text-brand-600">+ Baru</span>.
                </p>
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

            <div className="px-5 py-4">
              <FormItem
                kategori={kategori}
                sub={sub}
                satuan={satuan}
                akun={akun}
                onTutup={() => setBuka(false)}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
