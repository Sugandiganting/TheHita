/**
 * Menyalin isi basis data ke satu berkas JSON untuk ditelaah bersama.
 *
 *   npm run ekspor            — tanpa rincian jurnal
 *   npm run ekspor -- --penuh — beserta seluruh baris jurnalnya
 *
 * Tabel pengguna sengaja tidak ikut: di dalamnya ada sidik kata sandi, dan
 * tidak ada pertanyaan analisis yang membutuhkannya. Yang ikut hanya
 * jumlahnya, supaya tetap terlihat ada berapa akun.
 *
 * Jurnal diringkas per bulan, bukan dibawa baris demi baris. Rinciannya
 * biasanya ribuan baris dan hampir selalu bukan yang ditanyakan; bila memang
 * perlu, --penuh membawanya serta.
 *
 * Hasilnya ditaruh di folder cadangan/, yang sudah diabaikan git — jadi tidak
 * mungkin ikut terdorong ke repositori publik tanpa sengaja.
 */
import { PrismaClient } from '@prisma/client';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const penuh = process.argv.includes('--penuh');

/** "2026-10" dari tanggal, tanpa pergeseran zona waktu. */
const periode = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

async function ringkasJurnal() {
  const baris = await prisma.journalLine.findMany({
    select: {
      debit: true,
      credit: true,
      unitId: true,
      account: { select: { code: true, type: true } },
      entry: { select: { date: true } },
    },
  });

  const per = new Map<string, { period: string; unitId: string; debit: number; credit: number; baris: number }>();
  for (const b of baris) {
    const kunci = `${periode(b.entry.date)}|${b.unitId}`;
    const ada = per.get(kunci) ?? {
      period: periode(b.entry.date), unitId: b.unitId, debit: 0, credit: 0, baris: 0,
    };
    ada.debit += b.debit;
    ada.credit += b.credit;
    ada.baris += 1;
    per.set(kunci, ada);
  }
  return [...per.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
}

async function main() {
  const isi: Record<string, unknown> = {
    dibuat: new Date().toISOString(),
    catatan: 'Ekspor untuk analisis. Tabel pengguna tidak disertakan.',
    jumlahPengguna: await prisma.user.count(),

    grup: await prisma.businessGroup.findMany(),
    unit: await prisma.businessUnit.findMany(),
    akun: await prisma.account.findMany(),

    rencanaKas: await prisma.cashPlan.findMany({
      include: { commitments: true, categories: true, checkpoints: true, spends: true },
      orderBy: { period: 'asc' },
    }),
    musim: await prisma.season.findMany({ include: { months: true } }),
    rencanaBelanja: await prisma.purchase.findMany(),
    kendaraan: await prisma.vehicle.findMany(),
    kewajiban: await prisma.scheduledObligation.findMany({ include: { payments: true } }),

    anggaran: await prisma.budget.findMany({ include: { lines: true } }),
    proyek: await prisma.project.findMany({ include: { items: true } }),
    statistikBulanan: await prisma.monthlyStat.findMany({ orderBy: { period: 'asc' } }),
    skenarioRamalan: await prisma.forecastScenario.findMany(),

    jurnal: {
      jumlahBukti: await prisma.journalEntry.count(),
      jumlahBaris: await prisma.journalLine.count(),
      ringkasPerBulan: await ringkasJurnal(),
      ...(penuh
        ? { bukti: await prisma.journalEntry.findMany({ include: { lines: true }, orderBy: { date: 'asc' } }) }
        : {}),
    },
  };

  const stempel = new Date().toISOString().slice(0, 10);
  const folder = join(akar, 'cadangan');
  const berkas = join(folder, `analisis-${stempel}${penuh ? '-penuh' : ''}.json`);
  await mkdir(folder, { recursive: true });
  await writeFile(berkas, JSON.stringify(isi, null, 2));

  const { size } = await stat(berkas);
  console.log(`\nTersimpan: ${berkas}`);
  console.log(`Ukuran   : ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nIsinya:');
  for (const [nama, nilai] of Object.entries(isi)) {
    if (Array.isArray(nilai)) console.log(`  ${nama.padEnd(18)} ${nilai.length} baris`);
  }
  const j = isi.jurnal as { jumlahBukti: number; jumlahBaris: number };
  console.log(`  ${'jurnal'.padEnd(18)} ${j.jumlahBukti} bukti, ${j.jumlahBaris} baris`
    + (penuh ? ' (rinci)' : ' (diringkas per bulan)'));
  console.log('\nBerkasnya JSON biasa — boleh dibuka dulu sebelum dikirim.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
