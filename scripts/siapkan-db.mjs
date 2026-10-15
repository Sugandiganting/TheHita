// Menyamakan struktur database dengan skema, bila skemanya berubah.
//
// Menambah menu kadang berarti menambah tabel. Kalau kode baru ditarik tanpa
// menyamakan databasenya, aplikasi terbuka seperti biasa lalu gagal di halaman
// yang memakai tabel itu — "The table main.CashPlan does not exist" — pesan
// yang tidak menyinggung sebab sebenarnya sama sekali. Langkah ini mudah
// terlewat karena hanya perlu sesekali, jadi lebih baik dijalankan sendiri.
//
// `prisma db push` tanpa --accept-data-loss menolak perubahan yang menghapus
// data, jadi penambahan tabel dan kolom lewat, sedangkan yang berbahaya berhenti
// dengan keluhan yang terbaca.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const skema = join(akar, 'prisma', 'schema.prisma');
// Disimpan di node_modules supaya hilang saat pemasangan ulang — dan saat itu
// Prisma Client memang disusun ulang juga.
const penanda = join(akar, 'node_modules', '.cache', 'hita-skema.sha');

let isi;
try {
  isi = readFileSync(skema);
} catch {
  console.error('[db] prisma/schema.prisma tidak ditemukan.');
  process.exit(1);
}

const sidik = createHash('sha256').update(isi).digest('hex');

let tersimpan = null;
try {
  tersimpan = readFileSync(penanda, 'utf8').trim();
} catch {
  // Belum pernah dijalankan, atau node_modules baru dipasang ulang.
}

if (tersimpan === sidik) process.exit(0);

console.log('[db] Skema berubah — menyamakan struktur database…');

/*
 * Dipanggil langsung ke berkas prisma di node_modules/.bin, bukan lewat npx.
 *
 * npx mengandalkan hal-hal yang tidak selalu ada: ia bisa memutuskan mengunduh
 * paket lebih dulu, dan tanpa terminal sungguhan — misalnya saat build
 * dijalankan di latar belakang dengan nohup — ia berhenti tanpa mencetak
 * sebabnya. Berkas yang sudah terpasang di sebelah kita tidak punya masalah
 * itu. npx tetap disediakan sebagai cadangan bila berkasnya tidak ketemu.
 */
const binPrisma = join(akar, 'node_modules', '.bin', 'prisma');
const pakaiBin = existsSync(binPrisma);

const jalankanPrisma = (args, stdio) => (pakaiBin
  ? execFileSync(binPrisma, args, { cwd: akar, stdio })
  : execFileSync('npx', ['prisma', ...args], { cwd: akar, stdio }));

try {
  jalankanPrisma(['db', 'push', '--skip-generate'], 'inherit');
  jalankanPrisma(['generate'], ['ignore', 'ignore', 'inherit']);
} catch (e) {
  // Sebabnya ikut dicetak: pesan "jalankan sendiri untuk melihat sebabnya"
  // memaksa satu putaran bolak-balik yang tidak perlu.
  console.error(`\n[db] Penyamaan struktur database gagal: ${e.message}`);
  if (!pakaiBin) console.error('[db] node_modules/.bin/prisma tidak ditemukan — pustaka belum terpasang penuh?');
  console.error('[db] Jalankan "npm run db:push" sendiri untuk melihat rinciannya.');
  process.exit(1);
}

mkdirSync(dirname(penanda), { recursive: true });
writeFileSync(penanda, sidik);
console.log('[db] Struktur database sudah sesuai.');
