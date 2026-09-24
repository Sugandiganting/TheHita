# Panduan Pemakaian Harian

Panduan singkat untuk staf akunting. Tidak perlu latar belakang teknis.

---

## 1. Mencatat pemasukan

Menu **Transaksi** → tab **Entri cepat** → tombol **Pemasukan**.

| Kolom | Diisi apa |
|---|---|
| Tanggal | Tanggal uang diterima |
| Unit usaha | Cabang yang menerima, mis. `SKR — Sri Krisna` |
| Nominal | Angka saja, tanpa titik. Contoh `4750000` |
| Kategori pendapatan | Jenis pemasukannya, mis. `4-1200 Kamar - OTA` |
| Masuk ke kas/bank | Uangnya masuk ke mana, mis. `1120.01 Bank Mandiri/BCA` |
| Keterangan | Penjelasan singkat |
| No. bukti | Opsional, mis. nomor invoice |

Sistem otomatis membuat jurnal: **kas didebit, pendapatan dikredit**.

## 2. Mencatat pengeluaran

Sama seperti di atas, tekan tombol **Pengeluaran**. Yang berubah hanya:

- **Kategori beban / HPP** — jenis pengeluarannya, mis. `6120.01 Biaya Listrik`
- **Dibayar dari kas/bank** — uangnya diambil dari mana

Jurnal yang terbentuk: **beban didebit, kas dikredit**.

## 3. Satu tagihan untuk dua cabang

Contoh: tagihan listrik Rp 30.000.000 satu meteran, dipakai bersama Sri Krisna dan
Play Laundry, dibagi 20 juta dan 10 juta.

Menu **Transaksi** → tab **Jurnal manual**:

| Akun | Unit | Debit | Kredit |
|---|---|---|---|
| `6120.01 Biaya Listrik` | SKR | 20.000.000 | |
| `6120.01 Biaya Listrik` | PLD | 10.000.000 | |
| `1120.01 Bank Mandiri/BCA` | SKR | | 30.000.000 |

Tombol **Simpan jurnal** baru aktif setelah tulisan **Balance ✓** muncul. Beban listrik
akan muncul di laporan masing-masing cabang sesuai porsinya, memakai satu akun yang sama.

## 3b. Memindahkan uang antar rekening

Menu **Cash and Bank → Transfer Money**.

Pilih rekening asal dan tujuan — daftarnya dikelompokkan per cabang, dan saldo tiap rekening
ditampilkan langsung di pilihannya. Isi nominal dan keterangan, lalu simpan.

Contoh pemakaian:

| Keperluan | Dari | Ke |
|---|---|---|
| Isi ulang kas belanja | `1120.01 Bank Mandiri/BCA` · SKR | `1110.03 Petty Cash Purchasing` · SKR |
| Setor hasil penjualan | `1110.01 Kas Pemasukan` · THL | `1120.01 Bank Mandiri/BCA` · THL |
| Pinjam dana antar cabang | `1120.01 Bank Mandiri/BCA` · IGYT | `1120.01 Bank Mandiri/BCA` · THL |

Bila asal dan tujuan berada di cabang berbeda, muncul kotak biru pemberitahuan. Sistem otomatis
mencatat piutang pada cabang pemberi dan hutang pada cabang penerima, supaya neraca kedua cabang
tetap seimbang masing-masing. Anda tidak perlu mengisi apa pun untuk itu.

Pantau hasilnya di kartu **Posisi antar unit** pada halaman Ringkasan Saldo: angka positif berarti
cabang tersebut sedang menalangi, negatif berarti sedang ditalangi. Totalnya harus selalu
**Seimbang** — bila tidak, ada jurnal manual lintas cabang yang perlu diperiksa.

## 4. Melihat laporan

Menu **Laporan**. Kosongkan filter unit untuk laporan seluruh grup, atau pilih satu
cabang untuk laporan cabang tersebut. Atur rentang bulan lewat kolom *Dari bulan* dan
*Sampai bulan*.

Periksa bagian **Neraca saldo** di kanan bawah — bila tertulis **Balance ✓**, seluruh
jurnal pada periode itu seimbang.

## 4b. Uang masuk dan uang keluar

Menu **Cash and Bank → Receive Money** dan **Pay Money**. Bentuk keduanya sama:

1. Pilih tanggal dan rekening yang dipakai
2. Isi lawan transaksi (dari siapa / kepada siapa) dan keterangan
3. Isi **rincian** — boleh lebih dari satu baris

Kolom **Untuk cabang** pada tiap baris rincian itulah kuncinya. Contoh tagihan listrik Rp 30 juta
yang dibayar dari bank Sri Krisna tetapi dipakai bersama Play Laundry:

| Akun beban | Untuk cabang | Nominal |
|---|---|---|
| `6120.01 Biaya Listrik` | SKR | 20.000.000 |
| `6120.01 Biaya Listrik` | PLD | 10.000.000 |

