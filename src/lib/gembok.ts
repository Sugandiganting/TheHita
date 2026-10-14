/**
 * Pembatas percobaan masuk.
 *
 * Kata sandi sekuat apa pun akhirnya bisa ditebak kalau penebaknya boleh
 * mencoba ribuan kali per menit. Daftar ini membuat percobaan beruntun dari
 * satu alamat berhenti setelah beberapa kali gagal.
 *
 * Disimpan di memori, bukan di basis data: hitungannya hilang tiap kali
 * aplikasi dinyalakan ulang, dan itu memang dapat diterima — yang dikejar
 * adalah memperlambat penebak, bukan menyimpan catatan.
 *
 * Yang dihitung alamat asalnya, bukan nama penggunanya. Kalau yang dihitung
 * nama pengguna, siapa pun bisa mengunci akun orang lain hanya dengan salah
 * ketik berkali-kali dengan sengaja.
 */

const BATAS = 10;
const JENDELA = 15 * 60_000;

type Catatan = { gagal: number; sejak: number };

const daftar = new Map<string, Catatan>();

/** Membuang catatan yang jendelanya sudah lewat, supaya petanya tidak menumpuk. */
function bersihkan(sekarang: number) {
  for (const [kunci, c] of daftar) {
    if (sekarang - c.sejak > JENDELA) daftar.delete(kunci);
  }
}

/** Sisa menit penguncian, atau 0 bila masih boleh mencoba. */
export function sisaKunci(alamat: string): number {
  const c = daftar.get(alamat);
  if (!c || c.gagal < BATAS) return 0;

  const sisa = JENDELA - (Date.now() - c.sejak);
  if (sisa <= 0) {
    daftar.delete(alamat);
    return 0;
  }
  return Math.ceil(sisa / 60_000);
}

export function catatGagal(alamat: string): void {
  const sekarang = Date.now();
  bersihkan(sekarang);

  const c = daftar.get(alamat);
  if (!c || sekarang - c.sejak > JENDELA) {
    daftar.set(alamat, { gagal: 1, sejak: sekarang });
    return;
  }
  c.gagal += 1;
}

export function lupakan(alamat: string): void {
  daftar.delete(alamat);
}
