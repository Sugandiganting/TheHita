/**
 * Hak akses per user level.
 *
 * Setiap user level memegang sekumpulan kode hak akses yang dicentang di
 * Master Data › User Level. Katalognya disusun per menu (tab di formulir),
 * lalu per sub menu di dalamnya, supaya pemberian aksesnya rapi. Yang diatur:
 * menu Proyek — siapa yang boleh menyusun, mengajukan, menyetujui rencana,
 * menyetujui dana, dan seterusnya — dan setiap menu Master Data (lihat,
 * tambah, ubah, hapus). Menu lain menyusul dengan menambah baris di katalog.
 *
 * Pengguna yang belum diberi level berakses penuh, seperti sebelum fitur ini
 * ada. Tanpa itu, memasang fitur ini akan langsung mengunci semua orang.
 */
import type { AksiProyek, AksiTambahan } from './proyek';

/** Hak proyek: langkah-langkah alur persetujuan dan pencatatan realisasi. */
const HAK_PROYEK = [
  { kode: 'proyek.kelola', sub: 'Data proyek', label: 'Buat & ubah proyek', keterangan: 'Membuat, mengubah, dan menghapus proyek serta item biayanya.' },
  { kode: 'proyek.ajukan', sub: 'Persetujuan', label: 'Submit Proposal', keterangan: 'Mengajukan proyek atau item tambahan (Draft → Proposed).' },
  { kode: 'proyek.setujui_rencana', sub: 'Persetujuan', label: 'Approve Plan', keterangan: 'Menyetujui rencana (Proposed → Funding Review).' },
  { kode: 'proyek.setujui_dana', sub: 'Persetujuan', label: 'Approve Funding', keterangan: 'Menyetujui dana (Funding Review → Approved).' },
  { kode: 'proyek.tolak', sub: 'Persetujuan', label: 'Reject', keterangan: 'Menolak pengajuan saat Proposed atau Funding Review.' },
  { kode: 'proyek.kembali_draf', sub: 'Persetujuan', label: 'Return to Draft', keterangan: 'Mengembalikan pengajuan ke Draft untuk disusun ulang.' },
  { kode: 'proyek.tunda', sub: 'Status proyek', label: 'Put On Hold & Resume', keterangan: 'Menandai proyek mangkrak dan melanjutkannya lagi.' },
  { kode: 'proyek.selesai', sub: 'Status proyek', label: 'Mark Completed', keterangan: 'Menandai proyek selesai.' },
  { kode: 'proyek.batalkan', sub: 'Status proyek', label: 'Cancel Project', keterangan: 'Membatalkan proyek yang sudah disetujui.' },
  { kode: 'proyek.realisasi', sub: 'Realisasi', label: 'Catat realisasi', keterangan: 'Mencatat pembayaran item dan menandai pembelanjaan selesai.' },
] as const;

/**
 * Menu di Master Data. Setiap menu punya empat hak: lihat, tambah, ubah,
 * hapus. Menambah menu master cukup dengan satu baris di sini.
 */
export const MENU_MASTER = [
  { kunci: 'coa', nama: 'Chart of Account', href: '/coa', hapus: 'Menghapus akun yang belum dipakai.' },
  { kunci: 'unit', nama: 'Unit Usaha', href: '/unit', hapus: 'Unit tidak dihapus; hak ini disediakan untuk kelak.' },
  { kunci: 'musim', nama: 'Musim', href: '/musim', hapus: 'Menghapus musim.' },
  { kunci: 'target_margin', nama: 'Target Margin', href: '/target-margin', hapus: 'Menghapus target margin sebuah bulan.' },
  { kunci: 'jenis_rab', nama: 'Jenis RAB', href: '/jenis-rab', hapus: 'Menghapus jenis RAB yang belum dipakai.' },
  { kunci: 'kewajiban', nama: 'Kewajiban Terjadwal', href: '/kewajiban', hapus: 'Menghapus kewajiban terjadwal.' },
  { kunci: 'kendaraan', nama: 'Kendaraan', href: '/kendaraan', hapus: 'Menghapus kendaraan.' },
  { kunci: 'pengguna', nama: 'Pengguna', href: '/pengguna', hapus: 'Menonaktifkan pengguna (akun tidak pernah dihapus).' },
  { kunci: 'user_level', nama: 'User Level', href: '/user-level', hapus: 'Menghapus user level yang tidak dipakai.' },
] as const;

