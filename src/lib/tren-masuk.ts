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

import { NAMA_SKENARIO, SKENARIO, type Skenario } from './rencana-kas';
import type { Period } from './period';

export type LaporanMasuk = {
  /** Tanggal dalam bulan, 1–31. */
  hari: number;
  /** Uang masuk kumulatif sampai tanggal itu. */
  masuk: number;
};

/** Di mana laju sekarang berdiri terhadap rentang pesimis–optimis. */
export type PosisiTren = 'DI_ATAS' | 'DI_DALAM' | 'DI_BAWAH';

/** Seberapa jauh target sebulan sebuah skenario sudah dikejar. */
export type Capaian = {
  target: number;
  /** Bagian target yang sudah masuk, 0–1 (bisa lebih dari 1 bila terlampaui). */
  persen: number;
  /** Yang masih kurang sampai akhir bulan; nol bila targetnya sudah lewat. */
  kurang: number;
  /** Rata-rata yang harus masuk tiap hari tersisa agar targetnya tercapai. */
  perHariSisa: number;
  tercapai: boolean;
  /**
   * Yang semestinya sudah masuk sampai tanggal laporan terakhir — target
   * sebulan dibagi rata ke seluruh hari. Inilah pembanding yang menjawab
   * "sedang di depan atau di belakang", sedangkan `target` menjawab "masih
   * kurang berapa sampai akhir bulan".
   */
  targetKini: number;
  /** Uang masuk dikurangi targetKini. Minus berarti tertinggal. */
  selisihKini: number;
};

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
  /** Sisa hari sampai akhir bulan. */
  sisaHari: number;
  /** Capaian terhadap target sebulan tiap skenario. */
  capaian: Record<Skenario, Capaian>;
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

  const sisaHari = hariSebulan - akhir.hari;

  /*
   * Dua angka yang mudah tertukar, dan keduanya perlu ditampilkan.
   *
   * "persen" membandingkan yang sudah masuk dengan target SEBULAN PENUH —
   * inilah yang terasa masih jauh di pertengahan bulan. "porsiHari" adalah
   * bagian bulan yang sudah berlalu. Capaian di atas porsi hari berarti
   * berjalan lebih cepat daripada targetnya, walaupun angkanya masih jauh di
   * bawah target sebulan.
   */
  const capaian = Object.fromEntries(
    SKENARIO.map((s) => {
      const target = proyeksi[s];
      const kurang = Math.max(0, target - akhir.masuk);
      const targetKini = target * porsiHari;
      return [s, {
        target,
        persen: target > 0 ? akhir.masuk / target : 0,
        kurang,
        perHariSisa: sisaHari > 0 ? kurang / sisaHari : 0,
        tercapai: kurang === 0,
        targetKini,
        selisihKini: akhir.masuk - targetKini,
      }];
    }),
  ) as Record<Skenario, Capaian>;

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
    sisaHari,
    capaian,
  };
}

/**
 * Baris untuk grafik batang: satu kelompok per skenario.
 *
 * Grafik garis sebelumnya menggambar empat garis yang berangkat dari titik
 * yang sama dan nyaris sejajar sampai akhir bulan. Bentuk itu memang memuat
 * laju harian, tetapi untuk menjawab pertanyaan yang sebenarnya ditanyakan —
 * "sudah cukup belum dibanding targetnya" — mata harus menaksir jarak antar
 * garis yang hanya beberapa piksel. Batang menjawabnya langsung: satu batang
 * target, satu batang kenyataan, bersebelahan.
 *
 * Targetnya dipecah dua supaya satu kelompok menjawab dua pertanyaan
 * sekaligus. Bagian bawah adalah yang semestinya sudah masuk sampai tanggal
 * laporan; bagian atas sisanya sampai akhir bulan. Jadi batang biru yang
 * melewati bagian bawah berarti berjalan lebih cepat daripada jadwal,
 * sementara tinggi seluruh batang abu tetap menunjukkan target sebulannya.
 */
export type BatangTren = {
  skenario: Skenario;
  nama: string;
  /** Yang semestinya sudah masuk sampai tanggal laporan terakhir. */
  targetKini: number;
  /** Sisanya sampai akhir bulan — targetSebulan dikurangi targetKini. */
  targetSisa: number;
  targetSebulan: number;
  /** Uang masuk sebenarnya. Sama untuk ketiga skenario. */
  masuk: number;
  /** masuk − targetKini. Minus berarti tertinggal dari jadwal. */
  selisih: number;
};

export function batangTren(tren: Tren): BatangTren[] {
  return SKENARIO.map((s) => {
    const c = tren.capaian[s];
    return {
      skenario: s,
      nama: NAMA_SKENARIO[s],
      targetKini: c.targetKini,
      targetSisa: Math.max(0, c.target - c.targetKini),
      targetSebulan: c.target,
      masuk: tren.masukTerakhir,
      selisih: c.selisihKini,
    };
  });
}
