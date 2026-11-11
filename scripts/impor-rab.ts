/**
 * Memasukkan RAB Purchasing dari lembar Excel ke tabel Budget.
 *
 * Satu sheet per cabang, satu baris per barang, satu kolom per bulan. Tiap
 * bulan menjadi RAB-nya sendiri — itulah bentuk RAB di aplikasi ini — jadi
 * satu lembar delapan bulan untuk lima cabang menjadi empat puluh RAB.
 *
 * Barang TIDAK pernah dibuat sendiri di sini. RAB yang menyebut barang yang
 * belum terdaftar akan menghentikan impor beserta daftar barangnya, karena
 * master barang adalah tempat akun COA diputuskan, dan menebaknya dari lembar
 * anggaran berarti menaruh keputusan akuntansi di tempat yang salah.
 *
 * Contoh:
 *   npx tsx scripts/impor-rab.ts data/RAB_2026-2027.xlsx --coba
 *   npx tsx scripts/impor-rab.ts data/RAB_2026-2027.xlsx
 */

import { PrismaClient } from '@prisma/client';
import { C, bukaWorkbook, rupiah, teks, type Sheet } from './lib-workbook';
import { cocokkanAkun, type AkunRingkas } from '../src/lib/impor-barang';
import {
  nilaiBaris, periodeDariJudul, siapkanRab,
  type BarisRab, type BarisSiap, type KolomBulan,
} from '../src/lib/impor-rab';

const prisma = new PrismaClient();

/** Sheet yang bukan RAB cabang. */
const BUKAN_CABANG = /^summary/i;

const JUDUL = {
  code: ['code', 'kode', 'kode item'],
  name: ['nama barang', 'nama item', 'nama'],
  satuan: ['satuan'],
  harga: ['harga'],
  type: ['type', 'tipe'],
  department: ['department', 'departemen'],
  coa: ['coa', 'akun'],
} as const;

type Kolom = { [K in keyof typeof JUDUL]: number };

/**
 * Nomor kolom tiap bidang beserta kolom-kolom bulannya.
 *
 * Judul yang sama muncul dua kali di baris yang sama: sekali untuk kolom
 * datanya, sekali lagi di blok rekapitulasi di sebelah kanan lembar. Yang
 * dipakai selalu yang PERTAMA — blok kanan itu ringkasan per COA, bukan data
 * per baris, dan membacanya akan memberi nilai yang tidak ada hubungannya
 * dengan barang di baris itu.
 */
function cariKolom(ws: Sheet): { kolom: Kolom; bulan: KolomBulan[]; barisJudul: number } {
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r += 1) {
    if (teks(ws.getCell(r, 1).value).trim().toUpperCase() !== 'CODE') continue;

    const judul = new Map<string, number>();
    const bulan: KolomBulan[] = [];
    for (let c = 1; c <= ws.columnCount; c += 1) {
      const mentah = ws.getCell(r, c).value;
      const periode = periodeDariJudul(mentah);
      if (periode) {
        bulan.push({ kolom: c, periode });
        continue;
      }
      const t = teks(mentah).trim().toLowerCase();
      if (t && !judul.has(t)) judul.set(t, c);
    }
    const temu = (pilihan: readonly string[]) => {
      for (const p of pilihan) {
        const c = judul.get(p);
        if (c) return c;
      }
      return 0;
    };
    const kolom = {
      code: temu(JUDUL.code), name: temu(JUDUL.name), satuan: temu(JUDUL.satuan),
      harga: temu(JUDUL.harga), type: temu(JUDUL.type),
      department: temu(JUDUL.department), coa: temu(JUDUL.coa),
    };
    const kurang = (Object.keys(kolom) as (keyof Kolom)[]).filter((k) => kolom[k] === 0);
    if (kurang.length > 0) {
      throw new Error(
        `Lembar "${ws.name}": kolom ${kurang.join(', ')} tidak ada di baris judulnya (baris ${r}).`,
      );
    }
    if (bulan.length === 0) {
      throw new Error(`Lembar "${ws.name}": tidak ada satu pun kolom bulan di baris judul ${r}.`);
    }
    return { kolom, bulan, barisJudul: r };
  }
  throw new Error(`Lembar "${ws.name}": baris judul (yang kolom A-nya "CODE") tidak ketemu.`);
}

