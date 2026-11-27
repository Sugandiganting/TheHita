/**
 * Hak akses per user level.
 *
 * Setiap user level memegang sekumpulan kode hak akses yang dicentang di
 * Master Data › User Level. Untuk sekarang yang diatur adalah menu Proyek —
 * siapa yang boleh menyusun, mengajukan, menyetujui rencana, menyetujui dana,
 * dan seterusnya — serta pengelolaan pengguna. Menu lain menyusul dengan
 * menambah baris di katalog ini.
 *
 * Pengguna yang belum diberi level berakses penuh, seperti sebelum fitur ini
 * ada. Tanpa itu, memasang fitur ini akan langsung mengunci semua orang.
 */
import type { AksiProyek, AksiTambahan } from './proyek';

export const KATALOG_HAK = [
  {
    modul: 'Proyek',
    hak: [
      { kode: 'proyek.kelola', label: 'Buat & ubah proyek', keterangan: 'Membuat, mengubah, dan menghapus proyek serta item biayanya.' },
      { kode: 'proyek.ajukan', label: 'Submit Proposal', keterangan: 'Mengajukan proyek atau item tambahan (Draft → Proposed).' },
      { kode: 'proyek.setujui_rencana', label: 'Approve Plan', keterangan: 'Menyetujui rencana (Proposed → Funding Review).' },
      { kode: 'proyek.setujui_dana', label: 'Approve Funding', keterangan: 'Menyetujui dana (Funding Review → Approved).' },
      { kode: 'proyek.tolak', label: 'Reject', keterangan: 'Menolak pengajuan saat Proposed atau Funding Review.' },
      { kode: 'proyek.kembali_draf', label: 'Return to Draft', keterangan: 'Mengembalikan pengajuan ke Draft untuk disusun ulang.' },
      { kode: 'proyek.tunda', label: 'Put On Hold & Resume', keterangan: 'Menandai proyek mangkrak dan melanjutkannya lagi.' },
      { kode: 'proyek.selesai', label: 'Mark Completed', keterangan: 'Menandai proyek selesai.' },
      { kode: 'proyek.batalkan', label: 'Cancel Project', keterangan: 'Membatalkan proyek yang sudah disetujui.' },
      { kode: 'proyek.realisasi', label: 'Catat realisasi', keterangan: 'Mencatat pembayaran item dan menandai pembelanjaan selesai.' },
    ],
  },
  {
    modul: 'Pengguna',
    hak: [
      { kode: 'pengguna.kelola', label: 'Kelola pengguna & user level', keterangan: 'Menambah pengguna, mengganti sandi, menonaktifkan, dan mengatur user level beserta hak aksesnya.' },
    ],
  },
] as const;

export type KodeHak = (typeof KATALOG_HAK)[number]['hak'][number]['kode'];

export const SEMUA_HAK: KodeHak[] = KATALOG_HAK.flatMap((m) => m.hak.map((h) => h.kode));

export const LABEL_HAK: Record<KodeHak, string> = Object.fromEntries(
  KATALOG_HAK.flatMap((m) => m.hak.map((h) => [h.kode, h.label])),
) as Record<KodeHak, string>;

/** Membaca kolom permissions: kode yang tidak dikenal dibuang. */
export function bacaHak(teks: string | null | undefined): KodeHak[] {
  const kenal = new Set<string>(SEMUA_HAK);
  return [...new Set((teks ?? '').split(',').map((x) => x.trim()).filter((x) => kenal.has(x)))] as KodeHak[];
}

/** Menyimpan daftar hak sebagai teks, urut menurut katalog. */
export function tulisHak(hak: readonly string[]): string {
  const dipilih = new Set(hak);
  return SEMUA_HAK.filter((k) => dipilih.has(k)).join(',');
}

/** Hak seorang pengguna: tanpa level berarti semuanya. */
export function hakPengguna(level: { permissions: string } | null | undefined): Set<KodeHak> {
  return new Set(level ? bacaHak(level.permissions) : SEMUA_HAK);
}

/** Hak yang dibutuhkan setiap langkah persetujuan proyek. */
export const HAK_AKSI_PROYEK: Record<AksiProyek, KodeHak> = {
  AJUKAN: 'proyek.ajukan',
  SETUJUI_RENCANA: 'proyek.setujui_rencana',
  SETUJUI_DANA: 'proyek.setujui_dana',
  TOLAK: 'proyek.tolak',
  SELESAI: 'proyek.selesai',
  TUNDA: 'proyek.tunda',
  LANJUTKAN: 'proyek.tunda',
  BATALKAN: 'proyek.batalkan',
  KEMBALI_DRAF: 'proyek.kembali_draf',
};

/** Pengajuan tambahan memakai hak yang sama dengan langkah proyek yang senama. */
export const HAK_AKSI_TAMBAHAN: Record<AksiTambahan, KodeHak> = {
  AJUKAN: 'proyek.ajukan',
  SETUJUI_RENCANA: 'proyek.setujui_rencana',
  SETUJUI_DANA: 'proyek.setujui_dana',
  TOLAK: 'proyek.tolak',
  KEMBALI_DRAF: 'proyek.kembali_draf',
};

export function pesanTanpaHak(hak: KodeHak): string {
  return `User level Anda tidak punya hak "${LABEL_HAK[hak]}". Minta pengelola pengguna menambahkannya di Master Data › User Level.`;
}

/**
 * Apakah masih ada pengguna aktif yang bisa mengelola pengguna. Dipakai
 * sebelum menyimpan perubahan level atau status akun: tanpa satu pun,
 * tidak ada lagi yang bisa membuka kuncinya kecuali lewat baris perintah.
 */
export function masihAdaPengelola(
  pengguna: readonly { active: boolean; level: { permissions: string } | null }[],
): boolean {
  return pengguna.some((u) => u.active && hakPengguna(u.level).has('pengguna.kelola'));
}
