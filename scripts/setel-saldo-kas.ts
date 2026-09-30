/**
 * Menyamakan saldo kas di pembukuan dengan saldo kas yang sebenarnya.
 *
 * Kenapa ini diperlukan. Pembukuan ini diisi dari laporan laba rugi GuestPro,
 * dan laba rugi tidak memuat seluruh pergerakan kas: angsuran pokok utang bank,
 * prive pemilik, belanja modal yang dibayar tunai, dan saldo kas pada awal
 * periode semuanya tidak muncul di sana. Akibatnya "saldo kas" hasil impor
 * sebenarnya sama dengan akumulasi laba, bukan uang yang betul-betul ada.
 *
 * Skrip ini membuat satu bukti jurnal penyesuaian pada tanggal tertentu yang
 * menggeser saldo kas ke angka sebenarnya, dengan lawan akun ekuitas. Bukti
 * lamanya diganti bila dijalankan ulang, jadi aman diulang.
 *
 * Contoh:
 *   npx tsx scripts/setel-saldo-kas.ts --tanggal=30/09/2026 --saldo=167192901 --coba
 *   npx tsx scripts/setel-saldo-kas.ts --tanggal=30/09/2026 \
 *       --per-unit=THL:60000000,SKR:15000000,THU:80000000,IGYT:7192901,PLD:5000000
 *
 * Pilihan:
 *   --tanggal=DD/MM/YYYY  Tanggal penyesuaian (wajib)
 *   --saldo=N             Total saldo kas sebenarnya pada tanggal itu
 *   --per-unit=KODE:N,..  Saldo kas sebenarnya per cabang. Lebih tepat daripada
 *                         --saldo, karena pembagian per cabang tidak bisa
 *                         disimpulkan dari satu angka gabungan.
 *   --akun=KODE           Akun kas yang disetel (bawaan 1110.01 Kas Pemasukan)
 *   --lawan=KODE          Lawan jurnalnya (bawaan 3101.02 Opening Balance Equity)
 *   --coba                Tampilkan saja, tidak menyimpan
 */

import { PrismaClient } from '@prisma/client';
import { round } from '../src/lib/accounting';
import { COA_TEMPLATE } from '../src/lib/coa-template';

const prisma = new PrismaClient();

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bad: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const rupiah = (n: number) => Math.round(n).toLocaleString('id-ID');

function parseTanggal(s: string): Date {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) throw new Error(`Tanggal "${s}" tidak dikenali. Pakai bentuk DD/MM/YYYY.`);
  const [, d, bl, th] = m;
  return new Date(Date.UTC(Number(th), Number(bl) - 1, Number(d)));
}

