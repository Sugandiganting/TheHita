/**
 * Menambahkan akun bawaan yang belum ada di database.
 *
 * COA bawaan hanya dipasang sekali, saat `npm run setup`. Akun yang kelak
 * ditambahkan ke src/lib/coa-template.ts — misalnya 6120.10 Biaya Air (PDAM) —
 * karena itu tidak pernah sampai ke database yang sudah berjalan, di MacBook
 * maupun di server. Langkah ini menutup celah itu, dan dijalankan sendiri tiap
 * aplikasi dinyalakan.
 *
 * Hanya MENAMBAH. Akun yang sudah ada tidak disentuh sama sekali, walau nama
 * atau isinya berbeda dari bawaan: bisa jadi memang sengaja diubah lewat menu
 * COA, dan menimpanya diam-diam akan membatalkan keputusan itu.
 *
 *   npm run lengkapi-coa
 */
import { PrismaClient } from '@prisma/client';
import { COA_TEMPLATE } from '../src/lib/coa-template';

const prisma = new PrismaClient();

async function utama() {
  const ada = new Set(
    (await prisma.account.findMany({ select: { code: true } })).map((a) => a.code),
  );
  // Database kosong belum pernah di-setup; itu urusan `npm run setup`, bukan langkah ini.
  if (ada.size === 0) return;

  const kurang = COA_TEMPLATE.filter((a) => !ada.has(a.code));
  if (kurang.length === 0) return;

  // Induk lebih dulu, supaya anak yang induknya juga baru bisa langsung ditautkan.
  kurang.sort((a, b) => Number(Boolean(b.isHeader)) - Number(Boolean(a.isHeader)));
  for (const a of kurang) {
    const induk = a.parent
      ? await prisma.account.findUnique({ where: { code: a.parent }, select: { id: true } })
      : null;
    await prisma.account.create({
      data: {
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        isHeader: a.isHeader ?? false,
        isCash: a.isCash ?? false,
        isPool: a.isPool ?? false,
        cashflowCategory: a.cashflow ?? null,
        description: a.description ?? null,
        parentId: induk?.id ?? null,
      },
    });
    console.log(`[coa] Akun baru: ${a.code} ${a.name}`);
  }
}

utama()
  .catch((e) => {
    // Tidak menghentikan aplikasi: akun yang belum ada bisa ditambahkan lewat
    // menu COA, sedangkan aplikasi yang gagal menyala tidak bisa dipakai sama sekali.
    console.error(`[coa] Akun bawaan tidak bisa dilengkapi: ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(() => prisma.$disconnect());
