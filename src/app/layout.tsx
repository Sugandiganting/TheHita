import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'The Hita Finance — Akuntansi & Peramalan Kas',
  description:
    'Sistem pencatatan pemasukan & pengeluaran berbasis COA untuk seluruh cabang hotel, laundry dan cafe, lengkap dengan peramalan arus kas proyek.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
