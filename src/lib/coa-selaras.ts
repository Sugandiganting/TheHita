/**
 * Penyelarasan nama COA dengan template RAB (RAB_New_Template, Nov 2026).
 *
 * Nama akun di template dipakai tim sehari-hari dan lebih mudah dikenali,
 * jadi nama akun di aplikasi disamakan dengannya. Nomor akunnya tidak berubah:
 * riwayat jurnal, RAB, dan barang tetap menunjuk akun yang sama — hanya
 * namanya yang berganti.
 *
 * Dijalankan otomatis saat aplikasi menyala (scripts/selaraskan-coa.ts), dan
 * hanya bertindak bila akun atau barangnya masih dalam keadaan lama. Akun
 * yang sudah diganti namanya sendiri lewat menu COA tidak disentuh.
 */

export type GantiNamaAkun = { code: string; dari: string; jadi: string; catatan?: string };

export const GANTI_NAMA_AKUN: GantiNamaAkun[] = [
  { code: '6120.06', dari: 'Biaya Peralatan dan Perlengkapan Kantor', jadi: 'Biaya Peralatan & Perlengkapan Kantor' },
  { code: '6150.02', dari: 'Biaya Perlengkapan dan Peralatan Amenities', jadi: 'Biaya Amenities' },
  { code: '6150.03', dari: 'Biaya Chemical HK', jadi: 'Biaya Chemical' },
  { code: '6150.05', dari: 'Biaya Room Supplies', jadi: 'Biaya Cleaning & Supplies' },
  { code: '6150.10', dari: 'Biaya Peralatan dan Perlengkapan FO', jadi: 'Biaya Peralatan & Perlengkapan FO' },
  { code: '6160.02', dari: 'Biaya Gas Kitchen', jadi: 'Biaya Gas IGYT' },
  {
    code: '6160.05', dari: 'Biaya Air Isi Ulang', jadi: 'Biaya Air Isi Ulang HK',
    catatan: 'Template memisahkan air isi ulang HK dan IGYT; IGYT mendapat akun baru 6160.07.',
  },
  {
    code: '6160.06', dari: 'Biaya Tabung Gas', jadi: 'Biaya Gas Laundry',
    catatan: 'Pemakai terbesarnya Play Laundry; gas tabung hotel di template memakai Biaya Gas HK (6160.01).',
  },
  { code: '6170.01', dari: 'Biaya Sabun & Chemical Laundry', jadi: 'Biaya Chemical Laundry' },
  { code: '6170.02', dari: 'Biaya Perlengkapan (Supplies) Laundry', jadi: 'Biaya Supplies Laundry' },
  { code: '6190.04', dari: 'Biaya Packaging', jadi: 'Biaya Supplies & Packaging IGYT' },
];

/** Akun baru dari template; dibuat oleh lengkapi-coa lewat COA_TEMPLATE. */
export const AKUN_BARU_SELARAS = ['6160.07'];

export type PindahAkunBarang = {
  kode: string;
  /** Departemen (sub kategori) barangnya — kode yang sama bisa ada di beberapa departemen. */
  departemen: string;
  /** Hanya dipindah bila akunnya masih yang ini. */
  dari: string;
  ke: string;
  alasan: string;
};

export const PINDAH_AKUN_BARANG: PindahAkunBarang[] = [
  { kode: 'HK-001', departemen: 'House Keeping', dari: '6150.05', ke: '6150.02', alasan: 'Box Dental Kit adalah amenities, sesuai template.' },
  { kode: 'FNB-004', departemen: 'IGYT', dari: '6160.05', ke: '6160.07', alasan: 'Air isi ulang IGYT punya akunnya sendiri di template.' },
  { kode: 'FO-004', departemen: 'Front Office', dari: '6190.02', ke: '6150.10', alasan: 'Sticky notes adalah perlengkapan FO, bukan bahan minuman.' },
];
