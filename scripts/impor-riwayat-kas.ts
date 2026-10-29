/**
 * Mengisi riwayat posisi kas dari workbook proyeksi — banyak bulan sekaligus,
 * cukup dari satu berkas.
 *
 * Bedanya dengan `impor-kas`: skrip itu mengisi SATU bulan berjalan secara
 * lengkap (proyeksi, belanja per departemen, asumsi pengeluaran) dan perlu
 * workbook kondisi keuangan untuk saldonya. Skrip ini hanya mengisi dua angka
 * per bulan — saldo kas dan uang masuk — tetapi untuk seluruh bulan yang sudah
 * lewat. Dua angka itulah yang dipakai menu Arus Kas Bulanan untuk menurunkan
 * NET CASH FLOW dan NET CASH CUMMULATIVE, jadi setelah skrip ini dijalankan
 * laporan di aplikasi akan sama persis dengan workbook.
 *
 * Saldo diambil dari baris "NET CASH CUMMULATIVE (Cash Basis)", bukan dari
 * workbook kondisi keuangan, karena baris itu memang saldo kas akhir bulan.
 *
 * Contoh:
 *   npm run impor-riwayat -- data/Proyeksi.xlsx --coba
 *   npm run impor-riwayat -- data/Proyeksi.xlsx
 *
 * Pilihan:
 *   --sheet=NAMA  Sheet yang dibaca (bawaan: "Combined Cashflow Normal")
 *   --coba        Hanya menampilkan hasil bacaan, tidak menyimpan apa pun
 */

import { PrismaClient } from '@prisma/client';
import {
  C, ambilSheet, angka, bukaWorkbook, cariBaris, nomorBulan, rupiah, teks,
  type Sheet,
} from './lib-workbook';

const prisma = new PrismaClient();

const BARIS_MASUK = 'CASHFLOW';
const BARIS_SALDO = 'NET CASH CUMMULATIVE (Cash Basis)';
const BARIS_NET = 'NET CASH FLOW';

type Kolom = {
  index: number;
  huruf: string;
  period: string;
  bulan: number;
  tahun: number;
  berjalan: boolean;
};

type Bulan = {
  period: string;
  tanggal: Date;
  saldo: number;
  masuk: number;
  /** NET CASH FLOW apa adanya dari workbook, dipakai untuk memeriksa hasil. */
  netSheet: number | null;
};

const hariTerakhir = (tahun: number, bulan: number) =>
  new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

/**
 * Judul kolom berbentuk "August (Berjalan)", "August (Projected)", atau
 * sekadar "July". Keterangan setelah baris pertama (mis. "(Updated Senin)")
 * dibuang karena isinya catatan bebas.
 */
function bacaJudul(ws: Sheet, barisJudul: number, barisTahun: number, c: number): Kolom | null {
  const baris1 = teks(ws.getCell(barisJudul, c).value).split('\n')[0].trim();
  if (!baris1) return null;
  const m = /^([A-Za-z]+)\s*(\(([^)]*)\))?/.exec(baris1);
  if (!m) return null;
  const bulan = nomorBulan(m[1]);
  if (!bulan) return null;
  const tahun = angka(ws.getCell(barisTahun, c).value);
  if (tahun === null) return null;
  const ket = (m[3] ?? '').trim().toLowerCase();
  if (ket.startsWith('projected')) return null;
  return {
    index: c,
    huruf: ws.getColumn(c).letter,
    period: `${tahun}-${String(bulan).padStart(2, '0')}`,
    bulan,
    tahun,
    berjalan: ket.startsWith('berjalan'),
  };
}

/**
 * Baris yang memuat tanggal potong tiap kolom berjalan — isinya bisa angka
 * ("31") atau kalimat ("Saldo per 28 Oktober"). Letaknya tidak tetap, jadi
 * dicari: beberapa baris di bawah judul, yang paling banyak terbaca sebagai
 * tanggal yang masuk akal untuk bulan kolomnya.
 */
