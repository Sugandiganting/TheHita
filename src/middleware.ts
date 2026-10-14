import { NextResponse, type NextRequest } from 'next/server';
import { NAMA_KUKI, bacaToken } from '@/lib/sesi';

/**
 * Pintu masuk tunggal: tiap permintaan diperiksa di sini sebelum sampai ke
 * halaman mana pun.
 *
 * Diletakkan di middleware, bukan di tiap halaman, justru karena halaman baru
 * akan terus bertambah. Memasang pemeriksaan satu per satu berarti cepat atau
 * lambat ada satu yang terlewat, dan satu halaman yang terlewat sudah cukup
 * untuk membuka seluruh isinya.
 */
export async function middleware(request: NextRequest) {
  const sesi = await bacaToken(request.cookies.get(NAMA_KUKI)?.value);
  if (sesi) return NextResponse.next();

  // Permintaan dari dalam halaman (aksi server, fetch) tidak boleh dialihkan:
  // yang kembali bukan halaman masuk melainkan kegagalan yang membingungkan.
  if (request.headers.get('accept')?.includes('text/html') === false) {
    return new NextResponse('Sesi berakhir. Muat ulang halaman lalu masuk kembali.', { status: 401 });
  }

  const tujuan = new URL('/masuk', request.url);
  const asal = request.nextUrl.pathname + request.nextUrl.search;
  if (asal !== '/') tujuan.searchParams.set('lanjut', asal);
  return NextResponse.redirect(tujuan);
}

export const config = {
  /*
   * Seluruh alamat kecuali halaman masuk itu sendiri, berkas bawaan Next, dan
   * ikon. Daftarnya sengaja berupa pengecualian, bukan daftar yang dijaga:
   * halaman yang lupa didaftarkan akan ikut terjaga, bukan ikut terbuka.
   */
  matcher: ['/((?!masuk|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
