/**
 * Rencana kas jangka pendek: dari posisi kas hari ini sampai akhir bulan.
 *
 * Berbeda dengan mesin peramalan yang melihat belasan bulan ke depan, bagian
 * ini menjawab satu pertanyaan sempit yang ditanyakan tiap minggu — berapa yang
 * boleh dibelanjakan sampai akhir bulan, bila uang masuk ternyata seret, wajar,
 * atau baik. Rumusnya sengaja dibuat sesederhana mungkin supaya hasilnya bisa
 * dihitung ulang dengan tangan saat rapat.
 */

import { addMonths, periodEndExclusive, periodStart, type Period } from './period';

export type Skenario = 'PESIMIS' | 'NORMAL' | 'OPTIMIS';
export const SKENARIO: readonly Skenario[] = ['PESIMIS', 'NORMAL', 'OPTIMIS'] as const;

export const NAMA_SKENARIO: Record<Skenario, string> = {
  PESIMIS: 'Pesimis',
  NORMAL: 'Normal',
  OPTIMIS: 'Optimis',
};

/** Pembulatan plafon mingguan — angka bulat lebih mudah dijadikan aturan. */
export const PEMBULATAN = 100_000;

const HARI = 86_400_000;

export type Komitmen = {
  label: string;
  amount: number;
  /** Tanggal jatuh tempo dalam bulan, 1–31. null bila belum pasti. */
  dueDay: number | null;
  paid: boolean;
};

/**
 * Cara sebuah laporan belanja diperlakukan terhadap laporan sebelumnya.
 * TAMBAH untuk pengeluaran baru, SETEL untuk membetulkan angka yang salah atau
 * memulai hitungan dari nol setelah posisi kas diperbarui.
 */
export type ModeBelanja = 'TAMBAH' | 'SETEL';

export type EntriBelanja = {
  /** Urutan stabil bila dua laporan bertanggal sama. */
  urut: number;
  date: Date;
  amount: number;
  mode: ModeBelanja;
};

export type Kategori = {
  label: string;
  /** Porsi relatif; dinormalkan terhadap jumlah seluruh kategori. */
  weight: number;
  /** Yang sudah dibelanjakan kategori ini setelah tanggal posisi kas. */
  terpakai?: number;
};

export type Masukan = {
  period: Period;
  /** Tanggal posisi kas terakhir dilaporkan; sisa bulan dihitung dari esoknya. */
  tanggal: Date;
  saldoKas: number;
  masukSampaiKini: number;
  proyeksi: Record<Skenario, number>;
  komitmen: Komitmen[];
  kategori: Kategori[];
  /**
   * Cicilan rencana belanja yang jatuh tempo sesudah tanggal posisi kas di
   * bulan ini. Dipisah dari komitmen biasa supaya terlihat sendiri di layar.
   */
  cicilanBelanja?: number;
  /**
   * Kewajiban terjadwal yang jatuh tempo sesudah tanggal posisi kas di bulan
   * ini — pajak kendaraan, PBB, perpanjangan izin. Dipisah dari komitmen biasa
   * karena asalnya dari master data, bukan diketik ulang tiap bulan.
   */
  kewajiban?: number;
  /**
   * Yang sudah dibelanjakan SETELAH tanggal posisi kas di atas. Belanja sebelum
   * tanggal itu tidak dihitung di sini karena sudah tercermin pada saldo yang
   * dilaporkan — menghitungnya dua kali akan mengecilkan anggaran tanpa sebab.
   *
   * Boleh dikosongkan: jumlah seluruh kategori yang dipakai, dan itu menutup
   * kemungkinan total dan rinciannya berbeda.
   */
  terpakai?: number;
};

export type Minggu = {
  mulai: Date;
  /** Hari terakhir minggu ini, inklusif. */
  selesai: Date;
  hari: number;
  plafonDasar: number;
  tambahan: number;
  /** Uang masuk kumulatif bulan ini yang harus tercapai agar tambahan dibuka. */
  targetMasuk: number;
};

export type HasilSkenario = {
  skenario: Skenario;
  proyeksi: number;
  sisaMasuk: number;
  /** Jatah seluruh sisa bulan, sebelum dikurangi yang sudah terpakai. */
  jatah: number;
  /** Yang masih boleh dibelanjakan: jatah dikurangi yang sudah terpakai. */
  bolehBelanja: number;
  perMinggu: number;
};

export type PorsiKategori = {
  label: string;
  /** Jatah sebulan penuh menurut porsinya, sebelum dikurangi belanja. */
  jatah: number;
  terpakai: number;
  /** jatah − terpakai. Minus berarti kategori ini sudah lewat jatahnya. */
  sisa: number;
  /** Sisa dibagi jumlah minggu yang tersisa. */
  perMinggu: number;
};

