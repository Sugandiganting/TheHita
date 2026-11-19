/**
 * Item biaya proyek: jumlah × harga satuan = total.
 *
 * Totalnya yang disimpan dan dipakai peramalan serta rencana kas, karena
 * itulah uang yang akan keluar. Jumlah dan harga satuan disimpan di
 * sebelahnya supaya totalnya bisa ditelusuri dan diubah selama proyek berjalan.
 */

const bulat = (n: number) => Math.round(n * 100) / 100;

/** Total item: jumlah × harga satuan, dibulatkan ke sen. */
export function totalItemProyek(jumlah: number, hargaSatuan: number): number {
  return bulat(jumlah * hargaSatuan);
}

/**
 * Harga satuan yang ditampilkan. Item lama — dibuat sebelum ada jumlah dan
 * harga satuan — hanya punya nominal, jadi harganya nominal dibagi jumlahnya
 * (jumlahnya 1, jadi sama dengan nominalnya).
 */
export function hargaSatuanItem(item: { quantity: number; unitPrice: number | null; amount: number }): number {
  if (item.unitPrice !== null) return item.unitPrice;
  return item.quantity > 0 ? bulat(item.amount / item.quantity) : item.amount;
}

/** Jumlah dari isian: boleh pecahan dengan koma atau titik ("1,5" atau "1.5"). */
export function bacaJumlah(teks: string): number {
  const n = Number(String(teks).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------------ */
/* Status dan alur persetujuan proyek                                  */
/* ------------------------------------------------------------------ */

/**
 * Alur persetujuan proyek:
 *
 *   Draft → Proposed → Funding Review → Approved → In Progress → Completed
 *                ↘ Rejected     ↘ Rejected        ↘ Cancelled
 *
 * Proposed: diajukan, menunggu rencananya disetujui. Funding Review: rencana
 * disetujui, menunggu keputusan dana. Approved: dana disetujui, menunggu
 * tanggal mulai — begitu tanggalnya tiba, terbaca In Progress tanpa perlu
 * ditekan. Siapa yang boleh menyetujui belum dibatasi; setiap perpindahan
 * dicatat oleh siapa dan kapan, supaya jejaknya sudah ada saat hak akses per
 * pengguna dibuat.
 */
export const STATUS_PROYEK = [
  'DRAFT', 'PROPOSED', 'FUNDING_REVIEW', 'APPROVED', 'ONGOING', 'DONE', 'REJECTED', 'CANCELLED',
] as const;
export type StatusProyek = (typeof STATUS_PROYEK)[number];

export const LABEL_STATUS_PROYEK: Record<StatusProyek, string> = {
  DRAFT: 'Draft',
  PROPOSED: 'Proposed',
  FUNDING_REVIEW: 'Funding Review',
  APPROVED: 'Approved',
  ONGOING: 'In Progress',
  DONE: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/** Arti tiap status, untuk keterangan di halaman proyek. */
export const ARTI_STATUS_PROYEK: Record<StatusProyek, string> = {
  DRAFT: 'Masih disusun, belum diajukan.',
  PROPOSED: 'Diajukan, menunggu rencananya disetujui.',
  FUNDING_REVIEW: 'Rencana disetujui, menunggu keputusan dana.',
  APPROVED: 'Dana disetujui, menunggu tanggal mulai proyek.',
  ONGOING: 'Sedang berjalan.',
  DONE: 'Selesai.',
  REJECTED: 'Tidak disetujui.',
  CANCELLED: 'Dihentikan setelah sempat disetujui.',
};

/**
 * Status tersimpan dibaca dalam alur baru. "PLANNED" (Direncanakan) dari
 * sebelum alur persetujuan ada dibaca sebagai Approved, karena proyek seperti
 * itu sudah ikut dihitung di peramalan — membacanya sebagai pengajuan akan
 * diam-diam mengeluarkannya dari ramalan kas.
 */
export function statusBaku(status: string): StatusProyek {
  if (status === 'PLANNED') return 'APPROVED';
  return (STATUS_PROYEK as readonly string[]).includes(status) ? (status as StatusProyek) : 'DRAFT';
}

/** Status yang terbaca hari ini: Approved yang tanggal mulainya sudah tiba adalah In Progress. */
export function statusEfektif(status: string, tanggalMulai: Date, hariIni: Date): StatusProyek {
  const s = statusBaku(status);
  const mulai = Date.UTC(tanggalMulai.getUTCFullYear(), tanggalMulai.getUTCMonth(), tanggalMulai.getUTCDate());
  const kini = Date.UTC(hariIni.getUTCFullYear(), hariIni.getUTCMonth(), hariIni.getUTCDate());
  return s === 'APPROVED' && mulai <= kini ? 'ONGOING' : s;
}

/**
 * Status tersimpan yang ikut memotong kas di peramalan. Pengajuan yang belum
 * disetujui dananya belum pasti jalan, jadi belum dihitung.
 */
export const STATUS_MEMOTONG_KAS = ['PLANNED', 'APPROVED', 'ONGOING'] as const;

export type AksiProyek =
  | 'AJUKAN' | 'SETUJUI_RENCANA' | 'SETUJUI_DANA' | 'TOLAK' | 'SELESAI' | 'BATALKAN' | 'KEMBALI_DRAF';

export const AKSI_PROYEK: Record<AksiProyek, {
  label: string;
  dari: readonly StatusProyek[];
  ke: StatusProyek;
  butuhCatatan: boolean;
  bahaya?: boolean;
}> = {
  AJUKAN: { label: 'Submit Proposal', dari: ['DRAFT'], ke: 'PROPOSED', butuhCatatan: false },
  SETUJUI_RENCANA: { label: 'Approve Plan', dari: ['PROPOSED'], ke: 'FUNDING_REVIEW', butuhCatatan: false },
  SETUJUI_DANA: { label: 'Approve Funding', dari: ['FUNDING_REVIEW'], ke: 'APPROVED', butuhCatatan: false },
  TOLAK: { label: 'Reject', dari: ['PROPOSED', 'FUNDING_REVIEW'], ke: 'REJECTED', butuhCatatan: true, bahaya: true },
  SELESAI: { label: 'Mark Completed', dari: ['ONGOING'], ke: 'DONE', butuhCatatan: false },
  BATALKAN: { label: 'Cancel Project', dari: ['APPROVED', 'ONGOING'], ke: 'CANCELLED', butuhCatatan: true, bahaya: true },
  KEMBALI_DRAF: { label: 'Return to Draft', dari: ['PROPOSED', 'REJECTED'], ke: 'DRAFT', butuhCatatan: false },
};

/** Aksi yang tersedia untuk sebuah status efektif, dalam urutan tampil. */
export function aksiTersedia(status: StatusProyek): AksiProyek[] {
  return (Object.keys(AKSI_PROYEK) as AksiProyek[]).filter((a) => AKSI_PROYEK[a].dari.includes(status));
}
