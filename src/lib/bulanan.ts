/**
 * Uang masuk bulan demi bulan: yang diproyeksikan dan yang benar-benar datang.
 *
 * Grafik sebelumnya hanya menatap bulan berjalan, padahal pola musim sudah
 * memberi angka untuk bulan-bulan sesudahnya dan laporan posisi kas sudah
 * menyimpan bulan-bulan sebelumnya. Yang kurang hanya menyusunnya berderet.
 *
 * Bulan yang sudah lewat sengaja ikut ditampilkan, dan bukan sekadar hiasan:
 * proyeksinya dihitung ulang dengan pola musim yang berlaku sekarang, jadi
 * mendampingkannya dengan kenyataan memperlihatkan apakah polanya memang
 * cocok. Pola yang selalu meleset ke satu arah lebih mudah terlihat di sini
 * daripada di angka mana pun.
 *
 * Batang proyeksinya satu, bertingkat tiga: pesimis sebagai dasar, lalu
 * selisihnya ke normal, lalu ke optimis. Jumlah ketiganya selalu sama dengan
 * proyeksi tertinggi — ditulis dengan Math.max supaya tetap benar walau
 * angkanya tertukar urutan, yang memang pernah terjadi saat satu sheet
 * tertinggal diperbarui.
 */

import { addMonths, type Period } from './period';

export type PosisiBulan = 'LALU' | 'INI' | 'DEPAN';

export type BarisBulan = {
  period: Period;
  posisi: PosisiBulan;
  pesimis: number;
  normal: number;
  optimis: number;
  /** Tiga lapis batang proyeksi; jumlahnya sama dengan proyeksi tertinggi. */
  lapisPesimis: number;
  lapisNormal: number;
  lapisOptimis: number;
  /** Uang masuk yang benar-benar tercatat; null bila belum ada. */
  masuk: number | null;
  /** Hari yang dicakup angka masuk itu; null bila tidak diketahui. */
  hariMasuk: number | null;
  /** Perkiraan sisa bulan menurut skenario normal; hanya untuk bulan berjalan. */
  perkiraanSisa: number | null;
};

export type ProyeksiTiga = { PESIMIS: number; NORMAL: number; OPTIMIS: number };

/** Tiga lapis yang kalau ditumpuk tingginya persis proyeksi tertinggi. */
function lapis(p: ProyeksiTiga) {
  const dasar = Math.max(0, p.PESIMIS);
  const sampaiNormal = Math.max(dasar, p.NORMAL);
  return {
    lapisPesimis: dasar,
    lapisNormal: sampaiNormal - dasar,
    lapisOptimis: Math.max(sampaiNormal, p.OPTIMIS) - sampaiNormal,
  };
}

export function barisBulan(opsi: {
  /** Bulan berjalan. */
  period: Period;
  /** Banyaknya bulan ke belakang dan ke depan yang ikut ditampilkan. */
  mundur: number;
  maju: number;
  proyeksi: (p: Period) => ProyeksiTiga;
  /** Laporan posisi kas bulan-bulan lalu: uang masuk dan hari yang dicakupnya. */
  laporan: { period: Period; masuk: number; hari: number }[];
  /** Uang masuk menurut jurnal, dipakai bila bulan itu tidak punya laporan. */
  jurnal: { period: Period; cashIn: number }[];
  /** Uang masuk bulan berjalan sampai laporan terakhir; null bila belum ada. */
  masukBulanIni: number | null;
  hariBulanIni: number | null;
}): BarisBulan[] {
  const { period, mundur, maju, proyeksi, masukBulanIni, hariBulanIni } = opsi;

  const dariLaporan = new Map(opsi.laporan.map((l) => [l.period, l]));
  const dariJurnal = new Map(opsi.jurnal.filter((j) => j.cashIn > 0).map((j) => [j.period, j]));

  const baris: BarisBulan[] = [];
  for (let i = -Math.max(0, mundur); i <= Math.max(0, maju); i += 1) {
    const p = addMonths(period, i);
    const tiga = proyeksi(p);
    const posisi: PosisiBulan = i < 0 ? 'LALU' : i === 0 ? 'INI' : 'DEPAN';

    // Bulan lalu: laporan posisi kas didahulukan daripada jurnal, sama seperti
    // pembanding laju harian — keduanya tidak selalu mengukur hal yang sama,
    // dan yang diketik sendiri itulah yang setara dengan bulan berjalan.
    let masuk: number | null = null;
    let hariMasuk: number | null = null;
    if (posisi === 'LALU') {
      const l = dariLaporan.get(p);
      if (l && l.masuk > 0) {
        masuk = l.masuk;
        hariMasuk = l.hari;
      } else {
        masuk = dariJurnal.get(p)?.cashIn ?? null;
      }
    } else if (posisi === 'INI') {
      masuk = masukBulanIni;
      hariMasuk = hariBulanIni;
    }

    baris.push({
      period: p,
      posisi,
      pesimis: tiga.PESIMIS,
      normal: tiga.NORMAL,
      optimis: tiga.OPTIMIS,
      ...lapis(tiga),
      masuk,
      hariMasuk,
      // Hanya bulan berjalan yang punya "sisa": bulan lalu sudah selesai, bulan
      // depan belum punya kenyataan apa pun untuk ditambahi.
      perkiraanSisa: posisi === 'INI' && masuk !== null
        ? Math.max(0, tiga.NORMAL - masuk)
        : null,
    });
  }
  return baris;
}
