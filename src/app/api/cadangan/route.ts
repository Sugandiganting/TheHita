import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prisma } from '@/lib/db';
import { sesiSekarang } from '@/lib/sesi-server';

export const dynamic = 'force-dynamic';

/**
 * Mengunduh salinan basis data.
 *
 * Berkas SQLite tidak boleh disalin begitu saja selagi dipakai — salinan yang
 * diambil di tengah penulisan bisa rusak dan baru ketahuan saat dibutuhkan.
 * "VACUUM INTO" meminta SQLite sendiri yang menuliskan salinannya, sehingga
 * hasilnya utuh meski ada yang sedang menyimpan data pada saat yang sama.
 */
export async function GET() {
  // Middleware sudah menjaga alamat ini, tetapi berkas ini berisi seluruh
  // keuangan perusahaan — satu pemeriksaan lagi di sini murah harganya.
  const sesi = await sesiSekarang();
  if (!sesi) return new Response('Tidak berwenang', { status: 401 });

  const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const tujuan = join(tmpdir(), `hita-${stempel}-${process.pid}.db`);

  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${tujuan}'`);
    const isi = await readFile(tujuan);
    return new Response(new Uint8Array(isi), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="hita-${stempel}.db"`,
        'Content-Length': String(isi.length),
      },
    });
  } catch (e) {
    console.error('[cadangan] gagal:', e);
    return new Response('Gagal membuat salinan. Periksa catatan server.', { status: 500 });
  } finally {
    await rm(tujuan, { force: true });
  }
}
