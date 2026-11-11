/**
 * Membaca master barang dari lembar Excel menjadi barang yang siap disimpan.
 *
 * Dipisah dari skripnya supaya bisa diuji tanpa berkas dan tanpa basis data.
 * Yang dikerjakan di sini hanya hal yang bisa diputuskan dari isi lembarnya
 * sendiri: membakukan ejaan, mencocokkan nama akun dengan bagan akun yang ada,
 * dan menemukan tabrakan kode. Penyimpanannya di `scripts/impor-barang.ts`.
 *
 * Satu hal yang TIDAK dikerjakan di sini: menebak. Nama akun yang tidak cocok
 * tidak dipaksakan ke akun terdekat — ia dilaporkan beserta kandidatnya, dan
 * impornya berhenti. Barang yang masuk dengan akun yang salah tidak kelihatan
 * salah sampai laporan bulan itu dibaca kembali.
 */

import { normalKode, normalNama, periksaKodeNama } from './barang';

/* ------------------------------------------------------------------ akun */

export type AkunRingkas = { id: string; code: string; name: string };

/**
 * Membakukan nama akun untuk dicocokkan.
 *
 * "&" dan "dan" dipakai bergantian di dua tempat yang sama — lembarnya menulis
 * "Biaya Peralatan & Perlengkapan FO", aplikasinya "Biaya Peralatan dan
 * Perlengkapan FO" — dan keduanya memang akun yang sama.
 */
