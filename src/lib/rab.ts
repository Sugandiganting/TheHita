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
 * Jenis RAB: Purchasing, Umum, dan jenis yang ditambahkan sendiri di Master
 * Data — HR, Management.
 *
 * Bentuknya cuma dua, karena yang dianggarkan memang berbeda bentuknya.
 * Purchasing menganggarkan barang: semen berapa sak, dengan harga satuan
 * berapa. Selebihnya menganggarkan akun: gaji sebulan, listrik sebulan —
 * tidak ada satuan dan tidak ada harga satuan yang masuk akal di sana.
 * Jenis baru boleh berbentuk per barang atau per akun, dipilih saat dibuat dan
 * tidak berubah sesudahnya.
 *
 * Yang tersimpan di RAB adalah KODE-nya, bukan namanya, supaya nama boleh
 * diganti tanpa memutus RAB maupun kategori rencana kas yang sudah memakainya.
 */
export const JENIS_PURCHASING = 'PURCHASING';
export const JENIS_UMUM = 'UMUM';

/** Kode jenis RAB. Bebas, karena jenisnya bisa ditambah sendiri. */
export type JenisRab = string;

export type InfoJenisRab = {
  code: string;
  name: string;
  /** Disusun per barang (Purchasing, atau jenis tambahan yang dipilih begitu). */
  perBarang: boolean;
  /** Purchasing dan Umum: selalu ada, tidak bisa dihapus. */
  bawaan: boolean;
};

const NAMA_BAWAAN: Record<string, string> = {
  [JENIS_PURCHASING]: 'Purchasing',
  [JENIS_UMUM]: 'Umum',
};

/**
 * Apakah RAB jenis ini disusun per barang. `perBarang` adalah himpunan kode
 * jenis per barang dari master (lihat kodePerBarang); tanpa itu hanya
 * Purchasing yang dianggap per barang.
 */
export function jenisPerBarang(code: string, perBarang?: ReadonlySet<string>): boolean {
  return perBarang ? perBarang.has(code) : code === JENIS_PURCHASING;
}

/** Kode jenis yang disusun per barang, dari daftar jenis lengkap. */
export function kodePerBarang(daftar: readonly InfoJenisRab[]): Set<string> {
  return new Set(daftar.filter((j) => j.perBarang).map((j) => j.code));
}

/**
 * Daftar jenis lengkap dari baris yang tersimpan: kedua jenis bawaan selalu
 * ada dan selalu di depan — dengan nama tersimpan bila pernah diganti —
 * lalu jenis tambahan menurut abjad.
 */
