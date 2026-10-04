/**
 * Siapa yang menanggung biaya yang di GuestPro tidak bertanda cabang.
 *
 * Sebagian beban di GuestPro tidak menyebut cabangnya. Dulu beban seperti itu
 * disebar ke SEMUA cabang dalam satu PMS sebanding pendapatan — cara yang
 * membebani cabang dengan biaya yang bukan miliknya. IGYT, misalnya, sempat
 * menanggung Rp 24,3 juta bonus management dan Rp 82,6 juta beban bersama lain
 * selama delapan bulan, padahal IGYT sudah punya akun gaji dan servisnya
 * sendiri.
 *
 * Daftar di bawah menggantikan terkaan itu dengan keterangan langsung dari
 * pemilik usaha:
 *
 *   GuestPro 1 (The Hita Uluwatu + IGYT)
 *     Listrik  : satu meteran, dipakai berdua.
 *     Sisanya  : milik Uluwatu. IGYT punya 616.10 Gaji IGYT dan 616.12 Service
 *                IGYT sendiri, jadi gaji dan servis di akun bersama bukan
 *                miliknya.
 *
 *   GuestPro 2 (The Hita Legian + Sri Krisna + Play Laundry)
 *     Software : ditanggung Legian.
 *     Sisanya  : ditanggung Legian dan Sri Krisna berdua — stafnya memang orang
 *                yang sama, berpindah lokasi karena jaraknya dekat. Play
 *                Laundry tidak ikut; laundry punya akun gaji dan servisnya
 *                sendiri.
 */

import type { PmsSource } from './coa-legacy';

/** Cabang yang menanggung satu biaya bersama. */
export type Penanggung = readonly string[];

type AturanPms = {
  /** Penanggung bawaan untuk akun tak bertanda di PMS ini. */
  bawaan: Penanggung;
  /** Pengecualian, memakai nomor akun pada COA baru. */
  khusus: Record<string, Penanggung>;
};

const ATURAN: Record<PmsSource, AturanPms> = {
  PMS1: {
    bawaan: ['THU'],
    khusus: {
      '6120.01': ['THU', 'IGYT'], // Biaya Listrik — satu meteran berdua
    },
  },
  PMS2: {
    bawaan: ['THL', 'SKR'],
    khusus: {
      '6120.05': ['THL'], // Biaya Software dan Langganan — ditanggung Legian
    },
  },
};

/**
 * Cabang penanggung satu akun bersama pada PMS tertentu.
 *
 * `newCode` adalah nomor akun pada COA baru, bukan nomor GuestPro-nya.
 */
export function penanggungBeban(newCode: string, pms: PmsSource): Penanggung {
  const aturan = ATURAN[pms];
  return aturan.khusus[newCode] ?? aturan.bawaan;
}

/**
 * Nama kelompok penanggung, dipakai sebagai penanda pada baris jurnal dan
 * sebagai judul kelompok di laporan. Satu cabang mengembalikan null: biaya itu
 * sepenuhnya milik cabang tersebut, bukan beban bersama.
 */
export function namaPenanggung(penanggung: Penanggung): string | null {
  // Urutannya mengikuti daftar di atas, bukan abjad — "THL+SKR" lebih enak
  // dibaca daripada "SKR+THL", dan daftarnya sudah pasti sehingga hasilnya tetap
  // sama setiap kali.
  return penanggung.length > 1 ? penanggung.join('+') : null;
}
