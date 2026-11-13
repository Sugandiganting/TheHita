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

/* ------------------------------------------------------------------ */
/* Jenis RAB                                                           */
/* ------------------------------------------------------------------ */

/**
 * Dua bentuk RAB, karena yang dianggarkan memang berbeda bentuknya.
 *
 * Purchasing menganggarkan barang: semen berapa sak, dengan harga satuan
 * berapa. Yang lain menganggarkan akun: gaji sebulan, listrik sebulan —
 * tidak ada satuan dan tidak ada harga satuan yang masuk akal di sana.
 * Memaksakan satu formulir untuk keduanya berarti setengah kolomnya selalu
 * kosong, dan yang kosong tidak pernah jelas apakah memang tidak berlaku
 * atau sekadar belum diisi.
 */
export const JENIS_RAB = ['UMUM', 'PURCHASING'] as const;
export type JenisRab = (typeof JENIS_RAB)[number];

export const JENIS_RAB_LABEL: Record<JenisRab, string> = {
  UMUM: 'Selain Purchasing',
  PURCHASING: 'Purchasing',
};

export function jenisRabSah(nilai: string): nilai is JenisRab {
  return (JENIS_RAB as readonly string[]).includes(nilai);
}

/* ------------------------------------------------------------------ */
/* Baris RAB Purchasing                                                */
/* ------------------------------------------------------------------ */

/** Satu barang di dalam RAB Purchasing, lengkap dengan akun bebannya. */
export type BarisBarangRab = {
  lineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  satuan: string;
  kategori: string;
  /** Departemen pemakainya. Selalu ada: ia bagian dari jati diri barangnya. */
  subKategori: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  quantity: number;
  unitPrice: number;
  /** Jumlah kali harga satuan. Tidak disimpan, supaya tidak pernah berbeda. */
  anggaran: number;
  catatan: string | null;
  realisasi: RealisasiBaris;
};

/**
 * Realisasi satu baris RAB.
 *
 * Tiga keadaan yang harus dibedakan, dan hanya dua di antaranya yang berupa
 * angka:
 *
 *   belum   — belum dilaporkan sama sekali. Anggarannya masih mungkin terpakai
 *             penuh, jadi ia tetap dihitung sebagai uang yang akan keluar.
 *   berjalan — sudah dibeli sebagian, tetapi belum ditandai selesai. Sisanya
 *             masih mungkin keluar, jadi juga belum boleh disebut hemat.
 *   selesai — sudah tuntas. Selisihnya terhadap anggaran barulah penghematan,
 *             dan nol pada yang selesai berarti sungguh tidak jadi dibeli.
 *
 * Perbedaan "belum" dan "nol" itu bukan kehalusan: yang satu berarti uangnya
 * masih akan keluar, yang lain berarti tidak akan. Menyamakan keduanya membuat
 * rencana kas salah justru pada angka yang paling dipakai.
 */
export type RealisasiBaris = {
  /** null berarti belum dilaporkan. */
  quantity: number | null;
  unitPrice: number | null;
  tanggal: Date | null;
  selesai: boolean;
  catatan: string | null;
  /** Jumlah kali harga satuan; null selama belum dilaporkan. */
  nilai: number | null;
};

export type StatusRealisasi = 'BELUM' | 'BERJALAN' | 'SELESAI';

export const statusRealisasi = (r: RealisasiBaris): StatusRealisasi =>
  (r.selesai ? 'SELESAI' : r.nilai === null ? 'BELUM' : 'BERJALAN');

export const LABEL_REALISASI: Record<StatusRealisasi, string> = {
  BELUM: 'Belum direalisasi',
  BERJALAN: 'Sebagian',
  SELESAI: 'Selesai',
};

/**
 * Nilai anggaran satu baris barang.
 *
 * Hasilnya dihitung, bukan disimpan. Menyimpan jumlah, harga satuan, dan
 * hasil kalinya sekaligus berarti menyimpan satu angka yang bisa bertentangan
 * dengan dua angka lainnya — dan yang bertentangan itu baru terlihat saat
 * seseorang menjumlahkan ulang dengan tangan.
 */
export function nilaiBarisBarang(
  baris: { quantity: number; unitPrice: number },
  pembulatan: (n: number) => number = (n) => Math.round(n * 100) / 100,
): number {
  return pembulatan(baris.quantity * baris.unitPrice);
}

/**
 * Penghematan sebuah baris: anggaran dikurangi realisasinya.
 *
 * Hanya baris yang SELESAI yang menghasilkan angka. Yang belum selesai masih
 * mungkin menghabiskan sisa anggarannya, dan menghitungnya sebagai hemat
 * berarti membelanjakan uang yang belum tentu ada.
 *
 * Boleh negatif: belanja yang melebihi anggarannya adalah pemborosan, dan
 * menyembunyikannya di balik nol membuat total penghematan terbaca lebih
 * besar daripada yang sungguh dihemat.
 */
