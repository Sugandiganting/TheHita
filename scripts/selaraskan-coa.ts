/**
 * Menyamakan nama akun dan akun beberapa barang dengan template RAB.
 * Lihat src/lib/coa-selaras.ts untuk daftar dan alasannya.
 *
 * Berjalan saat aplikasi menyala, sesudah lengkapi-coa. Hanya akun yang
 * namanya masih nama lama dan barang yang akunnya masih akun lama yang
 * diubah, jadi aman dijalankan berulang kali.
 */
import { PrismaClient } from '@prisma/client';
import { GANTI_NAMA_AKUN, PINDAH_AKUN_BARANG } from '../src/lib/coa-selaras';

const prisma = new PrismaClient();

async function utama() {
  for (const g of GANTI_NAMA_AKUN) {
    const hasil = await prisma.account.updateMany({ where: { code: g.code, name: g.dari }, data: { name: g.jadi } });
    if (hasil.count > 0) console.log(`[coa] ${g.code} ${g.dari} → ${g.jadi}`);
  }

  for (const p of PINDAH_AKUN_BARANG) {
    const [dari, ke] = await Promise.all([
      prisma.account.findUnique({ where: { code: p.dari }, select: { id: true } }),
      prisma.account.findUnique({ where: { code: p.ke }, select: { id: true } }),
    ]);
    if (!dari || !ke) continue;
    const hasil = await prisma.item.updateMany({
      where: { code: p.kode, accountId: dari.id, subCategory: { name: p.departemen } },
      data: { accountId: ke.id },
    });
    if (hasil.count > 0) console.log(`[coa] Barang ${p.kode} (${p.departemen}): akun ${p.dari} → ${p.ke}`);
  }
}

utama()
  .catch((e) => {
    // Tidak menghentikan aplikasi: nama akun bisa diubah lewat menu COA.
    console.error(`[coa] Penyelarasan nama akun gagal: ${e instanceof Error ? e.message : String(e)}`);
  })
  .finally(() => prisma.$disconnect());
