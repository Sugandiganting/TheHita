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

**Belum punya domain? Boleh dilewati.** Aplikasinya bisa dipasang dan dipakai
lewat alamat IP saja, dan domainnya menyusul kapan pun tanpa memasang ulang —
yang berubah hanya satu berkas konfigurasi Caddy. Lewati bagian domain di bawah
dan ikuti jalur "Tanpa domain" di langkah 7.

Satu hal yang **tidak** boleh dilewati adalah HTTPS-nya. Cookie sesi aplikasi
ini ditandai `Secure` di mode produksi, jadi lewat HTTP biasa login tidak akan
pernah berhasil — peramban menolak mengirim cookienya kembali. Langkah 7 tetap
wajib dikerjakan, hanya caranya yang berbeda.

**Sebagian penyedia sudah membuatkan penggunanya.** Biznet NEO Lite, misalnya,
menanyakan nama pengguna dan kunci SSH saat pemesanan, lalu membuatkannya
untuk Anda. Kalau begitu, lewati `adduser` di langkah 1, dan jalankan perintah
yang di bawah ini ditulis sebagai root dengan `sudo` di depannya. Periksa
dengan `whoami` dan `sudo -v`.

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
#
# Lewati baris ini bila penyedia VPS sudah membuatkannya saat pemesanan —
# `id hita` akan menjawab dengan nomor penggunanya, bukan "no such user".
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

### Tanpa domain, lewat alamat IP

Pakai konfigurasi yang sudah disiapkan untuk ini:

```bash
IP=103.0.0.1        # GANTI dengan alamat IP VPS Anda

cp /home/hita/app/deploy/Caddyfile-ip /etc/caddy/Caddyfile
sed -i "s/GANTI_DENGAN_IP/$IP/g" /etc/caddy/Caddyfile

# Keduanya harus 0 — yang pertama memastikan penggantiannya kena, yang kedua
# memastikan berkasnya tidak rusak karena $IP ternyata kosong.
grep -c GANTI_DENGAN_IP /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile > /dev/null && echo "konfigurasi sah"

mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl reload caddy
```

Buka `https://<alamat-ip>` di peramban. Peramban akan memperingatkan bahwa
sertifikatnya tidak dikenal — itu wajar dan tidak berbahaya di sini: Let's
Encrypt tidak menerbitkan sertifikat untuk alamat IP, jadi Caddy membuat
sertifikatnya sendiri. Lalu lintasnya tetap terenkripsi penuh; yang tidak bisa
dibuktikan hanyalah "server ini benar milik siapa", dan itu memang hanya bisa
dijawab oleh nama domain.

Di Chrome: **Advanced** lalu **Proceed**. Di Safari: **Show Details** lalu
**visit this website**. Cukup sekali per peramban.

Begitu domainnya siap, lanjutkan ke bagian berikutnya — tidak ada yang perlu
diubah di sisi aplikasi maupun basis datanya.

### Dengan domain

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

Satu perintah:

```bash
sudo bash /home/hita/app/deploy/perbarui.sh
```

Urutannya: basis data dicadangkan dulu, baru versi barunya ditarik, dipasang,
dan dibangun. **Layanannya hanya dinyalakan ulang bila pembangunannya
berhasil** — jadi kegagalan di tengah tidak pernah membuat aplikasinya mati,
versi lama tetap melayani. Setelah menyala, alamatnya dicoba sampai menjawab;
kalau tidak, catatan layanannya ikut ditampilkan beserta perintah untuk kembali
ke versi sebelumnya.

Basis datanya tidak tersentuh. Perubahan struktur tabel disesuaikan sendiri,
karena langkah itu sudah menempel pada `npm run build`.

Tidak ada versi baru? Skripnya berhenti dan mengatakannya. Tambahkan `--paksa`
untuk tetap membangun ulang.

### Memperbarui dari GitHub, tanpa membuka terminal

Ada juga `.github/workflows/perbarui-vps.yml`: buka tab **Actions** di GitHub,
pilih **Perbarui VPS**, tekan **Run workflow**. Ia menyambung ke server lewat
SSH lalu menjalankan skrip yang sama.

Perlu disiapkan sekali di **Settings → Secrets and variables → Actions**:

| Rahasia | Isi |
| --- | --- |
| `VPS_HOST` | alamat IP server |
| `VPS_USER` | pengguna yang boleh `sudo`, biasanya `root` |
| `VPS_SSH_KEY` | kunci privat SSH, isi berkasnya |
| `VPS_HOST_KEY` | keluaran `ssh-keyscan <host>` — boleh kosong, tetapi sangat disarankan |

Buat kunci khusus untuk ini, jangan memakai kunci pribadi:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/hita-deploy -C "github-deploy" -N ""
ssh-copy-id -i ~/.ssh/hita-deploy.pub root@ALAMAT-IP
cat ~/.ssh/hita-deploy          # isinya yang ditempel ke VPS_SSH_KEY
ssh-keyscan ALAMAT-IP           # keluarannya ke VPS_HOST_KEY
```

**Pertimbangkan dulu.** Menaruh kunci SSH di GitHub berarti siapa pun yang
bisa masuk ke akun GitHub itu bisa masuk ke server. Untuk satu orang yang
punya akses terminal, menjalankan satu perintah di atas sudah cukup dan lebih
sedikit yang bisa salah. Sengaja pula ia hanya berjalan saat ditekan, bukan
tiap kali ada push: yang memutuskan kapan versi baru naik sebaiknya orang.

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
