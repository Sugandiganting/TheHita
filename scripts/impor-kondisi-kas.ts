/**
 * Memuat posisi kas mingguan dari workbook proyeksi (Combined Cashflow).
 *
 * Workbook itu diperbarui tiap Senin, Rabu, dan Jumat. Mengetik ulang angkanya
 * ke layar tiap kali adalah pekerjaan yang paling mungkin salah ketik sekaligus
 * paling mudah dihindari, jadi di sini dibaca langsung dari berkasnya.
 *
 * YANG DIBACA HANYA KOLOM "(Berjalan)" — kolom berisi apa yang sudah benar-
 * benar terjadi sampai hari pembaruan: saldo kas, uang yang sudah masuk, dan
 * belanja tiap kantong. Kolom proyeksi di sebelahnya sengaja tidak disentuh,
 * begitu pula angka pengeluaran rutin: peramalan adalah pekerjaan aplikasi,
 * dihitung dari realisasi, pola musim dan target margin. Workbook dan aplikasi
 * meramal dengan cara yang berbeda, dan menimpa yang satu dengan yang lain
 * membuat angka di layar tidak lagi bisa ditelusuri asalnya.
 *
 * Workbook kondisi keuangan (sheet "Saldo New Format") boleh disertakan, tetapi
 * tidak wajib: saldo kasnya sendiri sudah ada di baris "NET CASH CUMMULATIVE
 * (Cash Basis)" pada kolom bulan berjalan, dan tanggalnya di baris SALES di
 * kolom yang sama. Kalau berkas kondisi ikut disebut, itulah yang dipakai —
 * di sana saldonya dirinci per rekening, jadi lebih mudah ditelusuri saat
 * angkanya terasa aneh.
 *
 * Contoh:
 *   npm run impor-kas -- data/Proyeksi.xlsx --coba
 *   npm run impor-kas -- data/Proyeksi.xlsx
 *   npm run impor-kas -- data/Proyeksi.xlsx data/Kondisi_Keuangan.xlsx
 *
 * Pilihan:
 *   --periode=YYYY-MM  Bulan yang diisi (bawaan: kolom berjalan terakhir yang terisi)
 *   --coba             Hanya menampilkan hasil bacaan, tidak menyimpan apa pun
 */

import { PrismaClient } from '@prisma/client';
import {
  BULAN, C, ambilSheet, angka, bacaTanggal, bukaWorkbook, cariBaris, rupiah, teks,
  type Sheet,
} from './lib-workbook';

const prisma = new PrismaClient();

/**
 * Tanggal pembaruan sebuah kolom berjalan.
 *
 * Ditulis dengan dua cara di workbook yang sama: kadang kalimat penuh
 * "Saldo per 11 November", kadang nomor harinya saja. Keduanya dibaca, dan
 * bulan serta tahunnya diambil dari kolomnya sendiri — bukan dari tulisannya,
 * yang bisa tertinggal saat kolomnya disalin ke bulan berikutnya.
 */