export type BulanRunway = {
  period: Period;
  /**
   * Saldo sebelum bulan itu berjalan. Untuk bulan berjalan yang dipakai adalah
   * saldo kas yang dilaporkan, bukan saldo awal bulan — sisanya sudah terjadi.
   */
  saldoAwal: number;
  /**
   * Perkiraan uang masuk bulan itu. Untuk bulan berjalan hanya yang belum
   * datang, karena yang sudah datang sudah ada di saldo yang dilaporkan.
   */
  masuk: number;
  /**
   * Perkiraan uang keluar bulan itu. Sama persis untuk ketiga skenario —
   * yang membedakan skenario hanyalah uang masuknya.
   */
  keluar: number;
  /** saldoAwal + masuk − keluar. */
  saldoAkhir: number;
  /** Saldo akhir bulan itu masih menutup satu kali gaji. */
  cukupGaji: boolean;
  /** Yang kurang agar gaji bulan berikutnya tertutup; nol bila sudah cukup. */
  kurangGaji: number;
};

/** Laju kas sebuah bulan: uang masuknya dikurangi pengeluaran rutin sebulan. */
export type LajuBulan = {
  period: Period;
  arus: number;
};

export type Runway = {
  /** Laju bulan berikutnya saja. */
  arusBersih: number;
  /**
   * Rata-rata laju sepanjang horizon. Inilah yang mewakili arah keseluruhan:
   * dengan pola musim, laju satu bulan bisa berlawanan arah dengan nasib kas
   * setahun ke depan — bulan ramai menambah, tetapi bulan-bulan sepi
   * sesudahnya yang menghabiskan.
   */
  arusRata: number;
  /** Bulan dengan laju terendah dan tertinggi, untuk menunjukkan ayunan musim. */
  arusTerendah: LajuBulan;
  arusTertinggi: LajuBulan;
  bulan: BulanRunway[];
  /** Bulan pertama dengan saldo akhir minus; null bila tidak habis sepanjang horizon. */
  habisPada: Period | null;
  /** Bulan pertama yang saldonya tidak lagi menutup gaji. */
  gajiTerancam: Period | null;
};

export type Rencana = {
  mulai: Date;
  selesai: Date;
  hari: number;
  komitmenBelumBayar: number;
  cicilanBelanja: number;
  kewajiban: number;
  terpakai: number;
  skenario: Record<Skenario, HasilSkenario>;
  minggu: Minggu[];
  kategori: PorsiKategori[];
};

/** Ke kelipatan PEMBULATAN terdekat, tetap benar untuk angka negatif. */
const bulatkan = (n: number) => Math.round(n / PEMBULATAN) * PEMBULATAN;

/** Tengah malam UTC pada hari yang sama — supaya jam tidak ikut dihitung. */
export const hariUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export const selisihHari = (a: Date, b: Date) => Math.round((hariUtc(b) - hariUtc(a)) / HARI);
export const tambahHari = (d: Date, n: number) => new Date(hariUtc(d) + n * HARI);

/**
 * Sisa bulan yang masih bisa direncanakan: mulai sehari setelah posisi kas
 * dilaporkan — uang masuk "sampai dengan 9 Oktober" berarti sisanya baru
 * dihitung dari tanggal 10 — sampai hari terakhir bulan itu.
 */
export function jendela(period: Period, tanggal: Date): { mulai: Date; selesai: Date; hari: number } {
  const awalBulan = periodStart(period);
  const akhirBulan = tambahHari(periodEndExclusive(period), -1);
  const sesudah = tambahHari(tanggal, 1);
  const mulai = new Date(Math.max(awalBulan.getTime(), sesudah.getTime()));
  const hari = Math.max(0, selisihHari(mulai, akhirBulan) + 1);
  return { mulai, selesai: akhirBulan, hari };
}

/**
 * Potongan tujuh harian dari `mulai`. Sisa yang kurang dari sepekan digabung ke
 * minggu terakhir, bukan berdiri sendiri — plafon untuk satu atau dua hari
 * tidak ada gunanya sebagai aturan belanja.
 */
