/**
 * Mengubah hasil baca Profit and Loss Report GuestPro menjadi jurnal siap impor.
 *
 * Masukannya JSON dari scripts/baca-pnl.py. Semua padanan akun diambil dari
 * src/lib/coa-legacy.ts, jadi tidak ada tabel padanan kedua yang bisa basi.
 *
 * Contoh:
 *   python3 scripts/baca-pnl.py laporan/*.pdf --keluar=data/pnl.json
 *   npx tsx scripts/pnl-ke-jurnal.ts data/pnl.json --keluar=data/jurnal-pnl.csv
 *   npm run impor -- data/jurnal-pnl.csv --pms=PMS2 --unit=THL
 *
 * Pilihan:
 *   --keluar=BERKAS    Tempat menyimpan jurnal (bila tidak diisi, hanya ringkasan)
 *   --pms=PMS1|PMS2    PMS asal laporan (bawaan PMS2)
 *   --unit=KODE        Cabang untuk pendapatan tanpa penanda cabang (bawaan THL)
 *   --alokasi=CARA     Cara membagi beban bersama antar cabang:
 *                        pendapatan  sebanding pendapatan tiap cabang (bawaan)
 *                        rata        dibagi rata ke cabang yang berpendapatan
 *                        <KODE>      seluruhnya ke satu cabang, mis. --alokasi=THL
 *   --kas=KODE         Akun penyeimbang tiap cabang (bawaan 1110.01 Kas Pemasukan)
 *
 * Catatan akuntansi. Laporan laba rugi hanya memuat pendapatan dan beban, jadi
 * jurnal ini menyeimbangkannya ke satu akun kas per cabang: satu baris kas
 * masuk sebesar pendapatan, satu baris kas keluar sebesar beban. Hasilnya
 * pembukuan berbasis kas: pengaruh tiap bulan terhadap kas sama dengan laba
 * bersih bulan itu. Cukup untuk peramalan arus kas, tetapi bukan pengganti
 * neraca — piutang dan hutang tidak ada di laporan ini.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { allocateByWeight, round } from '../src/lib/accounting';
import { PMS_SOURCES, resolveLegacyAccount, type PmsSource } from '../src/lib/coa-legacy';
import { COA_TEMPLATE } from '../src/lib/coa-template';

type Akun = { kode: string; nama: string; nilai: number };
type Laporan = {
  berkas?: string;
  bulan: number;
  tahun: number;
  akun: Akun[];
  /** Total yang tercetak di PDF, dipakai sebagai pembanding terakhir. */
  tercetak?: { net?: number | null };
};

type Baris = {
  kodeSumber: string;
  namaAkun: string;
  unit: string;
  debit: number;
  kredit: number;
  keterangan: string;
};

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bad: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const NAMA_BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

/** Tanggal akhir bulan — laporan laba rugi adalah rekap sebulan penuh. */
function akhirBulan(tahun: number, bulan: number) {
  const hari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  return `${String(hari).padStart(2, '0')}/${String(bulan).padStart(2, '0')}/${tahun}`;
}

type Opsi = { pms: PmsSource; unitBawaan: string; alokasi: string; akunKas: string };

type HasilBulan = {
  label: string;
  baris: Baris[];
  pendapatan: Map<string, number>;
  beban: Map<string, number>;
  bebanBersama: number;
  peringatan: string[];
  galat: string[];
};

