/**
 * Membaca RAB Purchasing dari lembar Excel menjadi baris yang siap disimpan.
 *
 * Dipisah dari skripnya supaya bisa diuji tanpa berkas dan tanpa basis data.
 * Lihat `scripts/impor-rab.ts` untuk penyimpanannya.
 *
 * Bentuk lembarnya: satu sheet per cabang, satu baris per barang, dan satu
 * kolom per bulan yang berisi jumlah yang direncanakan. Jadi satu baris di
 * lembar menjadi beberapa baris RAB — satu untuk tiap bulan yang jumlahnya
 * lebih dari nol, masing-masing di RAB bulan itu sendiri.
 */

import { normalKode, normalNama } from './barang';
import { KODE_DIPERBAIKI, type PerbaikanKode } from './impor-barang';

/* ------------------------------------------------------------------ bulan */

/** Satu kolom bulan: letaknya di lembar, dan bulan yang diwakilinya. */
export type KolomBulan = { kolom: number; periode: string };

const NAMA_BULAN: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5,
  jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, ags: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11, des: 12, dec: 12, desember: 12, december: 12,
};

/**
 * Membaca judul kolom bulan.
 *
 * Judulnya ditulis dua cara di lembar yang sama: sebagian sebagai tanggal
 * Excel sungguhan, sebagian sebagai teks "Des 2026". Keduanya harus terbaca,
 * karena yang satu kolom pertama dan sisanya yang lain — dan melewatkan kolom
 * pertama berarti anggaran satu bulan penuh hilang tanpa suara.
 */
