/**
 * Memuat hasil `npm run ekspor` ke basis data instansi ini.
 *
 *   npm run impor-analisis -- <berkas.json> --ganti
 *
 * Kebalikan dari ekspor-analisis.ts, dan dipakai untuk menelaah data satu
 * pemasangan di pemasangan lain — mis. agar yang membantu bisa melihat angka
 * yang sama persis.
 *
 * Menimpa, bukan menambah: tabel yang disebut di berkasnya dikosongkan lebih
 * dulu. Karena itu --ganti wajib ditulis sendiri, supaya tidak ada yang
 * kehilangan datanya hanya karena salah menempel nama berkas.
 *
 * Tabel pengguna tidak ikut, karena ekspornya memang tidak membawanya. Jadi
 * pemasangan tujuan tetap memakai akun dan kata sandinya sendiri.
 */
import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const berkas = argv.find((a) => !a.startsWith('--'));
const ganti = argv.includes('--ganti');

/** Tanggal datang sebagai teks ISO di JSON; Prisma menuntut objek Date. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
function pulihkanTanggal<T>(baris: T): T {
  if (Array.isArray(baris)) return baris.map(pulihkanTanggal) as T;
  if (baris === null || typeof baris !== 'object') return baris;
  const hasil: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(baris as Record<string, unknown>)) {
    hasil[k] = typeof v === 'string' && ISO.test(v) ? new Date(v) : pulihkanTanggal(v);
  }
  return hasil as T;
}

/** Membuang relasi bersarang; anaknya dimasukkan sendiri sesudah induknya. */
function tanpaAnak<T extends Record<string, unknown>>(baris: T, ...anak: string[]): T {
  const hasil = { ...baris };
  for (const a of anak) delete hasil[a];
  return hasil;
}

async function main() {
  if (!berkas) {
    console.error('Pakai: npm run impor-analisis -- <berkas.json> --ganti');
    process.exit(1);
  }
  const isi = pulihkanTanggal(JSON.parse(await readFile(berkas, 'utf8')));

  if (!ganti) {
    console.error('Perintah ini MENIMPA data yang ada. Tambahkan --ganti bila memang itu yang dimaksud.');
    process.exit(1);
  }

  // Dikosongkan dari anak ke induk, supaya kunci asingnya tidak menggantung.
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.obligationPayment.deleteMany();
  await prisma.scheduledObligation.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.spendEntry.deleteMany();
  await prisma.spendCategory.deleteMany();
  await prisma.cashCheckpoint.deleteMany();
  await prisma.cashCommitment.deleteMany();
  await prisma.cashPlan.deleteMany();
  await prisma.seasonMonth.deleteMany();
  await prisma.season.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.projectCostItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.monthlyStat.deleteMany();
  await prisma.forecastScenario.deleteMany();
  await prisma.account.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.businessGroup.deleteMany();

  const hitung: Record<string, number> = {};
  const catat = (nama: string, n: number) => { hitung[nama] = n; };

  await prisma.businessGroup.createMany({ data: isi.grup ?? [] });
  catat('grup', isi.grup?.length ?? 0);
  await prisma.businessUnit.createMany({ data: isi.unit ?? [] });
  catat('unit', isi.unit?.length ?? 0);
  await prisma.account.createMany({ data: isi.akun ?? [] });
  catat('akun', isi.akun?.length ?? 0);

  for (const p of isi.rencanaKas ?? []) {
    await prisma.cashPlan.create({ data: tanpaAnak(p, 'commitments', 'categories', 'checkpoints', 'spends') });
    await prisma.cashCommitment.createMany({ data: p.commitments ?? [] });
    await prisma.spendCategory.createMany({ data: p.categories ?? [] });
    await prisma.cashCheckpoint.createMany({ data: p.checkpoints ?? [] });
    await prisma.spendEntry.createMany({ data: p.spends ?? [] });
  }
  catat('rencanaKas', isi.rencanaKas?.length ?? 0);

  for (const m of isi.musim ?? []) {
    await prisma.season.create({ data: tanpaAnak(m, 'months') });
    await prisma.seasonMonth.createMany({ data: m.months ?? [] });
  }
  catat('musim', isi.musim?.length ?? 0);

  await prisma.purchase.createMany({ data: isi.rencanaBelanja ?? [] });
  catat('rencanaBelanja', isi.rencanaBelanja?.length ?? 0);
  await prisma.vehicle.createMany({ data: isi.kendaraan ?? [] });
  catat('kendaraan', isi.kendaraan?.length ?? 0);

  for (const k of isi.kewajiban ?? []) {
    await prisma.scheduledObligation.create({ data: tanpaAnak(k, 'payments') });
    await prisma.obligationPayment.createMany({ data: k.payments ?? [] });
  }
  catat('kewajiban', isi.kewajiban?.length ?? 0);

  for (const b of isi.anggaran ?? []) {
    await prisma.budget.create({ data: tanpaAnak(b, 'lines') });
    await prisma.budgetLine.createMany({ data: b.lines ?? [] });
  }
  catat('anggaran', isi.anggaran?.length ?? 0);

  for (const p of isi.proyek ?? []) {
    await prisma.project.create({ data: tanpaAnak(p, 'items') });
    await prisma.projectCostItem.createMany({ data: p.items ?? [] });
  }
  catat('proyek', isi.proyek?.length ?? 0);

  await prisma.monthlyStat.createMany({ data: isi.statistikBulanan ?? [] });
  catat('statistikBulanan', isi.statistikBulanan?.length ?? 0);
  await prisma.forecastScenario.createMany({ data: isi.skenarioRamalan ?? [] });
  catat('skenarioRamalan', isi.skenarioRamalan?.length ?? 0);

  // Jurnal hanya ikut bila ekspornya dibuat dengan --penuh.
  const bukti = isi.jurnal?.bukti ?? [];
  for (const e of bukti) {
    await prisma.journalEntry.create({ data: tanpaAnak(e, 'lines') });
    await prisma.journalLine.createMany({ data: e.lines ?? [] });
  }
  catat('buktiJurnal', bukti.length);

  console.log(`\nDimuat dari ${berkas}`);
  for (const [nama, n] of Object.entries(hitung)) console.log(`  ${nama.padEnd(18)} ${n}`);
  if (bukti.length === 0 && isi.jurnal?.jumlahBukti > 0) {
    console.log(`\nJurnalnya tidak ikut (ekspornya tanpa --penuh): ${isi.jurnal.jumlahBukti} bukti`
      + `, ${isi.jurnal.jumlahBaris} baris di sumbernya. Halaman yang bersandar pada jurnal akan kosong.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
