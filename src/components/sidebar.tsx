'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

type Item = {
  href: string;
  label: string;
  icon?: ReactNode;
  desc?: string;
  /** Judul kecil pemisah di dalam grup; baris berurutan dengan judul sama disatukan. */
  section?: string;
  /** Halamannya belum ada — ditampilkan sebagai penanda, bukan tautan. */
  soon?: boolean;
};
type Group = { key: string; label: string; icon: ReactNode; items: Item[] };
type Entry = Item | Group;

const isGroup = (e: Entry): e is Group => 'items' in e;

/* Ikon garis sederhana — ringan, tidak perlu pustaka tambahan. */
const I = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const ICON = {
  dashboard: I(<><path d="M3 13h8V3H3zM13 21h8V11h-8zM13 7h8V3h-8zM3 21h8v-4H3z" /></>),
  cash: I(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>),
  transfer: I(<><path d="M4 8h13l-3-3M20 16H7l3 3" /></>),
  receive: I(<><path d="M12 4v11M8 11l4 4 4-4" /><path d="M4 20h16" /></>),
  pay: I(<><path d="M12 19V8M8 12l4-4 4 4" /><path d="M4 20h16" /></>),
  journal: I(<><path d="M5 4h11l4 4v12H5z" /><path d="M8 11h8M8 15h5" /></>),
  report: I(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  forecast: I(<><path d="M3 17l5-6 4 3 4-6 5 4" /><path d="M3 21h18" /></>),
  project: I(<><path d="M3 7h6l2 2h10v10H3z" /><path d="M7 13h8" /></>),
  coa: I(<><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="8" cy="5" r="1.4" /><circle cx="14" cy="12" r="1.4" /><circle cx="10" cy="19" r="1.4" /></>),
  unit: I(<><path d="M3 21V8l6-4 6 4v13" /><path d="M15 21V12h6v9" /><path d="M7 12h2M7 16h2" /></>),
  budget: I(<><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h4" /></>),
  logistic: I(<><path d="M3 8l9-4 9 4v8l-9 4-9-4z" /><path d="M3 8l9 4 9-4M12 12v8" /></>),
  master: I(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>),
};

/**
 * Menu disusun menurut pekerjaan yang dilakukan, bukan menurut urutan
 * pembuatannya. Lima kelompok tetap: Akuntansi mencatat yang sudah terjadi,
 * Logistik mengurus barang, Anggaran & Rencana melihat ke depan, Laporan
 * membaca hasilnya, Master Data menyimpan yang jarang berubah.
 *
 * Yang belum dibangun tetap didaftarkan dengan tanda "segera" supaya tempatnya
 * sudah jelas sejak sekarang dan tidak ada menu yang terlihat bisa diklik
 * padahal halamannya belum ada.
 */
const MENU: Entry[] = [
  { href: '/', label: 'Dashboard', icon: ICON.dashboard },
  {
    key: 'akuntansi',
    label: 'Akuntansi',
    icon: ICON.journal,
    items: [
      { href: '/kas', label: 'Ringkasan Saldo', desc: 'Posisi kas & bank tiap cabang', section: 'Kas & Bank' },
      { href: '/kas/transfer', label: 'Transfer Money', desc: 'Pindah uang antar rekening', section: 'Kas & Bank' },
      { href: '/kas/terima', label: 'Receive Money', desc: 'Catat uang masuk', section: 'Kas & Bank' },
      { href: '/kas/bayar', label: 'Pay Money', desc: 'Catat uang keluar', section: 'Kas & Bank' },
      { href: '/transaksi', label: 'Jurnal Transaksi', desc: 'Entri cepat & jurnal manual', section: 'Jurnal' },
      { href: '/impor', label: 'Impor Data', desc: 'Tarik dari ekspor GuestPro', section: 'Jurnal' },
    ],
  },
  {
    key: 'logistik',
    label: 'Logistik',
    icon: ICON.logistic,
    items: [
      { href: '/logistik/receiving', label: 'Receiving', desc: 'Barang masuk dari pemasok', soon: true },
      { href: '/logistik/issuing', label: 'Issuing', desc: 'Barang keluar ke departemen', soon: true },
      { href: '/logistik/barang', label: 'Master Barang', desc: 'Daftar item & satuan', soon: true },
    ],
  },
  {
    key: 'rencana',
    label: 'Anggaran & Rencana',
    icon: ICON.budget,
    items: [
      { href: '/rab', label: 'Input RAB', desc: 'Susun anggaran per bulan' },
      { href: '/peramalan', label: 'Peramalan', desc: 'Proyeksi kas & kemampuan beli' },
      { href: '/proyek', label: 'Proyek', desc: 'Rencana belanja besar' },
    ],
  },
  {
    key: 'laporan',
    label: 'Laporan',
    icon: ICON.report,
    items: [
      { href: '/laporan', label: 'Laporan Keuangan', desc: 'Laba rugi, neraca, arus kas' },
      { href: '/rab/laporan', label: 'Laporan RAB', desc: 'Anggaran vs realisasi' },
      { href: '/logistik/laporan', label: 'Laporan Logistik', desc: 'Pemakaian & kenaikan harga', soon: true },
    ],
  },
  {
    key: 'master',
    label: 'Master Data',
    icon: ICON.master,
    items: [
      { href: '/coa', label: 'Chart of Account', desc: 'Daftar akun' },
      { href: '/unit', label: 'Unit Usaha', desc: 'Cabang & jenis usaha' },
    ],
  },
];

const STORAGE_KEY = 'hita.sidebar.collapsed';
const GROUP_KEY = 'hita.sidebar.groups';

const SEMUA_HREF = MENU.flatMap((e) =>
  isGroup(e) ? e.items.filter((i) => !i.soon).map((i) => i.href) : [e.href],
);

const cocok = (href: string, pathname: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

/**
 * Href terpanjang yang cocok dengan alamat sekarang, bukan yang pertama ketemu.
 * "/rab" dan "/rab/laporan" kini berada di kelompok yang berbeda, dan tanpa
 * aturan ini membuka Laporan RAB akan ikut menyalakan Input RAB sekaligus
 * membuka kelompok Anggaran & Rencana. Hal yang sama berlaku untuk "/kas"
 * terhadap "/kas/transfer".
 */
function hrefAktif(pathname: string): string | null {
  let terbaik: string | null = null;
  for (const href of SEMUA_HREF) {
    if (cocok(href, pathname) && (terbaik === null || href.length > terbaik.length)) terbaik = href;
  }
  return terbaik;
}

/** Grup yang memuat halaman yang sedang dibuka, bila ada. */
function grupHalaman(pathname: string): string | null {
  const href = hrefAktif(pathname);
  if (href === null) return null;
  for (const e of MENU) {
    if (isGroup(e) && e.items.some((i) => i.href === href)) return e.key;
  }
  return null;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Di layar lebar sidebar mengecil jadi ikon; di ponsel ia menjadi laci geser.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(['akuntansi']);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
      const tersimpan = localStorage.getItem(GROUP_KEY);
      if (tersimpan !== null) setOpenGroups(JSON.parse(tersimpan));
    } catch {
      // Penyimpanan browser bisa diblokir — abaikan, pakai nilai bawaan.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_KEY, JSON.stringify(openGroups));
    } catch {
      /* diabaikan */
    }
  }, [openGroups]);

  /**
   * Pindah ke halaman di dalam sebuah grup akan membuka grup itu, supaya
   * pemakai melihat di mana dirinya berada. Hanya saat berpindah — selebihnya
   * tombolnya yang menentukan, termasuk untuk menutup grup halaman ini sendiri.
   */
  useEffect(() => {
    const key = grupHalaman(pathname);
    if (key) setOpenGroups((g) => (g.includes(key) ? g : [...g, key]));
  }, [pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* diabaikan */
    }
  }, [collapsed]);

  // Tutup laci setiap kali pindah halaman.
  useEffect(() => setMobileOpen(false), [pathname]);

  const aktif = hrefAktif(pathname);
  const active = (href: string) => href === aktif;
  const groupActive = (g: Group) => g.items.some((i) => active(i.href));

  const toggleGroup = (key: string) =>
    setOpenGroups((g) => (g.includes(key) ? g.filter((k) => k !== key) : [...g, key]));

  const width = collapsed ? 'lg:w-[68px]' : 'lg:w-[248px]';

  return (
    <>
      {/* Bilah atas: hanya berisi tombol menu dan identitas */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => (window.innerWidth >= 1024 ? setCollapsed((v) => !v) : setMobileOpen((v) => !v))}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label={collapsed ? 'Tampilkan menu' : 'Sembunyikan menu'}
          aria-expanded={!collapsed || mobileOpen}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">H</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-slate-900">The Hita Finance</span>
            <span className="block text-[11px] text-slate-500">Akuntansi &amp; Peramalan Kas</span>
          </span>
        </Link>
      </header>

      {/* Latar gelap saat laci terbuka di ponsel */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="lg:flex lg:items-start">
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 w-[248px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white
                    transition-transform duration-200 lg:sticky lg:top-[57px] lg:z-20 lg:h-[calc(100vh-57px)] lg:translate-x-0
                    lg:transition-[width] ${width} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Menu utama"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
          <span className="text-sm font-semibold text-slate-900">Menu</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        <nav className="space-y-0.5 p-2.5">
          {MENU.map((entry) => {
            if (!isGroup(entry)) {
              const on = active(entry.href);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  title={collapsed ? entry.label : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    on ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="h-5 w-5 shrink-0">{entry.icon}</span>
                  <span className={collapsed ? 'lg:hidden' : ''}>{entry.label}</span>
                </Link>
              );
            }

            const open = openGroups.includes(entry.key);
            return (
              <div key={entry.key}>
                <button
                  type="button"
                  onClick={() => (collapsed ? setCollapsed(false) : toggleGroup(entry.key))}
                  title={collapsed ? entry.label : undefined}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    groupActive(entry) ? 'text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="h-5 w-5 shrink-0">{entry.icon}</span>
                  <span className={`flex-1 text-left ${collapsed ? 'lg:hidden' : ''}`}>{entry.label}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${collapsed ? 'lg:hidden' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>

                {open && (
                  <div className={`mt-0.5 space-y-0.5 ${collapsed ? 'lg:hidden' : 'border-l border-slate-200 pl-3 ml-5'}`}>
                    {entry.items.map((item, i) => {
                      const on = active(item.href);
                      const judul = item.section && item.section !== entry.items[i - 1]?.section;
                      const isi = (
                        <>
                          {item.label}
                          {item.soon && (
                            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                              segera
                            </span>
                          )}
                          {item.desc && <span className="block text-[11px] font-normal text-slate-400">{item.desc}</span>}
                        </>
                      );

                      return (
                        <div key={item.href}>
                          {judul && (
                            <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {item.section}
                            </p>
                          )}
                          {item.soon ? (
                            <span className="block cursor-default rounded-lg px-3 py-1.5 text-sm text-slate-400">
                              {isi}
                            </span>
                          ) : (
                            <Link
                              href={item.href}
                              className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                                on ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              {isi}
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-7xl px-4 py-7">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-slate-500">
          The Hita Hospitality Group — satu sistem untuk semua cabang &amp; jenis usaha.
        </footer>
      </div>
      </div>
    </>
  );
}
