/**
 * Uang masuk sedang mengarah ke skenario yang mana?
 *
 * Tiga proyeksi di kartu atas adalah tebakan yang dibuat di awal bulan. Yang
 * tidak dijawab siapa pun sampai bulannya habis: dari ketiganya, mana yang
 * sedang benar-benar terjadi. Padahal jawabannya sudah ada di data — tiap
 * posisi kas yang dilaporkan membawa uang masuk kumulatif pada tanggalnya.
 *
 * Caranya sesederhana mungkin: laju sampai hari ini ditarik lurus sampai akhir
 * bulan, lalu dibandingkan dengan ketiga proyeksi. Anggapan garis lurus itu
 * memang kasar — akhir pekan dan hari raya tidak rata — tetapi ia bisa dihitung
 * ulang dengan tangan, dan arahnya sudah cukup untuk memutuskan apakah plafon
 * belanja minggu ini boleh dilonggarkan.
 */

import { SKENARIO, type Skenario } from './rencana-kas';
import type { Period } from './period';

export type LaporanMasuk = {
  /** Tanggal dalam bulan, 1–31. */
  hari: number;
  /** Uang masuk kumulatif sampai tanggal itu. */
  masuk: number;
};

/** Di mana laju sekarang berdiri terhadap rentang pesimis–optimis. */
export type PosisiTren = 'DI_ATAS' | 'DI_DALAM' | 'DI_BAWAH';

export type Tren = {
  hariSebulan: number;
  /** Laporan yang dipakai, urut dari tanggal terkecil. */
  laporan: LaporanMasuk[];
  /** Nilai akhir bulan tiap skenario — ujung kanan tiap garis acuan. */
  proyeksi: Record<Skenario, number>;
  hariTerakhir: number;
  masukTerakhir: number;
  /** Perkiraan akhir bulan bila laju hari-hari ini bertahan. */
  lajuAkhirBulan: number;
  /** Yang paling dekat dengan laju sekarang. */
  terdekat: Skenario;
  posisi: PosisiTren;
  /** Selisih terhadap yang seharusnya sudah masuk menurut skenario normal. */
  selisihNormal: number;
  /** Berapa persen dari sebulan yang sudah berlalu. */
  porsiHari: number;
};

/** Jumlah hari dalam bulan sebuah periode "YYYY-MM". */
export function hariDalamBulan(period: Period): number {
  const [tahun, bulan] = period.split('-').map(Number);
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

/**
 * Menyusun tren dari laporan posisi kas.
 *
 * Mengembalikan null bila belum ada yang bisa dibandingkan: tanpa satu pun
 * laporan, atau laporannya bertanggal 1 — menarik laju dari nol hari hanya
 * menghasilkan angka tak hingga.
 */
export function hitungTren(
  period: Period,
  laporanMentah: LaporanMasuk[],
  proyeksi: Record<Skenario, number>,
): Tren | null {
  const hariSebulan = hariDalamBulan(period);

  // Urut menaik, dan hanya yang tanggalnya masuk akal untuk bulan itu.
  const laporan = laporanMentah
    .filter((l) => l.hari >= 1 && l.hari <= hariSebulan && l.masuk >= 0)
    .sort((a, b) => a.hari - b.hari);

  const akhir = laporan[laporan.length - 1];
  if (!akhir || akhir.hari < 1) return null;

  const porsiHari = akhir.hari / hariSebulan;
  const lajuAkhirBulan = akhir.masuk / porsiHari;

  // Yang paling dekat diukur dari selisih mutlak, bukan dari urutan: laju yang
  // jatuh di antara dua skenario memang lebih dekat ke salah satunya.
  let terdekat: Skenario = 'NORMAL';
  for (const s of SKENARIO) {
    if (Math.abs(lajuAkhirBulan - proyeksi[s]) < Math.abs(lajuAkhirBulan - proyeksi[terdekat])) {
      terdekat = s;
    }
  }

  // Rentangnya dibaca dari nilai, bukan dari namanya. Proyeksi optimis yang
  // keliru diketik lebih rendah daripada pesimis tidak boleh membuat seluruh
  // penilaian terbalik.
  const semua = SKENARIO.map((s) => proyeksi[s]);
  const tertinggi = Math.max(...semua);
  const terendah = Math.min(...semua);

  let posisi: PosisiTren = 'DI_DALAM';
  if (lajuAkhirBulan > tertinggi) posisi = 'DI_ATAS';
  else if (lajuAkhirBulan < terendah) posisi = 'DI_BAWAH';

  return {
    hariSebulan,
    laporan,
    proyeksi,
    hariTerakhir: akhir.hari,
    masukTerakhir: akhir.masuk,
    lajuAkhirBulan,
    terdekat,
    posisi,
    selisihNormal: akhir.masuk - proyeksi.NORMAL * porsiHari,
    porsiHari,
  };
}

/**
 * Titik-titik untuk grafik: satu baris per tanggal yang diperlukan.
 *
 * Garis skenario digambar lurus dari nol pada tanggal 0 sampai proyeksinya pada
 * hari terakhir bulan, jadi dua titik sudah cukup untuk masing-masing. Yang
 * membutuhkan banyak titik hanya garis aktualnya.
 */
export function titikGrafik(tren: Tren): {
  hari: number;
  aktual: number | null;
  pesimis: number;
  normal: number;
  optimis: number;
}[] {
  const hari = new Set<number>([0, tren.hariSebulan, ...tren.laporan.map((l) => l.hari)]);
  const masukPada = new Map(tren.laporan.map((l) => [l.hari, l.masuk]));

  return [...hari]
    .sort((a, b) => a - b)
    .map((h) => {
      const porsi = h / tren.hariSebulan;
      return {
        hari: h,
        // Tanggal 0 adalah titik awal bersama: belum ada uang masuk sama sekali.
        aktual: h === 0 ? 0 : masukPada.get(h) ?? null,
        pesimis: tren.proyeksi.PESIMIS * porsi,
        normal: tren.proyeksi.NORMAL * porsi,
        optimis: tren.proyeksi.OPTIMIS * porsi,
      };
    });
}
