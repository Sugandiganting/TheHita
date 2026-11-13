/**
 * Target uang masuk bulan-bulan ke depan, diturunkan dari bulan yang
 * realisasinya sudah lengkap.
 *
 *     n   = target uang masuk bulan yang dihitung
 *     n−1 = uang masuk NYATA bulan sebelumnya
 *     t   = target yang tercapai di bulan itu (pesimis, normal, atau optimis)
 *     c   = pengali musim bulan dihitung terhadap bulan sebelumnya
 *
 *     bila n−1 > t :  n = (t + ((n−1) − t) × 50%) × c
 *     selain itu   :  n = t × c
 *
 * Setengah selisih itulah inti rumusnya: bulan yang melampaui targetnya
 * menggeser target berikutnya setengah jalan menuju kenyataan. Dasarnya target
 * yang tercapai, bukan uang masuknya — memakai uang masuk berarti menambahkan
 * kelebihan itu satu setengah kali, dan targetnya berakhir di atas bulan yang
 * baru saja lewat. Separuh, bukan seluruhnya, karena satu bulan ramai belum
 * tentu berulang; dan bukan nol, karena kalau tidak, target tidak pernah naik
 * betapapun baiknya kenyataan.
 *
 * Yang di bawah tingkat terendah tidak menyeret targetnya ikut jatuh: ia
 * kembali ke target pesimis. Bulan buruk yang menurunkan target bulan depan
 * akan menurunkannya lagi bulan sesudahnya, dan seterusnya — rencana yang
 * menyesuaikan diri ke bawah tanpa dasar berhenti menjadi rencana.
 */

import { monthOf, type Period } from './period';
import { pengali, type PolaMusim } from './musim';
import { SKENARIO, type Skenario } from './rencana-kas';
import { targetBulan, type PolaTargetMargin, type TargetMargin } from './target-margin';

const bulat = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Bagian kelebihan yang dibawa ke bulan berikutnya. */
export const BAGIAN_KELEBIHAN = 0.5;

export type Tingkat = {
  /** Tingkat tertinggi yang tercapai; null bila di bawah pesimis sekalipun. */
  skenario: Skenario | null;
  /** Nilai target tingkat itu. Bila tidak ada yang tercapai, target pesimis. */
  t: number;
};

/**
 * Tingkat yang tercapai sebuah bulan, dibandingkan dengan ketiga proyeksinya.
 *
 * Dibandingkan dengan UANG MASUK, bukan dengan margin: yang ditanya rumus ini
 * seberapa jauh pemasukan melampaui targetnya, dan margin menjawab pertanyaan
 * lain — apakah yang masuk itu tersisa.
 *
 * Proyeksi yang nol dilewati. Nol bukan target yang pernah ditetapkan
 * seseorang, dan menganggapnya tercapai akan membuat tiap bulan terbaca
 * melampaui targetnya.
 */
export function tingkatTercapai(masukNyata: number, proyeksi: Record<Skenario, number>): Tingkat | null {
  const pesimis = proyeksi.PESIMIS;
  if (!Number.isFinite(masukNyata)) return null;
  if (!(pesimis > 0)) return null;

  // Dari yang tertinggi: yang pertama tercapai itulah tingkatnya.
  for (const sk of [...SKENARIO].reverse()) {
    const target = proyeksi[sk];
    if (target > 0 && masukNyata >= target) return { skenario: sk, t: target };
  }
  return { skenario: null, t: pesimis };
}

/**
 * Pengali musim bulan tujuan terhadap bulan asal.
 *
 * Musim bulan asal dilepas dulu sebelum musim bulan tujuan dipasang, karena
 * angka asalnya nyata dan sudah membawa musim bulannya sendiri. Tanpa itu,
 * bulan high yang dipakai sebagai asal menularkan tingginya ke bulan
 * sesudahnya, dan bulan low menularkan rendahnya.
 *
 * Null bila salah satu bulannya belum diberi musim: menebak dengan pola yang
 * belum ada sama saja dengan mengarang.
 */
export function pengaliMusim(asal: Period, tujuan: Period, pola: PolaMusim): number | null {
  const a = pola.get(monthOf(asal));
  const b = pola.get(monthOf(tujuan));
  if (!a || !b) return null;
  const bawah = pengali(a);
  if (bawah <= 0) return null;
  return pengali(b) / bawah;
}

/**
 * Satu langkah rumus: target bulan berikutnya dari sebuah bulan yang
 * realisasinya sudah lengkap.
 *
 * Dasarnya TARGET YANG TERCAPAI, bukan uang masuk yang nyata. Dari situ
 * separuh kelebihannya ditambahkan, sehingga targetnya bergerak setengah
 * jalan dari target lama menuju kenyataan — lalu dikali musim.
 *
 * Perbedaannya bukan soal selera. Memakai uang masuk nyata sebagai dasar
 * berarti menambahkan kelebihan itu satu setengah kali, dan targetnya
 * berakhir di atas bulan yang baru saja lewat; memakai target sebagai dasar
 * membuatnya berhenti di tengah. Satu bulan ramai belum tentu berulang, dan
 * target yang melampaui bulan terbaik belum tentu bisa dikejar.
 */