export function pecahMinggu(mulai: Date, selesai: Date): { mulai: Date; selesai: Date; hari: number }[] {
  const total = selisihHari(mulai, selesai) + 1;
  if (total <= 0) return [];

  const potongan: { mulai: Date; selesai: Date; hari: number }[] = [];
  for (let i = 0; i < total; i += 7) {
    const a = tambahHari(mulai, i);
    const b = tambahHari(mulai, Math.min(i + 6, total - 1));
    potongan.push({ mulai: a, selesai: b, hari: selisihHari(a, b) + 1 });
  }

  const akhir = potongan[potongan.length - 1];
  if (potongan.length > 1 && akhir.hari < 7) {
    potongan.pop();
    const sebelum = potongan[potongan.length - 1];
    sebelum.selesai = akhir.selesai;
    sebelum.hari += akhir.hari;
  }
  return potongan;
}

/**
 * Membagi satu jumlah menurut bobot, dibulatkan ke bawah, dengan sisanya
 * diberikan ke bagian terakhir supaya jumlah seluruhnya tetap persis sama.
 */
export function bagiProporsional(total: number, bobot: number[], pembulatan = PEMBULATAN): number[] {
  const jumlahBobot = bobot.reduce((s, b) => s + b, 0);
  if (bobot.length === 0) return [];
  if (jumlahBobot <= 0) return bobot.map(() => 0);

  const hasil = bobot.map((b) => Math.floor((total * b) / jumlahBobot / pembulatan) * pembulatan);
  const terpakai = hasil.reduce((s, v) => s + v, 0);
  hasil[hasil.length - 1] += total - terpakai;
  return hasil;
}

function hasilSkenario(
  skenario: Skenario,
  proyeksi: number,
  masukSampaiKini: number,
  saldoKas: number,
  komitmen: number,
  terpakai: number,
  jumlahMinggu: number,
): HasilSkenario {
  const sisaMasuk = Math.max(0, proyeksi - masukSampaiKini);
  const jatah = saldoKas + sisaMasuk - komitmen;
  const bolehBelanja = jatah - terpakai;
  return {
    skenario,
    proyeksi,
    sisaMasuk,
    jatah,
    bolehBelanja,
    // Dibulatkan: angka ini dibacakan sebagai aturan belanja, bukan hasil
    // pembukuan, dan "Rp 45.733.333 per minggu" tidak lebih berguna daripada
    // "Rp 45,7 juta" sambil jauh lebih sulit diingat.
    perMinggu: jumlahMinggu > 0 ? bulatkan(bolehBelanja / jumlahMinggu) : 0,
  };
}

export function hitungRencana(m: Masukan): Rencana {
  const { mulai, selesai, hari } = jendela(m.period, m.tanggal);
  const potongan = pecahMinggu(mulai, selesai);
  const komitmenBelumBayar = m.komitmen.filter((k) => !k.paid).reduce((s, k) => s + k.amount, 0);
  const cicilanBelanja = m.cicilanBelanja ?? 0;
  const kewajiban = m.kewajiban ?? 0;
  const terpakai = m.terpakai ?? m.kategori.reduce((s, k) => s + (k.terpakai ?? 0), 0);

  const skenario = Object.fromEntries(
    SKENARIO.map((s) => [
      s,
      hasilSkenario(
        s, m.proyeksi[s], m.masukSampaiKini, m.saldoKas,
        komitmenBelumBayar + cicilanBelanja + kewajiban, terpakai, potongan.length,
      ),
    ]),
  ) as Record<Skenario, HasilSkenario>;

  // Plafon dasar memakai skenario pesimis: yang boleh dibelanjakan walau uang
  // masuk seret. Tambahan adalah selisihnya terhadap normal, dan baru dibuka
  // bila uang masuk kumulatif sudah sampai di target tanggal itu — jadi belanja
  // mengikuti uang yang benar-benar diterima, bukan yang diharapkan.
  //
  // Keduanya dibatasi oleh anggaran normal yang sudah dinolkan, bukan oleh
  // selisih antar skenario. Saat kas defisit, pesimis dan normal sama-sama
  // minus, dan selisih keduanya tetap positif — tanpa batas ini tabelnya akan
  // menjanjikan puluhan juta boleh dibelanjakan justru ketika uangnya tidak ada.
  const dasar = Math.max(0, skenario.PESIMIS.bolehBelanja);
  const tambahanTotal = Math.max(0, Math.max(0, skenario.NORMAL.bolehBelanja) - dasar);
  const bobotHari = potongan.map((p) => p.hari);
  const bagianDasar = bagiProporsional(dasar, bobotHari);
  const bagianTambahan = bagiProporsional(tambahanTotal, bobotHari);

  const kejarNormal = Math.max(0, m.proyeksi.NORMAL - m.masukSampaiKini);
  let kumulatifHari = 0;
  const minggu: Minggu[] = potongan.map((p, i) => {
    kumulatifHari += p.hari;
    return {
      ...p,
      plafonDasar: bagianDasar[i],
      tambahan: bagianTambahan[i],
      targetMasuk: bulatkan(m.masukSampaiKini + (kejarNormal * kumulatifHari) / hari),
    };
  });

  // Pembagian antar kategori memakai skenario normal — angka yang dipakai
  // sehari-hari — sedangkan pesimis dan optimis tetap terlihat di kartu atas.
  //
  // Yang dibagi adalah jatah sebelum dikurangi belanja, bukan sesudahnya. Jatah
  // yang sudah bersih lalu dikurangi belanja kategori sekali lagi akan
  // memotong uang yang sama dua kali, dan hasilnya tidak menjawab pertanyaan
  // mana pun: bukan "berapa jatahnya", bukan pula "berapa sisanya". Dengan
  // membagi yang kotor, jumlah seluruh sisa kategori kembali persis sama dengan
  // angka boleh belanja di kartu atas.
  const bobotKategori = m.kategori.map((k) => k.weight);
  const bagianJatah = bagiProporsional(Math.max(0, skenario.NORMAL.jatah), bobotKategori);
  const kategori: PorsiKategori[] = m.kategori.map((k, i) => {
    const dipakai = k.terpakai ?? 0;
    const sisa = bagianJatah[i] - dipakai;
    return {
      label: k.label,
      jatah: bagianJatah[i],
      terpakai: dipakai,
      sisa,
      // Dinolkan saat jatahnya sudah terlampaui: "boleh belanja minus tiga
      // belas juta seminggu" bukan aturan yang bisa dijalankan siapa pun.
      perMinggu: potongan.length > 0 ? bulatkan(Math.max(0, sisa) / potongan.length) : 0,
    };
  });

  return {
    mulai, selesai, hari, komitmenBelumBayar, cicilanBelanja, kewajiban, terpakai,
    skenario, minggu, kategori,
  };
}