const angka = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && typeof (v as { result?: unknown }).result === 'number') {
    return (v as { result: number }).result;
  }
  return null;
};

function bacaLembar(ws: Sheet): BarisRab[] {
  const { kolom, bulan, barisJudul } = cariKolom(ws);
  const hasil: BarisRab[] = [];
  for (let r = barisJudul + 1; r <= ws.rowCount; r += 1) {
    const ambil = (c: number) => teks(ws.getCell(r, c).value).trim();
    const code = ambil(kolom.code);
    // Baris kosong dan baris jumlah bukan barang; itu bagian tata letak
    // lembarnya, bukan data yang hilang.
    if (!code || /^(total|grand|sub)/i.test(code)) continue;
    hasil.push({
      sheet: ws.name,
      baris: r,
      code,
      name: ambil(kolom.name),
      type: ambil(kolom.type),
      department: ambil(kolom.department),
      coa: ambil(kolom.coa),
      satuan: ambil(kolom.satuan),
      harga: angka(ws.getCell(r, kolom.harga).value),
      bulanan: bulan.map((b) => ({
        periode: b.periode,
        jumlah: angka(ws.getCell(r, b.kolom).value) ?? 0,
      })),
    });
  }
  return hasil;
}

/* ------------------------------------------------------------------ cabang */

/** Nama sheet yang tidak sama persis dengan nama cabangnya di aplikasi. */
const ALIAS_CABANG: Record<string, string> = {
  srk: 'SKR',
  'sri krisna': 'SKR',
  'play laundry': 'PLD',
  laundry: 'PLD',
  igyt: 'IGYT',
};

async function petaCabang(sheet: string[]): Promise<Map<string, string>> {
  const unit = await prisma.businessUnit.findMany({
    where: { active: true, isPool: false },
    select: { code: true, name: true },
  });
  const peta = new Map<string, string>();
  const belum: string[] = [];
  for (const s of sheet) {
    const k = s.trim().toLowerCase();
    const hit = unit.find((u) => u.name.toLowerCase() === k || u.code.toLowerCase() === k)
      ?? unit.find((u) => u.code === ALIAS_CABANG[k]);
    if (hit) peta.set(s, hit.code);
    else belum.push(s);
  }
  if (belum.length > 0) {
    throw new Error(
      `Sheet ini tidak ketemu cabangnya: ${belum.join(', ')}.\n`
      + `Cabang yang terdaftar: ${unit.map((u) => `${u.code} (${u.name})`).join(', ')}.`,
    );
  }
  return peta;
}

/* ------------------------------------------------------------------- barang */

type ItemRingkas = {
  id: string; code: string; name: string;
  kategori: string; departemen: string; accountId: string; accountCode: string; accountName: string;
};

/**
 * Mencari barang yang dimaksud satu baris RAB.
 *
 * Dua lapis. Pertama kategori + departemen + kode, persis seperti barangnya
 * didaftarkan. Kalau tidak ketemu, kodenya dicari sendirian lalu disaring
 * dengan AKUN dari kolom COA — karena akunlah yang sebenarnya membedakan dua
 * barang berkode sama, dan departemen di lembar anggaran menyebut siapa yang
 * membeli, yang tidak selalu sama dengan departemen tempat barangnya terdaftar.
 *
 * Kalau penyaringan itu menyisakan lebih dari satu, impornya berhenti. Memilih
 * salah satu berarti menebak akun sebuah pengeluaran.
 */
