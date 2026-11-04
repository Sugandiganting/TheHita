import { cookies } from 'next/headers';
import { prisma } from './db';
import { NAMA_KUKI, bacaToken, type Sesi } from './sesi';

/**
 * Sesi yang sedang berjalan, dibaca dari kuki.
 *
 * Middleware sudah memastikan tidak ada halaman yang terbuka tanpa sesi, jadi
 * fungsi ini bukan penjaga pintu — gunanya menyebut siapa yang sedang masuk.
 */
export async function sesiSekarang(): Promise<Sesi | null> {
  return bacaToken((await cookies()).get(NAMA_KUKI)?.value);
}

/**
 * Apakah pemegang sesi ini masih berhak masuk.
 *
 * Kuki sesi berisi segalanya sendiri dan berlaku dua minggu, jadi
 * menonaktifkan sebuah akun tidak otomatis memutus sesi yang sedang berjalan —
 * orangnya tetap bisa memakai sistem sampai kukinya kedaluwarsa. Untuk tombol
 * yang bertuliskan "Nonaktifkan", dua minggu jelas bukan yang dimaksud
 * siapa pun yang menekannya.
 *
 * Pemeriksaannya di sini, bukan di middleware: middleware berjalan di runtime
 * Edge yang tidak bisa menyentuh basis data.
 */
export async function penggunaMasihAktif(sesi: Sesi): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: sesi.id },
    select: { active: true },
  });
  return user?.active === true;
}