Simpan sekali, dan beban listrik langsung muncul di laporan masing-masing cabang sesuai porsinya —
memakai satu nomor akun yang sama. Penyeimbang antar unitnya dibuat otomatis.

## 5. Merencanakan proyek

1. Menu **Proyek** → **Proyek baru**.
2. Isi nama, unit, dan tanggal mulai.
3. Pilih sumber dana. Untuk pinjaman bank, isi jumlah, bunga per tahun, dan tenor —
   cicilan bulanan langsung dihitung dan ditampilkan.
4. Bila proyek akan menambah pendapatan (mis. kamar baru), isi perkiraan tambahan
   pendapatan dan biaya per bulan beserta tanggal mulai beroperasi.
5. Simpan, lalu tambahkan **item biaya** satu per satu beserta rencana tanggal bayarnya.
   Jadwal inilah yang dipakai peramalan.
6. Tandai item **Lunas** setelah dibayar — item lunas tidak dihitung lagi sebagai rencana
   pengeluaran.

## 6. Memeriksa kecukupan kas

Menu **Peramalan**.

1. Isi **Saldo kas minimum yang dijaga**. Patokan umum: 3 bulan biaya operasional.
2. Lihat kartu **Kapan uang habis**.
   - *Tidak habis* → kas aman sepanjang periode proyeksi.
   - *Tertulis nama bulan* → kas diperkirakan minus mulai bulan tersebut.
3. Lihat kartu **Kemampuan belanja proyek** — batas aman dana yang bisa dikeluarkan
   sekarang.
4. Hapus centang sebuah proyek untuk melihat kondisi kas seandainya proyek itu ditunda.
5. Pada tabel **Rincian bulanan**: baris kuning = di bawah batas aman, baris merah = minus.

### Bila hasilnya menunjukkan kas akan habis

Empat hal yang bisa dicoba, urut dari yang paling ringan:

1. **Geser jadwal pembayaran** item biaya ke bulan high season (Juli–Agustus, Desember).
2. **Pecah pembayaran** menjadi beberapa termin.
3. **Tambah pendanaan** — naikkan nilai pinjaman atau perpanjang tenor untuk memperkecil
   cicilan bulanan.
4. **Kurangi lingkup proyek** — misalnya bangun 5 kamar dulu, bukan 8.

Setiap perubahan langsung terlihat hasilnya di halaman Peramalan.

## 7. Menambah akun baru

Menu **COA** → panel **Akun baru** di kanan. Isi nomor, nama, dan jenis akun.

Aturan penomoran: `1` aset, `2` kewajiban, `3` modal, `4` pendapatan, `5` harga pokok,
`6` beban operasional. Ikuti pola nomor yang sudah ada agar urutan laporan tetap rapi.

Centang **Akun kas / bank** hanya untuk rekening atau kas fisik — saldo akun inilah yang
dipakai mesin peramalan.

### Mengubah akun

Tekan **Ubah** pada baris akun. Formulir di kanan berganti ke mode ubah dengan isian
yang sudah terisi. Tekan **Batal** untuk kembali menambah akun baru.

Untuk akun yang sudah pernah dipakai, **jenis akun** dan **tanda kas/bank** dikunci.
Nomor, nama, kelompok, dan induknya tetap bisa diubah. Penguncian ini disengaja:
mengubah jenis akun akan membalik tanda saldo pada seluruh laporan yang sudah jadi,
dan mencabut tanda kas akan mengubah saldo kas serta hasil peramalan. Bila memang perlu
jenis yang berbeda, non-aktifkan akun lama lalu buat akun baru.

### Menghapus akun

Tombol **Hapus** hanya muncul untuk akun yang benar-benar bersih. Bila tidak bisa dihapus,
alasannya langsung tertulis di kolom Aksi:

| Yang tertulis | Artinya |
|---|---|
| `Dipakai 846 jurnal` | Sudah ada transaksinya. Non-aktifkan saja agar laporan lama tetap utuh. |
| `Punya 7 akun anak` | Akun induk. Pindahkan atau hapus akun di bawahnya dulu. |
| `Dipakai 3 item proyek` | Masih dirujuk rincian biaya proyek. |
| `Dipakai sistem` | Akun antar unit, dipakai otomatis oleh menu Cash and Bank. |

Penghapusan memakai konfirmasi dua langkah: tekan **Hapus**, lalu **Ya, hapus**.
Akun yang sudah terhapus tidak bisa dikembalikan, tetapi karena syaratnya belum pernah
dipakai, tidak ada data transaksi yang ikut hilang.

## 8. Menambah cabang baru

Menu **Unit Usaha** → panel **Unit baru**. Isi kode singkat, nama, jenis usaha, dan saldo
kas awal. COA tidak perlu diubah sama sekali — cabang baru langsung bisa memakai seluruh
akun yang ada.

---

## Mencadangkan data

Seluruh data berada dalam satu berkas: `prisma/hita.db`. Salin berkas tersebut secara
berkala ke penyimpanan lain (hard disk eksternal atau cloud). Untuk memulihkan, cukup
kembalikan berkas itu ke tempat semula.
