/**
 * Target margin tiap skenario, dan tiga hal yang diturunkan darinya.
 *
 * Satu hubungan sederhana dipakai dari tiga arah:
 *
 *     margin = (masuk − keluar) ÷ masuk
 *
 *   ke depan   target masuk  = keluar ÷ (1 − margin)   "supaya 5% tercapai,
 *                                                       harus masuk berapa"
 *   ke samping batas belanja = masuk × (1 − margin)    "dengan masuk segini,
 *                                                       boleh belanja berapa"
 *   ke belakang golongan     = margin jatuh di pita mana  "bulan ini P, N,
 *                                                          atau O"
 *
 * MARGIN OPERASI, BUKAN MARGIN KAS APA ADANYA. Renovasi, pembelian aset tetap
 * dan cicilan pokok utang dikeluarkan lebih dulu. Tanpa itu, bulan yang
 * kebetulan berproyek besar tergolong pesimis padahal usahanya berjalan baik —
 * dan golongan itulah yang nanti menentukan target bulan berikutnya, sehingga
 * satu bulan renovasi akan menarik turun seluruh tahun sesudahnya.
 *
 * Bunga pinjaman tetap di dalam: bunga memang biaya. Pokoknya tidak: pokok
 * adalah pengembalian pinjaman, bukan ongkos menjalankan usaha.
 */

/**
 * Akun beban renovasi — satu-satunya beban yang dikeluarkan dari margin
 * operasi. Disebut dengan nomornya karena COA tidak punya penanda untuk ini;
 * kalau kelak ada akun renovasi kedua, ia ditambahkan di sini dan bukan
 * ditebak dari namanya.
 */
export const AKUN_RENOVASI = ['6150.11'] as const;

export const SKENARIO_URUT = ['PESIMIS', 'NORMAL', 'OPTIMIS'] as const;
export type SkenarioMargin = (typeof SKENARIO_URUT)[number];

/** Target margin tiap skenario, dalam persen. */
export type TargetMargin = Map<SkenarioMargin, number>;

/**
 * Target tiap bulan kalender, 1 sampai 12.
 *
 * Per bulan dan bukan satu set setahun, karena bulan sepi memang tidak bisa
 * dituntut margin yang sama dengan bulan ramai — dan beban yang hanya muncul
 * di bulan tertentu, seperti THR, tidak terwakili oleh pola musim yang
 * mengatur pemasukan.
 */
export type PolaTargetMargin = Map<number, TargetMargin>;

/** Target sebuah bulan kalender; undefined bila bulan itu belum ditetapkan. */
export function targetBulan(pola: PolaTargetMargin, month: number): TargetMargin | undefined {
  const t = pola.get(month);
  return t && targetLengkap(t) ? t : undefined;
}

const bulat = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Margin yang boleh dipakai: angka hingga, dan di bawah 100%. */
function marginSah(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n < 100;
}

/**
 * Uang masuk yang diperlukan agar sebuah margin tercapai, bila belanja
 * operasinya sebesar `belanjaOperasi`.
 *
 * Inilah arah yang menjadikan margin sebuah TARGET dan bukan ramalan: ia
 * menjawab "supaya margin 5% tercapai, bulan depan harus masuk berapa",
 * bukan "bulan depan kira-kira masuk berapa".
 *
 * Null bila belanjanya belum diketahui atau marginnya belum ditetapkan.
 * Margin 100% atau lebih juga null: tidak ada uang masuk sebesar apa pun yang
 * membuat seluruhnya tersisa sambil tetap ada yang dibelanjakan.
 */
export function targetMasukDariMargin(
  belanjaOperasi: number | null,
  margin: number | null,
  pembulatan: (n: number) => number = bulat,
): number | null {
  if (belanjaOperasi === null || !Number.isFinite(belanjaOperasi) || belanjaOperasi <= 0) return null;
  if (!marginSah(margin)) return null;
  return pembulatan(belanjaOperasi / (1 - margin / 100));
}

/**
 * Batas belanja operasi sebulan supaya marginnya tercapai, bila uang masuknya
 * sebesar `masuk`. Kebalikan arah dari targetMasukDariMargin.
 *
 * Margin negatif menghasilkan batas di atas uang masuk, dan itu memang
 * maksudnya: pesimis −5% berarti boleh tekor lima persen.
 */
export function batasBelanjaDariMargin(
  masuk: number | null,
  margin: number | null,
  pembulatan: (n: number) => number = bulat,
): number | null {
  if (masuk === null || !Number.isFinite(masuk) || masuk <= 0) return null;
  if (!marginSah(margin)) return null;
  return pembulatan(masuk * (1 - margin / 100));
}

/**
 * Margin yang benar-benar tercapai, dalam persen.
 *
 * Null bila belum ada uang masuk: membaginya dengan nol menghasilkan tak
 * hingga, dan bulan yang belum menerima apa pun memang belum punya margin —
 * bukan margin nol.
 */
export function marginTercapai(
  masuk: number,
  belanjaOperasi: number,
  pembulatan: (n: number) => number = bulat,
): number | null {
  if (!Number.isFinite(masuk) || masuk <= 0) return null;
  return pembulatan(((masuk - belanjaOperasi) / masuk) * 100);
}

/**
 * Golongan sebuah bulan menurut margin yang dicapainya.
 *
 * Pitanya terbentuk sendiri dari ketiga target, tanpa perlu diketik dua ujung:
 * yang mencapai target optimis tergolong optimis, yang mencapai normal
 * tergolong normal, dan seterusnya ke bawah. Di bawah target pesimis tidak ada
 * golongan — itu bukan skenario yang pernah direncanakan siapa pun, dan
 * menyebutnya "pesimis" akan membuat bulan terburuk terbaca seolah masih di
 * dalam rencana.
 *
 * Target yang belum lengkap tidak menggolongkan apa pun: golongan yang
 * dihitung dari pita yang separuh kosong akan terbaca sama meyakinkannya
 * dengan golongan yang benar.
 */
export function golonganMargin(
  tercapai: number | null,
  target: TargetMargin,
): SkenarioMargin | 'DI_BAWAH_PESIMIS' | null {
  if (tercapai === null) return null;
  const p = target.get('PESIMIS');
  const n = target.get('NORMAL');
  const o = target.get('OPTIMIS');
  if (p === undefined || n === undefined || o === undefined) return null;

  if (tercapai >= o) return 'OPTIMIS';
  if (tercapai >= n) return 'NORMAL';
  if (tercapai >= p) return 'PESIMIS';
  return 'DI_BAWAH_PESIMIS';
}

/**
 * Ketiga target berurut naik: pesimis paling rendah, optimis paling tinggi.
 *
 * Diperiksa dan bukan dipaksakan dengan mengurutkan sendiri, karena urutan
 * yang terbalik hampir selalu salah ketik — dan diam-diam menukarnya akan
 * menyembunyikan salah ketik itu sampai angkanya dipakai mengambil keputusan.
 */
export function targetBerurut(target: TargetMargin): boolean {
  const p = target.get('PESIMIS');
  const n = target.get('NORMAL');
  const o = target.get('OPTIMIS');
  if (p === undefined || n === undefined || o === undefined) return false;
  return p < n && n < o;
}

/** Ketiga skenario sudah punya angka. */
export function targetLengkap(target: TargetMargin): boolean {
  return SKENARIO_URUT.every((s) => target.get(s) !== undefined);
}
