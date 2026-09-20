/**
 * Seed database:
 *  1. Grup usaha + 5 unit (3 hotel, 1 laundry, 1 cafe) sesuai kondisi nyata.
 *  2. Chart of Account standar perhotelan.
 *  3. Contoh histori transaksi 18 bulan supaya menu Peramalan langsung bisa dipakai.
 *  4. Satu contoh proyek penambahan kamar.
 *
 * Jalankan: npm run db:seed
 * Set SEED_DEMO=0 untuk memasang master data saja tanpa transaksi contoh.
 */

import { PrismaClient } from '@prisma/client';
import { COA_TEMPLATE } from '../src/lib/coa-template';

const prisma = new PrismaClient();

const WITH_DEMO = process.env.SEED_DEMO !== '0';
const HISTORY_MONTHS = 18;

/* PRNG deterministik supaya data contoh selalu sama di setiap komputer. */
function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const rnd = makeRandom(20260920);

/** Variasi acak ±pct persen. */
function jitter(value: number, pct = 0.12): number {
  return value * (1 + (rnd() * 2 - 1) * pct);
}

function roundTo(value: number, step = 1000): number {
  return Math.round(value / step) * step;
}

/**
 * Indeks musiman pariwisata Bali: ramai saat libur sekolah Eropa (Jul-Agu),
 * Natal-Tahun Baru, dan sepi di Februari-Maret serta Oktober-November.
 */
const SEASON = [0, 1.12, 0.78, 0.84, 0.95, 1.0, 1.08, 1.32, 1.35, 1.06, 0.88, 0.85, 1.24];

const UNITS = [
  { code: 'SKR', name: 'Sri Krisna', type: 'HOTEL', rooms: 32, legacyPms: 'GuestPro 1', openingCash: 95_000_000, scale: 1.0 },
  { code: 'THL', name: 'The Hita Legian', type: 'HOTEL', rooms: 24, legacyPms: 'GuestPro 1', openingCash: 70_000_000, scale: 0.82 },
  { code: 'THU', name: 'The Hita Uluwatu', type: 'HOTEL', rooms: 20, legacyPms: 'GuestPro 2', openingCash: 60_000_000, scale: 0.74 },
  { code: 'PLD', name: 'Play Laundry', type: 'LAUNDRY', rooms: 0, legacyPms: 'GuestPro 1', openingCash: 25_000_000, scale: 1.0 },
  { code: 'IGYT', name: 'IGYT Coffee & Eatery', type: 'CAFE', rooms: 0, legacyPms: 'GuestPro 2', openingCash: 35_000_000, scale: 1.0 },
];

async function seedMaster() {
  const group = await prisma.businessGroup.upsert({
    where: { code: 'HITA' },
    update: { name: 'The Hita Hospitality Group' },
    create: { code: 'HITA', name: 'The Hita Hospitality Group' },
  });

  for (const u of UNITS) {
    await prisma.businessUnit.upsert({
      where: { code: u.code },
      update: { name: u.name, type: u.type, roomCount: u.rooms, legacyPms: u.legacyPms },
      create: {
        code: u.code,
        name: u.name,
        type: u.type,
        groupId: group.id,
        roomCount: u.rooms,
        legacyPms: u.legacyPms,
        openingCash: u.openingCash,
      },
    });
  }

  // COA dibuat dua tahap: akun dulu, lalu relasi induk-anak.
  for (const a of COA_TEMPLATE) {
    await prisma.account.upsert({
      where: { code: a.code },
      update: {
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        isHeader: a.isHeader ?? false,
        isCash: a.isCash ?? false,
        cashflowCategory: a.cashflow ?? null,
        description: a.description ?? null,
      },
      create: {
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        isHeader: a.isHeader ?? false,
        isCash: a.isCash ?? false,
        cashflowCategory: a.cashflow ?? null,
        description: a.description ?? null,
      },
    });
  }

  for (const a of COA_TEMPLATE) {
    if (!a.parent) continue;
    const parent = await prisma.account.findUnique({ where: { code: a.parent }, select: { id: true } });
    if (parent) {
      await prisma.account.update({ where: { code: a.code }, data: { parentId: parent.id } });
    }
  }

  console.log(`✓ 1 grup, ${UNITS.length} unit usaha, ${COA_TEMPLATE.length} akun COA`);
}

