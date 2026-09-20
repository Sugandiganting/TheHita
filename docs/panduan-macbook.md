# Panduan Pemasangan di MacBook

Ditulis untuk yang belum pernah memakai Terminal. Ikuti berurutan, sekitar 10 menit.

---

## Langkah 1 — Pasang Node.js

Node.js adalah mesin yang menjalankan aplikasi ini. Dipasang sekali saja.

1. Buka <https://nodejs.org>
2. Klik tombol besar bertuliskan **LTS** (versi yang stabil)
3. Buka berkas `.pkg` yang terunduh, lalu klik **Continue** sampai **Install**
4. Masukkan kata sandi Mac Anda bila diminta

> **MacBook dengan chip M1/M2/M3/M4?** Situsnya otomatis memberi versi yang tepat.
> Tidak perlu memilih apa pun.

### Memastikan berhasil

Tekan `Command + Spasi`, ketik **Terminal**, tekan Enter. Pada jendela hitam yang
muncul, ketik:

```
node -v
```

Tekan Enter. Bila muncul angka seperti `v22.11.0`, Node.js sudah siap. Angkanya harus
**20 atau lebih besar**.

---

## Langkah 2 — Unduh aplikasinya

Pilih salah satu cara.

### Cara A — lewat Terminal (disarankan, mudah diperbarui)

Salin baris berikut satu per satu ke Terminal, tekan Enter setiap selesai satu baris:

```bash
cd ~/Documents
git clone https://github.com/Sugandiganting/TheHita.git
```

> Bila muncul jendela **"The git command requires the command line developer tools"**,
> klik **Install** dan tunggu selesai, lalu ulangi perintah `git clone` di atas.

Aplikasi kini berada di folder **Documents → TheHita**.

### Cara B — unduh sebagai ZIP

1. Buka <https://github.com/Sugandiganting/TheHita>
2. Klik tombol hijau **Code** → **Download ZIP**
3. Pindahkan hasil ekstraknya ke folder **Documents**, ganti namanya menjadi `TheHita`

---

## Langkah 3 — Jalankan

Buka folder **Documents → TheHita** di Finder, lalu **klik dua kali berkas
`mulai.command`**.

Terminal akan terbuka dan mengerjakan semuanya sendiri:

```
================================================
  The Hita Finance
  Akuntansi & Peramalan Kas
================================================

[OK] Node.js v22.11.0 terdeteksi
Memasang komponen yang dibutuhkan (sekali saja, 1-3 menit)...
[OK] Komponen terpasang
Menyiapkan database untuk pertama kali...
[OK] Database siap

Menjalankan aplikasi...
```

Browser terbuka otomatis di <http://localhost:3000>. **Pemakaian pertama butuh 2-4
menit** karena komponen harus diunduh; berikutnya hanya beberapa detik.

### Bila macOS menolak membuka berkas

Muncul peringatan *"cannot be opened because it is from an unidentified developer"*?
Ini normal untuk berkas yang diunduh sebagai ZIP.

- **Klik kanan** pada `mulai.command` → pilih **Open** → klik **Open** pada peringatan

Cukup sekali; selanjutnya klik dua kali biasa sudah bisa.

### Bila muncul "permission denied"

Buka Terminal, ketik:

```bash
chmod +x ~/Documents/TheHita/mulai.command
```

---

## Pemakaian sehari-hari

| Kegiatan | Caranya |
|---|---|
| **Membuka aplikasi** | Klik dua kali `mulai.command`, tunggu browser terbuka |
| **Menutup aplikasi** | Klik jendela Terminal, tekan `Control + C`, lalu tutup jendelanya |
| **Membuka lagi setelah ditutup** | Klik dua kali `mulai.command` lagi |

> Jendela Terminal harus tetap terbuka selama aplikasi dipakai. Boleh diperkecil
> (minimize), jangan ditutup.

### Supaya lebih gampang dibuka

Seret berkas `mulai.command` ke **Dock** (baris ikon di bawah layar), di bagian kanan
dekat Trash. Selanjutnya cukup satu klik dari Dock.

---

## Mencadangkan data

Seluruh data Anda tersimpan dalam **satu berkas**:

```
Documents → TheHita → prisma → hita.db
```

Salin berkas itu ke iCloud Drive, Google Drive, atau hard disk eksternal secara berkala.
Untuk memulihkan, kembalikan berkas tersebut ke tempat semula.

> **Penting:** berkas `hita.db` sengaja tidak ikut ter-upload ke GitHub. Data keuangan
> Anda hanya ada di MacBook ini, jadi pencadangan manual adalah satu-satunya pengaman.

Cara cepat mencadangkan lewat Terminal:

```bash
cp ~/Documents/TheHita/prisma/hita.db ~/Desktop/backup-hita-$(date +%Y%m%d).db
```

---

## Memulai dari data kosong

Data contoh 18 bulan sengaja disertakan supaya menu Peramalan bisa langsung dicoba.
Bila sudah siap memakai data asli, buka Terminal:

```bash
cd ~/Documents/TheHita
SEED_DEMO=0 npm run db:reset
```

COA, lima unit usaha, dan skenario peramalan tetap ada — hanya transaksi contoh dan
proyek contoh yang dihapus.

> Perintah ini **menghapus seluruh transaksi**. Cadangkan `hita.db` dulu bila ragu.

---

## Mengambil pembaruan

Bila nanti ada perbaikan atau fitur baru:

```bash
cd ~/Documents/TheHita
git pull
npm install
```

Data Anda di `hita.db` tidak tersentuh oleh perintah ini.

---

## Bila ada masalah

| Gejala | Penyebab & solusi |
|---|---|
| `command not found: node` | Node.js belum terpasang atau Terminal belum di-restart. Tutup Terminal, buka lagi. |
| `command not found: git` | Pakai Cara B (unduh ZIP) di Langkah 2. |
| `Port 3000 is already in use` | Aplikasi sudah berjalan di jendela lain. Cek jendela Terminal yang terbuka, atau restart MacBook. |
| Browser menampilkan "tidak dapat terhubung" | Aplikasi belum siap. Tunggu 30 detik, muat ulang halaman. |
| Terminal menutup sendiri seketika | Klik kanan `mulai.command` → **Open** (lihat Langkah 3). |
| Halaman kosong / error aneh | Tekan `Control + C` di Terminal, klik dua kali `mulai.command` lagi. |

---

## Ingin diakses dari HP atau komputer lain?

Selama berada di jaringan WiFi yang sama, buka alamat **Network** yang tertera di
Terminal saat aplikasi dijalankan, misalnya `http://192.168.1.10:3000`.

> Cara ini hanya untuk jaringan internal kantor. Aplikasi belum memiliki sistem login,
> jadi siapa pun di WiFi yang sama bisa membukanya. Untuk pemakaian lebih luas —
> beberapa staf, akses dari luar kantor — perlu ditambahkan autentikasi dan dipasang
> di server terlebih dahulu.
