/**
 * Template Chart of Account (COA) standar untuk grup usaha perhotelan.
 * Struktur mengikuti kebiasaan pembukuan hotel di Indonesia dengan
 * pengelompokan gaya USALI yang disederhanakan.
 *
 * COA ini dipakai bersama oleh SELURUH unit usaha. Pemisahan cabang tidak lagi
 * dilakukan dengan menggandakan nomor akun, melainkan lewat dimensi unit pada
 * setiap baris jurnal — sehingga laporan per cabang dan konsolidasi sama-sama bisa.
 */

export type CoaSeed = {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE';
  subtype?: string;
  isHeader?: boolean;
  isCash?: boolean;
  cashflow?: 'OPERATING' | 'INVESTING' | 'FINANCING';
  parent?: string;
  description?: string;
};

export const COA_TEMPLATE: CoaSeed[] = [
  /* ---------------- 1. ASET ---------------- */
  { code: '1-0000', name: 'ASET', type: 'ASSET', isHeader: true },

  { code: '1-1000', name: 'Kas & Bank', type: 'ASSET', subtype: 'CASH_BANK', isHeader: true, parent: '1-0000' },
  { code: '1-1100', name: 'Kas Kecil (Petty Cash)', type: 'ASSET', subtype: 'CASH_BANK', isCash: true, parent: '1-1000' },
  { code: '1-1200', name: 'Kas Front Office', type: 'ASSET', subtype: 'CASH_BANK', isCash: true, parent: '1-1000' },
  { code: '1-1300', name: 'Bank BCA', type: 'ASSET', subtype: 'CASH_BANK', isCash: true, parent: '1-1000' },
  { code: '1-1400', name: 'Bank Mandiri', type: 'ASSET', subtype: 'CASH_BANK', isCash: true, parent: '1-1000' },
  { code: '1-1500', name: 'Bank BRI', type: 'ASSET', subtype: 'CASH_BANK', isCash: true, parent: '1-1000' },

  { code: '1-2000', name: 'Piutang', type: 'ASSET', subtype: 'RECEIVABLE', isHeader: true, parent: '1-0000' },
  { code: '1-2100', name: 'Piutang Tamu (Guest Ledger)', type: 'ASSET', subtype: 'RECEIVABLE', cashflow: 'OPERATING', parent: '1-2000' },
  { code: '1-2200', name: 'Piutang OTA', type: 'ASSET', subtype: 'RECEIVABLE', cashflow: 'OPERATING', parent: '1-2000', description: 'Tagihan ke Agoda, Booking.com, Traveloka, dll.' },
  { code: '1-2300', name: 'Piutang Travel Agent / Korporat', type: 'ASSET', subtype: 'RECEIVABLE', cashflow: 'OPERATING', parent: '1-2000' },
  { code: '1-2400', name: 'Piutang Laundry Pihak Ketiga', type: 'ASSET', subtype: 'RECEIVABLE', cashflow: 'OPERATING', parent: '1-2000' },

  { code: '1-3000', name: 'Persediaan', type: 'ASSET', subtype: 'INVENTORY', isHeader: true, parent: '1-0000' },
  { code: '1-3100', name: 'Persediaan Makanan', type: 'ASSET', subtype: 'INVENTORY', cashflow: 'OPERATING', parent: '1-3000' },
  { code: '1-3200', name: 'Persediaan Minuman', type: 'ASSET', subtype: 'INVENTORY', cashflow: 'OPERATING', parent: '1-3000' },
  { code: '1-3300', name: 'Persediaan Housekeeping & Amenities', type: 'ASSET', subtype: 'INVENTORY', cashflow: 'OPERATING', parent: '1-3000' },
  { code: '1-3400', name: 'Persediaan Chemical Laundry', type: 'ASSET', subtype: 'INVENTORY', cashflow: 'OPERATING', parent: '1-3000' },

  { code: '1-4000', name: 'Biaya Dibayar Dimuka & Uang Muka', type: 'ASSET', isHeader: true, parent: '1-0000' },
  { code: '1-4100', name: 'Sewa Dibayar Dimuka', type: 'ASSET', cashflow: 'OPERATING', parent: '1-4000' },
  { code: '1-4200', name: 'Asuransi Dibayar Dimuka', type: 'ASSET', cashflow: 'OPERATING', parent: '1-4000' },
  { code: '1-4300', name: 'Uang Muka Pembelian', type: 'ASSET', cashflow: 'OPERATING', parent: '1-4000' },
  { code: '1-4400', name: 'Uang Muka Proyek', type: 'ASSET', cashflow: 'INVESTING', parent: '1-4000' },

  { code: '1-5000', name: 'Aset Tetap', type: 'ASSET', subtype: 'FIXED_ASSET', isHeader: true, parent: '1-0000' },
  { code: '1-5100', name: 'Tanah', type: 'ASSET', subtype: 'FIXED_ASSET', cashflow: 'INVESTING', parent: '1-5000' },
  { code: '1-5200', name: 'Bangunan & Gedung', type: 'ASSET', subtype: 'FIXED_ASSET', cashflow: 'INVESTING', parent: '1-5000' },
  { code: '1-5300', name: 'Perlengkapan Kamar & Furniture', type: 'ASSET', subtype: 'FIXED_ASSET', cashflow: 'INVESTING', parent: '1-5000' },
  { code: '1-5400', name: 'Peralatan Dapur & Restoran', type: 'ASSET', subtype: 'FIXED_ASSET', cashflow: 'INVESTING', parent: '1-5000' },
  { code: '1-5500', name: 'Mesin Laundry', type: 'ASSET', subtype: 'FIXED_ASSET', cashflow: 'INVESTING', parent: '1-5000' },
  { code: '1-5600', name: 'Kendaraan', type: 'ASSET', subtype: 'FIXED_ASSET', cashflow: 'INVESTING', parent: '1-5000' },
  { code: '1-5700', name: 'Proyek Dalam Pelaksanaan', type: 'ASSET', subtype: 'FIXED_ASSET', cashflow: 'INVESTING', parent: '1-5000', description: 'Penampung biaya renovasi / pembangunan kamar yang belum selesai.' },
  { code: '1-5900', name: 'Akumulasi Penyusutan', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1-5000' },

  /* ---------------- 2. KEWAJIBAN ---------------- */
  { code: '2-0000', name: 'KEWAJIBAN', type: 'LIABILITY', isHeader: true },

  { code: '2-1000', name: 'Hutang Usaha', type: 'LIABILITY', subtype: 'PAYABLE', isHeader: true, parent: '2-0000' },
  { code: '2-1100', name: 'Hutang Supplier F&B', type: 'LIABILITY', subtype: 'PAYABLE', cashflow: 'OPERATING', parent: '2-1000' },
  { code: '2-1200', name: 'Hutang Supplier Operasional', type: 'LIABILITY', subtype: 'PAYABLE', cashflow: 'OPERATING', parent: '2-1000' },
  { code: '2-1300', name: 'Hutang Kontraktor Proyek', type: 'LIABILITY', subtype: 'PAYABLE', cashflow: 'INVESTING', parent: '2-1000' },

  { code: '2-2000', name: 'Hutang Pajak', type: 'LIABILITY', subtype: 'TAX', isHeader: true, parent: '2-0000' },
  { code: '2-2100', name: 'Hutang Pajak Hotel & Restoran (PB1)', type: 'LIABILITY', subtype: 'TAX', cashflow: 'OPERATING', parent: '2-2000' },
  { code: '2-2200', name: 'Hutang PPh 21', type: 'LIABILITY', subtype: 'TAX', cashflow: 'OPERATING', parent: '2-2000' },
  { code: '2-2300', name: 'Hutang PPh 23 / Final', type: 'LIABILITY', subtype: 'TAX', cashflow: 'OPERATING', parent: '2-2000' },

  { code: '2-3000', name: 'Kewajiban Lain', type: 'LIABILITY', isHeader: true, parent: '2-0000' },
  { code: '2-3100', name: 'Deposit Tamu', type: 'LIABILITY', cashflow: 'OPERATING', parent: '2-3000' },
  { code: '2-3200', name: 'Pendapatan Diterima Dimuka', type: 'LIABILITY', cashflow: 'OPERATING', parent: '2-3000' },
  { code: '2-3300', name: 'Biaya Yang Masih Harus Dibayar', type: 'LIABILITY', cashflow: 'OPERATING', parent: '2-3000' },
  { code: '2-3400', name: 'Hutang Service Charge Karyawan', type: 'LIABILITY', cashflow: 'OPERATING', parent: '2-3000' },

  { code: '2-4000', name: 'Pinjaman', type: 'LIABILITY', subtype: 'LOAN', isHeader: true, parent: '2-0000' },
  { code: '2-4100', name: 'Hutang Bank Jangka Pendek', type: 'LIABILITY', subtype: 'LOAN', cashflow: 'FINANCING', parent: '2-4000' },
  { code: '2-4200', name: 'Hutang Bank Jangka Panjang', type: 'LIABILITY', subtype: 'LOAN', cashflow: 'FINANCING', parent: '2-4000' },
  { code: '2-4300', name: 'Hutang Leasing', type: 'LIABILITY', subtype: 'LOAN', cashflow: 'FINANCING', parent: '2-4000' },
  { code: '2-4400', name: 'Hutang Pemegang Saham', type: 'LIABILITY', subtype: 'LOAN', cashflow: 'FINANCING', parent: '2-4000' },

  /* ---------------- 3. MODAL ---------------- */
  { code: '3-0000', name: 'MODAL', type: 'EQUITY', isHeader: true },
  { code: '3-1000', name: 'Modal Disetor', type: 'EQUITY', cashflow: 'FINANCING', parent: '3-0000' },
  { code: '3-2000', name: 'Laba Ditahan', type: 'EQUITY', parent: '3-0000' },
  { code: '3-3000', name: 'Prive / Pembagian Dividen', type: 'EQUITY', cashflow: 'FINANCING', parent: '3-0000' },
  { code: '3-9000', name: 'Saldo Pembuka', type: 'EQUITY', parent: '3-0000', description: 'Lawan jurnal untuk saldo awal saat migrasi dari sistem lama.' },

  /* ---------------- 4. PENDAPATAN ---------------- */
  { code: '4-0000', name: 'PENDAPATAN', type: 'REVENUE', isHeader: true },

  { code: '4-1000', name: 'Pendapatan Kamar', type: 'REVENUE', subtype: 'ROOM_REVENUE', isHeader: true, parent: '4-0000' },
  { code: '4-1100', name: 'Kamar - Walk In / Direct', type: 'REVENUE', subtype: 'ROOM_REVENUE', cashflow: 'OPERATING', parent: '4-1000' },
  { code: '4-1200', name: 'Kamar - OTA', type: 'REVENUE', subtype: 'ROOM_REVENUE', cashflow: 'OPERATING', parent: '4-1000' },
  { code: '4-1300', name: 'Kamar - Travel Agent / Korporat', type: 'REVENUE', subtype: 'ROOM_REVENUE', cashflow: 'OPERATING', parent: '4-1000' },
  { code: '4-1400', name: 'Kamar - Long Stay', type: 'REVENUE', subtype: 'ROOM_REVENUE', cashflow: 'OPERATING', parent: '4-1000' },

  { code: '4-2000', name: 'Pendapatan Makanan & Minuman', type: 'REVENUE', subtype: 'FNB_REVENUE', isHeader: true, parent: '4-0000' },
  { code: '4-2100', name: 'Penjualan Makanan', type: 'REVENUE', subtype: 'FNB_REVENUE', cashflow: 'OPERATING', parent: '4-2000' },
  { code: '4-2200', name: 'Penjualan Minuman', type: 'REVENUE', subtype: 'FNB_REVENUE', cashflow: 'OPERATING', parent: '4-2000' },
  { code: '4-2300', name: 'Penjualan Kopi & Pastry', type: 'REVENUE', subtype: 'FNB_REVENUE', cashflow: 'OPERATING', parent: '4-2000' },
  { code: '4-2400', name: 'Banquet & Event', type: 'REVENUE', subtype: 'FNB_REVENUE', cashflow: 'OPERATING', parent: '4-2000' },
  { code: '4-2500', name: 'Breakfast Charge', type: 'REVENUE', subtype: 'FNB_REVENUE', cashflow: 'OPERATING', parent: '4-2000' },

  { code: '4-3000', name: 'Pendapatan Laundry', type: 'REVENUE', subtype: 'LAUNDRY_REVENUE', isHeader: true, parent: '4-0000' },
  { code: '4-3100', name: 'Laundry - Tamu Hotel', type: 'REVENUE', subtype: 'LAUNDRY_REVENUE', cashflow: 'OPERATING', parent: '4-3000' },
  { code: '4-3200', name: 'Laundry - Pelanggan Luar', type: 'REVENUE', subtype: 'LAUNDRY_REVENUE', cashflow: 'OPERATING', parent: '4-3000' },
  { code: '4-3300', name: 'Laundry - Kontrak Hotel Lain', type: 'REVENUE', subtype: 'LAUNDRY_REVENUE', cashflow: 'OPERATING', parent: '4-3000' },

  { code: '4-9000', name: 'Pendapatan Lain-lain', type: 'REVENUE', subtype: 'OTHER_REVENUE', isHeader: true, parent: '4-0000' },
  { code: '4-9100', name: 'Sewa Ruang & Etalase', type: 'REVENUE', subtype: 'OTHER_REVENUE', cashflow: 'OPERATING', parent: '4-9000' },
  { code: '4-9200', name: 'Transport & Tour', type: 'REVENUE', subtype: 'OTHER_REVENUE', cashflow: 'OPERATING', parent: '4-9000' },
  { code: '4-9300', name: 'Spa & Wellness', type: 'REVENUE', subtype: 'OTHER_REVENUE', cashflow: 'OPERATING', parent: '4-9000' },
  { code: '4-9400', name: 'Denda & Miscellaneous', type: 'REVENUE', subtype: 'OTHER_REVENUE', cashflow: 'OPERATING', parent: '4-9000' },

  /* ---------------- 5. HARGA POKOK ---------------- */
  { code: '5-0000', name: 'HARGA POKOK PENJUALAN', type: 'COGS', isHeader: true },
  { code: '5-1000', name: 'HPP Makanan', type: 'COGS', cashflow: 'OPERATING', parent: '5-0000' },
  { code: '5-2000', name: 'HPP Minuman', type: 'COGS', cashflow: 'OPERATING', parent: '5-0000' },
  { code: '5-3000', name: 'HPP Kopi & Bahan Baku Cafe', type: 'COGS', cashflow: 'OPERATING', parent: '5-0000' },
  { code: '5-4000', name: 'Chemical & Bahan Laundry', type: 'COGS', cashflow: 'OPERATING', parent: '5-0000' },
  { code: '5-5000', name: 'Amenities & Guest Supplies', type: 'COGS', cashflow: 'OPERATING', parent: '5-0000' },
  { code: '5-6000', name: 'Komisi OTA & Travel Agent', type: 'COGS', cashflow: 'OPERATING', parent: '5-0000' },
  { code: '5-7000', name: 'Biaya Linen & Loundry Outsource', type: 'COGS', cashflow: 'OPERATING', parent: '5-0000' },

  /* ---------------- 6. BEBAN OPERASIONAL ---------------- */
  { code: '6-0000', name: 'BEBAN OPERASIONAL', type: 'EXPENSE', isHeader: true },

  { code: '6-1000', name: 'Beban Karyawan', type: 'EXPENSE', subtype: 'PAYROLL', isHeader: true, parent: '6-0000' },
  { code: '6-1100', name: 'Gaji & Upah', type: 'EXPENSE', subtype: 'PAYROLL', cashflow: 'OPERATING', parent: '6-1000' },
  { code: '6-1200', name: 'Tunjangan & THR', type: 'EXPENSE', subtype: 'PAYROLL', cashflow: 'OPERATING', parent: '6-1000' },
  { code: '6-1300', name: 'BPJS Kesehatan & Ketenagakerjaan', type: 'EXPENSE', subtype: 'PAYROLL', cashflow: 'OPERATING', parent: '6-1000' },
  { code: '6-1400', name: 'Service Charge Karyawan', type: 'EXPENSE', subtype: 'PAYROLL', cashflow: 'OPERATING', parent: '6-1000' },
  { code: '6-1500', name: 'Makan Karyawan', type: 'EXPENSE', subtype: 'PAYROLL', cashflow: 'OPERATING', parent: '6-1000' },
  { code: '6-1600', name: 'Seragam & Pelatihan', type: 'EXPENSE', subtype: 'PAYROLL', cashflow: 'OPERATING', parent: '6-1000' },
  { code: '6-1700', name: 'Tenaga Harian (Daily Worker)', type: 'EXPENSE', subtype: 'PAYROLL', cashflow: 'OPERATING', parent: '6-1000' },

  { code: '6-2000', name: 'Beban Utilitas', type: 'EXPENSE', subtype: 'UTILITIES', isHeader: true, parent: '6-0000' },
  { code: '6-2100', name: 'Listrik PLN', type: 'EXPENSE', subtype: 'UTILITIES', cashflow: 'OPERATING', parent: '6-2000' },
  { code: '6-2200', name: 'Air PDAM / Sumur', type: 'EXPENSE', subtype: 'UTILITIES', cashflow: 'OPERATING', parent: '6-2000' },
  { code: '6-2300', name: 'Gas LPG', type: 'EXPENSE', subtype: 'UTILITIES', cashflow: 'OPERATING', parent: '6-2000' },
  { code: '6-2400', name: 'Internet & Telepon', type: 'EXPENSE', subtype: 'UTILITIES', cashflow: 'OPERATING', parent: '6-2000' },
  { code: '6-2500', name: 'Kebersihan & Sampah', type: 'EXPENSE', subtype: 'UTILITIES', cashflow: 'OPERATING', parent: '6-2000' },

  { code: '6-3000', name: 'Beban Pemeliharaan', type: 'EXPENSE', subtype: 'MAINTENANCE', isHeader: true, parent: '6-0000' },
  { code: '6-3100', name: 'Perbaikan Bangunan', type: 'EXPENSE', subtype: 'MAINTENANCE', cashflow: 'OPERATING', parent: '6-3000' },
  { code: '6-3200', name: 'Perbaikan Peralatan & AC', type: 'EXPENSE', subtype: 'MAINTENANCE', cashflow: 'OPERATING', parent: '6-3000' },
  { code: '6-3300', name: 'Taman & Kolam Renang', type: 'EXPENSE', subtype: 'MAINTENANCE', cashflow: 'OPERATING', parent: '6-3000' },
  { code: '6-3400', name: 'Pest Control', type: 'EXPENSE', subtype: 'MAINTENANCE', cashflow: 'OPERATING', parent: '6-3000' },
  { code: '6-3500', name: 'Pemeliharaan Mesin Laundry', type: 'EXPENSE', subtype: 'MAINTENANCE', cashflow: 'OPERATING', parent: '6-3000' },

  { code: '6-4000', name: 'Beban Penjualan & Pemasaran', type: 'EXPENSE', subtype: 'MARKETING', isHeader: true, parent: '6-0000' },
  { code: '6-4100', name: 'Iklan & Promosi Digital', type: 'EXPENSE', subtype: 'MARKETING', cashflow: 'OPERATING', parent: '6-4000' },
  { code: '6-4200', name: 'Entertainment & Representasi', type: 'EXPENSE', subtype: 'MARKETING', cashflow: 'OPERATING', parent: '6-4000' },
  { code: '6-4300', name: 'Fotografi & Konten', type: 'EXPENSE', subtype: 'MARKETING', cashflow: 'OPERATING', parent: '6-4000' },

  { code: '6-5000', name: 'Beban Administrasi & Umum', type: 'EXPENSE', subtype: 'ADMIN', isHeader: true, parent: '6-0000' },
  { code: '6-5100', name: 'Alat Tulis & Cetakan', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },
  { code: '6-5200', name: 'Perizinan & Retribusi', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },
  { code: '6-5300', name: 'Jasa Profesional (Akuntan/Notaris)', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },
  { code: '6-5400', name: 'Asuransi', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },
  { code: '6-5500', name: 'Langganan Software & PMS', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },
  { code: '6-5600', name: 'Transportasi & BBM', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },
  { code: '6-5700', name: 'Biaya Bank & Merchant EDC', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },
  { code: '6-5800', name: 'Keamanan & Satpam', type: 'EXPENSE', subtype: 'ADMIN', cashflow: 'OPERATING', parent: '6-5000' },

  { code: '6-6000', name: 'Beban Sewa & Pajak', type: 'EXPENSE', subtype: 'RENT_TAX', isHeader: true, parent: '6-0000' },
  { code: '6-6100', name: 'Sewa Lahan / Gedung', type: 'EXPENSE', subtype: 'RENT_TAX', cashflow: 'OPERATING', parent: '6-6000' },
  { code: '6-6200', name: 'PBB', type: 'EXPENSE', subtype: 'RENT_TAX', cashflow: 'OPERATING', parent: '6-6000' },
  { code: '6-6300', name: 'Pajak Hotel & Restoran (PB1)', type: 'EXPENSE', subtype: 'RENT_TAX', cashflow: 'OPERATING', parent: '6-6000' },

  { code: '6-7000', name: 'Beban Penyusutan & Amortisasi', type: 'EXPENSE', subtype: 'DEPRECIATION', parent: '6-0000', description: 'Beban non-kas — tidak diperhitungkan dalam proyeksi arus kas.' },
  { code: '6-8000', name: 'Beban Bunga Pinjaman', type: 'EXPENSE', subtype: 'INTEREST', cashflow: 'FINANCING', parent: '6-0000' },
  { code: '6-9000', name: 'Beban Lain-lain', type: 'EXPENSE', subtype: 'OTHER', cashflow: 'OPERATING', parent: '6-0000' },
];