export function periodeDariJudul(nilai: unknown): string | null {
  if (nilai instanceof Date) {
    return `${nilai.getUTCFullYear()}-${String(nilai.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const t = String(nilai ?? '').trim();
  const m = /^([A-Za-z]+)\s*'?(\d{2,4})$/.exec(t);
  if (!m) return null;
  const bulan = NAMA_BULAN[m[1].toLowerCase()];
  if (!bulan) return null;
  const tahun = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return `${tahun}-${String(bulan).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ baris */

/** Satu baris mentah dari lembar cabang, apa adanya. */
export type BarisRab = {
  /** Nama sheet-nya, dipakai mencari cabangnya. */
  sheet: string;
  baris: number;
  code: string;
  name: string;
  /** Kolom TYPE: OPEX atau CAPEX. Di aplikasi ini kategori barangnya. */
  type: string;
  /** Kolom DEPARTMENT. Di aplikasi ini sub kategori barangnya. */
  department: string;
  /** Kolom COA, dipakai memastikan barang mana yang dimaksud. */
  coa: string;
  satuan: string;
  /** Kosong berarti kolom bulanannya berisi rupiah, bukan jumlah unit. */
  harga: number | null;
  /** Jumlah tiap bulan, searah dengan kolom bulan di lembarnya. */
  bulanan: { periode: string; jumlah: number }[];
};

/** Satu baris RAB yang siap disimpan: satu barang, satu bulan, satu cabang. */
export type BarisSiap = {
  sheet: string;
  baris: number;
  code: string;
  name: string;
  type: string;
  department: string;
  coa: string;
  periode: string;
  quantity: number;
  unitPrice: number;
  /** Isi bila barisnya memakai rupiah langsung, bukan jumlah kali harga. */
  catatan: string | null;
};

export type HasilRab = {
  siap: BarisSiap[];
  /** Perbaikan kode yang sungguh terpakai pada lembar ini. */
  terpakai: PerbaikanKode[];
  /** Baris yang tidak menganggarkan apa pun sepanjang lembarnya. */
  kosong: BarisRab[];
  /** Baris yang kolom bulanannya rupiah, bukan jumlah unit. */
  rupiah: BarisRab[];
  masalah: string[];
};

/**
 * Jumlah yang masuk akal sebagai banyaknya barang.
 *
 * Dipakai mengenali baris yang kolom bulanannya sebenarnya rupiah. Bukan
 * penentu — penentunya kolom HARGA yang kosong — melainkan jaring kedua,
 * untuk baris yang harganya terisi tetapi bulanannya jelas bukan jumlah unit.
 */
const BATAS_WAJAR_UNIT = 100_000;

/**
 * Membakukan seluruh lembar dan memecahnya per bulan.
 *
 * Dua bentuk baris yang harus dibedakan:
 *
 *   - Biasa: kolom bulanan berisi banyaknya barang, dikalikan HARGA.
 *   - Rupiah langsung: HARGA kosong, dan kolom bulanannya sudah berupa uang —
 *     dipakai untuk listrik pascabayar, yang tidak punya "harga satuan".
 *     Disimpan sebagai satu satuan dengan harga sebesar tagihannya, supaya
 *     uangnya tetap persis dan barisnya tetap terbaca masuk akal.
 *
 * Bulan yang jumlahnya nol dilewati: RAB bulan itu memang tidak menganggarkan
 * barang tersebut, dan baris senilai nol hanya memenuhi layar.
 */
export function siapkanRab(baris: BarisRab[]): HasilRab {
  const siap: BarisSiap[] = [];
  const kosong: BarisRab[] = [];
  const rupiah: BarisRab[] = [];
  const masalah: string[] = [];
  const terpakai: PerbaikanKode[] = [];

  for (const b of baris) {
    const name = normalNama(b.name);
    /*
     * Kode yang di master sudah diperbaiki, diperbaiki juga di sini.
     *
     * Aturannya satu dan sama (KODE_DIPERBAIKI), karena RAB yang menyebut
     * kode lama sementara masternya memakai kode baru tidak akan ketemu
     * barangnya — dan lembar RAB ini memang masih memakai BO-001 untuk dua
     * barang sekaligus, persis seperti lembar masternya dulu.
     */
    const asli = normalKode(b.code);
    const perbaikan = KODE_DIPERBAIKI.find(
      (k) => normalKode(k.kode) === asli && normalNama(k.nama).toLowerCase() === name.toLowerCase(),
    );
    if (perbaikan) terpakai.push(perbaikan);
    const code = perbaikan ? normalKode(perbaikan.jadi) : asli;
    if (!code) {
      masalah.push(`${b.sheet} baris ${b.baris}: kode barang kosong.`);
      continue;
    }
    if (!b.type.trim()) {
      masalah.push(`${b.sheet} baris ${b.baris} (${code}): kolom TYPE kosong.`);
      continue;
    }
    if (!b.department.trim()) {
      masalah.push(`${b.sheet} baris ${b.baris} (${code}): kolom DEPARTMENT kosong.`);
      continue;
    }

    const total = b.bulanan.reduce((s, x) => s + x.jumlah, 0);
    if (total === 0) {
      kosong.push(b);
      continue;
    }

    const langsung = b.harga === null || b.harga === 0
      || b.bulanan.some((x) => x.jumlah >= BATAS_WAJAR_UNIT);
    if (langsung) rupiah.push(b);

    for (const { periode, jumlah } of b.bulanan) {
      if (jumlah === 0) continue;
      siap.push({
        sheet: b.sheet,
        baris: b.baris,
        code,
        name,
        type: normalKode(b.type),
        department: normalNama(b.department),
        coa: normalNama(b.coa),
        periode,
        quantity: langsung ? 1 : jumlah,
        unitPrice: langsung ? jumlah : (b.harga ?? 0),
        catatan: langsung
          ? `Tagihan ${b.satuan || 'bulanan'}; di lembar RAB nilainya langsung rupiah, bukan jumlah kali harga satuan.`
          : null,
      });
    }
  }

  masalah.push(...bentrokBaris(siap));
  return { siap, terpakai, kosong, rupiah, masalah };
}

/**
 * Satu barang hanya boleh punya satu baris di dalam satu RAB.
 *
 * Basis datanya memang menjaga itu sendiri, tetapi kalau baru ketahuan di sana
 * sebagian RAB sudah tersimpan dan sebagian belum. Lebih baik seluruh lembar
 * diperiksa lebih dulu, dan tidak ada apa pun yang ditulis sampai bersih.
 */
function bentrokBaris(siap: BarisSiap[]): string[] {
  const peta = new Map<string, BarisSiap[]>();
  for (const s of siap) {
    const k = `${s.sheet}|${s.periode}|${s.type}|${s.department.toLowerCase()}|${s.code}`;
    peta.set(k, [...(peta.get(k) ?? []), s]);
  }
  // Satu kode yang bentrok akan bentrok di tiap bulannya — delapan kali untuk
  // keluhan yang sama. Dikumpulkan jadi satu per barang, dengan bulan-bulannya
  // disebut, supaya yang membacanya melihat satu masalah dan bukan delapan.
  const perBarang = new Map<string, { awal: BarisSiap; baris: Set<number>; bulan: string[] }>();
  for (const [, kumpulan] of peta) {
    if (kumpulan.length < 2) continue;
    const [awal] = kumpulan;
    const k = `${awal.sheet}|${awal.code}`;
    const cur = perBarang.get(k) ?? { awal, baris: new Set<number>(), bulan: [] };
    for (const x of kumpulan) cur.baris.add(x.baris);
    cur.bulan.push(awal.periode);
    perBarang.set(k, cur);
  }
  return [...perBarang.values()].map(({ awal, baris, bulan }) =>
    `${awal.sheet}: kode ${awal.code} dipakai ${baris.size} baris sekaligus `
    + `(baris ${[...baris].sort((a, b) => a - b).join(' dan ')}) di ${bulan.length} bulan `
    + `(${bulan.sort().join(', ')}). Satu barang hanya boleh punya satu baris dalam satu RAB, `
    + 'karena dua baris untuk barang yang sama tidak bisa dijumlahkan tanpa menebak mana yang berlaku.');
}

/** Nilai satu baris, dalam rupiah. */
export const nilaiBaris = (b: BarisSiap): number => b.quantity * b.unitPrice;
