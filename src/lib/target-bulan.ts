/**
 * Target tiap bulan kalender: margin kas yang diinginkan, dan lebar sebaran
 * optimis-pesimis di sekitar ramalan normalnya.
 *
 * MARGIN KAS, BUKAN MARGIN LABA BERSIH. Dihitung terhadap uang yang masuk,
 * bukan terhadap pendapatan di laba rugi. Uang masuk memuat hal yang bukan
 * pendapatan bulan itu — deposit tamu, pelunasan piutang, setoran modal,
 * pindahan antar rekening — sehingga kedua angka itu memang berbeda dan tidak
 * seharusnya dibandingkan begitu saja. Yang dijawab di sini satu pertanyaan
 * saja: dari uang yang masuk bulan ini, berapa yang ingin disisakan.
 *
 * Perbedaan itu disebut berulang-ulang justru karena tampak sepele. Begitu
 * sebuah angka bernama "margin" muncul di dua laporan dengan dasar berbeda,
 * selisihnya akan dicari orang berhari-hari — dan selisih itu memang tidak
 * punya sebab yang bisa ditemukan.
 */

export type TargetBulan = {
  /** 1 sampai 12. */
  month: number;
  /** Persen dari uang masuk yang ingin disisakan. null = belum ditetapkan. */
  cashMargin: number | null;
  /** Optimis = normal dinaikkan sekian persen. */
  optimisticUp: number | null;
  /** Pesimis = normal diturunkan sekian persen. */
  pessimisticDown: number | null;
};

/** Target tiap bulan kalender, 1 sampai 12. */
export type PolaTarget = Map<number, TargetBulan>;

/**
 * Pembulatan bawaan, sama dengan yang dipakai modul hitung lain di aplikasi
 * ini. Tanpa ini, 400 jt dinaikkan 12% berakhir di 448.000.000,00000006 —
 * benar secara angka, tetapi akan tercetak apa adanya di layar suatu hari.
 */
const bulat = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Persen yang boleh dipakai: angka hingga, dan tidak negatif. */
function persenSah(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * Batas belanja sebulan supaya margin targetnya tercapai.
 *
 * Margin 15% dari ramalan masuk 400 jt berarti belanja paling banyak 340 jt.
 * Mengembalikan null bila targetnya belum ditetapkan atau ramalannya belum
 * ada — itu jawaban, bukan kegagalan: batas yang dikarang dari angka yang
 * belum ada akan terbaca sama meyakinkannya dengan batas yang benar.
 *
 * Margin 100% atau lebih menghasilkan batas nol, bukan angka negatif: tidak
 * ada belanja yang kurang dari tidak belanja sama sekali.
 */
export function batasBelanjaMargin(
  proyeksiMasuk: number | null,
  cashMargin: number | null,
  pembulatan: (n: number) => number = bulat,
): number | null {
  if (proyeksiMasuk === null || !Number.isFinite(proyeksiMasuk) || proyeksiMasuk <= 0) return null;
  if (!persenSah(cashMargin)) return null;
  return Math.max(0, pembulatan(proyeksiMasuk * (1 - cashMargin / 100)));
}

/**
 * Margin kas yang benar-benar tercapai: selisih masuk dan keluar, dibagi
 * masuk, dalam persen.
 *
 * Null bila belum ada uang masuk sama sekali. Membaginya dengan nol akan
 * menghasilkan tak hingga, dan bulan yang belum menerima apa pun memang belum
 * punya margin — bukan margin nol.
 */
export function marginTercapai(masuk: number, keluar: number): number | null {
  if (!Number.isFinite(masuk) || masuk <= 0) return null;
  return ((masuk - keluar) / masuk) * 100;
}

/**
 * Sebaran pesimis dan optimis di sekitar ramalan normal.
 *
 * Yang dipakai persen terhadap normal, bukan dua angka yang diketik
 * sendiri-sendiri: tiga angka yang berdiri terpisah bisa bergerak saling
 * bertentangan — optimis di bawah normal — tanpa ada yang menahannya.
 *
 * Sisi yang persennya belum ditetapkan dikembalikan null, dan pemanggilnya
 * yang memutuskan apa yang dipakai sebagai gantinya. Penurunan 100% atau
 * lebih menghasilkan nol, bukan angka negatif.
 */
export function sebaranDariNormal(
  normal: number,
  target: TargetBulan | undefined,
  pembulatan: (n: number) => number = bulat,
): { pesimis: number | null; optimis: number | null } {
  if (!Number.isFinite(normal)) return { pesimis: null, optimis: null };
  const turun = target?.pessimisticDown;
  const naik = target?.optimisticUp;
  return {
    pesimis: persenSah(turun) ? Math.max(0, pembulatan(normal * (1 - turun / 100))) : null,
    optimis: persenSah(naik) ? pembulatan(normal * (1 + naik / 100)) : null,
  };
}

/** Ada satu pun bulan yang targetnya sudah ditetapkan. */
export function adaTarget(pola: PolaTarget): boolean {
  return [...pola.values()].some(
    (t) => persenSah(t.cashMargin) || persenSah(t.optimisticUp) || persenSah(t.pessimisticDown),
  );
}