function cariBarang(
  b: BarisSiap,
  perKunci: Map<string, ItemRingkas>,
  perKode: Map<string, ItemRingkas[]>,
  akun: AkunRingkas[],
): { ok: true; item: ItemRingkas; lewatAkun: boolean } | { ok: false; sebab: string } {
  const persis = perKunci.get(`${b.type}|${b.department.toLowerCase()}|${b.code}`);
  if (persis) return { ok: true, item: persis, lewatAkun: false };

  const sekode = perKode.get(b.code) ?? [];
  if (sekode.length === 0) {
    return { ok: false, sebab: `${b.code} "${b.name}" belum ada di master barang sama sekali.` };
  }

  const hasil = cocokkanAkun(b.coa, akun);
  if (!hasil.ok) {
    return {
      ok: false,
      sebab: `${b.code} tidak terdaftar di ${b.type}/${b.department}, dan akun "${b.coa}" di `
        + 'lembarnya tidak dikenali bagan akun, jadi tidak ada cara memastikan barang mana yang '
        + `dimaksud. Terdaftar di: ${sekode.map((i) => `${i.kategori}/${i.departemen}`).join(', ')}.`,
    };
  }
  const cocok = sekode.filter((i) => i.accountId === hasil.akun.id);
  if (cocok.length === 1) return { ok: true, item: cocok[0], lewatAkun: true };
  if (cocok.length === 0) {
    return {
      ok: false,
      sebab: `${b.code} "${b.name}" di lembar masuk ${b.type}/${b.department} dengan akun `
        + `${hasil.akun.code} ${hasil.akun.name}, tetapi tidak ada barang berkode itu yang `
        + `akunnya sama. Yang ada: ${sekode.map((i) => `${i.kategori}/${i.departemen} → ${i.accountCode}`).join(', ')}.`,
    };
  }
  return {
    ok: false,
    sebab: `${b.code} "${b.name}" cocok dengan ${cocok.length} barang sekaligus `
      + `(${cocok.map((i) => `${i.kategori}/${i.departemen}`).join(', ')}). Sebutkan departemennya `
      + 'di lembar RAB supaya tidak perlu ditebak.',
  };
}

/* -------------------------------------------------------------------- utama */

