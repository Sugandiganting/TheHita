# The Hita Finance

Sistem pencatatan keuangan dan peramalan arus kas untuk **The Hita Hospitality Group** —
mencatat pemasukan & pengeluaran berbasis Chart of Account (COA), memisahkan angka per
cabang dan per jenis usaha, serta memperkirakan **kapan kas akan habis** bila menjalankan
proyek besar seperti penambahan kamar.

---

## Masalah yang diselesaikan

| Kondisi sekarang | Dengan sistem ini |
|---|---|
| Sri Krisna, The Hita Legian & Play Laundry digabung di satu PMS GuestPro, dipisah hanya lewat penomoran COA | Semua unit berada di satu database, dipisah lewat **dimensi unit usaha** pada setiap baris jurnal |
| The Hita Uluwatu & IGYT Coffee di PMS terpisah, sehingga laporan gabungan harus disatukan manual | Laporan konsolidasi seluruh grup tersedia sekali klik, tanpa menggabungkan file |
| COA bengkak karena tiap cabang butuh nomor akun sendiri | Satu COA dipakai bersama; menambah cabang tidak menambah satu pun nomor akun |
| Belum ada cara memperkirakan dampak proyek besar terhadap kas | Menu **Peramalan** memproyeksikan saldo kas bulan demi bulan dan menunjukkan bulan saat kas menipis atau habis |

### Jawaban atas pertanyaan "apakah 1 sistem bisa mengatur semuanya?"

**Bisa.** Kuncinya adalah memisahkan dua hal yang selama ini tercampur:

- **Chart of Account** menjawab *"uang ini untuk apa?"* — listrik, gaji, pendapatan kamar.
- **Unit usaha** menjawab *"uang ini milik siapa?"* — Sri Krisna, Play Laundry, IGYT.

Di GuestPro keduanya dipaksa masuk ke satu kolom yang sama (nomor akun), sehingga cabang
baru berarti COA baru. Di sini keduanya jadi dua kolom terpisah pada setiap baris jurnal.
Akibatnya:

- Akun `6120.01 Biaya Listrik` dipakai kelima unit, tetapi laporannya tetap bisa dipisah.
- Satu tagihan listrik yang dipakai bersama hotel dan laundry bisa dibagi dua dalam satu
  bukti transaksi — sesuatu yang tidak mungkin dilakukan dengan pemisahan berbasis COA.
- Menambah cabang keenam cukup lewat menu **Unit Usaha**, tanpa menyentuh COA sama sekali.

---

## Unit usaha yang sudah terpasang

| Kode | Nama | Jenis | PMS lama |
|---|---|---|---|
| `SKR` | Sri Krisna | Hotel | GuestPro 1 |
| `THL` | The Hita Legian | Hotel | GuestPro 1 |
| `THU` | The Hita Uluwatu | Hotel | GuestPro 2 |
| `PLD` | Play Laundry | Laundry | GuestPro 1 |
| `IGYT` | IGYT Coffee & Eatery | Cafe & Resto | GuestPro 2 |

Kolom "PMS lama" hanya catatan asal data untuk membantu proses migrasi — di sistem ini
pengelompokan tersebut tidak lagi membatasi apa pun.

---

## Cara menjalankan

