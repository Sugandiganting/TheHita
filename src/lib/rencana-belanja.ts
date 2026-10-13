/**
 * Rencana belanja besar: proyek, renovasi, pembelian alat.
 *
 * Mesin penilaiannya tidak ditulis ulang — planPurchase dan advisePurchase di
 * forecast.ts sudah mengerjakan bagian yang sulit. Berkas ini hanya menyiapkan
 * dua hal: jadwal cicilan dalam tanggal kalender, supaya bisa disimpan dan
 * dicocokkan dengan bulan rencana kas, dan konteks yang dibaca mesin itu,
 * disusun dari ramalan rencana kas alih-alih dari rata-rata riwayat jurnal.
 */

import type { PurchaseCadence, PurchaseContext } from './forecast';
import { toPeriod, type Period } from './period';
import type { Runway } from './rencana-kas';

const HARI = 86_400_000;

export type Cicilan = {
  /** Nomor cicilan, mulai dari 1. */
  ke: number;
  jatuhTempo: Date;
  amount: number;
};

/** Sama dengan batas percobaan mesin penilaian, supaya keduanya sejalan. */
export const MAKS_CICILAN = 24;

/** Pilihan jarak antar cicilan yang tersedia di layar. */
export const KADENS: { nilai: PurchaseCadence; label: string }[] = [
  { nilai: 'WEEKLY', label: 'Mingguan' },
  { nilai: 'MONTHLY', label: 'Bulanan' },
];

export const NAMA_KADENS: Record<PurchaseCadence, string> = {
  WEEKLY: 'mingguan',
  MONTHLY: 'bulanan',
};

const hariUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Tanggal jatuh tempo cicilan ke-`ke`. Untuk cicilan bulanan, tanggal yang
 * melewati akhir bulan ditarik ke hari terakhir bulan itu — cicilan tanggal 31
 * tidak boleh melompat ke awal bulan berikutnya.
 */
function tanggalCicilan(mulai: Date, ke: number, cadence: PurchaseCadence): Date {
  const awal = hariUtc(mulai);
  if (ke <= 1) return awal;
  if (cadence === 'WEEKLY') return new Date(awal.getTime() + (ke - 1) * 7 * HARI);

  const tahun = awal.getUTCFullYear();
  const bulan = awal.getUTCMonth() + (ke - 1);
  const hariTerakhir = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();
  return new Date(Date.UTC(tahun, bulan, Math.min(awal.getUTCDate(), hariTerakhir)));
}

/**
 * Jadwal pembayaran sebuah rencana belanja. Dibagi rata, dengan sisa pembulatan
 * pada cicilan pertama supaya jumlahnya tetap persis sama dengan harganya —
 * aturan yang sama dengan mesin penilaian, agar keduanya tidak berselisih.
 */
export function jadwalCicilan(
  amount: number,
  instalments: number,
  cadence: PurchaseCadence,
  mulai: Date,
): Cicilan[] {
  const jumlah = Math.max(1, Math.round(instalments));
  const dasar = Math.round((amount / jumlah) * 100) / 100;
  return Array.from({ length: jumlah }, (_, i) => ({
    ke: i + 1,
    jatuhTempo: tanggalCicilan(mulai, i + 1, cadence),
    amount: i === 0 ? Math.round((amount - dasar * (jumlah - 1)) * 100) / 100 : dasar,
  }));
}

/** Jumlah cicilan yang jatuh tempo di dalam satu bulan. */
export function cicilanPada(jadwal: Cicilan[], period: Period): number {
  return jadwal
    .filter((c) => toPeriod(c.jatuhTempo) === period)
    .reduce((s, c) => s + c.amount, 0);
}

/**
 * Jumlah cicilan yang jatuh tempo sesudah tanggal tertentu di dalam satu bulan.
 *
 * Dipakai untuk bulan berjalan: cicilan yang jatuh tempo sebelum posisi kas
 * dilaporkan sudah tercermin pada saldonya, jadi mengurangkannya lagi berarti
 * menghitung uang yang sama dua kali.
 */
export function cicilanSetelah(jadwal: Cicilan[], period: Period, sesudah: Date): number {
  const batas = hariUtc(sesudah).getTime();
  return jadwal
    .filter((c) => toPeriod(c.jatuhTempo) === period && c.jatuhTempo.getTime() > batas)
    .reduce((s, c) => s + c.amount, 0);
}

/**
 * Konteks yang dibaca mesin penilaian, disusun dari ramalan rencana kas.
 *
 * Mesin itu semula memakai ramalan jangka panjang dari rata-rata jurnal.
 * Rencana kas tahu hal-hal yang tidak diketahui rata-rata itu — saldo bank yang
 * sebenarnya, komitmen yang belum dibayar, dan pola musim — sehingga
 * jawabannya jauh lebih dekat ke keadaan sesungguhnya.
 *
 * Batas amannya kebutuhan gaji sebulan: keputusan belanja yang menyisakan kas
 * di bawah satu kali gaji bukan keputusan yang boleh disebut aman.
 */
export function konteksPembelian(
  runway: Runway,
  saldoKas: number,
  kebutuhanGaji: number,
): PurchaseContext {
  let sebelumnya = saldoKas;
  const rows = runway.bulan.map((b) => {
    const row = { period: b.period, netCash: b.saldoAkhir - sebelumnya, cashBalance: b.saldoAkhir };
    sebelumnya = b.saldoAkhir;
    return row;
  });

  const terendah = Math.min(saldoKas, ...rows.map((r) => r.cashBalance));
  return {
    rows,
    openingCash: saldoKas,
    minCashBuffer: kebutuhanGaji,
    maxAffordableNow: Math.max(0, terendah - kebutuhanGaji),
  };
}