function cariBarisTanggal(ws: Sheet, barisJudul: number, kolom: Kolom[]): number | null {
  const berjalan = kolom.filter((k) => k.berjalan);
  if (berjalan.length === 0) return null;
  let terbaik: { baris: number; skor: number } | null = null;
  for (let r = barisJudul + 1; r <= barisJudul + 6; r += 1) {
    const skor = berjalan.filter((k) => bacaHari(ws, r, k) !== null).length;
    if (skor > 0 && (!terbaik || skor > terbaik.skor)) terbaik = { baris: r, skor };
  }
  return terbaik?.baris ?? null;
}

function bacaHari(ws: Sheet, baris: number, k: Kolom): number | null {
  const sel = ws.getCell(baris, k.index).value;
  const n = angka(sel) ?? Number(/(\d{1,2})/.exec(teks(sel))?.[1] ?? NaN);
  if (!Number.isInteger(n) || n < 1 || n > hariTerakhir(k.tahun, k.bulan)) return null;
  return n;
}

function bacaBulan(ws: Sheet): Bulan[] {
  const barisJudul = cariBaris(ws, 'Variable');
  if (barisJudul < 2) throw new Error('Baris tahun di atas baris judul tidak ada.');
  const barisTahun = barisJudul - 1;
  const barisMasuk = cariBaris(ws, BARIS_MASUK);
  const barisSaldo = cariBaris(ws, BARIS_SALDO);
  const barisNet = cariBaris(ws, BARIS_NET);

  const semua: Kolom[] = [];
  for (let c = 2; c <= 60; c += 1) {
    const k = bacaJudul(ws, barisJudul, barisTahun, c);
    if (k) semua.push(k);
  }
  const berjalan = semua.filter((k) => k.berjalan);
  if (berjalan.length === 0) {
    throw new Error(`Tidak ada kolom "(Berjalan)" di sheet ${ws.name}, jadi bulan mana yang `
      + 'sudah terjadi tidak bisa dibedakan dari proyeksi.');
  }
  const pertama = berjalan[0].index;
  const terakhir = berjalan[berjalan.length - 1].index;
  const barisTanggal = cariBarisTanggal(ws, barisJudul, semua);

  // Satu bulan bisa punya dua kolom: yang berjalan dan yang proyeksi. Yang
  // berjalan selalu menang. Bulan tanpa kolom berjalan hanya ikut bila
  // letaknya sebelum kolom berjalan pertama — sesudah itu artinya ramalan.
  const dipilih = new Map<string, Kolom>();
  for (const k of semua) {
    if (k.index > terakhir) continue;
    if (!k.berjalan && k.index > pertama) continue;
    const ada = dipilih.get(k.period);
    if (ada && (ada.berjalan || !k.berjalan)) continue;
    dipilih.set(k.period, k);
  }

  const hasil: Bulan[] = [];
  for (const k of [...dipilih.values()].sort((a, b) => a.index - b.index)) {
    const saldo = angka(ws.getCell(barisSaldo, k.index).value);
    const masuk = angka(ws.getCell(barisMasuk, k.index).value);
    // Bulan sebelum usaha ini mulai dicatat kolomnya kosong, bukan nol.
    if (saldo === null || masuk === null) continue;
    const hari = barisTanggal === null ? null : bacaHari(ws, barisTanggal, k);
    hasil.push({
      period: k.period,
      tanggal: new Date(Date.UTC(k.tahun, k.bulan - 1, hari ?? hariTerakhir(k.tahun, k.bulan))),
      saldo: Math.round(saldo),
      masuk: Math.round(masuk),
      netSheet: angka(ws.getCell(barisNet, k.index).value),
    });
  }
  return hasil;
}

