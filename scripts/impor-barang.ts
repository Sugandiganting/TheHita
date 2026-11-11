/**
 * Memasukkan master barang dari lembar Excel ke tabel Item.
 *
 * Lembarnya cukup punya baris judul dengan kolom Kode Item, Nama Item, Unit,
 * Category, Sub Category dan COA; kolom Catatan ikut dibaca kalau ada.
 * Kategori, sub kategori (departemen) dan satuan yang belum terdaftar dibuat
 * sendiri — yang tidak dibuat sendiri hanyalah akun COA, karena menambah akun
 * ke bagan akun adalah keputusan yang harus diambil orang, bukan skrip.
 *
 * Barang dikenali dari kategori + sub kategori + kode, jadi menjalankannya dua
 * kali tidak menggandakan apa pun: yang sudah ada diperbarui.
 *
 * Contoh:
 *   npx tsx scripts/impor-barang.ts data/Master_Data_Items.xlsx --coba
 *   npx tsx scripts/impor-barang.ts data/Master_Data_Items.xlsx
 *   npx tsx scripts/impor-barang.ts data/Master_Data_Items.xlsx --lembar="Master Data"
 */

import { PrismaClient } from '@prisma/client';
import { C, bukaWorkbook, teks, type Sheet } from './lib-workbook';
import {
  coaBerbeda, cocokkanAkun, siapkanLembar, tanpaKembar,
  type AkunRingkas, type BarangSiap, type BarisLembar,
} from '../src/lib/impor-barang';

const prisma = new PrismaClient();

/** Lembar yang dicoba berurutan kalau --lembar tidak disebut. */
const LEMBAR_BAWAAN = ['Master Data Lengkap', 'Master Data'];

const JUDUL = {
  code: ['kode item', 'kode', 'code'],
  name: ['nama item', 'nama', 'name'],
  unit: ['unit', 'satuan'],
  kategori: ['category', 'kategori'],
  sub: ['sub category', 'sub kategori', 'department', 'departemen'],
  coa: ['coa', 'akun'],
  catatan: ['catatan', 'keterangan'],
} as const;

type Kolom = { [K in keyof typeof JUDUL]: number };

/**
 * Nomor kolom tiap bidang, dicari dari baris judulnya.
 *
 * Dicari dan tidak dipatok karena lembar yang sama dikirim dalam beberapa
 * bentuk — "Master Data" punya tujuh kolom, "Master Data Lengkap" tiga belas —
 * dan urutan kolom bukan hal yang perlu dijaga seseorang supaya impor jalan.
 */
function cariKolom(ws: Sheet): { kolom: Kolom; barisJudul: number } {
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r += 1) {
    const judul = new Map<string, number>();
    for (let c = 1; c <= ws.columnCount; c += 1) {
      const t = teks(ws.getCell(r, c).value).trim().toLowerCase();
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
      code: temu(JUDUL.code), name: temu(JUDUL.name), unit: temu(JUDUL.unit),
      kategori: temu(JUDUL.kategori), sub: temu(JUDUL.sub), coa: temu(JUDUL.coa),
      catatan: temu(JUDUL.catatan),
    };
    const kurang = (['code', 'name', 'unit', 'kategori', 'sub', 'coa'] as const)
      .filter((k) => kolom[k] === 0);
    if (kurang.length === 0) return { kolom, barisJudul: r };
  }
  throw new Error(
    `Baris judul tidak ditemukan di sepuluh baris pertama lembar "${ws.name}". `
    + 'Yang harus ada: Kode Item, Nama Item, Unit, Category, Sub Category, COA.',
  );
}

function bacaBaris(ws: Sheet): BarisLembar[] {
  const { kolom, barisJudul } = cariKolom(ws);
  const hasil: BarisLembar[] = [];
  for (let r = barisJudul + 1; r <= ws.rowCount; r += 1) {
    const ambil = (c: number) => (c ? teks(ws.getCell(r, c).value).trim() : '');
    const code = ambil(kolom.code);
    // Baris pemisah dan baris judul kelompok tidak punya kode barang. Dilewati
    // tanpa suara: itu bagian tata letak lembarnya, bukan data yang hilang.
    if (!code) continue;
    hasil.push({
      baris: r,
      code,
      name: ambil(kolom.name),
      unit: ambil(kolom.unit),
      kategori: ambil(kolom.kategori),
      sub: ambil(kolom.sub),
      coa: ambil(kolom.coa),
      catatan: ambil(kolom.catatan),
    });
  }
  return hasil;
}

