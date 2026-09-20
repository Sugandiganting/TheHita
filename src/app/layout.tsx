import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/nav';

export const metadata: Metadata = {
  title: 'The Hita Finance — Akuntansi & Peramalan Kas',
  description:
    'Sistem pencatatan pemasukan & pengeluaran berbasis COA untuk seluruh cabang hotel, laundry dan cafe, lengkap dengan peramalan arus kas proyek.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-slate-500">
          The Hita Hospitality Group — satu sistem untuk semua cabang &amp; jenis usaha.
        </footer>
      </body>
    </html>
  );
}
