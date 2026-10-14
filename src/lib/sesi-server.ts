import { cookies } from 'next/headers';
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