export function targetBerikutnya(
  masukNyata: number,
  tingkat: Tingkat,
  c: number,
  pembulatan: (n: number) => number = bulat,
): number {
  if (masukNyata > tingkat.t) {
    return pembulatan((tingkat.t + (masukNyata - tingkat.t) * BAGIAN_KELEBIHAN) * c);
  }
  return pembulatan(tingkat.t * c);
}

export type BarisTargetCash = {
  period: Period;
  /** Target uang masuk tiap skenario. */
  target: Record<Skenario, number>;
  /** Bulan ini dihitung langsung dari realisasi, bukan dari bulan hasil hitungan. */
  dariRealisasi: boolean;
  /** Pengali musim yang dipakai terhadap bulan sebelumnya. */
  c: number;
};

/**
 * Ketiga skenario dari satu target normal, lewat master Target Margin.
 *
 * Belanja yang tersirat dari target normal dibagi (1 − margin) tiap skenario.
 * Ketiganya karena itu menggambarkan RENCANA BELANJA YANG SAMA pada tiga
 * tingkat keuntungan, bukan tiga tebakan pemasukan yang berdiri sendiri — dan
 * urutannya tidak bisa terbalik selama targetnya berurut.
 *
 * Mengembalikan null bila targetnya belum lengkap; pemanggilnya yang
 * memutuskan apa yang dipakai sebagai gantinya.
 */
export function sebaranDariTargetNormal(
  normal: number,
  margin: TargetMargin,
  pembulatan: (n: number) => number = bulat,
): Record<Skenario, number> | null {
  const mNormal = margin.get('NORMAL');
  if (mNormal === undefined || mNormal >= 100) return null;

  const belanja = normal * (1 - mNormal / 100);
  const hasil = {} as Record<Skenario, number>;
  for (const sk of SKENARIO) {
    const m = margin.get(sk);
    if (m === undefined || m >= 100) return null;
    hasil[sk] = pembulatan(belanja / (1 - m / 100));
  }
  return hasil;
}

/**
 * Rantai target dua belas bulan ke depan dari bulan terakhir yang lengkap.
 *
 * Bulan pertama memakai rumus penuh. Bulan-bulan sesudahnya hanya dikali
 * musim — dan itu bukan aturan tambahan melainkan akibat rumusnya sendiri:
 * sebuah bulan yang belum terjadi diandaikan mendarat tepat di targetnya,
 * sehingga (n−1) − t bernilai nol dan suku kelebihannya hilang dengan
 * sendirinya.
 *
 * Begitu sebuah bulan selesai, ia menjadi titik tumpu yang baru dan seluruh
 * rantainya dihitung ulang dari situ. Jadi ramalan dua belas bulan ini tidak
 * pernah menjauh dari kenyataan lebih dari satu bulan.
 */
export function rantaiTarget(input: {
  /** Bulan terakhir yang realisasinya lengkap. */
  anchor: Period;
  masukNyata: number;
  tingkat: Tingkat;
  pola: PolaMusim;
  /** Target margin tiap bulan kalender — tiap bulan rantai memakai miliknya sendiri. */
  margin: PolaTargetMargin;
  bulan: number;
  /** Bulan sesudah anchor, berurutan. */
  periode: Period[];
  pembulatan?: (n: number) => number;
}): BarisTargetCash[] {
  const pembulatan = input.pembulatan ?? bulat;
  const hasil: BarisTargetCash[] = [];

  let sebelumnya: Period = input.anchor;
  let nilaiSebelumnya: number | null = null;

  for (const period of input.periode.slice(0, input.bulan)) {
    const c = pengaliMusim(sebelumnya, period, input.pola);
    if (c === null) break;

    const normal: number = nilaiSebelumnya === null
      ? targetBerikutnya(input.masukNyata, input.tingkat, c, pembulatan)
      : pembulatan(nilaiSebelumnya * c);

    /*
     * Tiap bulan memakai target marginnya sendiri. Rantainya berhenti di bulan
     * pertama yang belum ditetapkan, bukan meminjam angka bulan lain: pinjaman
     * semacam itu menghasilkan target yang tampak sah padahal tidak pernah
     * dipilih siapa pun untuk bulan itu.
     */
    const marginBulan = targetBulan(input.margin, monthOf(period));
    if (!marginBulan) break;
    const sebaran = sebaranDariTargetNormal(normal, marginBulan, pembulatan);
    if (sebaran === null) break;

    hasil.push({ period, target: sebaran, dariRealisasi: nilaiSebelumnya === null, c });
    sebelumnya = period;
    nilaiSebelumnya = normal;
  }

  return hasil;
}
