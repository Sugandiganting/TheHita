// Menyalin basis data ke folder cadangan, lalu membuang salinan yang kedaluwarsa.
//
// Dijalankan terjadwal di server tiap malam. Salinannya diambil lewat
// "VACUUM INTO" supaya utuh meski sistem sedang dipakai — menyalin berkas
// SQLite dengan cp di tengah penulisan bisa menghasilkan berkas rusak yang
// baru ketahuan justru saat dibutuhkan.
//
//   node scripts/cadangkan.mjs [folder] [--simpan=30]
import { PrismaClient } from '@prisma/client';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const folder = argv.find((a) => !a.startsWith('--')) ?? join(akar, 'cadangan');
const simpanHari = Number(argv.find((a) => a.startsWith('--simpan='))?.split('=')[1] ?? 30);

const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

async function main() {
  await mkdir(folder, { recursive: true });
  const mentah = join(folder, `hita-${stempel}.db`);
  const akhir = `${mentah}.gz`;

  if (existsSync(mentah) || existsSync(akhir)) {
    console.error(`[cadangan] ${akhir} sudah ada — dilewati.`);
    process.exit(0);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${mentah}'`);
  } finally {
    await prisma.$disconnect();
  }

  // Dimampatkan karena basis data SQLite sebagian besar berisi ruang kosong
  // dan teks berulang; ukurannya biasa menyusut lebih dari separuh.
  await pipeline(createReadStream(mentah), createGzip(), createWriteStream(akhir));
  await rm(mentah, { force: true });
  console.log(`[cadangan] ${akhir} (${Math.round((await stat(akhir)).size / 1024)} KB)`);

  const batas = Date.now() - simpanHari * 86_400_000;
  let dibuang = 0;
  for (const nama of await readdir(folder)) {
    if (!/^hita-.*\.db\.gz$/.test(nama)) continue;
    const berkas = join(folder, nama);
    if ((await stat(berkas)).mtimeMs < batas) {
      await rm(berkas, { force: true });
      dibuang += 1;
    }
  }
  if (dibuang > 0) console.log(`[cadangan] ${dibuang} salinan lebih tua dari ${simpanHari} hari dibuang.`);
}

main().catch((e) => {
  console.error('[cadangan] gagal:', e);
  process.exit(1);
});
