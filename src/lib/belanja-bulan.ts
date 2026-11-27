/**
 * Belanja bulan ini: satu daftar seluruh uang yang harus keluar dalam sebulan.
 *
 * Menggantikan kategori Rencana Kas yang jatahnya diketik sendiri. Isinya
 * diambil langsung dari sumbernya:
 * - baris RAB yang sudah disahkan (semua jenis, seluruh cabang);
 * - item proyek Approved yang dibayar bulan ini atau sudah lewat tanggalnya;
 * - komitmen bulan ini (cicilan bank dan sejenisnya);
 * - kewajiban terjadwal dan cicilan rencana belanja yang jatuh tempo bulan ini.
 *
 * Aturannya satu untuk semua sumber, sama dengan item proyek:
 * - yang belum selesai dihitung sisanya (rencana − sudah dibayar);
 * - yang sudah selesai hanya realisasinya — selisihnya terhadap rencana
 *   (hemat) tidak ikut dihitung;
 * - pembayaran bertanggal sebelum atau pada tanggal posisi kas sudah ada di
 *   saldo, jadi tidak dikurangkan lagi.
 */
import { toPeriod, type Period } from './period';
import {
  realisasiSesudahPosisi, susunRealisasi, type PembayaranRab, type RealisasiLama,
} from './rab';
import {
  STATUS_MEMOTONG_KAS, itemBerlaku, keluarProyekUntukKas, realisasiDibuka, rekapRealisasiItem, statusEfektif,
} from './proyek';

export type SumberBelanja = 'RAB' | 'PROYEK' | 'KOMITMEN' | 'KEWAJIBAN' | 'CICILAN';

export const LABEL_SUMBER: Record<SumberBelanja, string> = {
  RAB: 'RAB',
  PROYEK: 'Proyek',
  KOMITMEN: 'Komitmen',
  KEWAJIBAN: 'Kewajiban',
  CICILAN: 'Cicilan belanja',
};

export type StatusBelanja = 'BELUM' | 'SEBAGIAN' | 'SELESAI';

export type ItemBelanja = {
  /** Unik di seluruh daftar. */
  kunci: string;
  sumber: SumberBelanja;
  /** Nama barang, akun, item, atau komitmennya. */
  label: string;
  /** Asalnya: "RAB HR · THL+SKR", nama proyek, dan seterusnya. */
  asal: string;
  /** Halaman tempat realisasinya dicatat. */
  href: string | null;
  /** Tanggal rencana atau jatuh tempo; null bila belum ditentukan. */
  tanggal: Date | null;
  /** Rencana atau anggarannya. */
  anggaran: number;
  /** Seluruh yang sudah dibayar, termasuk sebelum posisi kas. */
  dibayar: number;
  /** Bagian yang dibayar sesudah posisi kas — belum tercermin di saldo. */
  sesudahPosisi: number;
  /** Yang masih akan keluar; nol bila sudah selesai. */
  sisa: number;
  status: StatusBelanja;
  /** Sisa yang tanggalnya sudah lewat: tetap dihitung keluar bulan ini. */
  terlambat: boolean;
  /** Sudah selesai sebelum posisi kas: seluruhnya sudah tercermin di saldo. */
  diSaldo: boolean;
  /**
   * Kapan uangnya keluar, untuk tabel mingguan: sisa pada tanggal rencananya
   * dan pembayaran sesudah posisi kas pada tanggal bayarnya.
   */
  jadwal: { tanggal: Date | null; nilai: number }[];
  /** Khusus komitmen: id-nya, untuk tombol tandai dibayar. */
  komitmenId?: string;
};

const bulat = (n: number) => Math.round(n * 100) / 100;
const hariKe = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Uang yang masih akan mengurangi kas dari sebuah item: sisa + bayar sesudah posisi. */
export const keluarItem = (i: ItemBelanja) => bulat(i.sisa + i.sesudahPosisi);

function statusDari(selesai: boolean, dibayar: number): StatusBelanja {
  return selesai ? 'SELESAI' : dibayar > 0 ? 'SEBAGIAN' : 'BELUM';
}

function terlambatPada(tanggal: Date | null, posisi: Date | null, sisa: number): boolean {
  return sisa > 0 && tanggal !== null && posisi !== null && hariKe(tanggal) <= hariKe(posisi);
}

/* ------------------------------------------------------------------ */
/* RAB                                                                 */
/* ------------------------------------------------------------------ */

export type BarisRabBelanja = {
  id: string;
  label: string;
  asal: string;
  href: string;
  anggaran: number;
  tanggal: Date | null;
  lama: RealisasiLama;
  pembayaran: readonly PembayaranRab[];
  selesai: boolean;
};

