/**
 * Rencana kas yang berjalan sendiri dari bulan ke bulan.
 *
 * Tiap bulan punya barisnya sendiri, dan memang harus begitu: posisi kas dan
 * laporan belanja adalah catatan bulan itu. Yang tidak boleh ikut berganti
 * adalah yang sifatnya menetap — kategori belanja, komitmen berulang,
 * pengeluaran rutin, kebutuhan gaji. Sebelum ini semuanya menunggu seseorang
 * menekan "Buat rencana" di awal bulan, dan sampai itu terjadi seluruh halaman
 * kosong: plafon mingguan tidak ada, ramalan kas tidak ada, padahal datanya
 * semua sudah ada di bulan sebelumnya.
 *
 * Jadi bulan berjalan dibuat sendiri begitu halamannya dibuka, melanjutkan
 * bulan terakhir yang ada. Yang tersalin hanya yang menetap. Posisi kas,
 * laporan belanja dan komitmen sekali-ini tidak ikut: itu catatan bulan
 * kemarin, bukan aturan yang berlaku terus.
 *
 * Proyeksi uang masuk sengaja dibiarkan kosong. Kosong berarti "pakai usulan",
 * dan usulannya dihitung ulang dari riwayat dan pola musim tiap kali dibuka —
 * menyalin angka bulan lalu justru akan membekukan ramalannya pada bulan yang
 * sudah lewat.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './db';
import type { Period } from './period';

/** Dipakai saat bulan pertama dibuat dan belum ada bulan sebelumnya. */
export const KATEGORI_BAWAAN = [
  { label: 'Purchasing', weight: 20, sort: 0 },
  { label: 'HR (petty cash)', weight: 7, sort: 1 },
  { label: 'Bank Perusahaan', weight: 7, sort: 2 },
];

export type Lanjutan = {
  period: Period;
  /** Bulan yang disalin; null bila dibuat dari nol. */
  dari: Period | null;
  komitmen: number;
  kategori: number;
};

/** Membuat rencana sebuah bulan, melanjutkan bulan terakhir sebelum itu. */
export async function buatRencanaLanjutan(period: Period): Promise<Lanjutan> {
  const sebelumnya = await prisma.cashPlan.findFirst({
    where: { period: { lt: period } },
    orderBy: { period: 'desc' },
    include: { commitments: true, categories: true },
  });

  const komitmen = (sebelumnya?.commitments ?? [])
    .filter((k) => k.recurring)
    .map((k) => ({ label: k.label, amount: k.amount, dueDay: k.dueDay, recurring: true, sort: k.sort }));
  // Jatah per kategori ikut tersalin: RAB departemen tidak berubah tiap bulan,
  // dan mengetiknya ulang tiap awal bulan justru cara paling mudah untuk lupa.
  const kategori = sebelumnya?.categories.length
    ? sebelumnya.categories.map((k) => ({
        label: k.label, weight: k.weight, budget: k.budget, sort: k.sort,
      }))
    : KATEGORI_BAWAAN;

  await prisma.cashPlan.create({
    data: {
      period,
      // Asumsi ikut terbawa: keduanya angka yang jarang berubah, dan tanpa ini
      // ramalan kas bulan baru berdiri di atas usulan sistem padahal
      // penggunanya sudah pernah menetapkan angkanya sendiri.
      monthlyOutflow: sebelumnya?.monthlyOutflow ?? null,
      salaryNeed: sebelumnya?.salaryNeed ?? null,
      commitments: { create: komitmen },
      categories: { create: kategori },
    },
  });

  return {
    period,
    dari: sebelumnya?.period ?? null,
    komitmen: komitmen.length,
    kategori: kategori.length,
  };
}

/**
 * Memastikan bulan berjalan sudah punya rencananya.
 *
 * Mengembalikan bulan yang disalin bila baru saja dibuat, dan null bila
 * memang sudah ada atau belum bisa dibuat.
 *
 * Bulan pertama tetap dibuat sendiri lewat formulir: di situlah penggunanya
 * memilih mulai dari bulan mana, dan membuatnya otomatis berarti menebak.
 * Bulan yang kosong di tengah juga tidak diisi mundur — bulan tanpa satu pun
 * laporan lebih jujur tidak ada daripada ada tetapi kosong.
 */
export async function pastikanBulanBerjalan(period: Period): Promise<Period | null> {
  const ada = await prisma.cashPlan.findUnique({ where: { period }, select: { id: true } });
  if (ada) return null;

  const sebelumnya = await prisma.cashPlan.findFirst({
    where: { period: { lt: period } },
    select: { period: true },
    orderBy: { period: 'desc' },
  });
  if (!sebelumnya) return null;

  try {
    const hasil = await buatRencanaLanjutan(period);
    return hasil.dari;
  } catch (galat) {
    // Dua permintaan yang datang bersamaan bisa sama-sama lolos pemeriksaan di
    // atas; yang kalah ditolak oleh keunikan period. Itu bukan kegagalan —
    // rencananya tetap ada, hanya dibuat oleh permintaan yang satunya.
    if (galat instanceof Prisma.PrismaClientKnownRequestError && galat.code === 'P2002') {
      return null;
    }
    throw galat;
  }
}