async function main() {
  const argv = process.argv.slice(2);
  const ambil = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const coba = argv.includes('--coba');

  const tanggalTeks = ambil('tanggal');
  if (!tanggalTeks) {
    console.log('Wajib: --tanggal=DD/MM/YYYY, dan salah satu dari --saldo= atau --per-unit=');
    process.exit(1);
  }
  const tanggal = parseTanggal(tanggalTeks);
  const akunKas = ambil('akun') ?? '1110.01';
  const akunLawan = ambil('lawan') ?? '3101.02';
  for (const [label, kode] of [['--akun', akunKas], ['--lawan', akunLawan]] as const) {
    if (!COA_TEMPLATE.some((a) => a.code === kode && !a.isHeader)) {
      console.error(C.bad(`${label}=${kode} tidak ada di COA, atau akun induk.`));
      process.exit(1);
    }
  }

  const units = await prisma.businessUnit.findMany({ orderBy: { code: 'asc' } });
  const akun = await prisma.account.findMany({ where: { code: { in: [akunKas, akunLawan] } } });
  const idKas = akun.find((a) => a.code === akunKas)?.id;
  const idLawan = akun.find((a) => a.code === akunLawan)?.id;
  if (!idKas || !idLawan) {
    console.error(C.bad('Akun kas atau lawannya belum ada di database. Jalankan seed dulu.'));
    process.exit(1);
  }

  const bukti = `KAS-${String(tanggal.getUTCFullYear()).slice(2)}${String(tanggal.getUTCMonth() + 1).padStart(2, '0')}`;

  // Bukti penyesuaian sebelumnya dihapus LEBIH DULU, sebelum saldo buku dibaca.
  // Kalau tidak, saldo buku sudah memuat penyesuaian lama, dan koreksinya
  // meleset persis sebesar penyesuaian itu — dijalankan dua kali hasilnya beda.
  if (!coba) {
    const lama = await prisma.journalEntry.findFirst({ where: { reference: bukti, source: 'ADJUSTMENT' } });
    if (lama) {
      await prisma.journalEntry.delete({ where: { id: lama.id } });
      console.log(C.dim(`Bukti ${bukti} yang lama dihapus dulu sebelum dihitung ulang.`));
    }
  }

  // Saldo kas menurut pembukuan sampai tanggal tersebut.
  const akhirHari = new Date(tanggal.getTime() + 86_400_000);
  const baris = await prisma.journalLine.findMany({
    where: {
      account: { isCash: true },
      entry: { date: { lt: akhirHari }, NOT: { reference: bukti, source: 'ADJUSTMENT' } },
    },
    include: { unit: { select: { code: true } } },
  });
  const buku = new Map<string, number>(units.map((u) => [u.code, 0]));
  for (const b of baris) buku.set(b.unit.code, round((buku.get(b.unit.code) ?? 0) + b.debit - b.credit));
  const bukuTotal = round([...buku.values()].reduce((a, b) => a + b, 0));

  // Saldo sebenarnya: per cabang bila disebutkan, kalau tidak dibagi dari totalnya.
  const perUnitTeks = ambil('per-unit');
  const target = new Map<string, number>();
  let caraBagi = '';

  if (perUnitTeks) {
    for (const bagian of perUnitTeks.split(',')) {
      const [kode, nilai] = bagian.split(':');
      const u = (kode ?? '').trim().toUpperCase();
      if (!buku.has(u)) {
        console.error(C.bad(`Cabang "${u}" tidak dikenal. Pilihan: ${[...buku.keys()].join(', ')}.`));
        process.exit(1);
      }
      target.set(u, round(Number(String(nilai).replace(/[^\d.-]/g, ''))));
    }
    for (const u of buku.keys()) if (!target.has(u)) target.set(u, 0);
    caraBagi = 'disebutkan per cabang';
  } else {
    const saldoTeks = ambil('saldo');
    if (!saldoTeks) {
      console.error(C.bad('Sebutkan --saldo=N atau --per-unit=KODE:N,...'));
      process.exit(1);
    }
    const saldo = round(Number(saldoTeks.replace(/[^\d.-]/g, '')));

    // Hanya total yang diketahui, jadi pembagian per cabang harus diasumsikan.
    // Seluruh saldo buku dikalikan satu faktor yang sama sampai jumlahnya pas.
    // Cara ini tidak lebih benar daripada cara lain, tetapi paling sedikit
    // merusak gambarannya: tanda dan urutan tiap cabang tetap seperti semula.
    // Membagi menurut besarnya saldo tanpa tanda, misalnya, akan membalik IGYT
    // dari defisit menjadi surplus — jelas bukan keadaan sebenarnya.
    const kunci = [...buku.keys()];
    if (bukuTotal === 0) {
      console.error(C.bad('Saldo buku seluruh cabang nol, pembagian per cabang tidak bisa '
        + 'disimpulkan. Sebutkan --per-unit=KODE:N,...'));
      process.exit(1);
    }
    const faktor = saldo / bukuTotal;
    let terpakai = 0;
    for (const u of kunci) {
      const bagian = round((buku.get(u) ?? 0) * faktor);
      target.set(u, bagian);
      terpakai = round(terpakai + bagian);
    }
    const sisa = round(saldo - terpakai);
    if (sisa !== 0) {
      const terbesar = kunci.reduce((a, b) =>
        (Math.abs(buku.get(b) ?? 0) > Math.abs(buku.get(a) ?? 0) ? b : a));
      target.set(terbesar, round((target.get(terbesar) ?? 0) + sisa));
    }
    caraBagi = `saldo buku tiap cabang dikalikan ${faktor.toFixed(4)} (ASUMSI)`;
  }

  const targetTotal = round([...target.values()].reduce((a, b) => a + b, 0));

  console.log(C.bold(`\nPenyesuaian saldo kas per ${tanggalTeks}`) + (coba ? C.dim('  ·  MODE COBA') : ''));
  console.log(C.dim(`Akun kas ${akunKas}, lawan ${akunLawan}. Pembagian: ${caraBagi}.\n`));
  console.log(C.dim('Unit'.padEnd(7) + 'Saldo buku'.padStart(18) + 'Saldo sebenarnya'.padStart(20) + 'Penyesuaian'.padStart(18)));
  for (const u of [...buku.keys()].sort()) {
    const b = buku.get(u) ?? 0;
    const t = target.get(u) ?? 0;
    console.log(u.padEnd(7) + rupiah(b).padStart(18) + rupiah(t).padStart(20) + rupiah(t - b).padStart(18));
  }
  console.log(C.bold('TOTAL'.padEnd(7) + rupiah(bukuTotal).padStart(18) + rupiah(targetTotal).padStart(20)
    + rupiah(targetTotal - bukuTotal).padStart(18)));

  if (caraBagi.includes('ASUMSI')) {
    console.log(C.warn('\nPembagian per cabang di atas adalah asumsi, bukan hasil pengukuran.'
      + '\nTotalnya benar, tetapi angka per cabangnya belum tentu.'
      + '\nSebutkan --per-unit=KODE:N,... bila saldo tiap cabang diketahui.'));
  }

  if (coba) {
    await prisma.$disconnect();
    return;
  }

  const lines = [];
  for (const u of units) {
    const selisih = round((target.get(u.code) ?? 0) - (buku.get(u.code) ?? 0));
    if (selisih === 0) continue;
    const memo = `Penyesuaian saldo kas ${u.code} per ${tanggalTeks}`;
    lines.push(
      { accountId: idKas, unitId: u.id, debit: selisih > 0 ? selisih : 0, credit: selisih < 0 ? -selisih : 0, memo },
      { accountId: idLawan, unitId: u.id, debit: selisih < 0 ? -selisih : 0, credit: selisih > 0 ? selisih : 0, memo },
    );
  }
  if (lines.length === 0) {
    console.log(C.ok('\nSaldo pembukuan sudah sama dengan saldo sebenarnya, tidak ada yang perlu disesuaikan.'));
    await prisma.$disconnect();
    return;
  }

  await prisma.journalEntry.create({
    data: {
      date: tanggal,
      unitId: units[0].id,
      reference: bukti,
      description: `Penyesuaian saldo kas ke posisi sebenarnya per ${tanggalTeks}`,
      source: 'ADJUSTMENT',
      notes: `Sumber: proyeksi arus kas gabungan. Pembagian per cabang: ${caraBagi}.`,
      lines: { create: lines },
    },
  });
  console.log(C.ok(`\nBukti ${bukti} tersimpan, ${lines.length} baris.`));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(C.bad(String(e?.message ?? e)));
  await prisma.$disconnect();
  process.exit(1);
});
