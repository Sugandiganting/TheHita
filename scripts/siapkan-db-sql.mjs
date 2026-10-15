// Membuat tabel langsung dari prisma/awal.sql, tanpa "prisma db push".
//
// Jalur cadangan untuk server yang tidak bisa menjalankan schema-engine milik
// Prisma — di sebagian hosting bersama berkas itu tidak boleh dieksekusi, dan
// gejalanya bukan pesan galat melainkan perintah yang menggantung tanpa ujung.
//
// Yang dipakai di sini hanya Prisma Client, mesin yang sama dengan yang dipakai
// aplikasinya sehari-hari. Kalau ini jalan, aplikasinya pasti jalan.
//
//   npm run db:awal
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const berkas = join(akar, 'prisma', 'awal.sql');

/**
 * Dibuat tahan diulang: tiap perintah diberi "IF NOT EXISTS", sehingga
 * menjalankannya dua kali tidak merusak tabel yang sudah berisi data.
 */
function tahanDiulang(sql) {
  return sql
    .replace(/CREATE TABLE "/g, 'CREATE TABLE IF NOT EXISTS "')
    .replace(/CREATE UNIQUE INDEX "/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
    .replace(/CREATE INDEX "/g, 'CREATE INDEX IF NOT EXISTS "');
}

const prisma = new PrismaClient();

async function main() {
  const mentah = readFileSync(berkas, 'utf8');
  const perintah = tahanDiulang(mentah)
    .split(';')
    .map((p) => p.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);

  console.log(`[db] ${perintah.length} perintah dari prisma/awal.sql`);

  let dijalankan = 0;
  for (const p of perintah) {
    await prisma.$executeRawUnsafe(p);
    dijalankan += 1;
    if (dijalankan % 10 === 0) console.log(`[db] ${dijalankan}/${perintah.length}…`);
  }

  const tabel = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  console.log(`[db] Selesai. ${tabel.length} tabel siap:`);
  console.log('     ' + tabel.map((t) => t.name).join(', '));
}

main()
  .catch((e) => {
    console.error('[db] Gagal:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
