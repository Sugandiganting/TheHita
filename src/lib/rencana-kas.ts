/**
 * Rencana kas jangka pendek: dari posisi kas hari ini sampai akhir bulan.
 *
 * Berbeda dengan mesin peramalan yang melihat belasan bulan ke depan, bagian
 * ini menjawab satu pertanyaan sempit yang ditanyakan tiap minggu — berapa yang
 * boleh dibelanjakan sampai akhir bulan, bila uang masuk ternyata seret, wajar,
 * atau baik. Rumusnya sengaja dibuat sesederhana mungkin supaya hasilnya bisa
 * dihitung ulang dengan tangan saat rapat.
 */

import { periodEndExclusive, periodStart, type Period } from './period';

export type Skenario = 'PESIMIS' | 'NORMAL' | 'OPTIMIS';
export const SKENARIO: readonly Skenario[] = ['PESIMIS', 'NORMAL', 'OPTIMIS'] as const;

export const NAMA_SKENARIO: Record<Skenario, string> = {
  PESIMIS: 'Pesimis',
  NORMAL: 'Normal',
  OPTIMIS: 'Optimis',
};

/** Pembulatan plafon mingguan — angka bulat lebih mudah dijadikan aturan. */
export const PEMBULATAN = 100_000;

const HARI = 86_400_000;

export type Komitmen = {
  label: string;
  amount: number;
  /** Tanggal jatuh tempo dalam bulan, 1–31. null bila belum pasti. */
  dueDay: number | null;
  paid: boolean;
};

export type Kategori = {
  label: string;
  /** Porsi relatif; dinormalkan terhadap jumlah seluruh kategori. */
  weight: number;
};

export type Masukan = {
  period: Period;
  /** Tanggal posisi kas terakhir dilaporkan; sisa bulan dihitung dari esoknya. */
  tanggal: Date;
  saldoKas: number;
  masukSampaiKini: number;
  proyeksi: Record<Skenario, number>;
  komitmen: Komitmen[];
  kategori: Kategori[];
};

export type Minggu = {
  mulai: Date;
  /** Hari terakhir minggu ini, inklusif. */
  selesai: Date;
  hari: number;
  plafonDasar: number;
  tambahan: number;
  /** Uang masuk kumulatif bulan ini yang harus tercapai agar tambahan dibuka. */
  targetMasuk: number;
};

export type HasilSkenario = {
  skenario: Skenario;
  proyeksi: number;
  sisaMasuk: number;
  bolehBelanja: number;
  perMinggu: number;
};

export type PorsiKategori = {
  label: string;
  perMinggu: number;
  sisaBulan: number;
};

export type Rencana = {
  mulai: Date;
  selesai: Date;
  hari: number;
  komitmenBelumBayar: number;
  skenario: Record<Skenario, HasilSkenario>;
  minggu: Minggu[];
  kategori: PorsiKategori[];
};

/** Ke kelipatan PEMBULATAN terdekat, tetap benar untuk angka negatif. */
const bulatkan = (n: number) => Math.round(n / PEMBULATAN) * PEMBULATAN;

const hariUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const selisihHari = (a: Date, b: Date) => Math.round((hariUtc(b) - hariUtc(a)) / HARI);
const tambahHari = (d: Date, n: number) => new Date(hariUtc(d) + n * HARI);

/**
 * Sisa bulan yang masih bisa direncanakan: mulai sehari setelah posisi kas
 * dilaporkan — uang masuk "sampai dengan 9 Oktober" berarti sisanya baru
 * dihitung dari tanggal 10 — sampai hari terakhir bulan itu.
 */
export function jendela(period: Period, tanggal: Date): { mulai: Date; selesai: Date; hari: number } {
  const awalBulan = periodStart(period);
  const akhirBulan = tambahHari(periodEndExclusive(period), -1);
  const sesudah = tambahHari(tanggal, 1);
  const mulai = new Date(Math.max(awalBulan.getTime(), sesudah.getTime()));
  const hari = Math.max(0, selisihHari(mulai, akhirBulan) + 1);
  return { mulai, selesai: akhirBulan, hari };
}

/**
 * Potongan tujuh harian dari `mulai`. Sisa yang kurang dari sepekan digabung ke
 * minggu terakhir, bukan berdiri sendiri — plafon untuk satu atau dua hari
 * tidak ada gunanya sebagai aturan belanja.
 */
export function pecahMinggu(mulai: Date, selesai: Date): { mulai: Date; selesai: Date; hari: number }[] {
  const total = selisihHari(mulai, selesai) + 1;
  if (total <= 0) return [];

  const potongan: { mulai: Date; selesai: Date; hari: number }[] = [];
  for (let i = 0; i < total; i += 7) {
    const a = tambahHari(mulai, i);
    const b = tambahHari(mulai, Math.min(i + 6, total - 1));
    potongan.push({ mulai: a, selesai: b, hari: selisihHari(a, b) + 1 });
  }

  const akhir = potongan[potongan.length - 1];
  if (potongan.length > 1 && akhir.hari < 7) {
    potongan.pop();
    const sebelum = potongan[potongan.length - 1];
    sebelum.selesai = akhir.selesai;
    sebelum.hari += akhir.hari;
  }
  return potongan;
}

/**
 * Membagi satu jumlah menurut bobot, dibulatkan ke bawah, dengan sisanya
 * diberikan ke bagian terakhir supaya jumlah seluruhnya tetap persis sama.
 */
