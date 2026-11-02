/**
 * Rekonsiliasi kas penampung — mis. Kas Purchasing yang dananya disetor
 * beberapa cabang lalu dibelanjakan untuk cabang mana pun.
 *
 * Kenapa ini diperlukan. Selama uang dialokasikan per cabang di muka
 * ("amplop"), pembukuannya pasti tidak cocok di akhir bulan: uang tunai
 * sifatnya cair, dan begitu belanja satu cabang terbayar dari setoran cabang
 * lain, amplopnya kosong tanpa ada yang menjelaskan ke mana. Yang terjadi
 * sebenarnya bukan uang hilang, melainkan satu cabang menalangi cabang lain —
 * dan itu utang, bukan selisih.
 *
 * Jadi alokasinya dipindah: uang masuk tanpa menyebut cabang, cabangnya
 * ditentukan saat dibelanjakan. Dari situ dua angka yang selama ini dicari
 * muncul sendiri:
 *
 *   saldo penampung  = uang yang harus ada di tangan, bisa dihitung fisik
 *   disetor − dipakai = berapa sebuah cabang menalangi, atau ditalangi
 *
 * Akhir bulan tidak perlu "cocok" dalam arti amplop. Yang diperiksa cuma satu:
 * uang di tangan sama dengan saldo penampung. Ketimpangan antar cabang berhenti
 * jadi kesalahan yang harus dicari dan berubah jadi angka yang tercatat.
 */

/** Satu baris jurnal pada sebuah bukti yang menyentuh kas penampung. */
export type BarisBukti = {
  /** Akun baris ini. */
  accountId: string;
  /** Kode cabang yang memikul baris ini. */
  unit: string;
  debit: number;
  credit: number;
  /**
   * Baris jembatan piutang/hutang antar unit. Dibuat otomatis dan selalu
   * berpasangan, jadi ia tidak boleh ikut dibaca sebagai setoran maupun
   * belanja — kalau ikut, tiap mutasi terhitung dua kali.
   */
  antarUnit: boolean;
};

export type Bukti = {
  tanggal: Date;
  baris: BarisBukti[];
};

export type PosisiCabang = {
  unit: string;
  /** Dana yang disetor cabang ini ke penampung. */
  disetor: number;
  /** Belanja penampung yang dibebankan ke cabang ini. */
  dipakai: number;
  /**
   * disetor − dipakai: klaim cabang ini atas penampung.
   *
   * Positif berarti cabang itu menaruh lebih banyak daripada yang terpakai
   * untuknya — sebagian masih mengendap di penampung, sebagian mungkin sudah
   * terpakai cabang lain. Keduanya tidak bisa dipisahkan dari angka ini saja,
   * karena uang tunai memang cair. Yang memisahkannya: begitu penampungnya
   * kosong, klaim yang tersisa pasti sudah terpakai cabang lain — dan saat
   * itulah ia benar-benar utang.
   */
  net: number;
};

export type RekapPenampung = {
  saldoAwal: number;
  totalMasuk: number;
  totalKeluar: number;
  /** saldoAwal + masuk − keluar. Harus sama dengan uang yang dihitung fisik. */
  saldoAkhir: number;
  /** Per cabang, diurutkan dari klaim terbesar. */
  posisi: PosisiCabang[];
  /**
   * Selisih yang tidak terjelaskan. Jumlah seluruh klaim cabang seharusnya
   * sama persis dengan uang yang masih mengendap di penampung — bukan nol,
   * karena setoran yang belum terbelanjakan tetap jadi klaim penyetornya.
   * Selisih bukan nol berarti ada bukti yang baris lawannya tidak bercabang,
   * biasanya belanja yang pos bebannya masih memikul kode penampung.
   */
  selisih: number;
};

const bulat = (n: number) => Math.round(n * 100) / 100;

/**
 * Lawan dari baris penampung pada bukti yang sama menentukan cabangnya.
 *
 * Bukan baris penampungnya sendiri: baris itu memikul kode penampung, bukan
 * kode cabang yang bersangkutan. Pada setoran, lawannya adalah rekening bank
 * cabang penyetor (dikredit). Pada belanja, lawannya adalah pos beban cabang
 * pemakai (didebit) — dan satu bukti belanja boleh memuat beberapa cabang
 * sekaligus, yang justru bentuk paling ringkas untuk rekap mingguan.
 */
export function rekapPenampung(
  bukti: Bukti[],
  akunPenampung: string,
  rentang: { mulai: Date; selesaiEksklusif: Date },
): RekapPenampung {
  let saldoAwal = 0;
  let totalMasuk = 0;
  let totalKeluar = 0;
  const per = new Map<string, PosisiCabang>();

  const catat = (unit: string, ubah: Partial<Omit<PosisiCabang, 'unit' | 'net'>>) => {
    const ada = per.get(unit) ?? { unit, disetor: 0, dipakai: 0, net: 0 };
    ada.disetor = bulat(ada.disetor + (ubah.disetor ?? 0));
    ada.dipakai = bulat(ada.dipakai + (ubah.dipakai ?? 0));
    per.set(unit, ada);
  };

  for (const b of bukti) {
    const barisPenampung = b.baris.filter((l) => l.accountId === akunPenampung);
    if (barisPenampung.length === 0) continue;
    const delta = bulat(barisPenampung.reduce((t, l) => t + l.debit - l.credit, 0));
    if (delta === 0) continue;

    // Yang terjadi sebelum rentang hanya membentuk saldo awal, tidak ikut
    // dirinci: rinciannya milik bulan tempat kejadiannya.
    if (b.tanggal < rentang.mulai) {
      saldoAwal = bulat(saldoAwal + delta);
      continue;
    }
    if (b.tanggal >= rentang.selesaiEksklusif) continue;

    if (delta > 0) totalMasuk = bulat(totalMasuk + delta);
    else totalKeluar = bulat(totalKeluar - delta);

    const lawan = b.baris.filter((l) => l.accountId !== akunPenampung && !l.antarUnit);
    for (const l of lawan) {
      // Lawan yang dikredit berarti uang datang dari sana: setoran.
      if (l.credit > 0) catat(l.unit, { disetor: l.credit });
      // Lawan yang didebit berarti uang pergi ke sana: belanja.
      if (l.debit > 0) catat(l.unit, { dipakai: l.debit });
    }
  }

  const posisi = [...per.values()]
    .map((p) => ({ ...p, net: bulat(p.disetor - p.dipakai) }))
    .filter((p) => p.disetor !== 0 || p.dipakai !== 0)
    .sort((a, b) => b.net - a.net);

  // Setoran yang belum terbelanjakan tetap jadi klaim penyetornya, jadi jumlah
  // seluruh klaim sama dengan mutasi bersih penampung bulan itu — bukan nol.
  const mutasiBersih = bulat(totalMasuk - totalKeluar);

  return {
    saldoAwal,
    totalMasuk,
    totalKeluar,
    saldoAkhir: bulat(saldoAwal + mutasiBersih),
    posisi,
    selisih: bulat(posisi.reduce((t, p) => t + p.net, 0) - mutasiBersih),
  };
}