export function gabungJenisRab(
  tersimpan: readonly { code: string; name: string; perBarang?: boolean }[],
): InfoJenisRab[] {
  const nama = new Map(tersimpan.map((t) => [t.code, t.name]));
  const bawaan = Object.keys(NAMA_BAWAAN).map((code) => ({
    code,
    name: nama.get(code) ?? NAMA_BAWAAN[code],
    perBarang: jenisPerBarang(code),
    bawaan: true,
  }));
  const tambahan = tersimpan
    .filter((t) => !(t.code in NAMA_BAWAAN))
    .map((t) => ({ code: t.code, name: t.name, perBarang: t.perBarang === true, bawaan: false }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return [...bawaan, ...tambahan];
}

/** Nama sebuah jenis; kodenya sendiri bila jenisnya sudah tidak terdaftar. */
export function namaJenis(daftar: readonly InfoJenisRab[], code: string): string {
  return daftar.find((j) => j.code === code)?.name ?? NAMA_BAWAAN[code] ?? code;
}

/**
 * Kode dari nama yang diketik: "Pembayaran Management" → "PEMBAYARAN_MANAGEMENT".
 * Kosong bila namanya tidak mengandung huruf atau angka sama sekali.
 */
export function kodeJenisDariNama(nama: string): string {
  return nama
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * RAB mana yang menampung akun yang terpakai tanpa pernah dianggarkan, di
 * antara RAB-RAB satu pemilik pada bulan yang sama.
 *
 * Harus tepat satu: tanpa pemilik yang pasti, akun semacam itu terhitung di
 * tiap RAB dan totalnya membengkak. Umum lebih dulu, karena memang untuk
 * itulah jenis umum; bila tidak ada, jenis per akun lain menurut kodenya;
 * Purchasing paling akhir, karena isinya barang dan bukan beban sembarang.
 */
export function pemilikSisa(jenis: readonly string[], perBarang?: ReadonlySet<string>): string | null {
  if (jenis.length === 0) return null;
  if (jenis.includes(JENIS_UMUM)) return JENIS_UMUM;
  const perAkun = jenis.filter((j) => !jenisPerBarang(j, perBarang)).sort();
  return perAkun[0] ?? jenis[0];
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
  /**
   * Perkiraan tanggal belanja, diisi selagi RAB masih draf. null berarti
   * belum ditentukan — bukan "awal bulan".
   */
  rencanaTanggal: Date | null;
  catatan: string | null;
  realisasi: RealisasiBaris;
  /** Entri realisasi: realisasi lama (bila ada) dan tiap pembayaran. */
  entri: EntriRealisasi[];
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

/**
 * Urutan bulan dari yang paling dekat dengan bulan berjalan.
 *
 *   bulan ini → bulan depan → dua bulan lagi → … → bulan lalu → dua bulan lalu → …
 *
 * Bulan yang akan datang didahulukan daripada yang sudah lewat pada jarak yang
 * sama, karena RAB yang masih bisa diubah lebih sering dicari daripada yang
 * tinggal menunggu laporan realisasinya. Mengurutkan menurut bulan saja, naik
 * atau turun, menaruh bulan ini di tengah daftar begitu RAB disusun beberapa
 * bulan ke depan — dan dua belas baris pertama jadi bulan yang belum perlu
 * disentuh.
 *
 * Periode berformat YYYY-MM, jadi membandingkannya sebagai teks sudah benar.
 */
export function bandingkanBulanTerdekat(a: string, b: string, kini: string): number {
  if (a === b) return 0;
  const aDepan = a >= kini;
  const bDepan = b >= kini;
  if (aDepan !== bDepan) return aDepan ? -1 : 1;
  // Sama-sama ke depan: yang lebih awal lebih dekat. Sama-sama lewat: yang lebih akhir.
  return aDepan ? (a < b ? -1 : 1) : (a > b ? -1 : 1);
}

/**
 * Daftar RAB diurutkan dari bulan terdekat, lalu pemilik, lalu jenis — urutan
 * yang sama di dalam satu bulan seperti sebelumnya. Tidak mengubah daftar asal.
 */
export function urutkanRabTerdekat<T extends { period: string; scope: string; kind: string }>(
  daftar: readonly T[],
  kini: string,
): T[] {
  return [...daftar].sort((x, y) =>
    bandingkanBulanTerdekat(x.period, y.period, kini)
    || x.scope.localeCompare(y.scope)
    || x.kind.localeCompare(y.kind));
}

/**
 * Apakah catatan sebuah baris RAB umum cukup untuk membedakannya dari baris
 * lain yang memakai akun yang sama. null bila cukup; selain itu alasannya.
 *
 * Satu akun boleh dianggarkan beberapa kali — Neuviz, Guestpro dan STAAH
 * sama-sama Biaya Software dan Langganan — tetapi hanya catatannya yang
 * membedakan baris-baris itu, saat diubah, saat realisasinya dilaporkan, dan
 * saat dibaca di rancangan kas. Dua baris yang tidak bisa dibedakan bukan dua
 * tagihan, melainkan satu tagihan yang tercatat dua kali.
 *
 * `lainnya` adalah catatan baris lain di RAB yang sama dengan akun yang sama,
 * tidak termasuk baris yang sedang disimpan.
 */
export function cekCatatanAkunGanda(
  lainnya: readonly (string | null)[],
  catatan: string,
  namaAkun: string,
): string | null {
  if (lainnya.length === 0) return null;
  const bersih = catatan.trim();
  if (!bersih) {
    return `${namaAkun} sudah ada di RAB ini. Isi catatan untuk membedakannya — `
      + 'misalnya nama tagihannya: Neuviz, Guestpro.';
  }
  const kunci = bersih.toLocaleLowerCase('id-ID');
  if (lainnya.some((c) => (c ?? '').trim().toLocaleLowerCase('id-ID') === kunci)) {
    return `${namaAkun} dengan catatan "${bersih}" sudah ada di RAB ini. `
      + 'Ubah baris yang ada, atau beri catatan yang berbeda.';
  }
  return null;
}

/**
 * Anggaran RAB umum di tingkat akun: baris-baris yang memakai akun yang sama
 * dijumlahkan. Tingkat inilah yang bisa dibandingkan dengan jurnal, karena
 * jurnal hanya mencatat akunnya — bukan tagihan mana yang dimaksud.
 */
export function anggaranAkunDariBaris<T extends { accountId: string; amount: number }>(
  baris: readonly T[],
  info: (b: T) => { code: string; name: string },
  pembulatan: (n: number) => number = (n) => n,
): Map<string, { code: string; name: string; anggaran: number }> {
  const hasil = new Map<string, { code: string; name: string; anggaran: number }>();
  for (const b of baris) {
    const cur = hasil.get(b.accountId);
    if (cur) cur.anggaran = pembulatan(cur.anggaran + b.amount);
    else hasil.set(b.accountId, { ...info(b), anggaran: b.amount });
  }
  return hasil;
}

/** Batas salin RAB sekaligus. Lebih dari dua tahun hampir pasti salah ketik tahun. */
export const MAKS_BULAN_SALIN = 24;

/**
 * Bulan-bulan sesudah `dari` sampai `sampai`, keduanya "YYYY-MM":
 * deretBulanSesudah('2026-11', '2027-02') → ['2026-12', '2027-01', '2027-02'].
 * Kosong bila `sampai` tidak sesudah `dari`.
 */
export function deretBulanSesudah(dari: string, sampai: string): string[] {
  const hasil: string[] = [];
  let p = dari;
  while (hasil.length <= MAKS_BULAN_SALIN) {
    p = periodeBerikutnya(p);
    if (p > sampai) break;
    hasil.push(p);
  }
  return hasil;
}

/**
 * Apa yang terjadi pada satu bulan tujuan saat RAB disalin.
 *
 * Menimpa hanya boleh atas RAB yang masih bisa diubah tangan sendiri: draf,
 * dan belum pernah dilaporkan realisasinya. RAB yang disahkan terkunci justru
 * supaya angkanya tidak berubah diam-diam; realisasi yang sudah dicatat adalah
 * kenyataan, dan menimpa barisnya ikut menghapus kenyataan itu.
 */
export type NasibSalin = 'buat' | 'timpa' | 'lewat-ada' | 'lewat-disahkan' | 'lewat-realisasi';

export function nasibBulanSalin(
  tujuan: { status: string; adaRealisasi: boolean } | null,
  timpa: boolean,
): NasibSalin {
  if (!tujuan) return 'buat';
  if (!timpa) return 'lewat-ada';
  if (tujuan.status === 'ACTIVE') return 'lewat-disahkan';
  if (tujuan.adaRealisasi) return 'lewat-realisasi';
  return 'timpa';
}

/**
 * Perkiraan tanggal belanja yang dipindah ke bulan lain saat RAB disalin:
 * tanggal yang sama di bulan tujuan, atau hari terakhir bulan itu bila
 * tanggalnya tidak ada — tagihan tanggal 31 Januari jatuh 28 Februari, bukan
 * melompat ke awal Maret. Null tetap null: yang belum bertanggal tidak diberi
 * tanggal tebakan.
 */
export function geserTanggalKeBulan(tanggal: Date | null, period: string): Date | null {
  if (!tanggal) return null;
  const [tahun, bulan] = period.split('-').map(Number);
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  return new Date(Date.UTC(tahun, bulan - 1, Math.min(tanggal.getUTCDate(), hariTerakhir)));
}

/**
 * Rekap anggaran per jenis RAB per bulan, untuk tabel ringkasan di Input RAB.
 *
 * Baris mengikuti urutan `urutanJenis` (Purchasing, Umum, lalu jenis tambahan);
 * jenis yang tidak punya RAB sama sekali dilewati. Bulan diurutkan dari yang
 * terlama, karena tabel dibaca dari kiri ke kanan seperti kalender.
 */
export function rekapJenisPerBulan(
  daftar: readonly { kind: string; period: string; totalAnggaran: number }[],
  urutanJenis: readonly string[],
): {
  bulan: string[];
  baris: { kind: string; perBulan: Map<string, { anggaran: number; jumlah: number }>; total: number }[];
  totalBulan: Map<string, number>;
  total: number;
} {
  const bulan = [...new Set(daftar.map((r) => r.period))].sort();
  const jenisAda = new Set(daftar.map((r) => r.kind));
  const urut = [
    ...urutanJenis.filter((k) => jenisAda.has(k)),
    ...[...jenisAda].filter((k) => !urutanJenis.includes(k)).sort(),
  ];
  const bulat = (n: number) => Math.round(n * 100) / 100;
  const baris = urut.map((kind) => {
    const perBulan = new Map<string, { anggaran: number; jumlah: number }>();
    for (const r of daftar) {
      if (r.kind !== kind) continue;
      const cur = perBulan.get(r.period) ?? { anggaran: 0, jumlah: 0 };
      perBulan.set(r.period, { anggaran: bulat(cur.anggaran + r.totalAnggaran), jumlah: cur.jumlah + 1 });
    }
    return { kind, perBulan, total: bulat([...perBulan.values()].reduce((t, v) => t + v.anggaran, 0)) };
  });
  const totalBulan = new Map(bulan.map((p) => [
    p, bulat(daftar.filter((r) => r.period === p).reduce((t, r) => t + r.totalAnggaran, 0)),
  ]));
  return { bulan, baris, totalBulan, total: bulat(baris.reduce((t, b) => t + b.total, 0)) };
}

/* ------------------------------------------------------------------ */
/* Realisasi per pembayaran — logika yang sama dengan item proyek      */
/* ------------------------------------------------------------------ */

export type PembayaranRab = {
  id?: string;
  date: Date;
  amount: number;
  /** Qty yang dibeli; hanya RAB per barang, boleh kosong untuk DP. */
  quantity: number | null;
  note: string | null;
};

/**
 * Realisasi lama: satu isian per baris yang dulu diketik dan ditimpa. Tetap
 * dihitung sebagai entri pertama, supaya data lama tidak hilang ketika
 * pembayaran berikutnya dicatat.
 */
export type RealisasiLama = {
  nilai: number | null;
  quantity: number | null;
  unitPrice: number | null;
  tanggal: Date | null;
  catatan: string | null;
};

const bulat2 = (n: number) => Math.round(n * 100) / 100;
const hariKe = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * Realisasi satu baris RAB dari realisasi lama dan pembayaran-pembayarannya.
 *
 * - nilai: jumlah seluruhnya; null selama belum ada apa pun dan belum selesai.
 *   Baris yang ditandai selesai tanpa pembayaran bernilai 0 — tidak jadi
 *   dibelanjakan, dan seluruh anggarannya menjadi hemat.
 * - quantity: jumlah qty dari entri yang mencatatnya; null bila tidak ada.
 * - unitPrice: harga rata-rata nyata (nilai ÷ qty) bila qty diketahui.
 * - tanggal: pembayaran terakhir.
 */
export function susunRealisasi(
  lama: RealisasiLama,
  pembayaran: readonly PembayaranRab[],
  selesai: boolean,
): RealisasiBaris {
  const adaLama = lama.nilai !== null;
  if (!adaLama && pembayaran.length === 0) {
    return { quantity: null, unitPrice: null, tanggal: null, selesai, catatan: lama.catatan, nilai: selesai ? 0 : null };
  }
  const nilai = bulat2((lama.nilai ?? 0) + pembayaran.reduce((t, p) => t + p.amount, 0));
  const qtyAda = [
    ...(adaLama && lama.quantity !== null ? [lama.quantity] : []),
    ...pembayaran.filter((p) => p.quantity !== null).map((p) => p.quantity as number),
  ];
  const quantity = qtyAda.length > 0 ? bulat2(qtyAda.reduce((t, q) => t + q, 0)) : null;
  const tanggalSemua = [
    ...(adaLama && lama.tanggal ? [lama.tanggal] : []),
    ...pembayaran.map((p) => p.date),
  ];
  const tanggal = tanggalSemua.length > 0
    ? tanggalSemua.reduce((a, b) => (b.getTime() > a.getTime() ? b : a))
    : null;
  return {
    quantity,
    unitPrice: quantity !== null && quantity > 0
      ? (pembayaran.length === 0 && lama.unitPrice !== null ? lama.unitPrice : bulat2(nilai / quantity))
      : null,
    tanggal,
    selesai,
    catatan: lama.catatan ?? pembayaran[pembayaran.length - 1]?.note ?? null,
    nilai,
  };
}

/**
 * Bagian realisasi yang belum tercermin di saldo posisi kas: pembayaran yang
 * tanggalnya sesudah tanggal posisi kas. Yang sebelum atau pada tanggal itu
 * sudah ada di saldo, jadi tidak boleh dikurangkan lagi. Realisasi lama tanpa
 * tanggal tidak diketahui kapan keluarnya, dan dianggap belum tercermin —
 * sama seperti sebelum aturan ini ada.
 */
export function realisasiSesudahPosisi(
  lama: Pick<RealisasiLama, 'nilai' | 'tanggal'>,
  pembayaran: readonly Pick<PembayaranRab, 'date' | 'amount'>[],
  posisi: Date | null,
): number {
  if (posisi === null) {
    return bulat2((lama.nilai ?? 0) + pembayaran.reduce((t, p) => t + p.amount, 0));
  }
  const batas = hariKe(posisi);
  let total = 0;
  if (lama.nilai !== null && !(lama.tanggal && hariKe(lama.tanggal) <= batas)) total += lama.nilai;
  for (const p of pembayaran) if (hariKe(p.date) > batas) total += p.amount;
  return bulat2(total);
}

/** Realisasi lama baris RAB per akun, dari kolom real* yang dulu diketik sekali. */
export function lamaAkun(l: { realAmount: number | null; realDate: Date | null; realNotes: string | null }): RealisasiLama {
  return { nilai: l.realAmount, quantity: null, unitPrice: null, tanggal: l.realDate, catatan: l.realNotes };
}

/** Realisasi lama baris RAB per barang: jumlah × harga satuan, null bila separuh terisi. */
export function lamaBarang(l: {
  realQuantity: number | null; realUnitPrice: number | null; realDate: Date | null; realNotes: string | null;
}): RealisasiLama {
  const lengkap = l.realQuantity !== null && l.realUnitPrice !== null;
  return {
    nilai: lengkap ? bulat2((l.realQuantity as number) * (l.realUnitPrice as number)) : null,
    quantity: lengkap ? l.realQuantity : null,
    unitPrice: lengkap ? l.realUnitPrice : null,
    tanggal: l.realDate,
    catatan: l.realNotes,
  };
}

export type EntriRealisasi = {
  /** null untuk realisasi lama — dihapus lewat aksinya sendiri. */
  id: string | null;
  tanggal: Date | null;
  amount: number;
  quantity: number | null;
  note: string | null;
  lama: boolean;
};

/** Daftar entri realisasi untuk ditampilkan: realisasi lama (bila ada) lalu tiap pembayaran. */
export function entriRealisasi(lama: RealisasiLama, pembayaran: readonly PembayaranRab[]): EntriRealisasi[] {
  return [
    ...(lama.nilai !== null
      ? [{ id: null, tanggal: lama.tanggal, amount: lama.nilai, quantity: lama.quantity, note: lama.catatan, lama: true }]
      : []),
    ...pembayaran.map((p) => ({
      id: p.id ?? null, tanggal: p.date, amount: p.amount, quantity: p.quantity, note: p.note, lama: false,
    })),
  ];
}