export function itemRab(b: BarisRabBelanja, posisi: Date | null): ItemBelanja {
  const real = susunRealisasi(b.lama, b.pembayaran, b.selesai);
  const dibayar = real.nilai ?? 0;
  const sisa = b.selesai ? 0 : Math.max(0, bulat(b.anggaran - dibayar));
  const sesudahPosisi = realisasiSesudahPosisi(b.lama, b.pembayaran, posisi);
  const batas = posisi ? hariKe(posisi) : null;
  const jadwal = [
    ...(sisa > 0 ? [{ tanggal: b.tanggal, nilai: sisa }] : []),
    ...(b.lama.nilai !== null && !(batas !== null && b.lama.tanggal && hariKe(b.lama.tanggal) <= batas)
      ? [{ tanggal: b.lama.tanggal, nilai: b.lama.nilai }]
      : []),
    ...b.pembayaran
      .filter((p) => batas === null || hariKe(p.date) > batas)
      .map((p) => ({ tanggal: p.date, nilai: p.amount })),
  ];
  return {
    kunci: `rab-${b.id}`,
    sumber: 'RAB',
    label: b.label,
    asal: b.asal,
    href: b.href,
    tanggal: b.tanggal,
    anggaran: b.anggaran,
    dibayar,
    sesudahPosisi,
    sisa,
    status: statusDari(b.selesai, dibayar),
    terlambat: terlambatPada(b.tanggal, posisi, sisa),
    diSaldo: b.selesai && sesudahPosisi === 0,
    jadwal,
  };
}

/* ------------------------------------------------------------------ */
/* Proyek                                                              */
/* ------------------------------------------------------------------ */

type ProyekBelanja = Parameters<typeof keluarProyekUntukKas>[0][number];

/**
 * Item proyek yang masuk daftar bulan ini: yang dijadwalkan dibayar bulan
 * ini, yang lewat tanggal dan belum selesai, atau yang punya pembayaran
 * sesudah posisi kas di bulan ini. Angkanya diturunkan dari aturan yang sama
 * dengan uang proyek di ramalan kas, jadi jumlahnya selalu cocok.
 */
export function itemProyek(
  projects: readonly ProyekBelanja[],
  posisi: Date | null,
  period: Period,
  hariIni: Date = new Date(),
): ItemBelanja[] {
  // Proyek yang dananya pernah disetujui. Yang sudah berhenti (On Hold,
  // Completed, Cancelled) hanya membawa pembayaran yang belum di saldo.
  const disetujui = projects.filter((p) => realisasiDibuka(statusEfektif(p.status, p.startDate, hariIni)));
  const arus = keluarProyekUntukKas(disetujui, posisi, period, hariIni).filter((k) => k.period === period);
  const hasil: ItemBelanja[] = [];
  for (const p of disetujui) {
    const memotong = (STATUS_MEMOTONG_KAS as readonly string[]).includes(statusEfektif(p.status, p.startDate, hariIni));
    for (const item of p.items) {
      if (!itemBerlaku(item)) continue;
      const milik = arus.filter((k) => k.itemId === item.id);
      // Yang dijadwalkan bulan ini tetap tampil walau sudah selesai — supaya
      // terlihat realisasi dan hematnya — selama proyeknya masih berjalan.
      if (milik.length === 0 && !(memotong && toPeriod(item.plannedDate) === period)) continue;
      const real = rekapRealisasiItem(item, item.pembayaran);
      const sisa = bulat(milik.filter((k) => k.jenis === 'SISA').reduce((t, k) => t + k.amount, 0));
      const sesudahPosisi = bulat(milik.filter((k) => k.jenis === 'BAYAR').reduce((t, k) => t + k.amount, 0));
      hasil.push({
        kunci: `proyek-${item.id}`,
        sumber: 'PROYEK',
        label: item.name,
        asal: p.name,
        href: `/proyek/${p.id}`,
        tanggal: item.plannedDate,
        anggaran: item.amount,
        dibayar: real.realisasi,
        sesudahPosisi,
        sisa,
        status: real.selesai ? 'SELESAI' : real.realisasi > 0 ? 'SEBAGIAN' : 'BELUM',
        terlambat: milik.some((k) => k.terlambat),
        diSaldo: real.selesai && sesudahPosisi === 0,
        jadwal: milik.map((k) => ({ tanggal: k.tanggal, nilai: k.amount })),
      });
    }
  }
  return hasil;
}

/* ------------------------------------------------------------------ */
/* Komitmen, kewajiban, cicilan rencana belanja                        */
/* ------------------------------------------------------------------ */

