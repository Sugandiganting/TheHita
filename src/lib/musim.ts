/**
 * Pola musim kunjungan: berapa persen sebuah bulan naik atau turun terhadap
 * musim acuan.
 *
 * Dipakai meramalkan pendapatan bulan yang belum berjalan. Tanpa ini, ramalan
 * memakai satu angka untuk seluruh bulan ke depan, dan di usaha yang pendapatan
 * bulan ramainya bisa separuh lebih tinggi daripada bulan sepi, satu angka itu
 * pasti keliru di sebagian besar bulan.
 */

import { monthOf, type Period } from './period';

export type Musim = {
  code: string;
  name: string;
  /** Selisih terhadap musim acuan, dalam persen. Acuan bernilai 0. */
  delta: number;
};

/** Musim yang berlaku untuk tiap bulan kalender, 1 sampai 12. */
export type PolaMusim = Map<number, Musim>;

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Isian awal saat menu musim pertama kali dibuka. Angkanya titik mulai yang
 * masuk akal, bukan kebenaran — yang tahu pola sebenarnya adalah pemakainya,
 * dan tiap angka bisa diubah.
 */
export const MUSIM_BAWAAN: (Musim & { sort: number })[] = [
  { code: 'LOW', name: 'Low season', delta: -25, sort: 0 },
  { code: 'MID', name: 'Mid season', delta: 0, sort: 1 },
  { code: 'SHOULDER', name: 'Shoulder season', delta: 12, sort: 2 },
  { code: 'HIGH', name: 'High season', delta: 30, sort: 3 },
  { code: 'PEAK', name: 'Peak season', delta: 55, sort: 4 },
];

/** Pengali sebuah musim: delta +30% menjadi 1,3. */
export function pengali(m: Musim | undefined): number {
  return 1 + (m?.delta ?? 0) / 100;
}

/**
 * Pendapatan satu bulan penuh pada musim acuan, disimpulkan dari proyeksi bulan
 * berjalan dan musimnya sendiri.
 *
 * Caranya memang terbalik — biasanya acuan yang menentukan bulan — tetapi
 * justru itu yang membuatnya berguna: angka bulan berjalan sudah dipercaya
 * pemakainya, jadi seluruh ramalan ke depan bertumpu pada sesuatu yang nyata,
 * bukan pada satu angka acuan yang harus ditebak dan dipelihara sendiri.
 *
 * Mengembalikan null bila pengalinya nol atau negatif: pembagiannya tidak
 * bermakna, dan musim yang membuat pendapatan hilang sama sekali lebih mungkin
 * salah ketik daripada kenyataan.
 */
export function dasarAcuan(proyeksiBulanIni: number, musimBulanIni: Musim | undefined): number | null {
  const p = pengali(musimBulanIni);
  if (p <= 0) return null;
  return proyeksiBulanIni / p;
}

/**
 * Proyeksi untuk sebuah bulan menurut polanya. `null` bila polanya belum
 * disiapkan — pemanggil yang memutuskan apa yang dipakai sebagai gantinya.
 */
export function proyeksiMusim(
  period: Period,
  dasar: number | null,
  pola: PolaMusim,
): number | null {
  if (dasar === null || pola.size === 0) return null;
  const m = pola.get(monthOf(period));
  if (!m) return null;
  return dasar * pengali(m);
}

/**
 * Proyeksi sebuah bulan, dengan bulan yang belum diberi musim diramalkan
 * sebagai musim acuan.
 *
 * Bedanya dengan menyamakan bulan kosong dengan bulan berjalan baru terasa
 * ketika bulan berjalan bukan bulan acuan: bulan berjalan yang high akan
 * menularkan ketinggiannya ke seluruh bulan yang belum diisi, padahal yang
 * belum diisi justru belum diketahui ramai atau sepinya.
 */
export function proyeksiBulan(period: Period, dasar: number, pola: PolaMusim): number {
  return proyeksiMusim(period, dasar, pola) ?? dasar;
}

/**
 * Pola dianggap berguna hanya bila ada bulan yang musimnya berbeda. Dua belas
 * bulan yang seluruhnya satu musim menghasilkan angka yang persis sama dengan
 * tidak memakai pola sama sekali, dan menampilkannya sebagai "mengikuti pola
 * musim" hanya akan menyesatkan.
 */
export function polaBervariasi(pola: PolaMusim): boolean {
  const nilai = [...pola.values()].map((m) => m.delta);
  return nilai.length > 0 && new Set(nilai).size > 1;
}

/** Musim yang deltanya nol — acuan seluruh perhitungan. */
export function musimAcuan(daftar: Musim[]): Musim | undefined {
  return daftar.find((m) => m.delta === 0);
}