/**
 * Melipat laporan belanja menjadi satu angka. Dibaca berurutan menurut tanggal:
 * TAMBAH menumpuk di atas yang sebelumnya, SETEL membuang seluruh riwayat
 * sebelumnya dan memulai dari angka itu. Dua mode ini yang membedakan
 * "purchasing belanja Rp3 jt lagi" dari "ternyata totalnya Rp14 jt, bukan 11".
 */
export function lipatBelanja(entri: EntriBelanja[]): number {
  const urut = [...entri].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.urut - b.urut,
  );
  let total = 0;
  for (const e of urut) total = e.mode === 'SETEL' ? e.amount : total + e.amount;
  return Math.max(0, total);
}

/** Paling jauh yang masuk akal diramalkan dari satu bulan data. */
export const HORIZON_BULAN = 12;

/**
 * Kapan kas habis bila pola belanja tidak berubah.
 *
 * Pertanyaan ini sengaja dijawab dengan model yang berbeda dari plafon
 * mingguan. Plafon menjawab "berapa yang boleh dibelanjakan supaya kas tidak
 * habis"; bagian ini menjawab "apa yang terjadi kalau plafon itu tidak
 * diikuti dan belanja berjalan seperti bulan-bulan kemarin". Keduanya memang
 * harus berbeda — yang satu rencana, yang satu peringatan.
 */