Yang perlu dipasang lebih dulu: **Node.js versi 20 atau lebih baru**
(unduh di <https://nodejs.org>, pilih versi LTS).

### Cara termudah (macOS)

Klik dua kali berkas **`mulai.command`**. Berkas itu memeriksa Node.js, memasang
komponen, menyiapkan database, menjalankan aplikasi, dan membuka browser secara
otomatis. Panduan lengkap langkah demi langkah ada di
[docs/panduan-macbook.md](docs/panduan-macbook.md).

### Lewat Terminal

```bash
# 1. Ambil kode dan masuk ke foldernya
git clone https://github.com/Sugandiganting/TheHita.git
cd TheHita

# 2. Pasang komponen yang dibutuhkan
npm install

# 3. Siapkan file konfigurasi
cp .env.example .env

# 4. Buat database + isi COA, unit usaha, dan data contoh 18 bulan
npm run setup

# 5. Jalankan
npm run dev
```

Buka <http://localhost:3000> di browser.

### Mulai dari data kosong

`npm run setup` ikut memasang data contoh supaya menu Peramalan langsung bisa dicoba.
Untuk memakai sistem dengan data asli tanpa transaksi contoh:

```bash
SEED_DEMO=0 npm run db:reset
```

COA, unit usaha, dan skenario peramalan tetap terpasang; hanya transaksi contoh dan
proyek contoh yang dilewati.

### Perintah lain

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Menjalankan untuk pemakaian sehari-hari / pengembangan |
| `npm run build && npm start` | Menjalankan versi produksi (lebih cepat) |
| `npm test` | Menjalankan 25 pengujian mesin peramalan & aturan akuntansi |
| `npm run db:reset` | Mengosongkan database lalu mengisi ulang data awal |
| `npx prisma studio` | Membuka database secara langsung bila perlu koreksi manual |

---

## Isi menu

### Dashboard
Ringkasan saldo kas, pendapatan, beban, dan laba bersih. Bisa difilter per cabang atau
ditampilkan konsolidasi seluruh grup. Termasuk perbandingan laba antar cabang dan
peringatan dini bila kas diproyeksikan habis.

### Cash and Bank
Tiga cara uang bergerak, masing-masing punya halamannya sendiri:

- **Transfer Money** — memindahkan uang antar rekening milik grup, misalnya dari Bank IGYT ke
  Bank The Hita Legian, atau dari bank ke Kas Kecil Purchasing. Transfer tidak menambah atau
  mengurangi kekayaan grup, hanya memindahkan letaknya.
- **Receive Money** — mencatat uang masuk. Satu penerimaan boleh dipecah ke beberapa akun sekaligus.
- **Pay Money** — mencatat uang keluar. Satu pembayaran boleh dipecah ke beberapa akun beban dan
  dibagi ke beberapa cabang, misalnya satu tagihan listrik satu meteran untuk hotel dan laundry.

Halaman **Ringkasan Saldo** menampilkan posisi tiap rekening per cabang, sehingga "Bank BCA milik
IGYT" dan "Bank BCA milik The Hita Legian" terbaca sebagai dua kantong uang berbeda meski memakai
satu nomor akun.

#### Transaksi antar cabang

Ketika uang berpindah antar cabang, sistem otomatis menambahkan sepasang baris:
`1190.01 Piutang Antar Unit` pada cabang pemberi dan `2190.01 Hutang Antar Unit` pada cabang penerima.

Tanpa keduanya, jurnal memang tetap balance secara keseluruhan — tetapi neraca masing-masing cabang
tidak lagi seimbang berdiri sendiri, dan laporan per cabang menjadi salah tanpa ketahuan. Saldo kedua
akun itu selalu saling meniadakan pada laporan konsolidasi; kartu **Posisi antar unit** di halaman
Ringkasan Saldo memantaunya.

### Transaksi
Dua cara mencatat:

- **Entri cepat** — pilih *Pemasukan* atau *Pengeluaran*, isi nominal, kategori, dan kas
  yang dipakai. Jurnal debit/kredit dibuat otomatis. Ini untuk pemakaian harian.
- **Jurnal manual** — untuk transaksi yang menyentuh banyak akun sekaligus, misalnya satu
  tagihan listrik yang dibagi ke dua cabang, atau pelunasan hutang supplier. Tombol simpan
  baru aktif setelah debit dan kredit seimbang.

### Laporan
Laba rugi tersusun menurut COA, rincian saldo kas & bank, dan neraca saldo lengkap dengan
pemeriksaan keseimbangan debit-kredit. Semua bisa difilter per cabang dan per periode.

### Peramalan
Inti dari sistem ini — lihat bagian berikutnya.

### Proyek
Rencana belanja modal beserta jadwal pembayaran per item, sumber dana (kas sendiri,
pinjaman bank, atau setoran modal), dan perkiraan tambahan pendapatan setelah proyek
beroperasi. Jadwal inilah yang disuntikkan ke proyeksi arus kas.

### COA
Daftar akun (±125 akun bawaan, disusun mengikuti kebiasaan pembukuan hotel di Indonesia).
Bisa ditambah, diubah, atau dinonaktifkan. Akun bertanda **kas** adalah akun yang saldonya
dipakai mesin peramalan.

### Unit Usaha
Daftar cabang dan jenis usaha. Menambah cabang baru cukup dari sini.

---

## Cara kerja peramalan

Mesin peramalan berada di [`src/lib/forecast.ts`](src/lib/forecast.ts) dan bekerja dalam
enam langkah:

1. **Mengumpulkan histori.** Seluruh jurnal diringkas menjadi pemasukan dan pengeluaran
   kas per bulan.
2. **Mencari pola dasar** dengan salah satu dari tiga metode:
   - *Rata-rata tertimbang* (bawaan) — bulan terbaru diberi bobot lebih besar. Cocok bila
     kondisi usaha sedang berubah.
   - *Rata-rata sederhana* — semua bulan berbobot sama. Paling stabil.
   - *Garis tren* — mengikuti arah naik atau turun dari data.
3. **Mengoreksi pola musiman.** Bila histori sudah 12 bulan atau lebih, sistem menghitung
   indeks tiap bulan — misalnya Agustus biasanya 35% di atas rata-rata, Februari 20% di
   bawah. Pola musim dihilangkan dulu sebelum mencari tren, lalu dipasang kembali pada
   hasil ramalan, supaya tren tidak tertipu oleh perbedaan high/low season.
4. **Menerapkan asumsi pertumbuhan** pendapatan dan kenaikan biaya per tahun, dihitung
   berbunga majemuk per bulan.
5. **Menyuntikkan rencana proyek** — belanja modal sesuai jadwal pembayaran, pencairan
   pinjaman, cicilan (rumus anuitas), serta tambahan pendapatan dan biaya setelah proyek
   beroperasi.
6. **Menggulung saldo kas** bulan demi bulan untuk menemukan kapan saldo menembus batas
   aman dan kapan saldo menjadi minus.

### Angka yang dihasilkan

| Angka | Artinya |
|---|---|
| **Kapan uang habis** | Bulan pertama saldo kas diproyeksikan minus, beserta sisa waktunya dari sekarang |
| **Saldo terendah** | Titik paling kritis sepanjang periode proyeksi, dan bulan terjadinya |
| **Kemampuan belanja proyek** | Dana maksimum yang bisa dikeluarkan sekarang tanpa menembus batas aman — dihitung tanpa memperhitungkan proyek yang sudah ada |
| **Surplus/defisit rata-rata** | Selisih pemasukan dan pengeluaran rutin per bulan, sebelum belanja proyek |

### Menguji sebuah proyek

1. Buat proyek di menu **Proyek** beserta rincian biaya dan jadwal pembayarannya.
2. Buka **Peramalan**. Proyek aktif otomatis ikut dihitung.
3. Isi *Saldo kas minimum yang dijaga* — misalnya tiga bulan biaya operasional.
4. Hapus centang proyek tersebut untuk membandingkan kondisi kas dengan dan tanpa proyek.
5. Perhatikan tabel **Rincian bulanan**: baris kuning berarti saldo di bawah batas aman,
   baris merah berarti saldo minus.

Seluruh asumsi tersimpan di alamat halaman, sehingga satu skenario bisa disalin dan
dikirim ke pemilik atau bank lewat tautan biasa.

### Batasan yang perlu diketahui

- Ramalan hanya sebaik data yang diinput. Di bawah 3 bulan histori hasilnya masih kasar;
  pola musiman baru aktif setelah 12 bulan.
- Beban penyusutan sengaja **tidak** diperhitungkan karena bukan pengeluaran kas.
- Sistem memproyeksikan kelanjutan pola masa lalu. Kejadian luar biasa — pandemi,
  penutupan jalan, pembukaan pesaing besar — tidak bisa ditebak dari data historis.
  Gunakan kolom asumsi pertumbuhan untuk menurunkan proyeksi secara manual bila perlu.

---

## Struktur data

```
BusinessGroup                     grup usaha, untuk konsolidasi
└── BusinessUnit                  cabang / jenis usaha (SKR, THL, THU, PLD, IGYT)

Account                           COA, dipakai bersama seluruh unit

JournalEntry                      bukti transaksi
└── JournalLine                   baris debit/kredit — membawa accountId DAN unitId
                                  (inilah yang memisahkan cabang tanpa menggandakan COA)

Project                           rencana belanja modal
└── ProjectCostItem               rincian biaya + jadwal pembayaran

MonthlyStat                       statistik operasional (kamar terjual, tamu)
ForecastScenario                  skenario peramalan tersimpan
```

Setiap transaksi disimpan sebagai jurnal **double-entry**. Sistem menolak jurnal yang
tidak seimbang dan menolak posting ke akun induk, sehingga laporan selalu bisa
dipertanggungjawabkan.

---

## Struktur COA

| Rentang | Kelompok | Contoh |
|---|---|---|
| `1110` – `1120` | Kas & bank | Kas Pemasukan, Petty Cash FO, Bank Mandiri/BCA, Shopee Pay |
| `1130` – `1131` | Piutang | Guest Ledger, Piutang EDC, Piutang Booking.com, Piutang Traveloka |
| `1140` – `1143` | Persediaan | Amenities, Chemical HK, Bahan Makanan, Linen, Chemical Laundry |
| `1190` / `2190` | Antar unit | Piutang & Hutang Antar Unit (dibuat otomatis) |
| `1210` – `1220` | Aset tetap | Gedung & Bangunan, FF&E, Aset Dalam Pengerjaan |
| `2101` – `2103` | Kewajiban | Account Payable, Utang Pajak, Hotel Tax / PHR, Service Charge |
| `3101` | Modal | Modal Pemilik, Prive, Laba Ditahan, Opening Balance Equity |
| `4110` – `4113` | Pendapatan | Pendapatan Kamar, F&B Makanan, Laundry Kiloan, Rental Motor |
| `5110` | Harga pokok | HPP Food, HPP Minuman, HPP Breakfast, HPP Tour & Transfer |
| `6110` | Komisi OTA | Komisi Booking.com, Agoda, Traveloka, Klook, Trip.com |
| `6120` – `6191` | Beban operasional | Biaya Listrik, Gaji Karyawan, Pemeliharaan AC, Biaya Laundry |
| `7110` / `8110` | Non operasional | Interest Income, Bank Charge Expense |

Struktur ini diambil langsung dari COA GuestPro yang sedang dipakai, dengan akun yang
digandakan per cabang digabung menjadi satu. Padanan nomor lama ke nomor baru ada di
[docs/pemetaan-coa-guestpro.md](docs/pemetaan-coa-guestpro.md).

Daftar lengkap ada di [`src/lib/coa-template.ts`](src/lib/coa-template.ts).

---

## Rencana migrasi dari GuestPro

1. **Tutup buku** di GuestPro sampai tanggal tertentu, misalnya akhir bulan.
2. **Catat saldo awal.** Isi saldo kas & bank tiap unit lewat menu *Unit Usaha*, atau buat
   jurnal pembuka memakai akun `3101.02 Opening Balance Equity`.
3. **Pakai tabel padanan COA.** Seluruh 376 baris akun dari kedua berkas GuestPro sudah
   dipetakan ke nomor baru di [docs/pemetaan-coa-guestpro.md](docs/pemetaan-coa-guestpro.md).
   Akun yang dulu digandakan per cabang — `Biaya Listrik - TH`, `Biaya Listrik - SRK`, dan
   `Biaya Listrik` pada PMS satunya — kini menjadi satu akun `6120.01 Biaya Listrik`,
   dibedakan oleh kolom unit.
4. **Jalankan paralel satu bulan.** Catat di kedua sistem, lalu bandingkan laba rugi dan
   saldo kas untuk memastikan hasilnya cocok.
5. **Masukkan histori** minimal 12 bulan bila ingin peramalan langsung memperhitungkan
   pola musiman — ini investasi waktu yang paling berpengaruh pada kualitas ramalan.

---

## Catatan teknis

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Prisma** + **SQLite** — database berupa satu berkas, mudah dicadangkan (salin
  `prisma/hita.db`). Untuk pemakaian banyak orang sekaligus, ubah `datasource` di
  `prisma/schema.prisma` ke PostgreSQL tanpa mengubah kode aplikasi.
- **Tailwind CSS** untuk tampilan, **Recharts** untuk grafik
- Perhitungan tanggal memakai UTC agar hasilnya tidak bergeser karena zona waktu server
- Nilai uang disimpan dalam rupiah penuh

### Pengujian

```bash
npm test
```

Mencakup: aritmetika periode, ketiga metode estimasi, indeks musiman, rumus cicilan
anuitas, deteksi bulan kas habis, pengaruh proyek terhadap saldo, dan pembentukan jurnal
double-entry.

---

## Keamanan

Versi ini belum memiliki sistem login dan ditujukan untuk dijalankan di jaringan internal
atau komputer pribadi. Sebelum dipasang di server yang bisa diakses publik, tambahkan
autentikasi dan hak akses per pengguna terlebih dahulu.
