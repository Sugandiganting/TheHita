/**
 * Aturan sah untuk master barang.
 *
 * Dipisah dari aksi server supaya bisa diuji tanpa basis data, dan supaya
 * aturan yang sama dipakai di mana pun barang disimpan — nanti Receiving dan
 * Issuing memakainya juga.
 */

/** Kode selalu huruf besar tanpa spasi: "chem 01" dan "CHEM-01" bukan dua barang. */
export function normalKode(teks: string): string {
  return teks.trim().toUpperCase().replace(/\s+/g, '-');
}

/** Nama dirapikan spasinya saja — hurufnya milik yang mengetik. */
export function normalNama(teks: string): string {
  return teks.trim().replace(/\s+/g, ' ');
}

const POLA_KODE = /^[A-Z0-9][A-Z0-9._-]{0,31}$/;

/**
 * Memeriksa bentuk kode dan namanya saja — bagian yang tidak perlu tahu id apa
 * pun. Dipisah supaya perintah impor memakai aturan yang sama persis dengan
 * formulir di layar: kalau yang satu diperlonggar, yang lain ikut.
 */
export function periksaKodeNama(kodeMentah: string, namaMentah: string): string | null {
  const code = normalKode(kodeMentah);
  const name = normalNama(namaMentah);

  if (!code) return 'Kode barang wajib diisi.';
  if (!POLA_KODE.test(code)) {
    return 'Kode barang: 1–32 karakter, huruf/angka/titik/garis bawah/strip, diawali huruf atau angka.';
  }
  if (!name) return 'Nama barang wajib diisi.';
  if (name.length > 120) return 'Nama barang terlalu panjang, maksimal 120 karakter.';
  return null;
}

export type MasukanItem = {
  code: string;
  name: string;
  categoryId: string;
  subCategoryId: string;
  unitId: string;
  accountId: string;
};

/**
 * Memeriksa satu item. Mengembalikan pesan yang bisa langsung dibaca
 * penggunanya, atau null bila tidak ada yang salah.
 *
 * Yang TIDAK diperiksa di sini: kembar dengan item lain. Itu hanya bisa
 * dijawab basis data, dan menjawabnya di sini berarti membaca lalu menulis —
 * dua langkah yang di antaranya orang lain bisa menyelipkan item yang sama.
 */
export function periksaItem(m: MasukanItem): string | null {
  const bentuk = periksaKodeNama(m.code, m.name);
  if (bentuk) return bentuk;

  if (!m.categoryId) return 'Kategori wajib dipilih — kategori yang menentukan boleh tidaknya kode ini dipakai ulang.';
  if (!m.subCategoryId) {
    return 'Sub kategori wajib dipilih — di situlah departemen pemakainya, dan departemenlah '
      + 'yang menentukan akun beban barang ini. Satu kode yang dipakai dua departemen '
      + 'didaftarkan dua kali, masing-masing di sub kategorinya sendiri.';
  }
  if (!m.unitId) return 'Satuan wajib dipilih.';
  if (!m.accountId) return 'Akun COA wajib dipilih — itu yang menentukan barang ini dibebankan ke mana.';
  return null;
}

/**
 * Pesan untuk pelanggaran keunikan dari basis data.
 *
 * Prisma hanya menyebut nama kolomnya, dan "Unique constraint failed on the
 * fields: (categoryId, subCategoryId, code)" tidak memberi tahu penggunanya
 * apa yang harus diperbaiki. Yang perlu disebut: kembarnya di kategori dan sub
 * kategori mana, dan bahwa sub kategori lain justru boleh.
 */
export function pesanKembar(
  kolom: readonly string[],
  tempat: { kategori: string; sub: string },
  nilai: { code: string; name: string },
): string {
  const di = `${tempat.kategori} / ${tempat.sub}`;
  if (kolom.includes('code')) {
    return `Kode "${nilai.code}" sudah dipakai di ${di}. `
      + 'Kode yang sama boleh dipakai di sub kategori lain — justru begitulah satu kode yang '
      + 'dibeli dua departemen didaftarkan — tetapi tidak dua kali di sub kategori yang sama.';
  }
  if (kolom.includes('name')) {
    return `Nama "${nilai.name}" sudah ada di ${di}. `
      + 'Dua barang bernama sama dalam satu sub kategori akan membuat penyusun RAB memilih yang '
      + 'keliru tanpa ada yang terlihat salah.';
  }
  return 'Data ini sudah ada.';
}