export function hitungRunway(opsi: {
  period: Period;
  saldoKas: number;
  sisaMasuk: number;
  /** Proyeksi uang masuk bulan berjalan — menentukan sisa masuk bulan ini. */
  proyeksiBulanan: number;
  /**
   * Proyeksi untuk tiap bulan sesudahnya. Berupa fungsi, bukan satu angka,
   * karena musim berganti dari bulan ke bulan: bulan ramai dan bulan sepi tidak
   * boleh diramalkan dengan angka yang sama.
   */
  proyeksiBerikutnya: (period: Period) => number;
  pengeluaranBulanan: number;
  /** Komitmen yang belum dibayar, termasuk yang sekali ini saja. */
  komitmenBelumBayar: number;
  /** Komitmen yang berulang tiap bulan — bagian dari pengeluaran rutin. */
  komitmenRutinSebulan: number;
  kebutuhanGaji: number;
  /** Cicilan rencana belanja yang jatuh tempo di sebuah bulan. */
  cicilanPada?: (period: Period) => number;
  /** Kewajiban terjadwal yang jatuh tempo di sebuah bulan. */
  kewajibanPada?: (period: Period) => number;
  hariTersisa: number;
  hariSebulan: number;
  horizon?: number;
}): Runway {
  const {
    period, saldoKas, sisaMasuk, proyeksiBerikutnya, pengeluaranBulanan,
    komitmenBelumBayar, komitmenRutinSebulan,
    kebutuhanGaji, cicilanPada, kewajibanPada, hariTersisa, hariSebulan,
    horizon = HORIZON_BULAN,
  } = opsi;
  const cicilan = cicilanPada ?? (() => 0);
  const kewajiban = kewajibanPada ?? (() => 0);

  const bulan: BulanRunway[] = [];

  // Bulan berjalan dihitung dari daftar komitmen, bukan dari angka rutin yang
  // dirata-ratakan. Komitmen punya tanggal dan nominal yang pasti, sedangkan
  // belanja operasional tidak, jadi hanya bagian operasional yang diprorata
  // menurut sisa hari.
  //
  // Komitmen yang berulang dikeluarkan dulu dari pengeluaran rutin: keduanya
  // menyebut uang yang sama, dan mengurangkan dua-duanya akan menghitung gaji
  // dan cicilan dua kali. Yang tersisa — renovasi, pembelian sekali ini —
  // hanya memukul bulan berjalan, dan itu sebabnya ia harus ikut di sini:
  // tanpa ini, menambah komitmen besar sama sekali tidak menggerakkan ramalan.
  const operasionalSebulan = Math.max(0, pengeluaranBulanan - komitmenRutinSebulan);
  const porsi = hariSebulan > 0 ? hariTersisa / hariSebulan : 0;

  const catat = (period: Period, saldoAwal: number, masuk: number, keluar: number) => {
    const saldoAkhir = saldoAwal + masuk - keluar;
    bulan.push({
      period,
      saldoAwal,
      masuk,
      keluar,
      saldoAkhir,
      cukupGaji: saldoAkhir >= kebutuhanGaji,
      kurangGaji: Math.max(0, kebutuhanGaji - saldoAkhir),
    });
    return saldoAkhir;
  };

  let saldo = catat(
    period,
    saldoKas,
    sisaMasuk,
    komitmenBelumBayar + operasionalSebulan * porsi + cicilan(period) + kewajiban(period),
  );

  for (let i = 1; i <= horizon; i += 1) {
    if (saldo < 0) break;
    const bulanIni = addMonths(period, i);
    saldo = catat(
      bulanIni,
      saldo,
      proyeksiBerikutnya(bulanIni),
      pengeluaranBulanan + cicilan(bulanIni) + kewajiban(bulanIni),
    );
  }

  // Laju tiap bulan dihitung terpisah dari saldo, sepanjang horizon penuh.
  // Daftar saldo di atas berhenti begitu kas habis, sedangkan pertanyaan
  // "seberapa cepat kas terkuras" tidak boleh ikut berhenti di situ.
  //
  // Cicilan rencana belanja dan kewajiban terjadwal sengaja tidak masuk
  // hitungan: keduanya pengeluaran bertanggal, bukan laju. Akibatnya pada saldo
  // sudah terlihat di tabel.
  const laju: LajuBulan[] = Array.from({ length: Math.max(1, horizon) }, (_, i) => {
    const b = addMonths(period, i + 1);
    return { period: b, arus: proyeksiBerikutnya(b) - pengeluaranBulanan };
  });

  return {
    arusBersih: laju[0].arus,
    arusRata: laju.reduce((t, l) => t + l.arus, 0) / laju.length,
    arusTerendah: laju.reduce((a, b) => (b.arus < a.arus ? b : a)),
    arusTertinggi: laju.reduce((a, b) => (b.arus > a.arus ? b : a)),
    bulan,
    habisPada: bulan.find((b) => b.saldoAkhir < 0)?.period ?? null,
    gajiTerancam: bulan.find((b) => !b.cukupGaji)?.period ?? null,
  };
}

/**
 * Usulan tiga skenario dari riwayat uang masuk. Normal memakai rata-rata
 * tertimbang tiga bulan terakhir dengan bulan terbaru paling berat; pesimis dan
 * optimis memakai bulan terendah dan tertinggi di antaranya. Aturan yang bisa
 * dijelaskan dalam satu kalimat lebih berguna di rapat daripada rumus yang
 * lebih pintar tetapi tidak bisa ditelusuri.
 */
export function usulkanProyeksi(riwayat: number[]): Record<Skenario, number> | null {
  const pakai = riwayat.filter((v) => v > 0).slice(-3);
  if (pakai.length === 0) return null;

  const bobot = [1, 2, 3].slice(-pakai.length);
  const jumlahBobot = bobot.reduce((s, b) => s + b, 0);
  const normal = pakai.reduce((s, v, i) => s + v * bobot[i], 0) / jumlahBobot;

  return {
    PESIMIS: Math.min(...pakai),
    NORMAL: normal,
    OPTIMIS: Math.max(...pakai),
  };
}