async function utama() {
  const argv = process.argv.slice(2);
  const coba = argv.includes('--coba');
  const aktif = argv.includes('--aktif');
  const berkas = argv.find((a) => !a.startsWith('--'));
  if (!berkas) {
    console.error('Pemakaian: npx tsx scripts/impor-rab.ts <berkas.xlsx> [--coba] [--aktif]');
    process.exit(1);
  }

  const wb = await bukaWorkbook(berkas);
  const lembar = wb.worksheets.filter((w) => !BUKAN_CABANG.test(w.name));
  if (lembar.length === 0) throw new Error('Tidak ada satu pun sheet cabang di berkas ini.');
  console.log(C.bold(`${berkas} — ${lembar.length} sheet cabang: ${lembar.map((w) => w.name).join(', ')}`));

  const cabang = await petaCabang(lembar.map((w) => w.name));
  const mentah = lembar.flatMap((ws) => bacaLembar(ws));
  const { siap, terpakai, kosong, rupiah: baganRupiah, masalah } = siapkanRab(mentah);

  const periode = [...new Set(siap.map((s) => s.periode))].sort();
  console.log(C.dim(`${mentah.length} baris barang dibaca · ${periode.length} bulan: ${periode[0]} s/d ${periode[periode.length - 1]}`));

  /* ------- barang dicocokkan lebih dulu, sebelum apa pun ditulis ------- */

  const item = await prisma.item.findMany({
    select: {
      id: true, code: true, name: true,
      category: { select: { code: true } },
      subCategory: { select: { name: true } },
      account: { select: { id: true, code: true, name: true } },
    },
  });
  const ringkas: ItemRingkas[] = item.map((i) => ({
    id: i.id, code: i.code, name: i.name,
    kategori: i.category.code, departemen: i.subCategory.name,
    accountId: i.account.id, accountCode: i.account.code, accountName: i.account.name,
  }));
  const perKunci = new Map(ringkas.map((i) => [`${i.kategori}|${i.departemen.toLowerCase()}|${i.code}`, i]));
  const perKode = new Map<string, ItemRingkas[]>();
  for (const i of ringkas) perKode.set(i.code, [...(perKode.get(i.code) ?? []), i]);

  const akun = await prisma.account.findMany({
    where: {
      isHeader: false, active: true,
      OR: [
        { type: { in: ['EXPENSE', 'COGS'] } },
        { type: 'ASSET', subtype: { in: ['INVENTORY', 'FIXED_ASSET'] } },
      ],
    },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true },
  });

  const terpasang = new Map<BarisSiap, ItemRingkas>();
  const lewatAkun = new Map<string, { b: BarisSiap; item: ItemRingkas }>();
  const takKetemu = new Map<string, string>();
  for (const b of siap) {
    const h = cariBarang(b, perKunci, perKode, akun);
    if (h.ok) {
      terpasang.set(b, h.item);
      if (h.lewatAkun) lewatAkun.set(`${b.code}|${b.department}`, { b, item: h.item });
    } else {
      takKetemu.set(`${b.code}|${b.type}|${b.department}`, h.sebab);
    }
  }

  if (masalah.length > 0 || takKetemu.size > 0) {
    console.log();
    if (masalah.length > 0) {
      console.log(C.bad(`${masalah.length} hal harus dibereskan di lembarnya dulu:`));
      for (const m of masalah) console.log(`  • ${m}`);
      console.log();
    }
    if (takKetemu.size > 0) {
      console.log(C.bad(`${takKetemu.size} barang tidak ketemu di master:`));
      for (const s of takKetemu.values()) console.log(`  • ${s}`);
      console.log();
      console.log(C.dim(
        '  Daftarkan dulu di menu Master Barang, atau lewat BARANG_TAMBAHAN pada\n'
        + '  src/lib/impor-barang.ts lalu jalankan ulang "npm run impor-barang". RAB tidak boleh\n'
        + '  membuat barang sendiri: akun COA diputuskan di master, bukan di lembar anggaran.',
      ));
    }
    console.log(C.bad('\nTidak ada yang ditulis.'));
    process.exitCode = 1;
    return;
  }

  /* ------------------------------ ringkasan ------------------------------ */

  console.log(C.ok(`\n${siap.length} baris RAB siap, semuanya ketemu barangnya.`));

  if (terpakai.length > 0) {
    const sekali = [...new Set(terpakai)];
    console.log(C.warn(`\n${sekali.length} kode diperbaiki saat dibaca, sama seperti di master barang:`));
    for (const t of sekali) console.log(`  ${t.kode} "${t.nama}" → ${C.bold(t.jadi)}\n      ${C.dim(t.alasan)}`);
  }

  if (lewatAkun.size > 0) {
    console.log(C.warn(`\n${lewatAkun.size} barang dipakai departemen lain daripada tempatnya terdaftar:`));
    for (const { b, item } of lewatAkun.values()) {
      console.log(`  ${b.code} ${b.name}\n      di lembar ${b.sheet}: ${b.department} · `
        + `terdaftar di ${item.kategori}/${item.departemen} · akunnya sama (${item.accountCode}), jadi dipakai yang itu`);
    }
    console.log(C.dim('  Kalau salah satunya seharusnya barang tersendiri dengan akun berbeda, daftarkan di master dulu.'));
  }

  if (baganRupiah.length > 0) {
    console.log(C.warn(`\n${baganRupiah.length} baris nilainya langsung rupiah, bukan jumlah kali harga satuan:`));
    for (const b of baganRupiah) {
      const total = b.bulanan.reduce((s, x) => s + x.jumlah, 0);
      console.log(`  ${b.sheet} b${b.baris} ${b.code} ${b.name} (satuan "${b.satuan}", HARGA kosong)`);
      console.log(C.dim(`      disimpan 1 × nilai tiap bulannya; total ${rupiah(total)}`));
    }
  }

  if (kosong.length > 0) {
    console.log(C.dim(`\n${kosong.length} baris tidak menganggarkan apa pun sepanjang 8 bulan, jadi dilewati:`));
    const per = new Map<string, string[]>();
    for (const k of kosong) per.set(k.sheet, [...(per.get(k.sheet) ?? []), k.code]);
    for (const [s, kode] of per) console.log(C.dim(`  ${s}: ${kode.join(', ')}`));
  }

  console.log('\nRAB yang akan dibuat:');
  const rekap = new Map<string, { baris: number; nilai: number }>();
  for (const b of siap) {
    const k = `${cabang.get(b.sheet)}|${b.periode}`;
    const cur = rekap.get(k) ?? { baris: 0, nilai: 0 };
    rekap.set(k, { baris: cur.baris + 1, nilai: cur.nilai + nilaiBaris(b) });
  }
  const perCabang = new Map<string, { baris: number; nilai: number; bulan: number }>();
  for (const [k, v] of rekap) {
    const [unit] = k.split('|');
    const cur = perCabang.get(unit) ?? { baris: 0, nilai: 0, bulan: 0 };
    perCabang.set(unit, { baris: cur.baris + v.baris, nilai: cur.nilai + v.nilai, bulan: cur.bulan + 1 });
  }
  let semuaNilai = 0;
  for (const [unit, v] of perCabang) {
    console.log(`  ${unit.padEnd(6)} ${String(v.bulan).padStart(2)} bulan · ${String(v.baris).padStart(4)} baris · ${rupiah(v.nilai).padStart(16)}`);
    semuaNilai += v.nilai;
  }
  console.log(`  ${'TOTAL'.padEnd(6)} ${String(rekap.size).padStart(2)} RAB   · ${String(siap.length).padStart(4)} baris · ${rupiah(semuaNilai).padStart(16)}`);

  if (coba) {
    console.log(C.warn('\n--coba: tidak ada yang ditulis.'));
    return;
  }

  /* ------------------------------- menulis ------------------------------- */

  const status = aktif ? 'ACTIVE' : 'DRAFT';
  const idBudget = new Map<string, string>();
  for (const k of rekap.keys()) {
    const [scope, period] = k.split('|');
    const row = await prisma.budget.upsert({
      where: { scope_period_kind: { scope, period, kind: 'PURCHASING' } },
      update: {},
      create: { scope, period, kind: 'PURCHASING', status },
      select: { id: true },
    });
    idBudget.set(k, row.id);
  }

  let baru = 0;
  let ubah = 0;
  for (const b of siap) {
    const budgetId = idBudget.get(`${cabang.get(b.sheet)}|${b.periode}`)!;
    const itemId = terpasang.get(b)!.id;
    const data = { quantity: b.quantity, unitPrice: b.unitPrice, notes: b.catatan };
    const ada = await prisma.budgetItemLine.findUnique({
      where: { budgetId_itemId: { budgetId, itemId } },
      select: { id: true },
    });
    if (ada) {
      await prisma.budgetItemLine.update({ where: { id: ada.id }, data });
      ubah += 1;
    } else {
      await prisma.budgetItemLine.create({ data: { ...data, budgetId, itemId } });
      baru += 1;
    }
  }
  console.log(C.ok(`\n${rekap.size} RAB (${status}) · ${baru} baris baru, ${ubah} diperbarui.`));
  if (!aktif) {
    console.log(C.dim('  Masih DRAFT, jadi belum ikut dihitung di laporan dan peramalan. '
      + 'Sahkan dari halaman RAB-nya, atau jalankan ulang dengan --aktif.'));
  }
}

utama()
  .catch((e) => {
    console.error(C.bad(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
