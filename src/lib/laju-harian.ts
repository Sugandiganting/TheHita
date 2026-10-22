/**
 * Rata-rata uang masuk per hari.
 *
 * Angka bulanan sulit dibandingkan begitu panjang periodenya tidak sama:
 * laporan sepuluh hari dan laporan sepekan menghasilkan rupiah yang berbeda
 * tanpa berarti lajunya berbeda, dan Februari selalu terlihat sepi hanya
 * karena harinya lebih sedikit. Dibagi jumlah harinya, semuanya kembali
 * sebanding.
 *
 * Pembandingnya diambil dari dua tempat, dengan urutan yang disengaja.
 * Didahulukan laporan posisi kas bulan-bulan sebelumnya — angka yang diketik
 * sendiri, dan satu-satunya yang benar-benar setara dengan laju bulan berjalan
 * karena asalnya dari kolom yang sama. Jurnal baru dipakai bila belum ada satu
 * pun laporan bulan lalu. Keduanya tidak pernah dicampur dalam satu rata-rata,
 * dan yang terpakai selalu disebutkan, karena keduanya bisa mengukur hal yang
 * berbeda: jurnal bisa ikut mencatat transfer antar rekening atau pinjaman,
 * sedangkan posisi kas biasanya hanya pendapatan.
 *
 * Rata-ratanya dihitung dari seluruh uang masuk dibagi seluruh hari, bukan
 * dari rata-rata laju tiap bulan. Keduanya berbeda bila panjang periodenya
 * berbeda, dan yang pertama itulah arti sebenarnya dari "rata-rata per hari".
 */

import { daysInPeriod, type Period } from './period';

/** Uang masuk sebuah bulan beserta jumlah hari yang dicakupnya. */
export type BulanMasuk = { period: Period; masuk: number; hari: number };

export type SumberLaju = 'LAPORAN' | 'JURNAL';

export type LajuHarian = {
  /** Rata-rata per hari bulan berjalan, sampai tanggal laporan terakhir. */
  bulanIni: number;
  /** Hari yang sudah lewat dan terhitung di bulanIni. */
  hariBulanIni: number;
  /** Rata-rata per hari bulan-bulan sebelumnya; null bila belum ada datanya. */
  riwayat: number | null;
  /** Dari mana riwayatnya diambil; null bila tidak ada yang bisa dipakai. */
  sumber: SumberLaju | null;
  /** Banyaknya bulan yang terpakai menghitung riwayat. */
  bulanRiwayat: number;
  /** Bulan terlama dan terbaru yang terpakai; null bila riwayatnya kosong. */
  dari: Period | null;
  sampai: Period | null;
  /** bulanIni dibanding riwayat, dalam persen. null bila tidak ada pembanding. */
  selisihPersen: number | null;
};

/**
 * Bulan dari jurnal: angkanya sebulan penuh, jadi harinya sepanjang bulan itu.
 * Laporan posisi kas tidak begitu — harinya sampai tanggal laporan terakhir
 * saja, dan itu memang yang benar.
 */
export function dariJurnal(riwayat: { period: Period; cashIn: number }[]): BulanMasuk[] {
  return riwayat.map((b) => ({
    period: b.period,
    masuk: b.cashIn,
    hari: daysInPeriod(b.period),
  }));
}

function rataRata(bulan: BulanMasuk[]) {
  // Bulan tanpa satu pun uang masuk hampir selalu berarti datanya belum
  // diisi, bukan bulan yang benar-benar nihil. Ikut dihitung, ia menarik
  // rata-rata ke bawah dan pembandingnya jadi menyesatkan.
  const pakai = bulan
    .filter((b) => b.masuk > 0 && b.hari > 0)
    .sort((a, b) => (a.period < b.period ? -1 : 1));

  const totalMasuk = pakai.reduce((t, b) => t + b.masuk, 0);
  const totalHari = pakai.reduce((t, b) => t + b.hari, 0);

  return {
    nilai: totalHari > 0 ? totalMasuk / totalHari : null,
    jumlah: pakai.length,
    dari: pakai[0]?.period ?? null,
    sampai: pakai[pakai.length - 1]?.period ?? null,
  };
}

export function lajuHarian(
  masukTerakhir: number,
  hariTerakhir: number,
  sumber: { laporan: BulanMasuk[]; jurnal: BulanMasuk[] },
): LajuHarian {
  const bulanIni = hariTerakhir > 0 ? masukTerakhir / hariTerakhir : 0;

  const dariLaporan = rataRata(sumber.laporan);
  const dipakai = dariLaporan.nilai !== null ? dariLaporan : rataRata(sumber.jurnal);
  const asal: SumberLaju | null = dipakai.nilai === null
    ? null
    : dariLaporan.nilai !== null ? 'LAPORAN' : 'JURNAL';

  return {
    bulanIni,
    hariBulanIni: hariTerakhir,
    riwayat: dipakai.nilai,
    sumber: asal,
    bulanRiwayat: dipakai.jumlah,
    dari: dipakai.dari,
    sampai: dipakai.sampai,
    selisihPersen: dipakai.nilai !== null && dipakai.nilai > 0
      ? (bulanIni / dipakai.nilai - 1) * 100
      : null,
  };
}
