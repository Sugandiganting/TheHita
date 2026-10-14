// Menyalin .env.example menjadi .env bila belum ada.
//
// Berkas .env sengaja tidak ikut masuk git supaya rahasia tidak pernah
// terunggah. Akibatnya, salinan projek yang baru diunduh — lewat clone maupun
// ZIP dari GitHub — datang tanpa .env, dan Prisma langsung gagal dengan
// "Environment variable not found: DATABASE_URL" sebelum satu halaman pun
// sempat tampil. Isi contohnya tidak mengandung rahasia apa pun, hanya lokasi
// berkas SQLite, jadi menyalinnya otomatis aman dan menghemat satu langkah
// manual yang mudah terlewat.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const env = join(akar, '.env');
const contoh = join(akar, '.env.example');

if (!existsSync(env)) {
  if (!existsSync(contoh)) {
    console.error('[env] .env dan .env.example dua-duanya tidak ada — buat .env berisi DATABASE_URL="file:./hita.db"');
    process.exit(1);
  }
  copyFileSync(contoh, env);
  console.log('[env] .env belum ada, disalin dari .env.example');
}

/*
 * Kunci penanda tangan sesi dibuatkan sendiri bila masih kosong.
 *
 * Kalau dibiarkan sebagai langkah manual, cepat atau lambat ada pemasangan
 * yang berjalan dengan kunci contoh yang sama dengan semua orang — dan kunci
 * yang diketahui orang lain membuat kuki sesi bisa dipalsukan siapa saja.
 * Nilainya dibuat sekali lalu menetap, sehingga sesi tidak putus tiap kali
 * aplikasinya dinyalakan ulang.
 */
const isi = readFileSync(env, 'utf8');
const punyaKunci = /^AUTH_SECRET\s*=\s*"?[^"\s][^"\n]{15,}/m.test(isi);

if (!punyaKunci) {
  const kunci = randomBytes(48).toString('base64url');
  const bersih = isi.replace(/^AUTH_SECRET\s*=.*$/m, '').replace(/\n{3,}/g, '\n\n');
  const akhiran = bersih.endsWith('\n') ? '' : '\n';
  writeFileSync(env, bersih + akhiran + `AUTH_SECRET="${kunci}"\n`);
  console.log('[env] AUTH_SECRET dibuatkan secara acak.');
}
