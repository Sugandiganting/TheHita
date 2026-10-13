/**
 * Kewajiban terjadwal: uang keluar yang tanggalnya sudah diketahui jauh hari.
 *
 * Pajak kendaraan, PBB, perpanjangan izin, asuransi tahunan — nominalnya
 * jarang mengejutkan, tanggalnya pun tidak, tetapi tetap saja terasa mendadak
 * karena tidak ada tempat mencatatnya sebelum bulannya tiba. Komitmen biasa
 * tidak bisa menampungnya: komitmen menempel pada satu bulan dan tanggalnya
 * hanya angka 1–31, tanpa bulan dan tahun.
 *
 * Berkas ini hanya mengurus satu hal: dari sebuah kewajiban beserta aturan
 * pengulangannya, tanggal berapa saja uangnya keluar. Sisanya — plafon
 * mingguan dan ramalan kas — memakai hasil itu lewat jalur yang sudah ada.
 */

import { periodEndExclusive, periodStart, type Period } from './period';

/** Satuan pengulangan sebuah kewajiban. */
export type Pengulangan = 'SEKALI' | 'BULANAN' | 'TAHUNAN';

export const PENGULANGAN: { nilai: Pengulangan; label: string }[] = [
  { nilai: 'SEKALI', label: 'Sekali saja' },
  { nilai: 'BULANAN', label: 'Tiap bulan' },
  { nilai: 'TAHUNAN', label: 'Tiap tahun' },
];

export const NAMA_PENGULANGAN: Record<Pengulangan, string> = {
  SEKALI: 'sekali saja',
  BULANAN: 'bulan',
  TAHUNAN: 'tahun',
};

export type Kewajiban = {
  label: string;
  amount: number;
  /** Jatuh tempo pertama. */
  dueDate: Date;
  repeat: Pengulangan;
  /** Tiap berapa kali satuannya; 5 pada TAHUNAN berarti tiap lima tahun. */
  repeatEvery: number;
  active: boolean;
  /** Jatuh tempo terakhir yang sudah dilunasi. */
  paidUntil: Date | null;
};

export type Kejadian = {
  jatuhTempo: Date;
  amount: number;
};

/**
 * Batas pengamanan saat menyusun kejadian. Ramalan kas hanya melihat dua belas
 * bulan ke depan, jadi daftar sepanjang ini tidak akan pernah terpakai habis —
 * gunanya semata-mata agar kewajiban harian yang salah ketik tidak menghasilkan
 * daftar tanpa ujung.
 */
const MAKS_KEJADIAN = 400;

const hariUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Jatuh tempo ke-`ke` (mulai dari 0) menurut aturan pengulangannya.
 *
 * Tanggal yang melewati akhir bulan ditarik ke hari terakhirnya: kewajiban
 * tanggal 31 tidak boleh melompat ke awal bulan berikutnya, dan 29 Februari
 * tidak boleh berubah menjadi 1 Maret pada tahun biasa.
 */
function jatuhTempoKe(k: Kewajiban, ke: number): Date {
  const awal = hariUtc(k.dueDate);
  if (ke === 0 || k.repeat === 'SEKALI') return awal;

  const langkah = Math.max(1, Math.round(k.repeatEvery)) * ke;
  const tahun = awal.getUTCFullYear() + (k.repeat === 'TAHUNAN' ? langkah : 0);
  const bulan = awal.getUTCMonth() + (k.repeat === 'BULANAN' ? langkah : 0);
  const hariTerakhir = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();
  return new Date(Date.UTC(tahun, bulan, Math.min(awal.getUTCDate(), hariTerakhir)));
}

/** Sudah dilunasi, jadi tidak boleh lagi memukul ramalan. */
function lunas(k: Kewajiban, jatuhTempo: Date): boolean {
  return k.paidUntil !== null && jatuhTempo.getTime() <= hariUtc(k.paidUntil).getTime();
}

/**
 * Seluruh jatuh tempo sebuah kewajiban di dalam rentang [mulai, selesai).
 *
 * Yang sudah dilunasi dan yang kewajibannya dinonaktifkan tidak ikut: keduanya
 * bukan lagi uang yang akan keluar.
 */