async function main() {
  const argv = process.argv.slice(2);
  const berkas = argv.filter((a) => !a.startsWith('--'));
  const opsi = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const coba = argv.includes('--coba');

  if (berkas.length !== 1) {
    console.error('Pemakaian: npm run impor-riwayat -- <Proyeksi.xlsx> [--sheet=NAMA] [--coba]');
    process.exit(1);
  }

  const wb = await bukaWorkbook(berkas[0]);
  const ws = ambilSheet(wb, opsi('sheet') ?? 'Combined Cashflow Normal');
  const bulan = bacaBulan(ws);

  if (bulan.length === 0) {
    throw new Error(`Tidak ada bulan dengan angka di baris "${BARIS_SALDO}" pada sheet ${ws.name}.`);
  }

  console.log(C.bold(`\nRiwayat posisi kas dari sheet "${ws.name}"`) + (coba ? C.dim('  ·  MODE COBA') : ''));
  console.log(C.dim(
    '\nBulan     Tanggal       Saldo kas        Uang masuk    NET CASH FLOW  Sheet',
  ));

  // Net dihitung persis seperti aplikasi menghitungnya: selisih saldo akhir
  // dengan saldo akhir bulan sebelumnya. Dibandingkan dengan baris NET CASH
  // FLOW di workbook supaya ketahuan di sini juga bila ada yang tidak cocok,
  // bukan baru setelah dibuka di layar.
  let bedanya = 0;
  bulan.forEach((b, i) => {
    const lalu = i > 0 ? bulan[i - 1] : null;
    const bersambung = lalu !== null
      && new Date(Date.UTC(lalu.tanggal.getUTCFullYear(), lalu.tanggal.getUTCMonth() + 1, 1))
        .toISOString().slice(0, 7) === b.period;
    const net = bersambung ? b.saldo - lalu!.saldo : null;
    const cocok = net !== null && b.netSheet !== null && Math.abs(net - Math.round(b.netSheet)) <= 1;
    if (net !== null && b.netSheet !== null && !cocok) bedanya += 1;
    console.log(
      b.period.padEnd(10)
      + b.tanggal.toISOString().slice(0, 10).padEnd(12)
      + rupiah(b.saldo).padStart(16)
      + rupiah(b.masuk).padStart(18)
      + (net === null ? C.dim('—'.padStart(17)) : rupiah(net).padStart(17))
      + '  ' + (net === null ? C.dim('belum ada bulan sebelumnya') : cocok ? C.ok('cocok') : C.bad('BEDA')),
    );
  });

  if (bedanya > 0) {
    console.log(C.warn(`\n${bedanya} bulan berbeda dari baris "${BARIS_NET}" di workbook. `
      + 'Biasanya karena ada bulan yang terlewat di tengah, sehingga selisih saldonya '
      + 'menumpuk dua bulan jadi satu.'));
  }

  if (coba) {
    console.log(C.dim('\n--coba: tidak ada yang disimpan.\n'));
    return;
  }

  let baru = 0;
  for (const b of bulan) {
    // Rencana kas dibuat kosong bila belum ada: skrip ini hanya bertugas
    // mengisi posisi kas, bukan menebak jatah atau proyeksi bulan yang lewat.
    const plan = await prisma.cashPlan.upsert({
      where: { period: b.period }, update: {}, create: { period: b.period },
    });
    const ada = await prisma.cashCheckpoint.findUnique({
      where: { planId_date: { planId: plan.id, date: b.tanggal } },
    });
    if (!ada) baru += 1;
    await prisma.cashCheckpoint.upsert({
      where: { planId_date: { planId: plan.id, date: b.tanggal } },
      update: { cashOnHand: b.saldo, incomeToDate: b.masuk },
      create: {
        planId: plan.id, date: b.tanggal, cashOnHand: b.saldo, incomeToDate: b.masuk,
        notes: `Diimpor dari sheet ${ws.name}`,
      },
    });
  }

  console.log(C.ok(`\n${bulan.length} bulan tersimpan (${baru} laporan baru, `
    + `${bulan.length - baru} diperbarui).`));
  console.log(C.dim('Buka Laporan → Finance → Arus Kas Bulanan untuk memeriksanya.\n'));
}

main()
  .catch((e) => {
    console.error(C.bad(`\n${e instanceof Error ? e.message : String(e)}\n`));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
