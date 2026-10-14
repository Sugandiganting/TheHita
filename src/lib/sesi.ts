/**
 * Kuki sesi: membuat dan memeriksa tandanya.
 *
 * Dibuat sesederhana mungkin dan tanpa pustaka tambahan: satu kuki
 * bertanda tangan, tanpa tabel sesi. Alasannya bukan irit, melainkan agar
 * pemeriksaannya bisa berjalan di middleware — yang dijalankan di runtime
 * Edge, tempat Prisma tidak bisa dipakai. Pemeriksaan tanda tangan cukup
 * memakai Web Crypto, dan itu tersedia di kedua tempat.
 *
 * Akibat yang harus disadari: mencabut sesi seseorang sebelum waktunya tidak
 * bisa dilakukan satu per satu. Yang tersedia adalah mengganti AUTH_SECRET,
 * yang memutus seluruh sesi sekaligus.
 *
 * Berkas ini sengaja tidak mengimpor apa pun dari "node:" supaya bisa ikut
 * dimuat middleware. Urusan kata sandi ada di auth.ts, yang hanya dipakai di
 * sisi server biasa.
 */

export const NAMA_KUKI = 'hita_sesi';

/** Umur sesi. Cukup panjang agar tidak mengganggu, cukup pendek agar tidak abadi. */
export const UMUR_SESI_HARI = 14;

const enc = new TextEncoder();

/* base64url tanpa Buffer, supaya berkas ini tetap bisa jalan di mana saja. */
function keBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function dariBase64Url(teks: string): string {
  const b64 = teks.replace(/-/g, '+').replace(/_/g, '/');
  const biner = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(biner, (c) => c.charCodeAt(0)));
}

/**
 * Kunci penanda tangan. Wajib ada: tanpa kunci, tanda tangan apa pun bisa
 * dibuat siapa pun, dan pintu masuknya sama saja dengan tidak terkunci.
 */
function kunci(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_SECRET belum diisi. Jalankan "npm run siapkan" atau isi sendiri di berkas .env.');
  }
  return s;
}

async function tandaTangan(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(kunci()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return keBase64Url(new Uint8Array(sig));
}

/** Isi sesi yang dititipkan di kuki. */
export type Sesi = {
  id: string;
  username: string;
  name: string;
  /** Waktu kedaluwarsa, milidetik epoch. */
  exp: number;
};

export async function buatToken(sesi: Omit<Sesi, 'exp'>): Promise<string> {
  const isi: Sesi = { ...sesi, exp: Date.now() + UMUR_SESI_HARI * 86_400_000 };
  const data = keBase64Url(enc.encode(JSON.stringify(isi)));
  return `${data}.${await tandaTangan(data)}`;
}

/**
 * Membaca token dan memastikan tanda tangannya cocok serta belum kedaluwarsa.
 * Mengembalikan null untuk segala bentuk kegagalan — tidak ada gunanya
 * membedakan "rusak", "palsu" dan "kedaluwarsa" bagi yang membawanya.
 */
export async function bacaToken(token: string | undefined): Promise<Sesi | null> {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  try {
    if (sig !== await tandaTangan(data)) return null;
    const sesi = JSON.parse(dariBase64Url(data)) as Sesi;
    if (!sesi?.id || typeof sesi.exp !== 'number' || sesi.exp < Date.now()) return null;
    return sesi;
  } catch {
    return null;
  }
}