export function kejadian(k: Kewajiban, mulai: Date, selesai: Date): Kejadian[] {
  if (!k.active || k.amount <= 0) return [];

  const batasAwal = hariUtc(mulai).getTime();
  const batasAkhir = hariUtc(selesai).getTime();
  const hasil: Kejadian[] = [];

  for (let ke = 0; ke < MAKS_KEJADIAN; ke += 1) {
    const jatuhTempo = jatuhTempoKe(k, ke);
    const t = jatuhTempo.getTime();
    if (t >= batasAkhir) break;
    if (t >= batasAwal && !lunas(k, jatuhTempo)) hasil.push({ jatuhTempo, amount: k.amount });
    if (k.repeat === 'SEKALI') break;
  }
  return hasil;
}

/** Jatuh tempo berikutnya sejak sebuah tanggal, atau null bila sudah habis. */
export function berikutnya(k: Kewajiban, sejak: Date): Kejadian | null {
  if (!k.active) return null;

  const batas = hariUtc(sejak).getTime();
  for (let ke = 0; ke < MAKS_KEJADIAN; ke += 1) {
    const jatuhTempo = jatuhTempoKe(k, ke);
    if (jatuhTempo.getTime() >= batas && !lunas(k, jatuhTempo)) {
      return { jatuhTempo, amount: k.amount };
    }
    if (k.repeat === 'SEKALI') break;
  }
  return null;
}

/** Seluruh kejadian satu daftar kewajiban di dalam sebuah bulan, urut tanggal. */
export function kejadianBulan(
  daftar: Kewajiban[],
  period: Period,
): (Kejadian & { label: string })[] {
  const mulai = periodStart(period);
  const selesai = periodEndExclusive(period);
  return daftar
    .flatMap((k) => kejadian(k, mulai, selesai).map((e) => ({ ...e, label: k.label })))
    .sort((a, b) => a.jatuhTempo.getTime() - b.jatuhTempo.getTime());
}

/** Jumlah yang jatuh tempo di sebuah bulan, termasuk yang tanggalnya sudah lewat. */
export function kewajibanPada(daftar: Kewajiban[], period: Period): number {
  return kejadianBulan(daftar, period).reduce((t, e) => t + e.amount, 0);
}

/**
 * Jumlah yang jatuh tempo sesudah sebuah tanggal di dalam bulan itu.
 *
 * Dipakai untuk bulan berjalan: kewajiban yang jatuh tempo sebelum posisi kas
 * dilaporkan sudah tercermin pada saldonya, jadi mengurangkannya lagi berarti
 * menghitung uang yang sama dua kali. Aturan yang sama dipakai belanja dan
 * cicilan rencana belanja.
 */
export function kewajibanSetelah(daftar: Kewajiban[], period: Period, sesudah: Date): number {
  const batas = hariUtc(sesudah).getTime();
  return kejadianBulan(daftar, period)
    .filter((e) => e.jatuhTempo.getTime() > batas)
    .reduce((t, e) => t + e.amount, 0);
}

/** Label lengkap pengulangan, mis. "tiap 5 tahun". */
export function labelPengulangan(repeat: Pengulangan, every: number): string {
  if (repeat === 'SEKALI') return 'sekali saja';
  const n = Math.max(1, Math.round(every));
  return n === 1 ? `tiap ${NAMA_PENGULANGAN[repeat]}` : `tiap ${n} ${NAMA_PENGULANGAN[repeat]}`;
}

/**
 * Jatuh tempo berikutnya setelah sebuah pelunasan.
 *
 * Dipakai saat kewajiban ditandai lunas: yang berulang bergeser ke tanggal
 * sesudahnya, yang sekali saja memang habis di situ.
 */
export function setelahDilunasi(k: Kewajiban, jatuhTempo: Date): Date | null {
  const dilunasi = hariUtc(jatuhTempo);
  return berikutnya({ ...k, paidUntil: dilunasi }, dilunasi)?.jatuhTempo ?? null;
}