/** Akun yang boleh jadi akun sebuah barang — sama dengan yang ditawarkan di layar. */
function akunPakai(): Promise<AkunRingkas[]> {
  return prisma.account.findMany({
    where: {
      isHeader: false,
      active: true,
      OR: [
        { type: { in: ['EXPENSE', 'COGS'] } },
        { type: 'ASSET', subtype: { in: ['INVENTORY', 'FIXED_ASSET'] } },
      ],
    },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true },
  });
}

async function utama() {
  const argv = process.argv.slice(2);
  const coba = argv.includes('--coba');
  const pilihLembar = argv.find((a) => a.startsWith('--lembar='))?.slice('--lembar='.length);
  const berkas = argv.find((a) => !a.startsWith('--'));
  if (!berkas) {
    console.error('Pemakaian: npx tsx scripts/impor-barang.ts <berkas.xlsx> [--lembar="Master Data"] [--coba]');
    process.exit(1);
  }

  const wb = await bukaWorkbook(berkas);
  const nama = pilihLembar ? [pilihLembar] : LEMBAR_BAWAAN;
  const ws = nama.map((n) => wb.getWorksheet(n)).find((w) => w);
  if (!ws) {
    throw new Error(
      `Lembar ${nama.map((n) => `"${n}"`).join(' atau ')} tidak ada. `
      + `Yang tersedia: ${wb.worksheets.map((w) => w.name).join(', ')}. `
      + 'Sebutkan yang mana dengan --lembar="…".',
    );
  }
  console.log(C.bold(`Lembar "${ws.name}" dari ${berkas}`));

  const { barang: semua, masalah, terpakai } = siapkanLembar(bacaBaris(ws));
  const barang = tanpaKembar(semua);
  console.log(C.dim(`${semua.length} baris dibaca, ${barang.length} barang.`));

  if (terpakai.length > 0) {
    console.log(C.warn(`\n${terpakai.length} kode diperbaiki saat dibaca:`));
    for (const t of terpakai) {
      console.log(`  ${t.kode} "${t.nama}" → ${C.bold(t.jadi)}\n      ${C.dim(t.alasan)}`);
    }
    console.log(C.dim('  Aturannya ada di KODE_DIPERBAIKI pada src/lib/impor-barang.ts.'));
  }

  /* -------- akun: dicocokkan lebih dulu, sebelum apa pun ditulis -------- */

  const akun = await akunPakai();
  const namaCoa = [...new Set(barang.map((b) => b.coa))].sort();
  const petaAkun = new Map<string, AkunRingkas>();
  const lewatAlias: { coa: string; akun: AkunRingkas; jumlah: number }[] = [];
  const takCocok: string[] = [];

  for (const n of namaCoa) {
    const hasil = cocokkanAkun(n, akun);
    const jumlah = barang.filter((b) => b.coa === n).length;
    if (hasil.ok) {
      petaAkun.set(n, hasil.akun);
      if (hasil.lewatAlias) lewatAlias.push({ coa: n, akun: hasil.akun, jumlah });
    } else {
      takCocok.push(
        `  ${C.bad(n)} — dipakai ${jumlah} barang\n`
        + (hasil.kandidat.length
          ? `      yang mungkin dimaksud: ${hasil.kandidat.map((a) => `${a.code} ${a.name}`).join('; ')}`
          : '      tidak ada akun yang mendekati'),
      );
    }
  }

  if (masalah.length > 0 || takCocok.length > 0) {
    console.log();
    if (masalah.length > 0) {
      console.log(C.bad(`${masalah.length} hal harus dibereskan di lembarnya dulu:`));
      for (const m of masalah) console.log(`  • ${m}`);
      console.log();
    }
    if (takCocok.length > 0) {
      console.log(C.bad(`${takCocok.length} nama akun tidak dikenali bagan akun:`));
      console.log(takCocok.join('\n'));
      console.log();
      console.log(C.dim(
        'Dua jalan: tambahkan akunnya di menu Bagan Akun bila memang akun baru, atau — kalau itu\n'
        + 'cuma ejaan lain dari akun yang sudah ada — daftarkan padanannya di ALIAS_AKUN pada\n'
        + 'src/lib/impor-barang.ts. Tidak ada yang ditebak di sini: barang yang masuk dengan akun\n'
        + 'yang salah baru kelihatan salah saat laporan bulan itu dibaca kembali.',
      ));
    }
    console.log(C.bad('\nTidak ada yang ditulis.'));
    process.exitCode = 1;
    return;
  }

  console.log(C.ok(`${namaCoa.length} nama akun cocok semuanya.`));
  if (lewatAlias.length > 0) {
    console.log(C.warn(`\n${lewatAlias.length} di antaranya lewat tabel padanan — periksa sekali:`));
    for (const l of lewatAlias) {
      console.log(`  "${l.coa}" → ${l.akun.code} ${l.akun.name} ${C.dim(`(${l.jumlah} barang)`)}`);
    }
    console.log(C.dim('  Keliru satu? Ubah ALIAS_AKUN di src/lib/impor-barang.ts, atau akun barangnya di Master Barang.'));
  }

  /* ------------------------------ ringkasan ------------------------------ */

  const kategori = [...new Map(barang.map((b) => [b.katKode, b])).values()];
  const sub = [...new Map(barang.map((b) => [`${b.katKode}|${b.subKode}`, b])).values()];
  const satuan = [...new Map(barang.map((b) => [b.satKode, b])).values()];
  console.log();
  console.log(`${kategori.length} kategori: ${kategori.map((k) => k.katKode).join(', ')}`);
  // Satu departemen yang dipakai di dua kategori memang dua baris sub kategori
  // tersendiri, jadi kategorinya ikut disebut — tanpa itu daftarnya terbaca
  // seolah-olah ada yang kembar.
  console.log(`${sub.length} departemen: ${sub.map((s) => `${s.katKode}/${s.subKode} (${s.subNama})`).join(', ')}`);
  console.log(`${satuan.length} satuan: ${satuan.map((s) => s.satKode).join(', ')}`);

  const tambahan = barang.filter((b) => b.baris === 0);
  if (tambahan.length > 0) {
    console.log(C.warn(`\n${tambahan.length} barang ditambahkan di luar lembarnya:`));
    for (const t of tambahan) {
      console.log(`  ${t.code} ${t.name} — ${t.katKode}/${t.subKode}, ${t.satKode}, ${t.coa}`);
    }
    console.log(C.dim('  Daftarnya ada di BARANG_TAMBAHAN pada src/lib/impor-barang.ts.'));
  }

  /*
   * Perbedaan akun antar cabang, satu-satu.
   *
   * Yang sudah punya barang tersendiri tidak perlu disebut lagi — sudah
   * ditangani di atas. Yang belum, disodorkan apa adanya: entah ia memang
   * barang kedua yang belum didaftarkan, entah salah satu dari dua akun itu
   * keliru dicatat. Keduanya hanya bisa dijawab orang yang tahu bukunya.
   */
  const sudahPunyaTambahan = new Set(tambahan.map((t) => t.code));
  const akunDari = (nama: string) => {
    const h = cocokkanAkun(nama, akun);
    return h.ok ? h.akun : null;
  };
  const perluDiputuskan = barang
    .map((b) => ({ b, beda: coaBerbeda(b.catatan) }))
    .filter((x) => x.beda !== null && !sudahPunyaTambahan.has(x.b.code))
    // Dua nama akun yang berbeda bisa menunjuk akun yang sama — "Biaya Air
    // Isi Ulang IGYT" dan "Biaya Air isi ulang HK" dua-duanya 6160.05. Kalau
    // begitu tidak ada yang perlu diputuskan: akunnya memang satu, dan yang
    // memisahkan IGYT dari hotel adalah kolom cabang pada jurnalnya.
    .filter((x) => {
      const a = akunDari(x.beda!.dipakai);
      const b = akunDari(x.beda!.lain);
      return !(a && b && a.id === b.id);
    });

  if (perluDiputuskan.length > 0) {
    console.log(C.warn(`\n${perluDiputuskan.length} barang akunnya berbeda antar cabang dan belum diputuskan:`));
    for (const { b, beda } of perluDiputuskan) {
      console.log(
        `  ${b.code} ${b.name}\n`
        + `      masuk sebagai ${C.bold(beda!.dipakai)}, tetapi di ${beda!.cabang} dicatat ${C.bold(beda!.lain)}`,
      );
    }
    console.log(C.dim(
      '  Dua kemungkinan, dan hanya Anda yang bisa memilih: (a) itu memang barang kedua untuk\n'
      + '  departemen lain — daftarkan di BARANG_TAMBAHAN pada src/lib/impor-barang.ts; atau\n'
      + '  (b) salah satu dari dua akun itu keliru dicatat — betulkan akunnya di menu Master Barang.',
    ));
  }

  const perlu = new Set(perluDiputuskan.map((x) => x.b.code));
  const lainnya = barang.filter(
    (b) => b.catatan && b.baris !== 0 && !perlu.has(b.code) && !sudahPunyaTambahan.has(b.code),
  );
  if (lainnya.length > 0) {
    console.log(C.dim(`\n${lainnya.length} barang lain berbeda departemen antar cabang tetapi akunnya sama — tidak ada yang perlu dikerjakan:`));
    console.log(C.dim(`  ${lainnya.map((b) => b.code).join(', ')}`));
  }

  if (coba) {
    console.log(C.warn('\n--coba: tidak ada yang ditulis.'));
    return;
  }

  /* ------------------------------- menulis ------------------------------- */

  const idKategori = new Map<string, string>();
  for (const k of kategori) {
    const row = await prisma.itemCategory.upsert({
      where: { code: k.katKode },
      update: {},
      create: { code: k.katKode, name: k.katNama },
      select: { id: true },
    });
    idKategori.set(k.katKode, row.id);
  }

  const idSub = new Map<string, string>();
  for (const s of sub) {
    const categoryId = idKategori.get(s.katKode)!;
    const row = await prisma.itemSubCategory.upsert({
      where: { categoryId_code: { categoryId, code: s.subKode } },
      update: {},
      create: { categoryId, code: s.subKode, name: s.subNama },
      select: { id: true },
    });
    idSub.set(`${s.katKode}|${s.subKode}`, row.id);
  }

  const idSatuan = new Map<string, string>();
  for (const s of satuan) {
    const row = await prisma.itemUnit.upsert({
      where: { code: s.satKode },
      update: {},
      create: { code: s.satKode, name: s.satNama },
      select: { id: true },
    });
    idSatuan.set(s.satKode, row.id);
  }

  let baru = 0;
  let ubah = 0;
  for (const b of barang) {
    const categoryId = idKategori.get(b.katKode)!;
    const subCategoryId = idSub.get(`${b.katKode}|${b.subKode}`)!;
    const data = {
      name: b.name,
      unitId: idSatuan.get(b.satKode)!,
      accountId: petaAkun.get(b.coa)!.id,
      notes: b.catatan || null,
    };
    const ada = await prisma.item.findUnique({
      where: { categoryId_subCategoryId_code: { categoryId, subCategoryId, code: b.code } },
      select: { id: true },
    });
    if (ada) {
      await prisma.item.update({ where: { id: ada.id }, data });
      ubah += 1;
    } else {
      await prisma.item.create({ data: { ...data, categoryId, subCategoryId, code: b.code } });
      baru += 1;
    }
  }

  console.log(C.ok(`\n${baru} barang baru, ${ubah} diperbarui. Total sekarang ${await prisma.item.count()}.`));
}

utama()
  .catch((e) => {
    console.error(C.bad(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