type AccountMap = Map<string, string>;

/** Bangun satu bukti jurnal dari daftar (kode akun, debit, kredit). */
async function postEntry(opts: {
  date: Date;
  unitId: string;
  description: string;
  reference?: string;
  source?: string;
  projectId?: string;
  lines: { code: string; debit?: number; credit?: number; unitId?: string; memo?: string }[];
  accounts: AccountMap;
}) {
  const lines = opts.lines.map((l) => {
    const accountId = opts.accounts.get(l.code);
    if (!accountId) throw new Error(`Akun ${l.code} tidak ditemukan`);
    return {
      accountId,
      unitId: l.unitId ?? opts.unitId,
      debit: Math.round(l.debit ?? 0),
      credit: Math.round(l.credit ?? 0),
      memo: l.memo ?? null,
    };
  });

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 1) {
    throw new Error(`Jurnal tidak balance: ${opts.description} (D ${totalDebit} / K ${totalCredit})`);
  }

  await prisma.journalEntry.create({
    data: {
      date: opts.date,
      unitId: opts.unitId,
      description: opts.description,
      reference: opts.reference ?? null,
      source: opts.source ?? 'IMPORT',
      projectId: opts.projectId ?? null,
      lines: { create: lines },
    },
  });
}

async function seedTransactions() {
  const accounts = new Map(
    (await prisma.account.findMany({ select: { id: true, code: true } })).map((a) => [a.code, a.id]),
  );
  const units = new Map(
    (await prisma.businessUnit.findMany({ select: { id: true, code: true } })).map((u) => [u.code, u.id]),
  );

  const now = new Date();
  // Mulai dari HISTORY_MONTHS bulan lalu sampai bulan lalu (bulan berjalan sengaja dikosongkan).
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - HISTORY_MONTHS, 1));

  let entryCount = 0;

  for (let m = 0; m < HISTORY_MONTHS; m++) {
    const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1));
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const season = SEASON[month + 1];
    // Pertumbuhan alami usaha ~6%/tahun.
    const growth = Math.pow(1.06, m / 12);
    const day = (d: number) => new Date(Date.UTC(year, month, Math.min(d, daysInMonth)));
    /** Omzet tiap unit pada bulan ini, dipakai menghitung PB1, service charge dan prive. */
    const monthRevenue = new Map<string, number>();

    for (const u of UNITS) {
      const unitId = units.get(u.code)!;
      const factor = season * growth * u.scale;

      if (u.type === 'HOTEL') {
        const occupancy = Math.min(0.94, 0.58 * season * (1 + (rnd() - 0.5) * 0.1));
        const adr = jitter(u.code === 'THU' ? 780_000 : u.code === 'THL' ? 620_000 : 540_000, 0.06);
        const roomNights = Math.round(u.rooms * daysInMonth * occupancy);
        const roomRevenue = roundTo(roomNights * adr);

        const otaShare = 0.58;
        const otaRevenue = roundTo(roomRevenue * otaShare);
        const directRevenue = roomRevenue - otaRevenue;
        const otaCommission = roundTo(otaRevenue * 0.17);

        // Pendapatan kamar — OTA masuk lewat piutang lalu dicairkan, direct langsung tunai.
        await postEntry({
          date: day(daysInMonth),
          unitId,
          description: `Pendapatan kamar bulan ${year}-${String(month + 1).padStart(2, '0')}`,
          reference: `RV-${u.code}-${year}${String(month + 1).padStart(2, '0')}`,
          accounts,
          lines: [
            { code: '1-1200', debit: directRevenue },
            { code: '1-2200', debit: otaRevenue },
            { code: '4-1100', credit: directRevenue },
            { code: '4-1200', credit: otaRevenue },
          ],
        });
        entryCount++;

        // Pencairan piutang OTA (dipotong komisi) pada bulan yang sama, akhir bulan.
        await postEntry({
          date: day(daysInMonth),
          unitId,
          description: 'Pencairan piutang OTA dipotong komisi',
          accounts,
          lines: [
            { code: '1-1300', debit: otaRevenue - otaCommission },
            { code: '5-6000', debit: otaCommission },
            { code: '1-2200', credit: otaRevenue },
          ],
        });
        entryCount++;

        // F&B (breakfast + a la carte)
        const fnbRevenue = roundTo(roomNights * jitter(95_000, 0.1));
        const fnbCogs = roundTo(fnbRevenue * jitter(0.33, 0.08));
        await postEntry({
          date: day(daysInMonth),
          unitId,
          description: 'Pendapatan F&B & breakfast',
          accounts,
          lines: [
            { code: '1-1200', debit: fnbRevenue },
            { code: '4-2500', credit: roundTo(fnbRevenue * 0.6) },
            { code: '4-2100', credit: fnbRevenue - roundTo(fnbRevenue * 0.6) },
          ],
        });
        await postEntry({
          date: day(20),
          unitId,
          description: 'Pembelian bahan makanan & minuman',
          accounts,
          lines: [
            { code: '5-1000', debit: fnbCogs },
            { code: '1-1300', credit: fnbCogs },
          ],
        });
        entryCount += 2;

        monthRevenue.set(u.code, roomRevenue + fnbRevenue);

        // Amenities & guest supplies
        const amenities = roundTo(roomNights * jitter(22_000, 0.12));
        await postEntry({
          date: day(12),
          unitId,
          description: 'Pembelian amenities & guest supplies',
          accounts,
          lines: [
            { code: '5-5000', debit: amenities },
            { code: '1-1300', credit: amenities },
          ],
        });
        entryCount++;

        // Laundry internal dikerjakan Play Laundry — biaya hotel, pendapatan laundry.
        const laundryCharge = roundTo(roomNights * jitter(31_000, 0.1));
        await postEntry({
          date: day(daysInMonth),
          unitId,
          description: `Jasa laundry linen oleh Play Laundry`,
          accounts,
          lines: [
            { code: '5-7000', debit: laundryCharge, unitId },
            { code: '4-3300', credit: laundryCharge, unitId: units.get('PLD')! },
          ],
        });
        entryCount++;
      }

      if (u.type === 'LAUNDRY') {
        const outsideRevenue = roundTo(jitter(64_000_000 * factor, 0.15));
        const chemical = roundTo(outsideRevenue * jitter(0.19, 0.1));
        await postEntry({
          date: day(daysInMonth),
          unitId,
          description: 'Pendapatan laundry pelanggan luar',
          accounts,
          lines: [
            { code: '1-1100', debit: roundTo(outsideRevenue * 0.7) },
            { code: '1-2400', debit: outsideRevenue - roundTo(outsideRevenue * 0.7) },
            { code: '4-3200', credit: outsideRevenue },
          ],
        });
        await postEntry({
          date: day(daysInMonth),
          unitId,
          description: 'Penerimaan piutang laundry',
          accounts,
          lines: [
            { code: '1-1300', debit: outsideRevenue - roundTo(outsideRevenue * 0.7) },
            { code: '1-2400', credit: outsideRevenue - roundTo(outsideRevenue * 0.7) },
          ],
        });
        await postEntry({
          date: day(15),
          unitId,
          description: 'Pembelian chemical & deterjen',
          accounts,
          lines: [
            { code: '5-4000', debit: chemical },
            { code: '1-1300', credit: chemical },
          ],
        });
        entryCount += 3;
        monthRevenue.set(u.code, outsideRevenue);
      }

      if (u.type === 'CAFE') {
        const cafeRevenue = roundTo(jitter(188_000_000 * factor, 0.13));
        const coffee = roundTo(cafeRevenue * 0.42);
        const food = cafeRevenue - coffee;
        const cafeCogs = roundTo(cafeRevenue * jitter(0.36, 0.07));
        await postEntry({
          date: day(daysInMonth),
          unitId,
          description: 'Penjualan cafe & resto',
          accounts,
          lines: [
            { code: '1-1100', debit: roundTo(cafeRevenue * 0.45) },
            { code: '1-1300', debit: cafeRevenue - roundTo(cafeRevenue * 0.45) },
            { code: '4-2300', credit: coffee },
            { code: '4-2100', credit: food },
          ],
        });
        await postEntry({
          date: day(18),
          unitId,
          description: 'Pembelian bahan baku cafe',
          accounts,
          lines: [
            { code: '5-3000', debit: cafeCogs },
            { code: '1-1300', credit: cafeCogs },
          ],
        });
        entryCount += 2;
        monthRevenue.set(u.code, cafeRevenue);
      }

      /* ---- Beban rutin semua unit ---- */
      const base =
        u.type === 'HOTEL' ? 1.0 * u.scale : u.type === 'CAFE' ? 0.55 : 0.4;

      const payroll = roundTo(jitter(u.type === 'HOTEL' ? 92_000_000 * u.scale : u.type === 'CAFE' ? 38_000_000 : 27_000_000, 0.04));
      const bpjs = roundTo(payroll * 0.055);
      await postEntry({
        date: day(daysInMonth),
        unitId,
        description: 'Gaji, tunjangan & BPJS karyawan',
        accounts,
        lines: [
          { code: '6-1100', debit: payroll },
          { code: '6-1300', debit: bpjs },
          { code: '1-1300', credit: payroll + bpjs },
        ],
      });
      entryCount++;

      const listrik = roundTo(jitter((u.type === 'LAUNDRY' ? 34_000_000 : 26_000_000) * base * season, 0.1));
      const air = roundTo(jitter((u.type === 'LAUNDRY' ? 12_000_000 : 7_500_000) * base * season, 0.12));
      const internet = roundTo(jitter(2_400_000, 0.05));
      await postEntry({
        date: day(10),
        unitId,
        description: 'Tagihan listrik, air & internet',
        accounts,
        lines: [
          { code: '6-2100', debit: listrik },
          { code: '6-2200', debit: air },
          { code: '6-2400', debit: internet },
          { code: '1-1300', credit: listrik + air + internet },
        ],
      });
      entryCount++;

      // Pajak hotel & restoran (PB1) 10% dari omzet, disetor bulan berikutnya.
      const omzet = u.type === 'LAUNDRY' ? 0 : (monthRevenue.get(u.code) ?? 0);
      if (omzet > 0) {
        const pb1 = roundTo(omzet * 0.1);
        const serviceCharge = roundTo(omzet * 0.05);
        await postEntry({
          date: day(10),
          unitId,
          description: 'Setoran PB1 & service charge karyawan',
          accounts,
          lines: [
            { code: '6-6300', debit: pb1 },
            { code: '6-1400', debit: serviceCharge },
            { code: '1-1300', credit: pb1 + serviceCharge },
          ],
        });
        entryCount++;

        // Prive pemilik — kas yang benar-benar keluar meski bukan beban.
        const prive = roundTo(omzet * 0.1);
        await postEntry({
          date: day(28),
          unitId,
          description: 'Prive / pengambilan pemilik',
          accounts,
          lines: [
            { code: '3-3000', debit: prive },
            { code: '1-1300', credit: prive },
          ],
        });
        entryCount++;
      }

      const maintenance = roundTo(jitter(9_500_000 * base, 0.3));
      const marketing = roundTo(jitter(7_200_000 * base, 0.25));
      const admin = roundTo(jitter(6_800_000 * base, 0.15));
      await postEntry({
        date: day(25),
        unitId,
        description: 'Beban pemeliharaan, pemasaran & administrasi',
        accounts,
        lines: [
          { code: '6-3200', debit: maintenance },
          { code: '6-4100', debit: marketing },
          { code: '6-5100', debit: roundTo(admin * 0.3) },
          { code: '6-5500', debit: roundTo(admin * 0.25) },
          { code: '6-5600', debit: admin - roundTo(admin * 0.3) - roundTo(admin * 0.25) },
          { code: '1-1300', credit: maintenance + marketing + admin },
        ],
      });
      entryCount++;
    }
  }

  console.log(`✓ ${entryCount} bukti jurnal contoh (${HISTORY_MONTHS} bulan histori)`);
}