export function bagiProporsional(total: number, bobot: number[], pembulatan = PEMBULATAN): number[] {
  const jumlahBobot = bobot.reduce((s, b) => s + b, 0);
  if (bobot.length === 0) return [];
  if (jumlahBobot <= 0) return bobot.map(() => 0);

  const hasil = bobot.map((b) => Math.floor((total * b) / jumlahBobot / pembulatan) * pembulatan);
  const terpakai = hasil.reduce((s, v) => s + v, 0);
  hasil[hasil.length - 1] += total - terpakai;
  return hasil;
}

function hasilSkenario(
  skenario: Skenario,
  proyeksi: number,
  masukSampaiKini: number,
  saldoKas: number,
  komitmen: number,
  jumlahMinggu: number,
): HasilSkenario {
  const sisaMasuk = Math.max(0, proyeksi - masukSampaiKini);
  const bolehBelanja = saldoKas + sisaMasuk - komitmen;
  return {
    skenario,
    proyeksi,
    sisaMasuk,
    bolehBelanja,
    // Dibulatkan: angka ini dibacakan sebagai aturan belanja, bukan hasil
    // pembukuan, dan "Rp 45.733.333 per minggu" tidak lebih berguna daripada
    // "Rp 45,7 juta" sambil jauh lebih sulit diingat.
    perMinggu: jumlahMinggu > 0 ? bulatkan(bolehBelanja / jumlahMinggu) : 0,
  };
}

export function hitungRencana(m: Masukan): Rencana {
  const { mulai, selesai, hari } = jendela(m.period, m.tanggal);
  const potongan = pecahMinggu(mulai, selesai);
  const komitmenBelumBayar = m.komitmen.filter((k) => !k.paid).reduce((s, k) => s + k.amount, 0);

  const skenario = Object.fromEntries(
    SKENARIO.map((s) => [
      s,
      hasilSkenario(s, m.proyeksi[s], m.masukSampaiKini, m.saldoKas, komitmenBelumBayar, potongan.length),
    ]),
  ) as Record<Skenario, HasilSkenario>;

  // Plafon dasar memakai skenario pesimis: yang boleh dibelanjakan walau uang
  // masuk seret. Tambahan adalah selisihnya terhadap normal, dan baru dibuka
  // bila uang masuk kumulatif sudah sampai di target tanggal itu — jadi belanja
  // mengikuti uang yang benar-benar diterima, bukan yang diharapkan.
  //
  // Keduanya dibatasi oleh anggaran normal yang sudah dinolkan, bukan oleh
  // selisih antar skenario. Saat kas defisit, pesimis dan normal sama-sama
  // minus, dan selisih keduanya tetap positif — tanpa batas ini tabelnya akan
  // menjanjikan puluhan juta boleh dibelanjakan justru ketika uangnya tidak ada.
  const dasar = Math.max(0, skenario.PESIMIS.bolehBelanja);
  const tambahanTotal = Math.max(0, Math.max(0, skenario.NORMAL.bolehBelanja) - dasar);
  const bobotHari = potongan.map((p) => p.hari);
  const bagianDasar = bagiProporsional(dasar, bobotHari);
  const bagianTambahan = bagiProporsional(tambahanTotal, bobotHari);

  const kejarNormal = Math.max(0, m.proyeksi.NORMAL - m.masukSampaiKini);
  let kumulatifHari = 0;
  const minggu: Minggu[] = potongan.map((p, i) => {
    kumulatifHari += p.hari;
    return {
      ...p,
      plafonDasar: bagianDasar[i],
      tambahan: bagianTambahan[i],
      targetMasuk: bulatkan(m.masukSampaiKini + (kejarNormal * kumulatifHari) / hari),
    };
  });

  // Pembagian antar kategori memakai skenario normal — angka yang dipakai
  // sehari-hari — sedangkan pesimis dan optimis tetap terlihat di kartu atas.
  const perMingguNormal = skenario.NORMAL.perMinggu;
  const sisaNormal = skenario.NORMAL.bolehBelanja;
  const bobotKategori = m.kategori.map((k) => k.weight);
  const porsiMinggu = bagiProporsional(Math.max(0, perMingguNormal), bobotKategori);
  const porsiBulan = bagiProporsional(Math.max(0, sisaNormal), bobotKategori);
  const kategori: PorsiKategori[] = m.kategori.map((k, i) => ({
    label: k.label,
    perMinggu: porsiMinggu[i],
    sisaBulan: porsiBulan[i],
  }));

  return { mulai, selesai, hari, komitmenBelumBayar, skenario, minggu, kategori };
}

/**
 * Usulan tiga skenario dari riwayat uang masuk. Normal memakai rata-rata
 * tertimbang tiga bulan terakhir dengan bulan terbaru paling berat; pesimis dan
 * optimis memakai bulan terendah dan tertinggi di antaranya. Aturan yang bisa
 * dijelaskan dalam satu kalimat lebih berguna di rapat daripada rumus yang
 * lebih pintar tetapi tidak bisa ditelusuri.
 */
export function usulkanProyeksi(riwayat: number[]): Record<Skenario, number> | null {
  const pakai = riwayat.filter((v) => v > 0).slice(-3);
  if (pakai.length === 0) return null;

  const bobot = [1, 2, 3].slice(-pakai.length);
  const jumlahBobot = bobot.reduce((s, b) => s + b, 0);
  const normal = pakai.reduce((s, v, i) => s + v * bobot[i], 0) / jumlahBobot;

  return {
    PESIMIS: Math.min(...pakai),
    NORMAL: normal,
    OPTIMIS: Math.max(...pakai),
  };
}