export function normalAkun(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nama akun di lembar yang sudah diputuskan menunjuk akun mana.
 *
 * Dibutuhkan karena penamaan di lembar membawa DEPARTEMEN dan kadang UNIT
 * USAHA di belakangnya ("Biaya Gas HK", "Biaya Air Isi Ulang IGYT"), sedangkan
 * bagan akun hanya memisahkan departemen bila biayanya memang dikelola
 * terpisah. Yang memisahkan laporan IGYT dari laporan hotel bukan akunnya,
 * melainkan kolom cabang pada tiap jurnal — jadi akhiran unit usaha dilipat ke
 * akun yang sama.
 *
 * Tiap baris adalah keputusan akuntansi, bukan kecocokan huruf. Kalau ada yang
 * mau diubah, inilah tempatnya; satu barang saja bisa juga diubah langsung di
 * menu Master Barang.
 */
export const ALIAS_AKUN: Record<string, string> = {
  // Air isi ulang — satu akun untuk semuanya. Akhiran HK dan IGYT di lembar
  // adalah departemen dan unit usaha, bukan dua jenis biaya.
  'biaya air isi ulang hk': '6160.05',
  'biaya air isi ulang igyt': '6160.05',

  // Amenities: nama di aplikasi lebih panjang, isinya sama persis — dental
  // kit, shower cap, kopi dan teh sachet untuk kamar.
  'biaya amenities': '6150.02',

  // "Biaya Chemical" di lembar hanya dipakai delapan barang House Keeping:
  // parfum ruangan, pembersih kaca/lantai/kerak, Go Getter, 3M, Baygon, kamper.
  'biaya chemical': '6150.03',

  // Detergen, softener, pemutih, acid final rinse, parfum, oxyboost.
  'biaya chemical laundry': '6170.01',

  // "Cleaning & Supplies" di lembar isinya barang habis pakai kamar: tisu
  // toilet dan facial, plastik sampah, sampo, handwash, shower gel, sabun cuci
  // piring, pewangi Stella. Rumahnya Room Supplies.
  'biaya cleaning dan supplies': '6150.05',

  // Gas IGYT adalah gas dapur IGYT; cabangnya yang membedakannya dari dapur
  // hotel, bukan akunnya.
  'biaya gas igyt': '6160.02',

  // Gas laundry 3 kg — di aplikasi tabung gas punya akunnya sendiri.
  'biaya gas laundry': '6160.06',

  // Tisu, plastik cup dan take away, box ivory, cup saus, sponge, plastik
  // sampah — semuanya packaging dan perlengkapan jualan.
  'biaya supplies dan packaging igyt': '6190.04',

  // Isolasi, plastik 5–20 kg, tali rafia, nota 3 ply.
  'biaya supplies laundry': '6170.02',
};

/* ------------------------------------------------------- kode yang diperbaiki */

export type PerbaikanKode = {
  /** Kode di lembarnya. */
  kode: string;
  /** Nama barang yang kodenya diganti — yang satunya tetap memakai kode lama. */
  nama: string;
  jadi: string;
  alasan: string;
};

/**
 * Kode yang diperbaiki saat dibaca.
 *
 * Satu kode yang menunjuk dua barang berbeda tidak bisa masuk apa adanya, dan
 * memperbaikinya di lembar Excel-nya berarti perbaikan itu hilang begitu
 * lembarnya dikirim ulang. Jadi perbaikannya ditulis di sini: terbaca, tercatat
 * alasannya, dan ikut dilaporkan tiap kali impor dijalankan.
 *
 * Padanannya dicari dari kode DAN nama, jadi aturan yang sudah tidak terpakai —
 * karena lembarnya sendiri sudah diperbaiki — tidak mengubah apa pun.
 */
export const KODE_DIPERBAIKI: PerbaikanKode[] = [
  {
    kode: 'BO-001',
    nama: 'Listrik Office',
    jadi: 'BO-002',
    alasan: 'BO-001 dipakai untuk dua barang sekaligus di Back Office, "HVS" dan "Listrik Office"; '
      + 'lembarnya sendiri sudah menandainya "perlu kode baru". HVS yang memegang BO-001 karena '
      + 'ia barang kantor, dan token listrik mendapat kode berikutnya.',
  },
];

export type HasilAkun =
  | { ok: true; akun: AkunRingkas; lewatAlias: boolean }
  | { ok: false; kandidat: AkunRingkas[] };

/** Kata yang muncul di hampir semua nama akun, jadi tidak menandakan kedekatan. */
const KATA_UMUM = new Set(['biaya', 'dan', 'persediaan', 'hpp']);

const kata = (s: string): string[] =>
  normalAkun(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !KATA_UMUM.has(w));

/**
 * Mencari akun yang dimaksud satu nama di lembar.
 *
 * Tiga lapis, dari yang paling tegas: nama yang sama setelah dibakukan, lalu
 * tabel alias di atas, lalu — kalau dua-duanya gagal — menyerah dan
 * menyodorkan kandidat terdekat supaya orangnya yang memutuskan.
 */
export function cocokkanAkun(namaLembar: string, daftar: AkunRingkas[]): HasilAkun {
  const cari = normalAkun(namaLembar);

  const persis = daftar.find((a) => normalAkun(a.name) === cari);
  if (persis) return { ok: true, akun: persis, lewatAlias: false };

  const kodeAlias = ALIAS_AKUN[cari];
  if (kodeAlias) {
    const akun = daftar.find((a) => a.code === kodeAlias);
    // Alias yang menunjuk akun yang sudah tidak ada lebih berbahaya daripada
    // nama yang tak dikenal: yang satu menolak, yang lain diam-diam salah.
    if (akun) return { ok: true, akun, lewatAlias: true };
  }

  const kunci = kata(namaLembar);
  const nilai = (a: AkunRingkas) => {
    const punya = new Set(kata(a.name));
    return kunci.filter((w) => punya.has(w)).length;
  };
  const kandidat = daftar
    .map((a) => ({ a, n: nilai(a) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n || x.a.code.localeCompare(y.a.code))
    .slice(0, 5)
    .map((x) => x.a);

  return { ok: false, kandidat };
}

/* ------------------------------------------------------- departemen & satuan */

/**
 * Kode departemen, dibuat sama dengan awalan kode barangnya sendiri: barang
 * HK-012 berada di departemen HK. Yang tidak ada di tabel ini memakai namanya
 * sebagai kode.
 */
export const KODE_DEPARTEMEN: Record<string, string> = {
  'back office': 'BO',
  engineering: 'ENG',
  'front office': 'FO',
  'house keeping': 'HK',
  igyt: 'IGYT',
  laundry: 'LDR',
  operational: 'OPS',
};

/** Nama panjang satuan yang di lembarnya ditulis singkat. */
export const NAMA_SATUAN: Record<string, string> = {
  BTL: 'Botol',
  DR: 'Drum',
  GAL: 'Galon',
  KG: 'Kilogram',
  MONTH: 'Bulan',
  PCS: 'Pieces',
};

export const kodeDepartemen = (nama: string): string =>
  KODE_DEPARTEMEN[nama.trim().toLowerCase()] ?? normalKode(nama);

export const namaSatuan = (kode: string): string => NAMA_SATUAN[kode] ?? kode;

/* ------------------------------------------------------------------ lembar */

/** Satu baris mentah dari lembar, apa adanya. */
export type BarisLembar = {
  /**
   * Nomor barisnya di Excel — supaya pesan kesalahan bisa ditunjuk langsung.
   * 0 berarti barang itu bukan dari lembarnya, melainkan dari BARANG_TAMBAHAN.
   */
  baris: number;
  code: string;
  name: string;
  unit: string;
  kategori: string;
  sub: string;
  coa: string;
  catatan: string;
};

/** Satu barang yang ejaannya sudah dibakukan dan siap disimpan. */
export type BarangSiap = {
  baris: number;
  code: string;
  name: string;
  katKode: string;
  katNama: string;
  subKode: string;
  subNama: string;
  satKode: string;
  satNama: string;
  coa: string;
  catatan: string;
};

export type HasilLembar = {
  barang: BarangSiap[];
  /** Yang membuat impornya berhenti. Kosong berarti seluruh lembar sah. */
  masalah: string[];
  /** Perbaikan kode yang sungguh terpakai pada lembar ini. */
  terpakai: PerbaikanKode[];
};

const kunciBarang = (b: BarangSiap) => `${b.katKode}|${b.subKode}|${b.code}`;

const asal = (baris: number) => (baris === 0 ? 'barang tambahan' : `baris ${baris}`);

/**
 * Barang yang lembarnya sebut tetapi tidak punya barisnya sendiri.
 *
 * Lembarnya menyimpan satu baris per kode, jadi satu kode yang dipakai dua
 * departemen dengan akun yang BERBEDA hanya muncul sekali — yang dipakai
 * mayoritas cabang — dan pemakaian departemen lainnya cuma tercatat di kolom
 * Catatan. Padahal itu barang tersendiri: satuannya lain, akunnya lain, dan
 * tanpa barisnya sendiri departemen itu tidak punya barang untuk dipilih saat
 * menyusun RAB.
 *
 * Yang masuk ke sini HANYA bila akunnya sungguh berbeda. Catatan yang cuma
 * menyebut "Department berbeda" tanpa "COA berbeda" tidak perlu barang kedua:
 * akunnya sama, dan yang memisahkan laporan tiap cabang adalah kolom cabang
 * pada jurnalnya.
 */
export const BARANG_TAMBAHAN: Omit<BarisLembar, 'baris'>[] = [
  {
    code: 'HK-012',
    name: 'Sabun Cuci Piring',
    unit: 'Pack',
    kategori: 'OPEX',
    sub: 'IGYT',
    coa: 'Biaya Supplies & Packaging IGYT',
    catatan: 'Pemakaian IGYT atas HK-012. Di House Keeping sabun ini masuk Cleaning & Supplies '
      + 'dengan satuan Dr; di IGYT masuk Supplies & Packaging dengan satuan Pack.',
  },
  {
    code: 'FO-005',
    name: 'Buku Log Book',
    unit: 'Pcs',
    kategori: 'OPEX',
    sub: 'Laundry',
    coa: 'Biaya Supplies Laundry',
    catatan: 'Pemakaian Play Laundry atas FO-005. Di Front Office buku ini masuk Peralatan & '
      + 'Perlengkapan FO; di Laundry masuk Supplies Laundry.',
  },

  /*
   * Lima alat kebersihan di bawah ini muncul di template RAB Des 2026 – Jul
   * 2027 untuk Uluwatu, Legian dan SRK, tetapi belum sempat masuk lembar
   * master. Tanpa barisnya di sini, RAB ketiga cabang itu tidak bisa diimpor
   * utuh — dan yang paling berbahaya bukan impor yang berhenti, melainkan
   * impor yang jalan sambil diam-diam meninggalkan lima barang.
   */
  { code: 'HK-031', name: 'Sapu', unit: 'Pcs', kategori: 'OPEX', sub: 'House Keeping',
    coa: 'Biaya Peralatan dan Perlengkapan HK', catatan: 'Dari template RAB 2026–2027.' },
  { code: 'HK-032', name: 'Sapu Lidi', unit: 'Pcs', kategori: 'OPEX', sub: 'House Keeping',
    coa: 'Biaya Peralatan dan Perlengkapan HK', catatan: 'Dari template RAB 2026–2027.' },
  { code: 'HK-033', name: 'Pengki', unit: 'Pcs', kategori: 'OPEX', sub: 'House Keeping',
    coa: 'Biaya Peralatan dan Perlengkapan HK', catatan: 'Dari template RAB 2026–2027.' },
  { code: 'HK-034', name: 'Pel', unit: 'Pcs', kategori: 'OPEX', sub: 'House Keeping',
    coa: 'Biaya Peralatan dan Perlengkapan HK', catatan: 'Dari template RAB 2026–2027.' },
  { code: 'HK-035', name: 'Squeeze', unit: 'Pcs', kategori: 'OPEX', sub: 'House Keeping',
    coa: 'Biaya Peralatan dan Perlengkapan HK', catatan: 'Dari template RAB 2026–2027.' },
];

/**
 * Membakukan seluruh lembar dan memeriksanya sebagai satu kesatuan.
 *
 * Yang hanya bisa dilihat dari seluruh lembar sekaligus adalah tabrakan: satu
 * kode dipakai dua barang yang berbeda di departemen yang sama. Di data yang
 * ada hal itu sungguh terjadi — BO-001 dipakai untuk "HVS" dan "Listrik
 * Office" — dan lembarnya sendiri sudah menandainya "perlu kode baru".
 *
 * Tabrakan membuat seluruh impor berhenti, bukan hanya baris itu yang
 * dilewati. Barang yang diam-diam tidak masuk tidak akan ketahuan sampai
 * seseorang mencarinya saat menyusun RAB dan menyangka ia belum pernah
 * didaftarkan.
 */
export function siapkanLembar(baris: BarisLembar[]): HasilLembar {
  const masalah: string[] = [];
  const barang: BarangSiap[] = [];
  const terpakai: PerbaikanKode[] = [];

  const tambahan: BarisLembar[] = BARANG_TAMBAHAN.map((t) => ({ ...t, baris: 0 }));
  for (const b of [...baris, ...tambahan]) {
    const bentuk = periksaKodeNama(b.code, b.name);
    if (bentuk) {
      masalah.push(`${asal(b.baris)} (${b.code || 'kode kosong'}): ${bentuk}`);
      continue;
    }
    if (!b.kategori.trim()) {
      masalah.push(`${asal(b.baris)} (${b.code}): kolom Category kosong.`);
      continue;
    }
    if (!b.sub.trim()) {
      masalah.push(`${asal(b.baris)} (${b.code}): kolom Sub Category kosong — `
        + 'di situlah departemen yang menentukan akun bebannya.');
      continue;
    }
    if (!b.unit.trim()) {
      masalah.push(`${asal(b.baris)} (${b.code}): kolom Unit kosong.`);
      continue;
    }
    if (!b.coa.trim()) {
      masalah.push(`${asal(b.baris)} (${b.code}): kolom COA kosong.`);
      continue;
    }

    const satKode = normalKode(b.unit);
    const kodeAsli = normalKode(b.code);
    const namaBaku = normalNama(b.name);
    const perbaikan = KODE_DIPERBAIKI.find(
      (k) => normalKode(k.kode) === kodeAsli && normalNama(k.nama).toLowerCase() === namaBaku.toLowerCase(),
    );
    if (perbaikan) terpakai.push(perbaikan);

    barang.push({
      baris: b.baris,
      code: perbaikan ? normalKode(perbaikan.jadi) : kodeAsli,
      name: namaBaku,
      katKode: normalKode(b.kategori),
      katNama: normalNama(b.kategori),
      subKode: kodeDepartemen(b.sub),
      subNama: normalNama(b.sub),
      satKode,
      satNama: namaSatuan(satKode),
      coa: normalNama(b.coa),
      catatan: normalNama(b.catatan),
    });
  }

  masalah.push(...tabrakanKode(barang), ...tabrakanNama(barang));
  return { barang, masalah, terpakai };
}

function tabrakanKode(barang: BarangSiap[]): string[] {
  const peta = new Map<string, BarangSiap[]>();
  for (const b of barang) {
    const k = kunciBarang(b);
    peta.set(k, [...(peta.get(k) ?? []), b]);
  }
  const pesan: string[] = [];
  for (const [, kumpulan] of peta) {
    if (kumpulan.length < 2) continue;
    const [awal] = kumpulan;
    const beda = kumpulan.filter((b) => b.name !== awal.name);
    if (beda.length === 0) continue; // baris kembar persis — tidak apa-apa
    pesan.push(
      `Kode ${awal.code} dipakai ${kumpulan.length} barang berbeda di ${awal.katKode} / ${awal.subNama}: `
      + kumpulan.map((b) => `"${b.name}" (${asal(b.baris)})`).join(' dan ')
      + '. Satu kode hanya boleh menunjuk satu barang di dalam satu departemen, karena kodelah yang '
      + 'dipakai menjumlahkan pemakaiannya. Beri salah satunya kode baru di lembarnya, lalu ulangi.',
    );
  }
  return pesan;
}

function tabrakanNama(barang: BarangSiap[]): string[] {
  const peta = new Map<string, BarangSiap[]>();
  for (const b of barang) {
    const k = `${b.katKode}|${b.subKode}|${b.name.toLowerCase()}`;
    peta.set(k, [...(peta.get(k) ?? []), b]);
  }
  const pesan: string[] = [];
  for (const [, kumpulan] of peta) {
    if (kumpulan.length < 2) continue;
    const [awal] = kumpulan;
    if (kumpulan.every((b) => b.code === awal.code)) continue;
    pesan.push(
      `Nama "${awal.name}" dipakai ${kumpulan.length} kode berbeda di ${awal.katKode} / ${awal.subNama}: `
      + kumpulan.map((b) => `${b.code} (${asal(b.baris)})`).join(' dan ')
      + '. Penyusun RAB memilih barang dari namanya, jadi dua nama yang sama akan membuatnya '
      + 'memilih yang keliru tanpa ada yang terlihat salah.',
    );
  }
  return pesan;
}

/**
 * Catatan "COA berbeda" dibaca jadi bagian-bagiannya.
 *
 * Lembarnya menulis perbedaan antar cabang dalam satu bentuk yang tetap:
 * "COA berbeda: <akun lain> di <cabang> (dipakai: <akun yang dipakai>)".
 * Dibaca di sini supaya tiap perbedaan bisa diperiksa satu-satu — mana yang
 * sudah punya barang tersendiri di BARANG_TAMBAHAN, dan mana yang belum dan
 * karena itu masih menunggu keputusan orang.
 *
 * Catatan yang hanya menyebut "Department berbeda" tidak menghasilkan apa pun:
 * akunnya sama, jadi tidak ada yang perlu diputuskan.
 */
export function coaBerbeda(catatan: string): { lain: string; cabang: string; dipakai: string } | null {
  const m = /COA berbeda:\s*(.+?)\s+di\s+(.+?)\s*\(dipakai:\s*(.+?)\)/i.exec(catatan);
  if (!m) return null;
  return { lain: normalNama(m[1]), cabang: normalNama(m[2]), dipakai: normalNama(m[3]) };
}

/** Barang yang satu-satunya dari sekumpulan baris kembar persis. */
export function tanpaKembar(barang: BarangSiap[]): BarangSiap[] {
  const sudah = new Set<string>();
  return barang.filter((b) => {
    const k = `${kunciBarang(b)}|${b.name.toLowerCase()}`;
    if (sudah.has(k)) return false;
    sudah.add(k);
    return true;
  });
}