function susunBulan(lap: Laporan, o: Opsi): HasilBulan {
  const label = `${NAMA_BULAN[lap.bulan]} ${lap.tahun}`;
  const keterangan = `Laba rugi ${label} dari GuestPro`;
  const peringatan: string[] = [];
  const galat: string[] = [];

  const pendapatan = new Map<string, number>();
  const beban = new Map<string, number>();
  const baris: Baris[] = [];
  const bersama: Akun[] = [];

  for (const a of lap.akun) {
    const legacy = resolveLegacyAccount(a.kode, o.pms);
    // Akun tanpa padanan yang masih bernilai tidak boleh sekadar diperingatkan.
    // Melewatinya berarti membuang uang dari laporan tanpa terlihat — GuestPro
    // pernah menambah akun baru (6130.10 Biaya THR) setelah COA-nya diekspor,
    // dan laba sebulan jadi meleset Rp 6.750.000 tanpa ada yang gagal.
    if (!legacy || !legacy.newCode) {
      const sebab = legacy
        ? `belum punya padanan di COA baru`
        : `tidak ada di daftar akun GuestPro (src/lib/coa-legacy.ts)`;
      const pesan = `akun ${a.kode} (${legacy?.name ?? a.nama}) ${sebab}`;
      if (a.nilai !== 0) galat.push(`${pesan} — bernilai ${rupiah(a.nilai)}`);
      else peringatan.push(`${pesan}, tetapi nilainya nol jadi tidak berpengaruh`);
      continue;
    }
    if (a.nilai === 0) continue;

    const pendapatanKah = a.kode.startsWith('4');
    if (pendapatanKah) {
      // Pendapatan hampir selalu bertanda cabang. Bila tidak, catat sebagai
      // cabang bawaan dan sebutkan, jangan diam-diam.
      const unit = legacy.unit ?? o.unitBawaan;
      if (!legacy.unit) {
        peringatan.push(`pendapatan ${a.kode} (${legacy.name}) tanpa penanda cabang, `
          + `dicatat ke ${unit}`);
      }
      pendapatan.set(unit, round((pendapatan.get(unit) ?? 0) + a.nilai));
      baris.push({ kodeSumber: a.kode, namaAkun: legacy.name, unit, debit: 0, kredit: a.nilai, keterangan });
      continue;
    }

    if (legacy.unit) {
      beban.set(legacy.unit, round((beban.get(legacy.unit) ?? 0) + a.nilai));
      baris.push({ kodeSumber: a.kode, namaAkun: legacy.name, unit: legacy.unit, debit: a.nilai, kredit: 0, keterangan });
    } else {
      bersama.push(a);
    }
  }

  // Beban bersama: tidak ada penanda cabang di GuestPro, jadi harus dibagi.
  const bebanBersama = round(bersama.reduce((s, a) => s + a.nilai, 0));
  if (bersama.length > 0) {
    let bobot: Map<string, number>;
    if (o.alokasi === 'pendapatan') {
      bobot = new Map(pendapatan);
    } else if (o.alokasi === 'rata') {
      bobot = new Map([...pendapatan.keys()].map((u) => [u, 1]));
    } else {
      bobot = new Map([[o.alokasi, 1]]);
    }
    if (bobot.size === 0) {
      bobot = new Map([[o.unitBawaan, 1]]);
      peringatan.push(`tidak ada pendapatan pada bulan ini, beban bersama ${rupiah(bebanBersama)} `
        + `dicatat ke ${o.unitBawaan}`);
    }
    for (const a of bersama) {
      const legacy = resolveLegacyAccount(a.kode, o.pms)!;
      for (const [unit, nilai] of allocateByWeight(a.nilai, bobot)) {
        if (nilai === 0) continue;
        beban.set(unit, round((beban.get(unit) ?? 0) + nilai));
        baris.push({
          kodeSumber: a.kode,
          namaAkun: legacy.name,
          unit,
          debit: nilai,
          kredit: 0,
          keterangan: `${keterangan} — beban bersama dibagi ke ${unit}`,
        });
      }
    }
  }

  // Penyeimbang per cabang, supaya tiap cabang balance sendiri tanpa perlu
  // jembatan antar unit.
  //
  // Dicatat KOTOR — satu baris kas masuk sebesar pendapatan dan satu baris kas
  // keluar sebesar beban — bukan satu baris selisihnya saja. Pengaruhnya pada
  // saldo kas sama persis, tetapi peramalan membaca arus kas dari debit dan
  // kredit akun kas. Dengan satu baris bersih, "rata-rata pemasukan per bulan"
  // akan terbaca sebesar laba, bukan sebesar pendapatan, dan angkanya
  // menyesatkan.
  let nettoSeluruh = 0;
  for (const unit of new Set([...pendapatan.keys(), ...beban.keys()])) {
    const masuk = round(pendapatan.get(unit) ?? 0);
    const keluar = round(beban.get(unit) ?? 0);
    nettoSeluruh = round(nettoSeluruh + masuk - keluar);
    if (masuk !== 0) {
      baris.push({
        kodeSumber: o.akunKas,
        namaAkun: 'Penerimaan kas',
        unit,
        debit: masuk,
        kredit: 0,
        keterangan: `Penerimaan ${unit} ${label}`,
      });
    }
    if (keluar !== 0) {
      baris.push({
        kodeSumber: o.akunKas,
        namaAkun: 'Pengeluaran kas',
        unit,
        debit: 0,
        kredit: keluar,
        keterangan: `Pengeluaran ${unit} ${label}`,
      });
    }
  }

  // Pembanding terakhir: laba seluruh cabang harus sama dengan NET PROFIT yang
  // tercetak di PDF. Ini yang menangkap akun yang tercecer, salah tanda, atau
  // terhitung dua kali — pemeriksaan per cabang saja tidak akan menyadarinya,
  // karena jurnal yang kekurangan satu akun tetap bisa balance.
  const netTercetak = lap.tercetak?.net;
  if (netTercetak == null) {
    peringatan.push('NET PROFIT tidak ada di hasil baca, laba tidak bisa dibandingkan '
      + 'dengan laporan aslinya');
  } else if (Math.abs(nettoSeluruh - netTercetak) > 0.5) {
    galat.push(`laba seluruh cabang ${rupiah(nettoSeluruh)} tidak sama dengan `
      + `NET PROFIT tercetak ${rupiah(netTercetak)}, selisih `
      + `${rupiah(nettoSeluruh - netTercetak)}`);
  }

  return { label, baris, pendapatan, beban, bebanBersama, peringatan, galat };
}

