/**
 * Arus kas bulanan dari laporan posisi kas, bukan dari jurnal.
 *
 * Tiap minggu dua angka diketik: saldo kas & bank pada tanggal itu, dan uang
 * masuk kumulatif bulan itu sampai tanggal itu. Dari dua angka itu saja arus
 * kas sebulan sudah ketahuan seluruhnya:
 *
 *   net    = saldo akhir bulan ini − saldo akhir bulan sebelumnya
 *   keluar = masuk − net
 *
 * Uang keluarnya diturunkan, bukan diketik. Akibatnya dua hal bagus sekaligus:
 * ketiganya tidak mungkin tidak cocok satu sama lain, dan "keluar" otomatis
 * mencakup segala yang keluar dari bank — gaji, cicilan, belanja operasional —
 * bukan hanya yang sempat dicatat per kategori. Yang tidak bisa dijawab di
 * sini hanyalah rinciannya: keluar untuk apa. Itu memang kerjanya jurnal.
 *
 * Yang dipakai laporan TERAKHIR tiap bulan, karena itulah yang mencakup paling
 * banyak hari. Konsekuensinya satu baris bukan persis bulan kalender melainkan
 * jarak antar laporan — kalau laporan terakhir September tanggal 28 dan
 * Oktober tanggal 23, baris Oktober menutup 28 Sep sampai 23 Okt. Tanggalnya
 * ikut dibawa supaya bisa ditulis di layar, bukan disembunyikan.
 */

import type { Period } from './period';

/** Laporan posisi kas terakhir sebuah bulan. */
export type LaporanBulan = {
  period: Period;
  tanggal: Date;
  saldo: number;
  masuk: number;
};

export type ArusBulan = {
  period: Period;
  /** Tanggal laporan terakhir bulan ini. */
  tanggal: Date;
  /** Tanggal laporan terakhir bulan sebelumnya; null bila tidak ada. */
  tanggalAwal: Date | null;
  saldoAwal: number | null;
  saldoAkhir: number;
  masuk: number;
  /** masuk − net. Null bila bulan sebelumnya belum pernah dilaporkan. */
  keluar: number | null;
  /** saldoAkhir − saldoAwal. Null dengan alasan yang sama. */
  net: number | null;
};

export function arusKasBulanan(laporan: LaporanBulan[]): ArusBulan[] {
  const urut = [...laporan].sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));

  return urut.map((l, i) => {
    // Hanya bulan yang persis sebelumnya yang boleh jadi pembanding. Melompati
    // bulan yang tidak pernah dilaporkan akan menghasilkan "net" dua bulan
    // yang tertulis sebagai net sebulan — salah tanpa terlihat salah.
    const sebelum = i > 0 ? urut[i - 1] : null;
    const bersebelahan = sebelum !== null && bulanSebelum(l.period) === sebelum.period;
    const saldoAwal = bersebelahan ? sebelum.saldo : null;
    const net = saldoAwal === null ? null : l.saldo - saldoAwal;

    return {
      period: l.period,
      tanggal: l.tanggal,
      tanggalAwal: bersebelahan ? sebelum.tanggal : null,
      saldoAwal,
      saldoAkhir: l.saldo,
      masuk: l.masuk,
      keluar: net === null ? null : l.masuk - net,
      net,
    };
  });
}

/** "2026-10" -> "2026-09". */
function bulanSebelum(period: Period): Period {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
