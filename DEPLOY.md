# Memasang The Hita Finance di VPS

Panduan ini untuk VPS Ubuntu atau Debian yang masih kosong, dengan satu domain
atau subdomain yang sudah Anda miliki. Seluruh perintah dijalankan lewat SSH.

Yang akan terpasang:

| | |
|---|---|
| Node.js 22 | menjalankan aplikasinya |
| Caddy | menghadap internet, mengurus HTTPS sendiri |
| systemd | menyalakan ulang aplikasi otomatis saat mati atau server di-restart |
| Pencadangan harian | pukul 02:00, disimpan 30 hari terakhir |

Perkiraan waktu: 20–30 menit.

---

## 0. Sebelum mulai

**Arahkan domainnya ke VPS.** Di pengelola DNS domain Anda, buat satu data
`A` yang menunjuk alamat IP VPS:

```
Tipe  Nama        Nilai
A     keuangan    123.45.67.89      <- alamat IP VPS Anda
```

Perubahan DNS butuh beberapa menit sampai beberapa jam untuk menyebar. Periksa
dengan `ping keuangan.domainanda.co.id` dari komputer Anda — kalau sudah
menjawab dengan IP VPS, lanjutkan.

**Pastikan VPS-nya benar Ubuntu/Debian.** Masuk lewat SSH lalu jalankan:

```bash
cat /etc/os-release | head -2
```

Kalau yang muncul AlmaLinux, Rocky atau CentOS, perintah `apt` di bawah tidak
berlaku — beri tahu saya dan panduannya saya sesuaikan.

**Kalau VPS Rumahweb Anda memakai cPanel,** jangan ikuti panduan ini. Aplikasi
Node di cPanel dijalankan lewat menu "Setup Node.js App", bukan systemd. Beri
tahu saya kalau ternyata begitu.

---

## 1. Siapkan pengguna dan sistem

Masuk sebagai root, lalu:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw

# Pengguna khusus untuk aplikasinya. Menjalankan aplikasi sebagai root berarti
# satu celah di aplikasi langsung menjadi penguasaan penuh atas server.
adduser --disabled-password --gecos "" hita
```

Nyalakan tembok api, sisakan hanya tiga pintu:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Porta 3000 sengaja **tidak** dibuka: aplikasinya hanya mendengarkan dari dalam
server, dan yang menghadap internet hanya Caddy.

---

## 2. Pasang Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v    # harus 22.x
```

---

## 3. Ambil aplikasinya

```bash
su - hita
git clone https://github.com/sugandiganting/thehita.git app
cd app
npm ci
```

`npm ci` memasang pustaka persis seperti yang tercatat di `package-lock.json`.

---

## 4. Bangun dan siapkan basis data

```bash
npm run build
```

Perintah ini sekaligus membuat berkas `.env` dan **membuatkan `AUTH_SECRET`
acak** — kunci penanda tangan sesi login. Jangan diganti sembarangan: menggantinya
memutus seluruh sesi yang sedang berjalan.

Periksa isinya:

```bash
cat .env
```

Harus ada dua baris: `DATABASE_URL` dan `AUTH_SECRET` yang panjang dan acak.

---

## 5. Buat pengguna pertama

```bash
npm run pengguna -- tambah admin "Nama Lengkap Anda"
```

Kata sandinya dibuatkan acak dan **ditampilkan satu kali saja** — catat
sekarang. Anda bisa menggantinya sendiri dari menu Akun setelah berhasil masuk.

Untuk menentukan kata sandinya sendiri:

```bash
npm run pengguna -- tambah bendahara "Nama Bendahara" "kata-sandi-pilihan"
```

Perintah lain yang tersedia:

```bash
npm run pengguna -- daftar                  # lihat semua pengguna
npm run pengguna -- sandi admin             # ganti kata sandi, dibuatkan acak
npm run pengguna -- matikan bendahara       # cabut akses tanpa menghapus
npm run pengguna -- hidupkan bendahara
```

---

## 6. Jalankan sebagai layanan

Keluar dari pengguna `hita` kembali ke root (`exit`), lalu:

```bash
cp /home/hita/app/deploy/hita.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hita
systemctl status hita       # harus "active (running)"
```

Uji dari dalam server sendiri:

```bash
curl -I http://127.0.0.1:3000/masuk     # harus menjawab 200
```

Kalau gagal, lihat sebabnya:

```bash
journalctl -u hita -n 50 --no-pager
```

---

## 7. Pasang Caddy dan HTTPS

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Pasang konfigurasinya, lalu **ganti nama domain dan surelnya**:

```bash
cp /home/hita/app/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
```

Ganti dua baris teratas:

```
keuangan.contoh.co.id      ->  domain Anda yang sebenarnya
tls admin@contoh.co.id     ->  surel Anda
```

Simpan (Ctrl+O, Enter, Ctrl+X), lalu:

```bash
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl reload caddy
```

Buka domain Anda di peramban. Sertifikat HTTPS diminta otomatis pada kunjungan
pertama — beri waktu sekitar sepuluh detik. Halaman masuk akan muncul.

---

## 8. Nyalakan pencadangan harian

```bash
mkdir -p /home/hita/cadangan && chown hita:hita /home/hita/cadangan
cp /home/hita/app/deploy/hita-cadangan.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hita-cadangan.timer
```

Uji sekali tanpa menunggu tengah malam:

```bash
systemctl start hita-cadangan.service
ls -lh /home/hita/cadangan
```

Harus muncul satu berkas `hita-<tanggal>.db.gz`. Lihat jadwal berikutnya dengan
`systemctl list-timers hita-cadangan.timer`.

**Salinan di server saja belum cukup.** Kalau VPS-nya yang bermasalah,
cadangannya ikut hilang. Tekan **Unduh salinan sekarang** di menu Akun
sesekali — misalnya tiap tutup bulan — dan simpan berkasnya di tempat lain.

---

## Pemakaian sehari-hari

### Memperbarui aplikasi

```bash
su - hita
cd app
git pull
npm ci
npm run build
exit
systemctl restart hita
```

Basis datanya tidak tersentuh. Kalau ada perubahan struktur tabel,
`npm run build` menyesuaikannya sendiri.

### Melihat catatan

```bash
journalctl -u hita -f            # aplikasi, mengalir
journalctl -u caddy -n 50        # Caddy
tail -f /var/log/caddy/hita.log  # kunjungan
```

### Memulihkan dari cadangan

```bash
systemctl stop hita
su - hita
cd app
cp prisma/hita.db prisma/hita.db.sebelum-pulih       # jaga-jaga
gunzip -c /home/hita/cadangan/hita-2026-10-14-02-00-00.db.gz > prisma/hita.db
exit
systemctl restart hita
```

---

## Yang masih perlu diperhatikan

**Sesi berlaku 14 hari.** Setelah itu harus masuk lagi. Untuk memutus semua
sesi sekaligus — misalnya ada perangkat hilang — ganti `AUTH_SECRET` di `.env`
lalu `systemctl restart hita`.

**Percobaan masuk dibatasi 10 kali per 15 menit** dari satu alamat IP. Hitungannya
tersimpan di memori, jadi ikut hilang kalau aplikasinya dinyalakan ulang.

**Semua pengguna punya hak yang sama.** Siapa pun yang bisa masuk bisa membuka
dan mengubah semuanya. Pembedaan hak akses per menu belum ada.

**Basis datanya satu berkas** di `/home/hita/app/prisma/hita.db`. Jangan
menyalinnya dengan `cp` selagi aplikasi berjalan — gunakan perintah cadangan,
yang memakai cara aman bawaan SQLite.