const csvSel = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csvAngka = (n: number) => (n === 0 ? '' : n.toFixed(2));

async function main() {
  const argv = process.argv.slice(2);
  const berkas = argv.filter((a) => !a.startsWith('--'));
  const ambil = (nama: string) =>
    argv.find((a) => a.startsWith(`--${nama}=`))?.split('=').slice(1).join('=');

  if (berkas.length !== 1) {
    console.log(String.raw`Pemakaian: npx tsx scripts/pnl-ke-jurnal.ts data/pnl.json --keluar=data/jurnal-pnl.csv`);
    process.exit(1);
  }

  const pms = (ambil('pms') ?? 'PMS2').toUpperCase() as PmsSource;
  if (!PMS_SOURCES[pms]) {
    console.error(C.bad(`--pms harus salah satu dari ${Object.keys(PMS_SOURCES).join(', ')}.`));
    process.exit(1);
  }
  const unitTersedia = PMS_SOURCES[pms].units as readonly string[];
  const unitBawaan = (ambil('unit') ?? unitTersedia[0]).toUpperCase();
  if (!unitTersedia.includes(unitBawaan)) {
    console.error(C.bad(`--unit=${unitBawaan} bukan cabang pada ${pms}. `
      + `Pilihan: ${unitTersedia.join(', ')}.`));
    process.exit(1);
  }
  const alokasiMentah = (ambil('alokasi') ?? 'pendapatan').trim();
  const alokasi = /^(pendapatan|rata)$/i.test(alokasiMentah)
    ? alokasiMentah.toLowerCase()
    : alokasiMentah.toUpperCase();
  if (alokasi !== 'pendapatan' && alokasi !== 'rata' && !unitTersedia.includes(alokasi)) {
    console.error(C.bad(`--alokasi=${alokasi} tidak dikenal. `
      + `Pakai "pendapatan", "rata", atau salah satu cabang: ${unitTersedia.join(', ')}.`));
    process.exit(1);
  }
  const akunKas = ambil('kas') ?? '1110.01';
  if (!COA_TEMPLATE.some((a) => a.code === akunKas && !a.isHeader)) {
    console.error(C.bad(`--kas=${akunKas} tidak ada di COA (atau akun induk, bukan akun catat).`));
    process.exit(1);
  }

  const isi = JSON.parse(await readFile(berkas[0], 'utf8'));
  const laporan: Laporan[] = Array.isArray(isi) ? isi : [isi];
  laporan.sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan);

  const o: Opsi = { pms, unitBawaan, alokasi, akunKas };
  const semua: { lap: Laporan; hasil: HasilBulan }[] = [];
  for (const lap of laporan) semua.push({ lap, hasil: susunBulan(lap, o) });

  const caraTulis = alokasi === 'pendapatan'
    ? 'sebanding pendapatan tiap cabang'
    : alokasi === 'rata' ? 'dibagi rata' : `seluruhnya ke ${alokasi}`;
  console.log(C.bold(`\n${PMS_SOURCES[pms].label}`));
  console.log(C.dim(`Beban bersama dibagi ${caraTulis}. Penyeimbang: ${akunKas}.\n`));

  const semuaUnit = [...new Set(semua.flatMap(({ hasil }) =>
    [...hasil.pendapatan.keys(), ...hasil.beban.keys()]))].sort();
  const lebar = 13;
  console.log(C.dim(
    'Bulan'.padEnd(16)
    + semuaUnit.map((u) => `${u} laba`.padStart(lebar + 2)).join('')
    + 'beban bersama'.padStart(16)
    + 'laba'.padStart(16)));

  let adaPeringatan = false;
  let gagal = false;
  for (const { hasil } of semua) {
    const netto = semuaUnit.map((u) =>
      round((hasil.pendapatan.get(u) ?? 0) - (hasil.beban.get(u) ?? 0)));
    console.log(
      hasil.label.padEnd(16)
      + netto.map((n) => Math.round(n).toLocaleString('id-ID').padStart(lebar + 2)).join('')
      + Math.round(hasil.bebanBersama).toLocaleString('id-ID').padStart(16)
      + Math.round(netto.reduce((a, b) => a + b, 0)).toLocaleString('id-ID').padStart(16));
    for (const p of hasil.peringatan) {
      console.log(C.warn(`    ! ${p}`));
      adaPeringatan = true;
    }
    for (const g of hasil.galat) {
      console.log(C.bad(`    x ${g}`));
      gagal = true;
    }
  }

  // Pemeriksaan: tiap cabang harus balance sendiri, dan seluruh jurnal harus balance.
  for (const { hasil } of semua) {
    const perUnit = new Map<string, number>();
    for (const b of hasil.baris) {
      perUnit.set(b.unit, round((perUnit.get(b.unit) ?? 0) + b.debit - b.kredit));
    }
    for (const [unit, selisih] of perUnit) {
      if (Math.abs(selisih) > 0.005) {
        console.log(C.bad(`    x ${hasil.label} — ${unit} tidak balance, selisih ${rupiah(selisih)}`));
        gagal = true;
      }
    }
  }
  if (gagal) {
    console.error(C.bad('\nAda yang tidak beres di atas, tidak ada berkas yang ditulis. '
      + 'Angka yang belum cocok dengan laporan aslinya tidak boleh masuk pembukuan.'));
    process.exit(1);
  }
  console.log(C.ok('\nTiap cabang balance sendiri, dan laba tiap bulan sama dengan '
    + 'NET PROFIT yang tercetak di laporan.'));
  if (adaPeringatan) console.log(C.warn('Ada peringatan di atas, periksa sebelum mengimpor.'));

  const keluar = ambil('keluar');
  if (!keluar) {
    console.log(C.dim('\nTambahkan --keluar=data/jurnal-pnl.csv untuk menulis jurnalnya.'));
    return;
  }

  const larik: string[] = ['Tanggal,No Bukti,Kode Akun,Nama Akun,Unit,Keterangan,Debit,Kredit'];
  let jumlahBaris = 0;
  for (const { lap, hasil } of semua) {
    const bukti = `PL-${String(lap.tahun).slice(2)}${String(lap.bulan).padStart(2, '0')}`;
    const tanggal = akhirBulan(lap.tahun, lap.bulan);
    for (const b of hasil.baris) {
      larik.push([
        tanggal, bukti, b.kodeSumber, csvSel(b.namaAkun), b.unit,
        csvSel(b.keterangan), csvAngka(b.debit), csvAngka(b.kredit),
      ].join(','));
      jumlahBaris++;
    }
  }
  await writeFile(keluar, larik.join('\n') + '\n', 'utf8');
  console.log(`\n${semua.length} bulan, ${jumlahBaris} baris jurnal -> ${keluar}`);
  console.log(C.dim(`Impor dengan: npm run impor -- ${keluar} --pms=${pms} --unit=${unitBawaan}`));
}

main().catch((e) => {
  console.error(C.bad(String(e?.message ?? e)));
  process.exit(1);
});
