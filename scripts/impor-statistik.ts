/**
 * Memasukkan statistik hunian dari scripts/baca-statistik.py ke tabel MonthlyStat.
 *
 * Hanya angka operasional — room night dan pax. Angka uang tidak ikut, karena
 * sudah masuk lewat laporan laba rugi; lihat docs/impor-data-guestpro.md.
 *
 * Contoh:
 *   python3 scripts/baca-statistik.py --unit=THU laporan/*.pdf --keluar=data/statistik.csv
 *   npx tsx scripts/impor-statistik.ts data/statistik.csv
 *   npx tsx scripts/impor-statistik.ts data/statistik.csv --coba
 */

import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { parseCsv, findHeaderRow } from '../src/lib/import/parse';

const prisma = new PrismaClient();

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bad: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/** Jumlah hari pada satu bulan, untuk menghitung kamar tersedia. */
function hariDalamBulan(periode: string): number {
  const [tahun, bulan] = periode.split('-').map(Number);
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

type Baris = { unit: string; periode: string; roomNight: number; pax: number; kamar: number };

async function main() {
  const argv = process.argv.slice(2);
  const berkas = argv.filter((a) => !a.startsWith('--'));
  const coba = argv.includes('--coba');
  if (berkas.length === 0) {
    console.log('Pemakaian: npx tsx scripts/impor-statistik.ts data/statistik.csv [--coba]');
    process.exit(1);
  }

  const baris: Baris[] = [];
  for (const path of berkas) {
    const rows = parseCsv(await readFile(path, 'utf8'));
    const judul = findHeaderRow(rows);
    for (const r of rows.slice(judul + 1)) {
      if (!r[0]?.trim()) continue;
      baris.push({
        unit: r[0].trim().toUpperCase(),
        periode: r[1].trim(),
        roomNight: Number(r[2]) || 0,
        pax: Number(r[3]) || 0,
        kamar: Number(r[4]) || 0,
      });
    }
  }

  const units = await prisma.businessUnit.findMany();
  const byCode = new Map(units.map((u) => [u.code, u]));

  const takDikenal = [...new Set(baris.map((b) => b.unit))].filter((u) => !byCode.has(u));
  if (takDikenal.length > 0) {
    console.error(C.bad(`Unit tidak dikenal: ${takDikenal.join(', ')}.`));
    process.exit(1);
  }

  // Kamar tersedia dihitung dari jumlah kamar TERBANYAK yang pernah muncul di
  // laporan, bukan dari rata-ratanya. Laporan hanya memuat kamar yang terisi
  // minimal sekali, jadi bulan sepi memunculkan kamar lebih sedikit; memakai
  // angka bulan itu akan membuat tingkat huniannya tampak lebih tinggi
  // daripada yang sebenarnya.
  const kamarPerUnit = new Map<string, number>();
  for (const b of baris) {
    kamarPerUnit.set(b.unit, Math.max(kamarPerUnit.get(b.unit) ?? 0, b.kamar));
  }

  console.log(C.bold('\nStatistik hunian') + (coba ? C.dim('  ·  MODE COBA, tidak disimpan') : ''));
  for (const [unit, kamar] of kamarPerUnit) {
    const tercatat = byCode.get(unit)!.roomCount;
    console.log(C.dim(`  ${unit}: ${kamar} kamar terbanyak di laporan`
      + (tercatat && tercatat !== kamar ? `, data induk menyebut ${tercatat}` : '')));
  }
  console.log();
  console.log(C.dim('Unit  Periode    Room night      Pax   Tersedia   Hunian'));

  let simpan = 0;
  for (const b of baris.sort((a, z) => a.unit.localeCompare(z.unit) || a.periode.localeCompare(z.periode))) {
    // Laporan yang dikelompokkan per tipe kamar tidak memuat nomor kamar, jadi
    // jumlah kamarnya tidak diketahui. Kamar tersedia dibiarkan nol dan tingkat
    // huniannya tidak ditampilkan — lebih baik kosong daripada angka karangan.
    const kamar = kamarPerUnit.get(b.unit) ?? 0;
    const tersedia = kamar * hariDalamBulan(b.periode);
    console.log(`${b.unit.padEnd(6)}${b.periode.padEnd(11)}`
      + String(b.roomNight).padStart(10)
      + (b.pax > 0 ? String(b.pax) : '—').padStart(9)
      + (tersedia > 0 ? String(tersedia) : '—').padStart(11)
      + (tersedia > 0 ? `${((b.roomNight / tersedia) * 100).toFixed(1)}%` : '—').padStart(9));

    if (tersedia > 0 && b.roomNight > tersedia) {
      console.log(C.warn(`    ! room night melebihi kamar tersedia, periksa jumlah kamarnya`));
    }
    if (coba) continue;

    const unitId = byCode.get(b.unit)!.id;
    // Jumlah tamu tidak ada di semua laporan. Room Revenue Report memuat kamar
    // terjual tetapi tidak memuat pax, jadi kolom pax yang kosong dibiarkan apa
    // adanya — jangan sampai angka tamu yang sudah benar tertimpa nol.
    await prisma.monthlyStat.upsert({
      where: { unitId_period: { unitId, period: b.periode } },
      update: {
        roomsSold: b.roomNight,
        roomsAvailable: tersedia,
        ...(b.pax > 0 ? { guests: b.pax } : {}),
      },
      create: {
        unitId, period: b.periode, roomsSold: b.roomNight,
        roomsAvailable: tersedia, guests: b.pax,
        notes: 'Dari laporan GuestPro',
      },
    });
    simpan++;
  }

  if (!coba) {
    for (const [unit, kamar] of kamarPerUnit) {
      if (kamar === 0 || byCode.get(unit)!.roomCount === kamar) continue;
      await prisma.businessUnit.update({ where: { code: unit }, data: { roomCount: kamar } });
      console.log(C.dim(`\n${unit}: jumlah kamar pada data induk disesuaikan menjadi ${kamar}.`));
    }
    console.log(C.ok(`\n${simpan} bulan statistik tersimpan.`));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(C.bad(String(e?.message ?? e)));
  await prisma.$disconnect();
  process.exit(1);
});
