/**
 * Kata sandi: menyidik dan mencocokkan.
 *
 * Terpisah dari sesi.ts karena memakai scrypt dari node:crypto, yang tidak
 * tersedia di runtime Edge tempat middleware berjalan.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

const PANJANG_GARAM = 16;
const PANJANG_SIDIK = 64;

/** "scrypt:<garam>:<sidik>" — formatnya ikut tersimpan supaya bisa diganti kelak. */
export async function sidikKataSandi(kataSandi: string): Promise<string> {
  const garam = randomBytes(PANJANG_GARAM);
  const sidik = (await scrypt(kataSandi, garam, PANJANG_SIDIK)) as Buffer;
  return `scrypt:${garam.toString('hex')}:${sidik.toString('hex')}`;
}

/**
 * Pembandingnya memakai timingSafeEqual: membandingkan dengan === membocorkan
 * berapa karakter pertama yang sudah benar lewat selisih waktu.
 */
export async function cocokKataSandi(kataSandi: string, tersimpan: string): Promise<boolean> {
  const [jenis, garamHex, sidikHex] = tersimpan.split(':');
  if (jenis !== 'scrypt' || !garamHex || !sidikHex) return false;

  const diharapkan = Buffer.from(sidikHex, 'hex');
  const dihitung = (await scrypt(kataSandi, Buffer.from(garamHex, 'hex'), diharapkan.length)) as Buffer;
  return diharapkan.length === dihitung.length && timingSafeEqual(diharapkan, dihitung);
}
