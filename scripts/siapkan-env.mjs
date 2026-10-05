// Menyalin .env.example menjadi .env bila belum ada.
//
// Berkas .env sengaja tidak ikut masuk git supaya rahasia tidak pernah
// terunggah. Akibatnya, salinan projek yang baru diunduh — lewat clone maupun
// ZIP dari GitHub — datang tanpa .env, dan Prisma langsung gagal dengan
// "Environment variable not found: DATABASE_URL" sebelum satu halaman pun
// sempat tampil. Isi contohnya tidak mengandung rahasia apa pun, hanya lokasi
// berkas SQLite, jadi menyalinnya otomatis aman dan menghemat satu langkah
// manual yang mudah terlewat.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const env = join(akar, '.env');
const contoh = join(akar, '.env.example');

if (existsSync(env)) process.exit(0);

if (!existsSync(contoh)) {
  console.error('[env] .env dan .env.example dua-duanya tidak ada — buat .env berisi DATABASE_URL="file:./hita.db"');
  process.exit(1);
}

copyFileSync(contoh, env);
console.log('[env] .env belum ada, disalin dari .env.example');
