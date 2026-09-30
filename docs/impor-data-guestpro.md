# Memasukkan data lama dari GuestPro

Dokumen ini menjelaskan cara memindahkan data yang sudah ada di GuestPro ke sistem
ini, laporan apa yang dipakai, dan keputusan akuntansi yang harus diambil sebelum
angkanya masuk pembukuan.

## Laporan mana yang dipakai

GuestPro punya beberapa laporan yang isinya sebagian bertumpang tindih. Yang penting
diketahui:

| Laporan | Isi | Dipakai untuk |
|---|---|---|
| **Profit and Loss Report** | Seluruh pendapatan dan beban per akun, per bulan | **Sumber angka pembukuan** |
| **Sales Summary** | Room night, reservasi, pax, room charge, extra charge, POS per tipe kamar | Statistik operasional saja |

**Kedua laporan ini tidak boleh diimpor bersamaan.** Angkanya tumpang tindih: pada
Januari 2026, `Pendapatan Kamar - TH Seminyak` di laporan laba rugi bernilai
`147.288.126,40`, tepat sama dengan jumlah room charge + extra charge The Hita Legian
di Sales Summary bulan yang sama. Mengimpor keduanya berarti mencatat pendapatan dua
kali.

Laporan laba rugi yang dipakai sebagai sumber angka, karena isinya lengkap — memuat
juga Rental Motor, F&B Minuman FO, Denda, dan seluruh beban, yang tidak ada di Sales
Summary. Sales Summary tetap berguna, tetapi hanya untuk statistik: room night dan
pax per bulan, yang dipakai menghitung occupancy dan ARR.

## Langkah impor laba rugi

Tiga tahap. Tahap pertama memakai Python karena laporannya PDF, dua tahap sisanya
memakai kode yang sama dengan yang dipakai layar Impor Data.

Satu PDF boleh memuat beberapa bulan sekaligus — laporan Januari sampai Agustus
bisa jadi 28 halaman dalam satu berkas, dengan urutan bulan tidak berurutan.
Skripnya memecah sendiri per periode, dan menolak kalau ada bulan yang terbaca
dua kali.

```bash
# 1. PDF -> JSON. Berhenti dengan galat kalau hasil baca tidak sama dengan
#    total yang tercetak di laporan.
python3 scripts/baca-pnl.py laporan/PnL-*.pdf --keluar=data/pnl.json

# 2. JSON -> jurnal CSV. Di sini beban bersama dibagi antar cabang.
npx tsx scripts/pnl-ke-jurnal.ts data/pnl.json --keluar=data/jurnal-pnl.csv

# 3. Jurnal CSV -> database. Coba dulu tanpa menyimpan:
npm run impor -- data/jurnal-pnl.csv --pms=PMS2 --unit=THL --coba
npm run impor -- data/jurnal-pnl.csv --pms=PMS2 --unit=THL
```

Padanan nomor akun lama ke COA baru hanya ada di satu tempat,
`src/lib/coa-legacy.ts`, dan ketiga tahap di atas memakai tabel yang sama itu.
Lihat [pemetaan-coa-guestpro.md](pemetaan-coa-guestpro.md) untuk tabel lengkapnya.

### Pemeriksaan yang dilakukan sendiri

- `baca-pnl.py` membandingkan hasil bacanya dengan TOTAL INCOME, TOTAL COST OF SALES,
  TOTAL EXPENSES, TOTAL OTHER EXPENSES, dan NET PROFIT yang tercetak di PDF. Selisih
  lebih dari setengah rupiah menghentikan prosesnya. Ini bukan kehati-hatian
  berlebihan: pembacaan PDF pernah dua kali salah tanpa terlihat — satu kali kolom
  POS terbaca sebagai Extra Charge, satu kali angka total kelompok terserap ke akun
  terakhir dalam kelompok itu. Keduanya baru ketahuan dari pemeriksaan ini.
- `pnl-ke-jurnal.ts` memastikan **tiap cabang balance sendiri**, bukan hanya
  keseluruhan jurnal, dan tidak menulis berkas apa pun kalau ada yang tidak balance.
- `pnl-ke-jurnal.ts` juga membandingkan laba seluruh cabang dengan **NET PROFIT**
  yang tercetak, dan **berhenti** kalau ada akun bernilai yang tidak punya padanan.
  Keduanya ada karena ada yang pernah lolos: GuestPro menambah akun
  `6130.10 Biaya THR` setelah berkas COA-nya diekspor, jadi akun itu tidak ada di
  tabel padanan, nilainya dibuang diam-diam, dan laba Maret meleset Rp 6.750.000
  tanpa ada yang gagal. Pemeriksaan balance per cabang tidak menyadarinya — jurnal
  yang kehilangan satu akun tetap bisa balance. Kalau nanti GuestPro menambah akun
  baru lagi, prosesnya akan berhenti dan menyebut akunnya.
- `npm run impor` menolak bukti jurnal yang tidak balance, menolak akun yang tidak
  ada padanannya, dan melewati data yang sudah pernah diimpor.

## Beban bersama: keputusan yang harus diambil