async function seedProject() {
  const unit = await prisma.businessUnit.findUnique({ where: { code: 'THU' } });
  if (!unit) return;

  const existing = await prisma.project.findFirst({ where: { name: { contains: 'Penambahan 8 Kamar' } } });
  if (existing) return;

  const accounts = new Map(
    (await prisma.account.findMany({ select: { id: true, code: true } })).map((a) => [a.code, a.id]),
  );

  const now = new Date();
  const monthOffset = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 15));

  await prisma.project.create({
    data: {
      name: 'Penambahan 8 Kamar Baru - The Hita Uluwatu',
      unitId: unit.id,
      status: 'PLANNED',
      startDate: monthOffset(1),
      endDate: monthOffset(8),
      description:
        'Pembangunan 8 kamar deluxe di lahan belakang. Contoh proyek untuk menguji menu Peramalan: '
        + 'ubah jadwal pembayaran atau nilai pendanaan lalu lihat pengaruhnya pada saldo kas.',
      fundingType: 'LOAN',
      fundingAmount: 900_000_000,
      fundingDate: monthOffset(1),
      loanRatePct: 11,
      loanTenorMonths: 60,
      upliftRevenueMonthly: 132_000_000,
      upliftExpenseMonthly: 41_000_000,
      upliftStartDate: monthOffset(9),
      items: {
        create: [
          { name: 'Desain & perizinan (IMB/PBG)', amount: 85_000_000, plannedDate: monthOffset(1), accountId: accounts.get('1-5700') },
          { name: 'Pondasi & struktur', amount: 420_000_000, plannedDate: monthOffset(2), accountId: accounts.get('1-5700') },
          { name: 'Dinding, atap & finishing', amount: 380_000_000, plannedDate: monthOffset(4), accountId: accounts.get('1-5700') },
          { name: 'Instalasi listrik & plumbing', amount: 160_000_000, plannedDate: monthOffset(5), accountId: accounts.get('1-5700') },
          { name: 'Furniture & perlengkapan kamar', amount: 240_000_000, plannedDate: monthOffset(7), accountId: accounts.get('1-5300') },
          { name: 'AC, TV & elektronik', amount: 96_000_000, plannedDate: monthOffset(7), accountId: accounts.get('1-5300') },
          { name: 'Landscaping & area luar', amount: 75_000_000, plannedDate: monthOffset(8), accountId: accounts.get('1-5700') },
        ],
      },
    },
  });

  console.log('✓ 1 contoh proyek penambahan kamar');
}

