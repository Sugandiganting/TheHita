/**
 * Memuat posisi kas mingguan dari dua berkas kerja yang sudah dipakai sehari-hari:
 * workbook proyeksi (Combined Cashflow) dan workbook kondisi keuangan (Saldo).
 *
 * Keduanya diperbarui tiap Senin, Rabu, dan Jumat. Mengetik ulang angkanya ke
 * layar tiap kali adalah pekerjaan yang paling mungkin salah ketik sekaligus
 * paling mudah dihindari, jadi di sini dibaca langsung dari berkasnya.
 *
 * Contoh:
 *   npm run impor-kas -- data/Proyeksi.xlsx data/Kondisi_Keuangan.xlsx --coba
 *   npm run impor-kas -- data/Proyeksi.xlsx data/Kondisi_Keuangan.xlsx
 *
 * Pilihan:
 *   --periode=YYYY-MM  Bulan yang diisi (bawaan: bulan dari tanggal saldo terakhir)
 *   --coba             Hanya menampilkan hasil bacaan, tidak menyimpan apa pun
 */

import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { toPeriod } from '../src/lib/period';

const prisma = new PrismaClient();

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bad: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};
const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

/** Nama bulan Inggris dan Indonesia dipakai bercampur di dalam workbook. */
const BULAN: Record<number, string[]> = {
  1: ['january', 'januari'], 2: ['february', 'februari'], 3: ['march', 'maret'],
  4: ['april'], 5: ['may', 'mei'], 6: ['june', 'juni'], 7: ['july', 'juli'],
  8: ['august', 'agustus'], 9: ['september'], 10: ['october', 'oktober'],
  11: ['november'], 12: ['december', 'desember'],
};

type Sheet = import('exceljs').Worksheet;

const teks = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null) {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.result !== undefined) return teks(o.result);
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if (o.text !== undefined) return String(o.text);
  }
  return String(v);
};

const angka = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const r = (v as { result?: unknown }).result;
    if (typeof r === 'number') return r;
  }
  return null;
};

/**
 * Tanggal di kolom saldo diketik sebagai teks biasa, mis. "12 Oktober 2026",
 * bukan sebagai tanggal Excel — jadi keduanya harus bisa dibaca.
 */
function bacaTanggal(v: unknown): Date | null {
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  const m = /^\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/.exec(teks(v));
  if (!m) return null;
  const nama = m[2].toLowerCase();
  const bulan = Object.entries(BULAN).find(([, daftar]) => daftar.includes(nama))?.[0];
  if (!bulan) return null;
  return new Date(Date.UTC(Number(m[3]), Number(bulan) - 1, Number(m[1])));
}

async function bukaWorkbook(path: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(path)).buffer as ArrayBuffer);
  return wb;
}

function ambilSheet(wb: import('exceljs').Workbook, nama: string): Sheet {
  const ws = wb.getWorksheet(nama);
  if (!ws) {
    throw new Error(
      `Sheet "${nama}" tidak ada. Yang tersedia: ${wb.worksheets.map((w) => w.name).join(', ')}`,
    );
  }
  return ws;
}

/** Nomor baris yang kolom A-nya persis berbunyi `label`. */
function cariBaris(ws: Sheet, label: string, sampai = 80): number {
  for (let r = 1; r <= sampai; r += 1) {
    if (teks(ws.getCell(r, 1).value).trim().toLowerCase() === label.toLowerCase()) return r;
  }
  throw new Error(`Baris "${label}" tidak ditemukan di sheet ${ws.name}`);
}

/**
 * Kolom bulan pada baris judul. `berjalan` memilih kolom "(Berjalan)" yang
 * berisi angka sampai hari ini; selain itu kolom proyeksi, yang judulnya hanya
 * nama bulan tanpa keterangan apa pun.
 */
function cariKolom(ws: Sheet, barisJudul: number, bulan: number, berjalan: boolean): number {
  const nama = BULAN[bulan];
  for (let c = 2; c <= 40; c += 1) {
    const j = teks(ws.getCell(barisJudul, c).value).trim().toLowerCase();
    if (!j || !nama.some((n) => j.startsWith(n))) continue;
    const sisa = j.slice(nama.find((n) => j.startsWith(n))!.length).trim();
    if (berjalan ? sisa.startsWith('(berjalan)') : sisa === '') return c;
  }
  throw new Error(
    `Kolom ${berjalan ? 'berjalan' : 'proyeksi'} bulan ${nama[0]} tidak ditemukan di sheet ${ws.name}`,
  );
}

const nilai = (ws: Sheet, r: number, c: number) => angka(ws.getCell(r, c).value) ?? 0;

