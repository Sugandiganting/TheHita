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

export type MasukanItem = {
  code: string;
  name: string;
  categoryId: string;
  subCategoryId: string | null;
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
  const code = normalKode(m.code);
  const name = normalNama(m.name);

  if (!code) return 'Kode barang wajib diisi.';
  if (!POLA_KODE.test(code)) {
    return 'Kode barang: 1–32 karakter, huruf/angka/titik/garis bawah/strip, diawali huruf atau angka.';
  }
  if (!name) return 'Nama barang wajib diisi.';
  if (name.length > 120) return 'Nama barang terlalu panjang, maksimal 120 karakter.';
  if (!m.categoryId) return 'Kategori wajib dipilih — kategori yang menentukan boleh tidaknya kode ini dipakai ulang.';
  if (!m.unitId) return 'Satuan wajib dipilih.';
  if (!m.accountId) return 'Akun COA wajib dipilih — itu yang menentukan barang ini dibebankan ke mana.';
  return null;
}

/**
 * Pesan untuk pelanggaran keunikan dari basis data.
 *
 * Prisma hanya menyebut nama kolomnya, dan "Unique constraint failed on the
 * fields: (categoryId, code)" tidak memberi tahu penggunanya apa yang harus
 * diperbaiki. Yang perlu disebut: kembarnya di kategori mana, dan bahwa
 * kategori lain justru boleh.
 */
export function pesanKembar(
  kolom: readonly string[],
  namaKategori: string,
  nilai: { code: string; name: string },
): string {
  if (kolom.includes('code')) {
    return `Kode "${nilai.code}" sudah dipakai di kategori ${namaKategori}. `
      + 'Kode yang sama boleh dipakai di kategori lain, tetapi tidak dua kali di kategori yang sama.';
  }
  if (kolom.includes('name')) {
    return `Nama "${nilai.name}" sudah ada di kategori ${namaKategori}. `
      + 'Dua barang bernama sama dalam satu kategori akan membuat penyusun RAB memilih yang keliru '
      + 'tanpa ada yang terlihat salah.';
  }
  return 'Data ini sudah ada.';
}
