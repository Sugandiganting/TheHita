// Uji tercepat: bisakah Prisma benar-benar berbicara dengan basis datanya?
//
// Satu pertanyaan sepele ke SQLite, lalu selesai. Dipakai untuk mencoba
// beberapa mesin Prisma satu per satu di server yang tebakan sistem
// operasinya meleset — menjalankan seluruh pembuatan tabel hanya untuk tahu
// mesinnya hidup atau tidak terlalu lama dan tidak perlu.
//
//   npm run db:uji
import { PrismaClient } from '@prisma/client';

const mulai = Date.now();
const prisma = new PrismaClient();

try {
  // Nama tabel, bukan "SELECT 1": hasilnya berupa teks, sedangkan angka dari
  // SQLite datang sebagai BigInt yang tidak bisa dicetak begitu saja.
  const tabel = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  console.log(`[db] BISA — ${tabel.length} tabel, dijawab dalam ${Date.now() - mulai} ms`);
  const mesin = process.env.PRISMA_QUERY_ENGINE_LIBRARY;
  if (mesin) console.log(`[db] Mesin yang dipakai: ${mesin}`);
} catch (e) {
  console.error(`[db] GAGAL: ${e.message.split('\n')[0]}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
