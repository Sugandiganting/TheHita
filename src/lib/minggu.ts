/**
 * Baris mingguan untuk layar aturan: yang sudah lewat dan yang akan datang.
 *
 * Tabel aturan semula hanya memuat sisa bulan. Itu cukup untuk memutuskan
 * belanja minggu ini, tetapi menyisakan dua lubang. Pertanyaan yang selalu
 * menyusul — minggu-minggu kemarin uangnya masuk sesuai target atau tidak —
 * tidak terjawab sama sekali. Dan menjelang akhir bulan sisanya tinggal satu
 * baris, terlalu pendek untuk dipakai merencanakan apa pun.
 *
 * Jadi barisnya dibuat dua arah, dan keduanya memakai sumber yang berbeda
 * karena memang berbeda sifatnya:
 *
 * - Ke belakang mengikuti laporan posisi kas, satu baris untuk tiap laporan,
 *   dari laporan sebelumnya sampai laporan itu. Uang masuknya jadi selisih dua
 *   angka yang benar-benar dicatat, bukan hasil membagi rata jatah seminggu.
 *   Panjang barisnya ikut jarak antar laporan; kalau laporannya telat sepuluh
 *   hari, barisnya memang sepuluh hari, dan targetnya ikut sepuluh hari.
 * - Ke depan mengikuti rencana. Bila sisa bulan kurang dari empat minggu,
 *   diteruskan melewati pergantian bulan memakai proyeksi bulan berikutnya —
 *   tanpa plafon, karena jatah bulan depan belum dihitung.
 *
 * Targetnya selalu dihitung per hari, bukan per minggu: laju harian bulan itu
 * dikalikan jumlah harinya. Dengan begitu baris yang panjangnya tidak tujuh
 * hari, dan baris yang menyeberang pergantian bulan, tetap dibandingkan dengan
 * angka yang setara.
 */

import { daysInPeriod, periodEndExclusive, periodStart, toPeriod, type Period } from './period';
import { selisihHari, tambahHari, type Minggu } from './rencana-kas';

/** Satu laporan posisi kas: uang masuk kumulatif sejak awal bulan. */
export type LaporanKas = { date: Date; incomeToDate: number };

/** Proyeksi uang masuk sebulan penuh untuk sebuah periode. */
export type ProyeksiBulan = { period: Period; normal: number };

export type BarisMinggu = {
  mulai: Date;
  /** Hari terakhir, inklusif. */
  selesai: Date;
  hari: number;
  /** Sudah dilaporkan — uang masuknya angka jadi, bukan target. */
  lalu: boolean;
  /** Hari ini jatuh di dalam rentang ini. */
  berjalan: boolean;
  /** Seluruh harinya masih di dalam bulan rencana. */
  dalamBulan: boolean;
  /** null untuk baris yang tidak punya rencana: yang sudah lewat, dan bulan depan. */
  plafonDasar: number | null;
  tambahan: number | null;
  /** Uang masuk kumulatif yang harus tercapai agar tambahan dibuka. */
  targetKumulatif: number | null;
  /** Uang masuk yang semestinya datang sepanjang rentang ini. */
  target: number;
  /** Yang benar-benar masuk; null bila rentangnya belum dilaporkan. */
  masuk: number | null;
};

export type RingkasMinggu = {
  baris: BarisMinggu[];
  /** Jumlah seluruh baris yang sudah dilaporkan. */
  targetLalu: number;
  masukLalu: number;
  /** masukLalu − targetLalu. Minus berarti tertinggal dari target. */
  selisihLalu: number;
};