Di GuestPro, sebagian beban diberi penanda cabang (`-10` untuk The Hita Legian,
`-30` untuk Sri Krisna) dan sebagian tidak. Yang tidak bertanda adalah beban yang
memang ditanggung bersama. Jumlahnya besar — pada Januari 2026:

| | Nilai | Bagian |
|---|---|---|
| Beban bertanda cabang | Rp 39.432.273 | 35% |
| Beban bersama, tanpa penanda | Rp 74.182.231 | 65% |

Isi beban bersama Januari 2026:

| Kode | Nama | Nilai |
|---|---|---|
| `6130.01` | Biaya Gaji Karyawan | 26.377.602 |
| `6130.02` | Biaya Gaji Management | 22.373.705 |
| `6130.03` | Biaya Service Karyawan | 14.717.801 |
| `6130.05` | Biaya lain-lain | 5.623.300 |
| `6130.04` | Biaya Software dan Langganan | 3.630.900 |
| `6130.07` | Biaya Administrasi Bank | 360.223 |
| `6130.06` | Biaya Peralatan dan Perlengkapan Kantor | 233.000 |
| `6180.01` | Biaya Pemeliharaan Room | 229.700 |
| `8110.01` | Biaya Pajak | 228.000 |
| `6181.04` | Biaya Konsumsi | 173.000 |
| `6160.01-` | Biaya Gas | 140.000 |
| `6160.02-` | Biaya Galon | 95.000 |

Karena porsinya 65%, cara membaginya sangat menentukan hasil per cabang. Menaruh
semuanya di satu cabang akan membuat cabang itu tampak merugi dan cabang lain tampak
jauh lebih untung daripada kenyataannya.

`pnl-ke-jurnal.ts` menyediakan tiga cara lewat `--alokasi`:

| Pilihan | Arti |
|---|---|
| `--alokasi=pendapatan` | **Bawaan.** Sebanding pendapatan tiap cabang pada bulan itu. Januari 2026: The Hita Legian 78,0%, Sri Krisna 22,0%. |
| `--alokasi=rata` | Dibagi rata ke setiap cabang yang berpendapatan bulan itu. |
| `--alokasi=THL` | Seluruhnya ke satu cabang. Isi kode cabangnya, mis. `THL` atau `SKR`. |

Bawaannya `pendapatan` karena itu yang paling lazim dipakai untuk beban bersama dan
tidak perlu angka tambahan dari luar laporan. Kalau pembagian sebenarnya diketahui —
misalnya jumlah karyawan tiap cabang untuk gaji, atau jumlah kamar untuk
pemeliharaan — angkanya lebih tepat dihitung dengan dasar itu; sebutkan dasarnya dan
skripnya bisa ditambah.

Cabang yang belum berpendapatan pada bulan itu tidak ikut menanggung. Play Laundry
baru buka Maret dan saat itu akunnya masih menyatu dengan The Hita Legian, jadi pada
Januari dan Februari bagiannya nol dengan sendirinya.

## Akun penyeimbang

Laporan laba rugi hanya memuat pendapatan dan beban, tidak memuat kas, piutang,
maupun hutang. Supaya jurnalnya balance, selisih tiap cabang diseimbangkan ke satu
akun kas — bawaannya `1110.01 Kas Pemasukan`, bisa diganti dengan `--kas=KODE`.

Akibatnya pembukuan hasil impor ini berbasis kas: pengaruh setiap bulan terhadap kas
sama dengan laba bersih bulan itu. Ini cukup untuk peramalan arus kas, yang memang
tujuan utamanya, tetapi **bukan neraca yang sebenarnya** — piutang tamu dan hutang
supplier tidak ada di laporan sumbernya, jadi tidak bisa ikut terbawa. Kalau neraca
pembukanya diperlukan, yang dibutuhkan laporan Trial Balance atau Balance Sheet dari
GuestPro, bukan laba rugi.

Penyeimbangnya dibuat **per cabang**, bukan satu baris untuk seluruh jurnal.
Dengan begitu tiap cabang balance sendiri dan tidak perlu jembatan
`1190.01 Piutang Antar Unit` / `2190.01 Hutang Antar Unit`.

Tiap cabang mendapat **dua** baris kas, bukan satu baris selisihnya: satu kas
masuk sebesar pendapatan, satu kas keluar sebesar beban. Pengaruhnya pada saldo
kas sama persis, tetapi menu Peramalan membaca arus kas dari debit dan kredit
akun kas. Dengan satu baris bersih saja, "rata-rata pemasukan per bulan" terbaca
sebesar laba — Rp 71 juta, bukan Rp 186 juta — dan angkanya menyesatkan.

## Statistik dari Sales Summary

```bash
python3 scripts/baca-sales-summary.py laporan/Sales-Summary-*.pdf
```

Skrip ini menghasilkan room night, reservasi, pax, dan ARR per tipe kamar per bulan.
Angka uangnya **tidak** diimpor sebagai jurnal, karena sudah tercakup di laporan laba
rugi. Kalau ternyata laba rugi suatu bulan tidak tersedia dan hanya ada Sales
Summary, skrip ini bisa dipakai menerbitkan jurnal pendapatan bulan itu — tetapi
jangan sampai bulan yang sama diimpor dari kedua laporan.