function tanggalKolom(ws: Sheet, barisTanggal: number, kolom: number, bulan: number, tahun: number): Date | null {
  const mentah = ws.getCell(barisTanggal, kolom).value;
  const langsung = angka(mentah);
  const hari = langsung !== null && langsung >= 1 && langsung <= 31
    ? langsung
    : Number(/(\d{1,2})/.exec(teks(mentah))?.[1] ?? NaN);
  if (!Number.isFinite(hari) || hari < 1 || hari > 31) return null;
  return new Date(Date.UTC(tahun, bulan - 1, hari));
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

  if (berkas.length < 1 || berkas.length > 2) {
    console.error('Pemakaian: npm run impor-kas -- <Proyeksi.xlsx> [Kondisi_Keuangan.xlsx] [--periode=YYYY-MM] [--coba]');
    process.exit(1);
  }

  const wbProyeksi = await bukaWorkbook(berkas[0]);
  const wbKondisi = berkas[1] ? await bukaWorkbook(berkas[1]) : null;

  const normal = ambilSheet(wbProyeksi, 'Combined Cashflow Normal');
  const judul = cariBaris(normal, 'Variable');
  const barisTanggal = cariBaris(normal, 'SALES (Historical & Projected)');
  const barisKas = cariBaris(normal, 'NET CASH CUMMULATIVE (Cash Basis)');

  /* ---- Bulan mana yang dibaca ---- */
  /*
   * Tanpa --periode, yang dipakai adalah kolom berjalan TERAKHIR yang saldonya
   * terisi. Itulah pembaruan terbaru, dan itu pula yang dimaksud orang saat
   * berkata "perbarui data kasnya" — bukan bulan tertentu yang harus diingat
   * dan disebutkan tiap kali.
   */
  const berjalanTerisi: { kolom: number; bulan: number; tahun: number }[] = [];
  for (let c = 2; c <= 40; c += 1) {
    const j = teks(normal.getCell(judul, c).value).trim().toLowerCase();
    if (!j.includes('(berjalan)')) continue;
    const bln = Number(Object.entries(BULAN).find(([, nm]) => nm.some((n) => j.startsWith(n)))?.[0]);
    const th = angka(normal.getCell(1, c).value);
    if (!bln || th === null) continue;
    if ((angka(normal.getCell(barisKas, c).value) ?? 0) === 0) continue;
    berjalanTerisi.push({ kolom: c, bulan: bln, tahun: th });
  }
  if (berjalanTerisi.length === 0) {
    throw new Error('Tidak ada satu pun kolom "(Berjalan)" yang saldonya terisi di Combined Cashflow Normal.');
  }
  const pilihan = opsi.get('periode')
    ? berjalanTerisi.find((b) => `${b.tahun}-${String(b.bulan).padStart(2, '0')}` === opsi.get('periode'))
    : berjalanTerisi[berjalanTerisi.length - 1];
  if (!pilihan) {
    throw new Error(
      `Bulan ${opsi.get('periode')} tidak punya kolom berjalan yang terisi. Yang ada: `
      + berjalanTerisi.map((b) => `${b.tahun}-${String(b.bulan).padStart(2, '0')}`).join(', '),
    );
  }
  const { kolom: kolomBerjalan, bulan, tahun } = pilihan;
  const period = `${tahun}-${String(bulan).padStart(2, '0')}`;

  /* ---- Saldo dan tanggalnya ---- */
  let tanggal: Date | null = null;
  let saldo = 0;
  let asalSaldo = '';
  if (wbKondisi) {
    const saldoSheet = ambilSheet(wbKondisi, 'Saldo New Format');
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
    asalSaldo = 'workbook kondisi keuangan';
  } else {
    tanggal = tanggalKolom(normal, barisTanggal, kolomBerjalan, bulan, tahun);
    saldo = angka(normal.getCell(barisKas, kolomBerjalan).value) ?? 0;
    if (!tanggal) {
      throw new Error(
        `Tanggal pembaruan tidak terbaca di kolom berjalan ${period} `
        + `(baris ${barisTanggal} sheet Combined Cashflow Normal). `
        + 'Tulis "Saldo per <tanggal> <bulan>" di sel itu, atau sebutkan berkas kondisi keuangannya.',
      );
    }
    asalSaldo = 'NET CASH CUMMULATIVE (Cash Basis)';
  }

  /* ---- Uang masuk dan belanja berjalan ---- */
  const barisMasuk = cariBaris(normal, 'CASHFLOW');
  const masuk = nilai(normal, barisMasuk, kolomBerjalan);

  const KATEGORI = ['Purchasing', 'HR', 'Bank Perusahaan'] as const;
  const belanja = KATEGORI.map((label) => ({
    label,
    amount: nilai(normal, cariBaris(normal, label), kolomBerjalan),
  }));

  /* ---- Laporan ---- */
  console.log(C.bold(`\nRencana kas ${period}`));
  console.log(`  Saldo per ${tanggal.toISOString().slice(0, 10)}  ${C.bold(rupiah(saldo))} ${C.dim(`(${asalSaldo})`)}`);
  console.log(`  Uang masuk bulan ini        ${rupiah(masuk)}`);
  console.log(C.dim('\n  Sudah dibelanjakan bulan ini'));
  for (const b of belanja) console.log(`    ${b.label.padEnd(18)} ${rupiah(b.amount)}`);
  console.log(C.dim(
    '\n  Hanya kolom berjalan yang dibaca. Proyeksi uang masuk dan pengeluaran rutin tidak\n'
    + '  disentuh — keduanya dihitung aplikasi dari realisasi, pola musim dan target margin.',
  ));

  if (coba) {
    console.log(C.dim('\n--coba: tidak ada yang disimpan.\n'));
    return;
  }

  /* ---- Simpan ---- */
  const plan = await prisma.cashPlan.upsert({
    where: { period },
    // Yang dibuat hanyalah wadahnya bila belum ada. Tidak ada satu pun angka
    // proyeksi yang ditulis di sini — lihat catatan di kepala berkas.
    update: {},
    create: {
      period,
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