/** Tanggal ke-`hari` di bulan itu; hari yang tidak ada jatuh ke akhir bulan. */
export function tanggalDalamBulan(period: Period, hari: number): Date {
  const [y, m] = period.split('-').map(Number);
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(Math.max(1, hari), akhir)));
}

export function itemKomitmen(
  k: { id: string; label: string; amount: number; dueDay: number | null; paid: boolean; recurring: boolean },
  period: Period,
  posisi: Date | null,
): ItemBelanja {
  const tanggal = k.dueDay ? tanggalDalamBulan(period, k.dueDay) : null;
  // Komitmen hanya punya tanda dibayar, tanpa tanggal bayar: yang ditandai
  // dibayar dianggap sudah ada di saldo, seperti selama ini.
  const sisa = k.paid ? 0 : k.amount;
  return {
    kunci: `komitmen-${k.id}`,
    sumber: 'KOMITMEN',
    label: k.label,
    asal: k.recurring ? 'Komitmen berulang' : 'Komitmen sekali ini',
    href: null,
    tanggal,
    anggaran: k.amount,
    dibayar: k.paid ? k.amount : 0,
    sesudahPosisi: 0,
    sisa,
    status: k.paid ? 'SELESAI' : 'BELUM',
    terlambat: terlambatPada(tanggal, posisi, sisa),
    diSaldo: k.paid,
    jadwal: sisa > 0 ? [{ tanggal, nilai: sisa }] : [],
    komitmenId: k.id,
  };
}

/**
 * Pengeluaran bertanggal tanpa catatan realisasi — kewajiban terjadwal dan
 * cicilan rencana belanja. Yang jatuh tempo sebelum atau pada tanggal posisi
 * kas dianggap sudah dibayar dan tercermin di saldo, seperti selama ini.
 */
export function itemJatuhTempo(
  e: { kunci: string; sumber: 'KEWAJIBAN' | 'CICILAN'; label: string; asal: string; href: string | null; jatuhTempo: Date; amount: number },
  posisi: Date | null,
): ItemBelanja {
  const lewat = posisi !== null && hariKe(e.jatuhTempo) <= hariKe(posisi);
  return {
    kunci: e.kunci,
    sumber: e.sumber,
    label: e.label,
    asal: e.asal,
    href: e.href,
    tanggal: e.jatuhTempo,
    anggaran: e.amount,
    dibayar: lewat ? e.amount : 0,
    sesudahPosisi: 0,
    sisa: lewat ? 0 : e.amount,
    status: lewat ? 'SELESAI' : 'BELUM',
    terlambat: false,
    diSaldo: lewat,
    jadwal: lewat ? [] : [{ tanggal: e.jatuhTempo, nilai: e.amount }],
  };
}

/* ------------------------------------------------------------------ */
/* Rekap                                                               */
/* ------------------------------------------------------------------ */

const URUT_SUMBER: Record<SumberBelanja, number> = { KOMITMEN: 0, RAB: 1, PROYEK: 2, KEWAJIBAN: 3, CICILAN: 4 };

/** Urut menurut tanggal; yang belum bertanggal di akhir. */
export function urutkanBelanja(items: readonly ItemBelanja[]): ItemBelanja[] {
  return [...items].sort((a, b) => {
    if (a.tanggal && b.tanggal && a.tanggal.getTime() !== b.tanggal.getTime()) return a.tanggal.getTime() - b.tanggal.getTime();
    if (a.tanggal && !b.tanggal) return -1;
    if (!a.tanggal && b.tanggal) return 1;
    return URUT_SUMBER[a.sumber] - URUT_SUMBER[b.sumber] || a.label.localeCompare(b.label);
  });
}

export type RekapBelanja = {
  anggaran: number;
  dibayar: number;
  sisa: number;
  sesudahPosisi: number;
  /** sisa + dibayar sesudah posisi: yang dikurangkan dari saldo posisi kas. */
  keluar: number;
};

export function rekapBelanja(items: readonly ItemBelanja[]): RekapBelanja {
  const t = { anggaran: 0, dibayar: 0, sisa: 0, sesudahPosisi: 0 };
  for (const i of items) {
    t.anggaran += i.anggaran;
    t.dibayar += i.dibayar;
    t.sisa += i.sisa;
    t.sesudahPosisi += i.sesudahPosisi;
  }
  return {
    anggaran: bulat(t.anggaran), dibayar: bulat(t.dibayar), sisa: bulat(t.sisa),
    sesudahPosisi: bulat(t.sesudahPosisi), keluar: bulat(t.sisa + t.sesudahPosisi),
  };
}
