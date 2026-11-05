/**
 * Menandai kas penampung dan membuat pemegangnya pada basis data yang sudah ada.
 *
 *   npm run tandai-penampung
 *
 * Pemasangan baru sudah mendapat keduanya dari prisma/seed.ts. Skrip ini untuk
 * basis data yang terlanjur jalan sebelum penandanya ada — ia aman diulang,
 * karena hanya menetapkan nilai, tidak menambah apa pun dua kali.
 */
import { PrismaClient } from '@prisma/client';
import { AKUN_PENAMPUNG, KODE_PENAMPUNG, NAMA_PENAMPUNG } from '../src/lib/penampung-master';

const prisma = new PrismaClient();

async function main() {
  const group = await prisma.businessGroup.findFirst({ select: { id: true } });
  if (!group) {
    console.error('Belum ada grup usaha. Jalankan seed-nya lebih dulu.');
    process.exit(1);
  }

  const unit = await prisma.businessUnit.upsert({
    where: { code: KODE_PENAMPUNG },
    update: { name: NAMA_PENAMPUNG, isPool: true },
    create: {
      code: KODE_PENAMPUNG,
      name: NAMA_PENAMPUNG,
      type: 'OTHER',
      groupId: group.id,
      roomCount: 0,
      openingCash: 0,
      isPool: true,
    },
  });
  console.log(`[penampung] Pemegang: ${unit.code} — ${unit.name}`);

  await prisma.account.updateMany({
    where: { code: { in: [...AKUN_PENAMPUNG] } },
    data: { isPool: true },
  });
  const ditandai = await prisma.account.findMany({
    where: { isPool: true },
    orderBy: { code: 'asc' },
    select: { code: true, name: true },
  });
  for (const a of ditandai) console.log(`[penampung] ${a.code} — ${a.name}`);
  console.log(`[penampung] ${ditandai.length} akun ditandai sebagai penampung.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