export function barisMinggu({
  period, hariIni, minggu, laporan, proyeksi, maksDepan = 4,
}: {
  period: Period;
  hariIni: Date;
  /** Minggu rencana, dari sehari setelah laporan terakhir sampai akhir bulan. */
  minggu: Minggu[];
  laporan: LaporanKas[];
  /** Bulan rencana dan sesudahnya; yang di luar daftar memakai yang terdekat. */
  proyeksi: ProyeksiBulan[];
  /** Sedikitnya berapa baris ke depan yang ditampilkan. */
  maksDepan?: number;
}): RingkasMinggu {
  const awalBulan = periodStart(period);
  const akhirBulan = tambahHari(periodEndExclusive(period), -1);

  // Proyeksi di luar daftar memakai bulan terdekat yang ada. Periode "YYYY-MM"
  // berurut benar sebagai teks, jadi perbandingannya tidak perlu diurai dulu.
  const urutProyeksi = [...proyeksi].sort((a, b) => (a.period < b.period ? -1 : 1));
  const lajuHarian = (p: Period) => {
    if (urutProyeksi.length === 0) return 0;
    const tepat = urutProyeksi.find((n) => n.period === p);
    const nilai = tepat
      ? tepat.normal
      : p < urutProyeksi[0].period
        ? urutProyeksi[0].normal
        : urutProyeksi[urutProyeksi.length - 1].normal;
    const hari = daysInPeriod(p);
    return hari > 0 ? nilai / hari : 0;
  };

  const target = (mulai: Date, selesai: Date) => {
    let jumlah = 0;
    for (let i = 0; i <= selisihHari(mulai, selesai); i += 1) {
      jumlah += lajuHarian(toPeriod(tambahHari(mulai, i)));
    }
    return jumlah;
  };

  const rangka = (mulai: Date, selesai: Date) => ({
    mulai,
    selesai,
    hari: selisihHari(mulai, selesai) + 1,
    lalu: selisihHari(selesai, hariIni) > 0,
    berjalan: selisihHari(mulai, hariIni) >= 0 && selisihHari(hariIni, selesai) >= 0,
    dalamBulan: selisihHari(selesai, akhirBulan) >= 0,
    target: target(mulai, selesai),
  });

  // Ke belakang: satu baris per laporan, mulai dari awal bulan.
  const urut = [...laporan]
    .filter((l) => selisihHari(awalBulan, l.date) >= 0 && selisihHari(l.date, akhirBulan) >= 0)
    .sort((a, b) => selisihHari(b.date, a.date));

  const baris: BarisMinggu[] = [];
  let batas = tambahHari(awalBulan, -1);
  let kumulatif = 0;
  for (const l of urut) {
    const mulai = tambahHari(batas, 1);
    const selesai = tambahHari(l.date, 0);
    // Dua laporan bertanggal sama tidak mungkin tersimpan, tetapi kalau pernah
    // ada, baris sepanjang nol hari tidak menjelaskan apa pun.
    if (selisihHari(mulai, selesai) < 0) continue;
    baris.push({
      ...rangka(mulai, selesai),
      lalu: true,
      // "Berjalan" hanya untuk minggu yang masih terbuka. Laporan bertanggal
      // hari ini menutup harinya, jadi tidak ada lagi yang sedang berjalan.
      berjalan: false,
      plafonDasar: null,
      tambahan: null,
      targetKumulatif: null,
      masuk: l.incomeToDate - kumulatif,
    });
    batas = selesai;
    kumulatif = l.incomeToDate;
  }

  const targetLalu = baris.reduce((s, b) => s + b.target, 0);
  const masukLalu = baris.reduce((s, b) => s + (b.masuk ?? 0), 0);

  // Ke depan: rencana apa adanya, lalu disambung sampai cukup empat baris.
  for (const m of minggu) {
    baris.push({
      ...rangka(m.mulai, m.selesai),
      lalu: false,
      plafonDasar: m.plafonDasar,
      tambahan: m.tambahan,
      targetKumulatif: m.tambahan > 0 ? m.targetMasuk : null,
      masuk: null,
    });
  }

  let ujung = minggu.length > 0 ? minggu[minggu.length - 1].selesai : batas;
  for (let n = minggu.length; n < maksDepan; n += 1) {
    const mulai = tambahHari(ujung, 1);
    const selesai = tambahHari(mulai, 6);
    baris.push({
      ...rangka(mulai, selesai),
      lalu: false,
      plafonDasar: null,
      tambahan: null,
      targetKumulatif: null,
      masuk: null,
    });
    ujung = selesai;
  }

  return { baris, targetLalu, masukLalu, selisihLalu: masukLalu - targetLalu };
}
