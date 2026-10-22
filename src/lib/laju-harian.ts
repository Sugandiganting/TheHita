/**
 * Rata-rata uang masuk per hari.
 *
 * Angka bulanan sulit dibandingkan begitu panjang periodenya tidak sama:
 * laporan sepuluh hari dan laporan sepekan menghasilkan rupiah yang berbeda
 * tanpa berarti lajunya berbeda, dan Februari selalu terlihat sepi hanya
 * karena harinya lebih sedikit. Dibagi jumlah harinya, semuanya kembali
 * sebanding.
 *
 * Dua angka yang dihasilkan di sini menjawab pertanyaan yang berbeda. Yang
 * pertama laju bulan berjalan: uang masuk yang sudah dilaporkan dibagi hari
 * yang sudah lewat. Yang kedua laju beberapa bulan terakhir menurut jurnal,
 * sebagai pembanding — tanpa itu, "Rp 15 jt per hari" hanyalah angka yang
 * tidak diketahui bagus atau tidak.
 *
 * Rata-rata riwayatnya dihitung dari seluruh uang masuk dibagi seluruh hari,
 * bukan dari rata-rata laju tiap bulan. Keduanya berbeda bila panjang bulannya
 * berbeda, dan yang pertama itulah arti sebenarnya dari "rata-rata per hari".
 */

import { daysInPeriod, type Period } from './period';

export type BulanMasuk = { period: Period; cashIn: number };

export type LajuHarian = {
  /** Rata-rata per hari bulan berjalan, sampai tanggal laporan terakhir. */
  bulanIni: number;
  /** Hari yang sudah lewat dan terhitung di bulanIni. */
  hariBulanIni: number;
  /** Rata-rata per hari bulan-bulan sebelumnya; null bila belum ada datanya. */
  riwayat: number | null;
  /** Banyaknya bulan yang terpakai menghitung riwayat. */
  bulanRiwayat: number;
  /** Bulan terlama dan terbaru yang terpakai; null bila riwayatnya kosong. */
  dari: Period | null;
  sampai: Period | null;
  /** bulanIni dibanding riwayat, dalam persen. null bila tidak ada pembanding. */
  selisihPersen: number | null;
};

export function lajuHarian(
  masukTerakhir: number,
  hariTerakhir: number,
  riwayat: BulanMasuk[],
): LajuHarian {
  const bulanIni = hariTerakhir > 0 ? masukTerakhir / hariTerakhir : 0;

  // Bulan tanpa satu pun uang masuk hampir selalu berarti jurnalnya belum
  // diisi, bukan bulan yang benar-benar nihil. Ikut dihitung, ia menarik
  // rata-rata ke bawah dan pembandingnya jadi menyesatkan.
  const pakai = [...riwayat]
    .filter((b) => b.cashIn > 0)
    .sort((a, b) => (a.period < b.period ? -1 : 1));

  const totalMasuk = pakai.reduce((t, b) => t + b.cashIn, 0);
  const totalHari = pakai.reduce((t, b) => t + daysInPeriod(b.period), 0);
  const rata = totalHari > 0 ? totalMasuk / totalHari : null;

  return {
    bulanIni,
    hariBulanIni: hariTerakhir,
    riwayat: rata,
    bulanRiwayat: pakai.length,
    dari: pakai[0]?.period ?? null,
    sampai: pakai[pakai.length - 1]?.period ?? null,
    selisihPersen: rata !== null && rata > 0 ? (bulanIni / rata - 1) * 100 : null,
  };
}
