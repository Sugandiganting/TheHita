import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import './globals.css';
import { Shell } from '@/components/sidebar';
import { penggunaMasihAktif, sesiSekarang } from '@/lib/sesi-server';

export const metadata: Metadata = {
  title: 'The Hita Finance — Akuntansi & Peramalan Kas',
  description:
    'Sistem pencatatan pemasukan & pengeluaran berbasis COA untuk seluruh cabang hotel, laundry dan cafe, lengkap dengan peramalan arus kas proyek.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesi = await sesiSekarang();

  /*
   * Akun yang dinonaktifkan dihentikan di sini, bukan dibiarkan sampai
   * kukinya kedaluwarsa dua minggu kemudian.
   *
   * Tempatnya di tata letak karena seluruh halaman melewatinya, dan karena ia
   * berjalan di runtime Node sehingga boleh menyentuh basis data — middleware
   * tidak bisa, ia berjalan di Edge. Header x-hita-path dipasang middleware
   * hanya pada halaman yang dijaga, jadi ketiadaannya menandakan halaman
   * masuk: tanpa penanda itu, pengalihan di bawah akan berputar pada dirinya
   * sendiri.
   */
  if (sesi && (await headers()).get('x-hita-path') && !(await penggunaMasihAktif(sesi))) {
    redirect('/masuk?alasan=nonaktif');
  }

  return (
    <html lang="id">
      <body>
        <Shell pengguna={sesi?.name}>{children}</Shell>
      </body>
    </html>
  );
}