export function penghematanBaris(
  baris: { anggaran: number; realisasi: RealisasiBaris },
  pembulatan: (n: number) => number = (n) => Math.round(n * 100) / 100,
): number | null {
  if (!baris.realisasi.selesai || baris.realisasi.nilai === null) return null;
  return pembulatan(baris.anggaran - baris.realisasi.nilai);
}

/**
 * Uang yang masih akan keluar dari sebuah baris.
 *
 * Yang sudah selesai tidak akan keluar lagi, berapa pun sisa anggarannya.
 * Yang belum selesai diperkirakan memakai anggarannya — dikurangi yang sudah
 * sempat dibelanjakan, supaya belanja bertahap tidak terhitung dua kali.
 */
export function sisaAkanKeluar(
  baris: { anggaran: number; realisasi: RealisasiBaris },
  pembulatan: (n: number) => number = (n) => Math.round(n * 100) / 100,
): number {
  if (baris.realisasi.selesai) return 0;
  return pembulatan(Math.max(0, baris.anggaran - (baris.realisasi.nilai ?? 0)));
}

/**
 * Rekap sekumpulan baris RAB: dianggarkan berapa, sudah direalisasi berapa,
 * dan yang belum tersentuh berapa.
 *
 * Tiga angka ini menjawab tiga pertanyaan berbeda, dan sengaja tidak dibuat
 * saling menjumlah. `anggaran` adalah rencananya; `realisasi` adalah uang yang
 * sungguh keluar menurut laporan; `belum` adalah anggaran baris yang belum
 * dilaporkan sama sekali. Yang terakhir inilah yang dipakai rancangan kas,
 * karena hanya baris yang belum tersentuh yang pasti masih butuh uang —
 * baris yang sudah sebagian berjalan dihitung terpisah supaya tidak
 * mengaburkan keduanya.
 */
export type RekapRab = {
  anggaran: number;
  /** Uang yang dilaporkan sudah keluar. Baris yang belum dilaporkan tidak ikut. */
  realisasi: number;
  /** Anggaran baris yang belum dilaporkan sama sekali. */
  belum: number;
  /** Anggaran baris yang sudah dilaporkan tetapi belum ditandai selesai. */
  berjalan: number;
  /** Anggaran baris yang sudah ditandai selesai. */
  selesai: number;
  /** Penghematan dari baris yang selesai saja; minus berarti lewat anggaran. */
  hemat: number;
  /** Jumlah baris menurut statusnya. */
  jumlah: Record<StatusRealisasi, number>;
};

export const REKAP_KOSONG: RekapRab = {
  anggaran: 0, realisasi: 0, belum: 0, berjalan: 0, selesai: 0, hemat: 0,
  jumlah: { BELUM: 0, BERJALAN: 0, SELESAI: 0 },
};

export function rekapRab(
  baris: { anggaran: number; realisasi: RealisasiBaris }[],
  pembulatan: (n: number) => number = (n) => Math.round(n * 100) / 100,
): RekapRab {
  const r = { ...REKAP_KOSONG, jumlah: { BELUM: 0, BERJALAN: 0, SELESAI: 0 } };
  for (const b of baris) {
    const status = statusRealisasi(b.realisasi);
    r.anggaran += b.anggaran;
    r.realisasi += b.realisasi.nilai ?? 0;
    r.jumlah[status] += 1;
    if (status === 'BELUM') r.belum += b.anggaran;
    else if (status === 'BERJALAN') r.berjalan += b.anggaran;
    else {
      r.selesai += b.anggaran;
      r.hemat += penghematanBaris(b, pembulatan) ?? 0;
    }
  }
  for (const k of ['anggaran', 'realisasi', 'belum', 'berjalan', 'selesai', 'hemat'] as const) {
    r[k] = pembulatan(r[k]);
  }
  return r;
}

/**
 * Menjumlahkan baris-baris barang menjadi anggaran per akun.
 *
 * Beberapa barang boleh bermuara ke akun yang sama — semen dan besi keduanya
 * bisa masuk "Biaya Pemeliharaan". Perbandingan dengan jurnal hanya mungkin
 * di tingkat akun, karena jurnal tidak mencatat barangnya.
 */
export function anggaranPerAkun(
  barang: BarisBarangRab[],
  pembulatan: (n: number) => number = (n) => Math.round(n * 100) / 100,
): Map<string, { code: string; name: string; anggaran: number }> {
  const per = new Map<string, { code: string; name: string; anggaran: number }>();
  for (const b of barang) {
    const cur = per.get(b.accountId) ?? { code: b.accountCode, name: b.accountName, anggaran: 0 };
    cur.anggaran += b.anggaran;
    per.set(b.accountId, cur);
  }
  for (const v of per.values()) v.anggaran = pembulatan(v.anggaran);
  return per;
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