async function seedScenario() {
  const count = await prisma.forecastScenario.count();
  if (count > 0) return;

  await prisma.forecastScenario.createMany({
    data: [
      {
        name: 'Realistis',
        description: 'Asumsi dasar: pertumbuhan pendapatan 6%/tahun, biaya naik 5%/tahun.',
        horizonMonths: 24,
        method: 'WEIGHTED',
        lookbackMonths: 12,
        useSeasonality: true,
        revenueGrowthPct: 6,
        expenseGrowthPct: 5,
        minCashBuffer: 300_000_000,
      },
      {
        name: 'Konservatif',
        description: 'Pendapatan stagnan, biaya tetap naik. Dipakai untuk menguji ketahanan kas.',
        horizonMonths: 24,
        method: 'AVERAGE',
        lookbackMonths: 12,
        useSeasonality: true,
        revenueGrowthPct: 0,
        expenseGrowthPct: 8,
        minCashBuffer: 400_000_000,
      },
      {
        name: 'Optimis',
        description: 'Okupansi membaik, pendapatan tumbuh 15%/tahun.',
        horizonMonths: 24,
        method: 'TREND',
        lookbackMonths: 12,
        useSeasonality: true,
        revenueGrowthPct: 15,
        expenseGrowthPct: 6,
        minCashBuffer: 250_000_000,
      },
    ],
  });

  console.log('✓ 3 skenario peramalan bawaan');
}

async function main() {
  console.log('Menyiapkan data The Hita Finance...');
  await seedMaster();
  await seedScenario();

  if (WITH_DEMO) {
    const existing = await prisma.journalEntry.count();
    if (existing > 0) {
      console.log(`- Lewati transaksi contoh (sudah ada ${existing} bukti jurnal)`);
    } else {
      await seedTransactions();
      await seedProject();
    }
  } else {
    console.log('- SEED_DEMO=0, transaksi contoh dilewati');
  }

  console.log('Selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