async function main() {
  const argv = process.argv.slice(2);
  const berkas = argv.filter((a) => !a.startsWith('--'));
  const opsi = new Map(
    argv.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'];
    }),
  );
  const coba = opsi.has('coba');

  if (berkas.length !== 2) {
    console.error('Pemakaian: npm run impor-kas -- <Proyeksi.xlsx> <Kondisi_Keuangan.xlsx> [--periode=YYYY-MM] [--coba]');
    process.exit(1);
  }

  const [wbProyeksi, wbKondisi] = await Promise.all([bukaWorkbook(berkas[0]), bukaWorkbook(berkas[1])]);

  /* ---- Saldo terakhir dari workbook kondisi keuangan ---- */
  const saldoSheet = ambilSheet(wbKondisi, 'Saldo New Format');
  let tanggal: Date | null = null;
  let saldo = 0;
  for (let r = 1; r <= 200; r += 1) {
    const b = bacaTanggal(saldoSheet.getCell(r, 2).value);
    const total = angka(saldoSheet.getCell(r, 10).value);
    if (!b || total === null || total <= 0) continue;
    // Baris terakhir yang terisi menang, jadi sheet boleh terus ditambahi
    // ke bawah tanpa perlu menyebutkan baris mana yang dipakai.
    tanggal = b;
    saldo = total;
  }
  if (!tanggal) throw new Error('Tidak ada baris saldo bertanggal di sheet "Saldo New Format".');

  const period = opsi.get('periode') ?? toPeriod(tanggal);
  const bulan = Number(period.slice(5, 7));
  const bulanLalu = bulan === 1 ? 12 : bulan - 1;

  /* ---- Uang masuk dan belanja berjalan dari Combined Cashflow Normal ---- */
  const normal = ambilSheet(wbProyeksi, 'Combined Cashflow Normal');
  const judul = cariBaris(normal, 'Variable');
  const kolomBerjalan = cariKolom(normal, judul, bulan, true);

  const barisMasuk = cariBaris(normal, 'CASHFLOW');
  const masuk = nilai(normal, barisMasuk, kolomBerjalan);

  const KATEGORI = ['Purchasing', 'HR', 'Bank Perusahaan'] as const;
  const belanja = KATEGORI.map((label) => ({
    label,
    amount: nilai(normal, cariBaris(normal, label), kolomBerjalan),
  }));

  /* ---- Pengeluaran rutin: bulan lalu, lengkap dengan cicilan bank ---- */
  const kolomLalu = cariKolom(normal, judul, bulanLalu, true);
  const keluarLalu = nilai(normal, cariBaris(normal, 'TOTAL CASHOUTFLOW'), kolomLalu);
  const utangLalu = nilai(normal, cariBaris(normal, 'UTANG BANK'), kolomLalu);
  const pengeluaranRutin = keluarLalu + utangLalu;

  /* ---- Proyeksi tiga skenario ---- */
  const proyeksiNormal = nilai(normal, barisMasuk, cariKolom(normal, judul, bulan, false));
  const skenarioLain = (nama: string, bln = bulan) => {
    const ws = ambilSheet(wbProyeksi, nama);
    const j = cariBaris(ws, 'Variable');
    return nilai(ws, cariBaris(ws, 'TOTAL CASHFLOW'), cariKolom(ws, j, bln, false));
  };
  const proyeksiPesimis = skenarioLain('Combined Cashflow Pesimistic');
  const proyeksiOptimis = skenarioLain('Combined Cashflow Optimistic');

  // Bulan berikutnya bisa saja belum ada kolomnya — bulan Desember misalnya,
  // yang menyeberang tahun. Tidak ketemu berarti dikosongkan, dan sistem
  // memperlakukan bulan-bulan sesudahnya sama dengan bulan berjalan.
  const bulanDepan = bulan === 12 ? 1 : bulan + 1;
  const bolehKosong = (f: () => number): number | null => {
    try {
      const v = f();
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  };
  const depanNormal = bolehKosong(() => nilai(normal, barisMasuk, cariKolom(normal, judul, bulanDepan, false)));
  const depanPesimis = bolehKosong(() => skenarioLain('Combined Cashflow Pesimistic', bulanDepan));
  const depanOptimis = bolehKosong(() => skenarioLain('Combined Cashflow Optimistic', bulanDepan));

  /* ---- Laporan ---- */
  console.log(C.bold(`\nRencana kas ${period}`));
  console.log(`  Saldo per ${tanggal.toISOString().slice(0, 10)}  ${C.bold(rupiah(saldo))}`);
  console.log(`  Uang masuk bulan ini        ${rupiah(masuk)}`);
  console.log(C.dim('\n  Sudah dibelanjakan bulan ini'));
  for (const b of belanja) console.log(`    ${b.label.padEnd(18)} ${rupiah(b.amount)}`);
  console.log(C.dim('\n  Proyeksi uang masuk sebulan'));
  console.log(`    Pesimis            ${rupiah(proyeksiPesimis)}`);
  console.log(`    Normal             ${rupiah(proyeksiNormal)}`);
  console.log(`    Optimis            ${rupiah(proyeksiOptimis)}`);
  if (depanNormal || depanPesimis || depanOptimis) {
    console.log(C.dim('\n  Proyeksi bulan berikutnya (untuk ramalan kas habis)'));
    console.log(`    Pesimis            ${depanPesimis === null ? C.dim('mengikuti bulan ini') : rupiah(depanPesimis)}`);
    console.log(`    Normal             ${depanNormal === null ? C.dim('mengikuti bulan ini') : rupiah(depanNormal)}`);
    console.log(`    Optimis            ${depanOptimis === null ? C.dim('mengikuti bulan ini') : rupiah(depanOptimis)}`);
  }

  console.log(`\n  Pengeluaran rutin/bulan      ${rupiah(pengeluaranRutin)} ${C.dim(`(bulan ${bulanLalu}, termasuk cicilan bank)`)}`);

  if (proyeksiOptimis < proyeksiNormal) {
    console.log(C.warn(
      `\n  Peringatan: proyeksi optimis (${rupiah(proyeksiOptimis)}) lebih kecil daripada normal `
      + `(${rupiah(proyeksiNormal)}).\n  Sheet Optimistic tampaknya belum ikut diperbarui. Angkanya tetap dimuat apa adanya.`,
    ));
  }

  if (coba) {
    console.log(C.dim('\n--coba: tidak ada yang disimpan.\n'));
    return;
  }

  /* ---- Simpan ---- */
  const plan = await prisma.cashPlan.upsert({
    where: { period },
    update: {
      incomePessimistic: proyeksiPesimis,
      incomeNormal: proyeksiNormal,
      incomeOptimistic: proyeksiOptimis,
      nextPessimistic: depanPesimis,
      nextNormal: depanNormal,
      nextOptimistic: depanOptimis,
      monthlyOutflow: pengeluaranRutin,
    },
    create: {
      period,
      incomePessimistic: proyeksiPesimis,
      incomeNormal: proyeksiNormal,
      incomeOptimistic: proyeksiOptimis,
      nextPessimistic: depanPesimis,
      nextNormal: depanNormal,
      nextOptimistic: depanOptimis,
      monthlyOutflow: pengeluaranRutin,
      categories: { create: KATEGORI.map((label, sort) => ({ label, weight: 1, sort })) },
    },
    include: { categories: true },
  });

  await prisma.cashCheckpoint.upsert({
    where: { planId_date: { planId: plan.id, date: tanggal } },
    update: { cashOnHand: saldo, incomeToDate: masuk },
    create: { planId: plan.id, date: tanggal, cashOnHand: saldo, incomeToDate: masuk, notes: 'Diimpor dari workbook' },
  });

  // Angka belanja dari workbook selalu total sejak awal bulan, jadi dicatat
  // sebagai SETEL — menambahkannya akan menumpuk ganda tiap kali diimpor ulang.
  //
  // Nama kategori di sistem tidak selalu sama persis dengan di workbook:
  // "HR" di sana bisa bernama "Petty cash & HR" di sini. Dicocokkan per kata
  // supaya tidak lahir kategori kembar, tetapi tidak sampai mencocokkan
  // potongan kata yang kebetulan sama.
  const cocokKategori = (label: string, kandidat: string) => {
    const a = label.trim().toLowerCase();
    const b2 = kandidat.trim().toLowerCase();
    if (a === b2) return true;
    return b2.split(/[^a-z0-9]+/).includes(a);
  };

  for (const b of belanja) {
    let kategori = plan.categories.find((k) => cocokKategori(b.label, k.label));
    if (kategori && kategori.label !== b.label) {
      console.log(C.dim(`    ${b.label} dicocokkan ke kategori "${kategori.label}"`));
    }
    kategori ??= await prisma.spendCategory.create({
      data: { planId: plan.id, label: b.label, weight: 1, sort: plan.categories.length },
    });
    await prisma.spendEntry.deleteMany({
      where: { planId: plan.id, categoryId: kategori.id, date: tanggal, mode: 'SETEL' },
    });
    await prisma.spendEntry.create({
      data: {
        planId: plan.id, categoryId: kategori.id, date: tanggal,
        amount: b.amount, mode: 'SETEL', notes: 'Diimpor dari workbook',
      },
    });
  }

  console.log(C.ok(`\n  Tersimpan ke rencana kas ${period}.\n`));
}

main()
  .catch((e) => {
    console.error(C.bad(`\n${e instanceof Error ? e.message : String(e)}\n`));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
