import { cache } from 'react';
import { prisma } from './db';
import { sesiSekarang } from './sesi-server';
import {
  AKSI_MASTER, hakMaster, hakPengguna, pesanTanpaHak, type AksiMaster, type KodeHak, type MenuMaster,
} from './hak-akses';

/**
 * Hak akses pengguna yang sedang masuk, dibaca dari user level-nya. Dibaca
 * dari basis data tiap permintaan, bukan disimpan di kuki sesi, supaya
 * perubahan hak akses langsung berlaku tanpa perlu masuk ulang.
 */
export const hakSaya = cache(async (): Promise<Set<KodeHak>> => {
  const sesi = await sesiSekarang();
  if (!sesi) return new Set();
  const user = await prisma.user.findUnique({
    where: { id: sesi.id }, select: { level: { select: { permissions: true } } },
  });
  if (!user) return new Set();
  return hakPengguna(user.level);
});

/** Null bila pengguna ini punya hak itu; selain itu pesan penolakannya. */
export async function tolakTanpaHak(hak: KodeHak): Promise<string | null> {
  return (await hakSaya()).has(hak) ? null : pesanTanpaHak(hak);
}

/** Hak lihat/tambah/ubah/hapus pengguna ini pada sebuah menu master. */
export async function hakMenuMaster(menu: MenuMaster): Promise<Record<AksiMaster, boolean>> {
  const hak = await hakSaya();
  return Object.fromEntries(AKSI_MASTER.map((a) => [a, hak.has(hakMaster(menu, a))])) as Record<AksiMaster, boolean>;
}