export type MenuMaster = (typeof MENU_MASTER)[number]['kunci'];
export const AKSI_MASTER = ['lihat', 'tambah', 'ubah', 'hapus'] as const;
export type AksiMaster = (typeof AKSI_MASTER)[number];
export const LABEL_AKSI_MASTER: Record<AksiMaster, string> = { lihat: 'Lihat', tambah: 'Tambah', ubah: 'Ubah', hapus: 'Hapus' };

export type KodeHak = (typeof HAK_PROYEK)[number]['kode'] | `master.${MenuMaster}.${AksiMaster}`;

export type HakKatalog = {
  kode: KodeHak;
  /** Sub menu: kelompok di dalam tab. */
  sub: string;
  label: string;
  keterangan: string;
  /** Untuk hak master: lihat/tambah/ubah/hapus — ditampilkan ringkas sebaris. */
  aksi?: AksiMaster;
};

export const KATALOG_HAK: { modul: string; hak: HakKatalog[] }[] = [
  { modul: 'Proyek', hak: [...HAK_PROYEK] },
  {
    modul: 'Master Data',
    hak: MENU_MASTER.flatMap((m) => AKSI_MASTER.map((a): HakKatalog => ({
      kode: `master.${m.kunci}.${a}`,
      sub: m.nama,
      label: `${LABEL_AKSI_MASTER[a]} ${m.nama}`,
      keterangan: a === 'lihat' ? `Membuka menu ${m.nama}.`
        : a === 'tambah' ? `Menambah data baru di ${m.nama}.`
          : a === 'ubah' ? `Mengubah data yang sudah ada di ${m.nama}.`
            : m.hapus,
      aksi: a,
    }))),
  },
];

export const SEMUA_HAK: KodeHak[] = KATALOG_HAK.flatMap((m) => m.hak.map((h) => h.kode));

export const LABEL_HAK = Object.fromEntries(
  KATALOG_HAK.flatMap((m) => m.hak.map((h) => [h.kode, h.label])),
) as Record<KodeHak, string>;

/** Kode hak sebuah menu master. */
export const hakMaster = (menu: MenuMaster, aksi: AksiMaster): KodeHak => `master.${menu}.${aksi}`;

/**
 * Kode lama yang sudah diganti, beserta penggantinya. "pengguna.kelola"
 * dipecah menjadi lihat/tambah/ubah/hapus Pengguna dan User Level, jadi level
 * yang dibuat sebelumnya tetap memegang hak yang sama.
 */
const KODE_LAMA: Record<string, KodeHak[]> = {
  'pengguna.kelola': AKSI_MASTER.flatMap((a) => [hakMaster('pengguna', a), hakMaster('user_level', a)]),
};

/** Membaca kolom permissions: kode yang tidak dikenal dibuang. */
export function bacaHak(teks: string | null | undefined): KodeHak[] {
  const kenal = new Set<string>(SEMUA_HAK);
  const kode = (teks ?? '').split(',').map((x) => x.trim()).flatMap((x) => KODE_LAMA[x] ?? [x]);
  return [...new Set(kode.filter((x) => kenal.has(x)))] as KodeHak[];
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
 * Hak yang dibutuhkan untuk membetulkan hak akses siapa pun: membuka dan
 * mengubah User Level, serta membuka Pengguna dan memasang levelnya.
 */
export const HAK_PENGELOLA: KodeHak[] = [
  hakMaster('pengguna', 'lihat'), hakMaster('pengguna', 'ubah'),
  hakMaster('user_level', 'lihat'), hakMaster('user_level', 'ubah'),
];

/**
 * Apakah masih ada pengguna aktif yang bisa mengelola hak akses. Dipakai
 * sebelum menyimpan perubahan level atau status akun: tanpa satu pun,
 * tidak ada lagi yang bisa membuka kuncinya kecuali lewat baris perintah.
 */
export function masihAdaPengelola(
  pengguna: readonly { active: boolean; level: { permissions: string } | null }[],
): boolean {
  return pengguna.some((u) => {
    if (!u.active) return false;
    const h = hakPengguna(u.level);
    return HAK_PENGELOLA.every((k) => h.has(k));
  });
}

/** Halaman master yang tidak boleh dibuka pengguna dengan hak ini. */
export function halamanTertutup(hak: ReadonlySet<string>): string[] {
  return MENU_MASTER.filter((m) => !hak.has(hakMaster(m.kunci, 'lihat'))).map((m) => m.href);
}
