/**
 * Uang yang ditransfer ke kas sebuah departemen, dihitung sebagai terpakai.
 *
 * Anggapannya: begitu uang diserahkan ke Purchasing atau HR, uang itu habis.
 * Itu bukan penyederhanaan yang dipaksakan — memang begitu cara pembukuan ini
 * berjalan. Saldo kas yang dilaporkan tiap minggu sudah tidak memuat kas
 * departemen lagi, dan aritmetikanya cocok sampai rupiah terakhir dengan
 * rincian uang keluar di workbook: Purchasing + HR + Bank Perusahaan + utang
 * bank sama persis dengan penurunan saldonya.
 *
 * Konsekuensi yang perlu disadari: kalau sebuah departemen menyisakan kas di
 * tangan, jatahnya tetap terbaca habis padahal uangnya masih ada. Untuk arus
 * kas itu benar — uangnya sudah keluar dari kendali pusat — tetapi untuk
 * menilai efisiensi departemen, angkanya optimis.
 */

/** Satu baris jurnal yang menyentuh kas departemen. */
export type BarisTransfer = {
  accountId: string;
  debit: number;
  credit: number;
  tanggal: Date;
  /** Kode cabang pengirim. */
  unit: string;
};

/**
 * Total yang masuk ke sebuah akun kas departemen.
 *
 * Debit dikurangi kredit, bukan debit saja: pembatalan transfer dicatat
 * sebagai kredit di akun yang sama, dan mengabaikannya berarti uang yang sudah
 * dikembalikan tetap terhitung habis.
 *
 * `hanyaSetelahPosisi` memakai aturan yang sama dengan belanja manual: yang
 * terjadi sampai tanggal laporan posisi kas sudah tercermin pada saldonya,
 * jadi tidak boleh memotong plafon untuk kedua kalinya.
 */
export function terpakaiDariTransfer(
  baris: BarisTransfer[],
  accountId: string | null,
  opsi: { batasPosisi?: Date | null; hanyaSetelahPosisi?: boolean } = {},
): number {
  if (!accountId) return 0;
  const { batasPosisi = null, hanyaSetelahPosisi = false } = opsi;

  return baris
    .filter((l) => {
      if (l.accountId !== accountId) return false;
      if (!hanyaSetelahPosisi) return true;
      const sebelumPosisi = batasPosisi !== null && l.tanggal <= batasPosisi;
      return !sebelumPosisi;
    })
    .reduce((t, l) => t + l.debit - l.credit, 0);
}

/**
 * Rincian per cabang pengirim, terbesar lebih dulu.
 *
 * Cabang yang jumlahnya nol dibuang: biasanya itu transfer yang dikirim lalu
 * dikembalikan, dan menampilkannya sebagai "Rp 0" membuat pembacanya mencari
 * sesuatu yang sudah tidak ada.
 */
export function transferPerCabang(
  baris: BarisTransfer[],
  accountId: string | null,
): { unit: string; amount: number }[] {
  if (!accountId) return [];
  const per = new Map<string, number>();
  for (const l of baris) {
    if (l.accountId !== accountId) continue;
    per.set(l.unit, (per.get(l.unit) ?? 0) + l.debit - l.credit);
  }
  return [...per.entries()]
    .map(([unit, amount]) => ({ unit, amount }))
    .filter((x) => x.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}
