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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
try {
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], { cwd: akar, stdio: 'inherit' });
  execFileSync('npx', ['prisma', 'generate'], { cwd: akar, stdio: ['ignore', 'ignore', 'inherit'] });
} catch {
  console.error(
    '\n[db] Penyamaan struktur database gagal. Jalankan "npm run db:push" sendiri untuk melihat sebabnya.',
  );
  process.exit(1);
}

mkdirSync(dirname(penanda), { recursive: true });
writeFileSync(penanda, sidik);
console.log('[db] Struktur database sudah sesuai.');
