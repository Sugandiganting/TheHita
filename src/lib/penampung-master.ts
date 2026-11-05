/**
 * Kas penampung dan pemegangnya.
 *
 * Penampung adalah pot kas yang dananya disetor beberapa cabang lalu
 * dibelanjakan untuk cabang mana pun — kas Purchasing, kas HR, rekening
 * proyek. Menggandakannya per cabang melahirkan amplop yang tidak pernah
 * cocok di akhir bulan; alasan lengkapnya ada di src/lib/penampung.ts.
 *
 * Pot semacam itu tetap butuh pemilik, karena tiap baris jurnal wajib membawa
 * unit supaya neraca tiap cabang seimbang sendiri. Pemiliknya dibuat
 * tersendiri — bukan salah satu cabang, yang neracanya lalu akan memuat uang
 * yang tidak dikendalikannya.
 */

/** Kode pemegang kas penampung. */
export const KODE_PENAMPUNG = 'PUSAT';
export const NAMA_PENAMPUNG = 'Pusat';

/**
 * Saringan Prisma untuk "cabang usaha saja".
 *
 * Dipakai di tempat-tempat yang menanyakan cabang: pemilik RAB, pemilik
 * proyek, statistik okupansi, kartu per cabang di beranda. Laporan kas justru
 * tidak memakainya — uang di penampung nyata dan harus ikut terhitung.
 */
export const CABANG_SAJA = { active: true, isPool: false } as const;

/** Akun kas yang dikelola sebagai penampung tunggal. */
export const AKUN_PENAMPUNG = [
  '1110.03', // Petty Cash Purchasing
  '1110.04', // Petty Cash HR
  '1120.02', // Bank BCA - Proyek
  '1120.04', // Kas Property
] as const;
