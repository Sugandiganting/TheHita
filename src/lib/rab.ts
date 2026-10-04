/**
 * Rencana Anggaran Biaya — aturan yang menentukan bagaimana anggaran
 * dibandingkan dengan realisasinya.
 *
 * Satu RAB dimiliki oleh sebuah "scope": bisa satu cabang ("THL"), bisa satu
 * kelompok penanggung ("THL+SKR") untuk biaya yang ditanggung beberapa cabang
 * bersama. Bentuknya sengaja dibuat sama persis dengan `JournalLine.sharedGroup`
 * supaya anggaran dan realisasi diukur dengan dasar yang sama — kalau tidak,
 * selisihnya tidak berarti apa-apa.
 *
 * Lihat src/lib/beban-bersama.ts untuk siapa menanggung apa.
 */

import { namaPenanggung, type Penanggung } from './beban-bersama';

/** Baris jurnal, seperlunya saja untuk mencocokkan realisasi. */
export type BarisRealisasi = {
  accountId: string;
  unitCode: string;
  /** Kelompok penanggung bila biaya ini ditanggung bersama; null bila milik cabang sendiri. */
  sharedGroup: string | null;
  debit: number;
  credit: number;
};

/**
 * Apakah satu baris jurnal termasuk realisasi dari RAB bersangkutan.
 *
 * Aturannya cuma satu, tetapi penting: biaya bersama **tidak** dihitung sebagai
 * realisasi cabang. Gaji staf yang bekerja di Legian dan Sri Krisna bukan
 * sesuatu yang bisa dikendalikan Legian sendiri, jadi menagihkannya ke RAB
 * Legian membuat selisihnya tidak bermakna. Biaya seperti itu punya RAB
 * tersendiri atas nama kelompok penanggungnya.
 */
export function barisMasukScope(baris: BarisRealisasi, scope: string): boolean {
  if (baris.sharedGroup) return baris.sharedGroup === scope;
  return baris.unitCode === scope;
}

/** Scope untuk satu cabang. */
export function scopeCabang(unitCode: string): string {
  return unitCode;
}

/** Scope untuk satu kelompok penanggung; null bila penanggungnya cuma satu cabang. */
export function scopeBersama(penanggung: Penanggung): string | null {
  return namaPenanggung(penanggung);
}

/** Scope ini milik beberapa cabang bersama, bukan satu cabang. */
export function scopeBersamaKah(scope: string): boolean {
  return scope.includes('+');
}

/** Cabang-cabang yang tercakup sebuah scope. */
export function cabangDalamScope(scope: string): string[] {
  return scope.split('+');
}

export type BarisRab = {
  accountId: string;
  accountCode: string;
  accountName: string;
  /** Yang dianggarkan. */
  anggaran: number;
  /** Yang sudah terpakai menurut jurnal. */
  realisasi: number;
};

export type RingkasanBaris = BarisRab & {
  /** Anggaran dikurangi realisasi. Negatif berarti lewat anggaran. */
  sisa: number;
  /** Realisasi dibagi anggaran, dalam persen. Null bila tidak dianggarkan. */
  terpakaiPct: number | null;
  /** Realisasi melebihi anggaran. */
  lewat: boolean;
  /** Ada realisasi tetapi tidak pernah dianggarkan. */
  takDianggarkan: boolean;
};

export type RingkasanRab = {
  baris: RingkasanBaris[];
  totalAnggaran: number;
  totalRealisasi: number;
  totalSisa: number;
  terpakaiPct: number | null;
  /** Akun yang realisasinya melebihi anggaran. */
  jumlahLewat: number;
  /** Akun yang terpakai tanpa pernah dianggarkan. */
  jumlahTakDianggarkan: number;
};

/**
 * Menggabungkan anggaran dan realisasi menjadi satu daftar.
 *
 * Akun yang terpakai tetapi tidak pernah dianggarkan **tetap ditampilkan**,
 * ditandai tersendiri. Menyembunyikannya akan membuat total realisasi di
 * laporan tidak sama dengan beban yang benar-benar terjadi — persis jenis
 * selisih diam-diam yang paling sulit dilacak kemudian.
 */
export function ringkasRab(
  anggaran: BarisRab[],
  pembulatan: (n: number) => number = (n) => Math.round(n * 100) / 100,
): RingkasanRab {
  const baris = anggaran.map((b): RingkasanBaris => {
    const sisa = pembulatan(b.anggaran - b.realisasi);
    return {
      ...b,
      anggaran: pembulatan(b.anggaran),
      realisasi: pembulatan(b.realisasi),
      sisa,
      terpakaiPct: b.anggaran > 0 ? (b.realisasi / b.anggaran) * 100 : null,
      lewat: b.realisasi > b.anggaran,
      takDianggarkan: b.anggaran === 0 && b.realisasi !== 0,
    };
  });

  const totalAnggaran = pembulatan(baris.reduce((s, b) => s + b.anggaran, 0));
  const totalRealisasi = pembulatan(baris.reduce((s, b) => s + b.realisasi, 0));

  return {
    baris,
    totalAnggaran,
    totalRealisasi,
    totalSisa: pembulatan(totalAnggaran - totalRealisasi),
    terpakaiPct: totalAnggaran > 0 ? (totalRealisasi / totalAnggaran) * 100 : null,
    jumlahLewat: baris.filter((b) => b.lewat && !b.takDianggarkan).length,
    jumlahTakDianggarkan: baris.filter((b) => b.takDianggarkan).length,
  };
}

/** Bulan berikutnya dari sebuah periode YYYY-MM. */
export function periodeBerikutnya(period: string): string {
  const [tahun, bulan] = period.split('-').map(Number);
  return bulan === 12
    ? `${tahun + 1}-01`
    : `${tahun}-${String(bulan + 1).padStart(2, '0')}`;
}
