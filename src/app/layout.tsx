import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/sidebar';
import { sesiSekarang } from '@/lib/sesi-server';

export const metadata: Metadata = {
  title: 'The Hita Finance — Akuntansi & Peramalan Kas',
  description:
    'Sistem pencatatan pemasukan & pengeluaran berbasis COA untuk seluruh cabang hotel, laundry dan cafe, lengkap dengan peramalan arus kas proyek.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesi = await sesiSekarang();
  return (
    <html lang="id">
      <body>
        <Shell pengguna={sesi?.name}>{children}</Shell>
      </body>
    </html>
  );
}
