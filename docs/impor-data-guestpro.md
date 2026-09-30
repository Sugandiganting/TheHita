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
| **Sales Summary** | Kamar terjual, reservasi, pax, room charge, extra charge, POS | Statistik hunian saja |

**Kedua laporan ini tidak boleh diimpor bersamaan.** Angkanya tumpang tindih: pada
Januari 2026, `Pendapatan Kamar - TH Seminyak` di laporan laba rugi bernilai
`147.288.126,40`, tepat sama dengan jumlah room charge + extra charge The Hita Legian
di Sales Summary bulan yang sama. Mengimpor keduanya berarti mencatat pendapatan dua
kali.

Hal yang sama berlaku di GuestPro 1: pada Januari 2026, `Total Room Net` di Sales
Summary The Hita Uluwatu bernilai `182.521.289,83`, sedangkan `Pendapatan Kamar - TH
Uluwatu` di laba rugi bernilai `182.921.289,83` — dua laporan yang menghitung uang yang
sama.

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

## Statistik hunian

Ada dua laporan yang bisa dipakai. **Room Revenue Report lebih baik**: isinya satu
baris per transaksi kamar, lengkap dengan tanggal, nomor kamar, dan kode akun
cabang, sehingga kamar terjual per bulan per cabang maupun jumlah kamar yang
sebenarnya bisa dihitung langsung. Sales Summary hanya dipakai untuk jumlah tamu,
yang tidak ada di Room Revenue Report.

```bash
# Room Revenue Report (.xls) — kamar terjual + jumlah kamar
python3 scripts/baca-room-revenue.py laporan/room-revenue.xls \
    --banding=data/pnl.json --keluar=data/statistik.csv

# Sales Summary (.pdf) — jumlah tamu, dan kamar terjual bila Room Revenue tak ada
python3 scripts/baca-statistik.py --unit=THU laporan/Sales-Summary-*.pdf --keluar=data/statistik.csv

npx tsx scripts/impor-statistik.ts data/statistik.csv --coba
npx tsx scripts/impor-statistik.ts data/statistik.csv
```

`--banding` membandingkan pendapatan kamar di Room Revenue Report dengan akun
pendapatan kamar di laba rugi. Keduanya menghitung uang yang sama, jadi selisihnya
menandakan sesuatu — periode laporan yang salah, atau penyesuaian yang dicatat
langsung ke akun pendapatan tanpa lewat folio tamu. Perbandingan inilah yang
menemukan bahwa laba rugi Agustus 2026 dicetak untuk periode **01–30 Agustus**,
bukan 01–31, sehingga kehilangan satu hari penuh.

Yang diambil hanya angka operasional — kamar terjual, jumlah tamu, dan jumlah kamar.
Angka uangnya **tidak** diimpor, karena sudah tercakup di laporan laba rugi. Hasilnya
tampil di menu *Laporan* pada bagian **Statistik hunian**.

Beberapa catatan:

- **Jumlah kamar dihitung dari laporan**, yaitu nomor kamar yang benar-benar muncul,
  diambil yang terbanyak di antara bulan-bulan yang diimpor. Laporan hanya memuat kamar
  yang terisi minimal sekali, jadi memakai angka bulan sepi akan membuat tingkat hunian
  tampak lebih tinggi daripada yang sebenarnya. Angka ini juga menggantikan jumlah kamar
  pada data induk — The Hita Uluwatu tercatat 20 kamar padahal sebenarnya 30, The Hita
  Legian 24 padahal 16, Sri Krisna 32 padahal 6.
- **Jumlah tamu tidak ditimpa nol.** Room Revenue Report tidak memuat pax, jadi kolom
  pax yang kosong dibiarkan apa adanya saat dimuat ulang.
- **Laporan yang dikelompokkan per tipe kamar tidak memuat nomor kamar**, sehingga
  kapasitasnya tidak bisa disimpulkan. Untuk cabang seperti itu kamar terjual dan jumlah
  tamu tetap masuk, tetapi tingkat huniannya kosong sampai jumlah kamar diisi lewat menu
  *Unit Usaha*.
- **ARR tidak diambil dari laporan.** ARR yang tercetak GuestPro tidak selalu sepadan
  dengan angkanya sendiri — pada April dan Juni 2026 di The Hita Uluwatu, ARR dikali
  kamar terjual meleset dari Total Room Net yang tercetak di laporan yang sama. Di
  sistem ini ARR dihitung ulang dari pendapatan kamar yang sudah tercatat di jurnal.

`scripts/baca-sales-summary.py` yang lama masih ada. Skrip itu menerbitkan **jurnal**
pendapatan dari Sales Summary, dan hanya dipakai bila laba rugi suatu bulan benar-benar
tidak tersedia. Jangan sampai bulan yang sama diimpor dari kedua laporan.

## Menyamakan saldo kas dengan kenyataan

Laporan laba rugi tidak memuat seluruh pergerakan kas. Angsuran pokok utang bank,
prive pemilik, belanja modal yang dibayar tunai, dan saldo kas pada awal periode
tidak ada di sana. Akibatnya "saldo kas" hasil impor sebenarnya sama dengan
akumulasi laba, bukan uang yang betul-betul ada di rekening.

Pada 30 September 2026 selisihnya besar: pembukuan menunjukkan Rp 680.137.445
sedangkan kas sebenarnya Rp 167.192.901. Sebagian besar selisih itu angsuran utang
bank, yang pada proyeksi arus kas tercatat sekitar Rp 75,6 juta per bulan.

```bash
npx tsx scripts/setel-saldo-kas.ts --tanggal=30/09/2026 --saldo=167192901 --coba
npx tsx scripts/setel-saldo-kas.ts --tanggal=30/09/2026 --saldo=167192901
```

Skrip ini membuat satu bukti jurnal penyesuaian bernomor `KAS-YYMM` yang menggeser
saldo kas ke angka sebenarnya, dengan lawan `3101.02 Opening Balance Equity`.
Dijalankan ulang, bukti lamanya diganti — bukan ditumpuk.

Beberapa hal yang perlu diketahui:

- **Pasang di tiap tanggal yang saldo sebenarnya diketahui.** Bukti berikutnya
  dihitung dari saldo setelah bukti sebelumnya, jadi memasang Juli, Agustus, dan
  September berturut-turut membuat garis kasnya cocok di ketiga titik itu.
- **Peramalan mengabaikan bukti penyesuaian.** Nilainya besar tetapi bukan arus kas
  yang benar-benar terjadi pada bulan itu. Kalau ikut dihitung, rata-rata pemasukan
  dan pengeluaran bulanan melenceng jauh — pernah terbaca Rp 482 juta per bulan
  padahal beban tertinggi sebulan hanya Rp 336 juta.
- **Pembagian per cabang adalah asumsi** bila hanya total yang diketahui. Saldo buku
  tiap cabang dikalikan satu faktor yang sama, sehingga tanda dan urutan tiap cabang
  tetap. Sebutkan `--per-unit=THL:N,SKR:N,...` bila saldo tiap cabang diketahui.
- **Peramalan masih belum memperhitungkan angsuran utang bank.** Selama angsuran itu
  belum dicatat sebagai pengeluaran rutin, ramalannya akan terlalu optimis.
