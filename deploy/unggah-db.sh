#!/usr/bin/env bash
#
# Mengunggah basis data di komputer ini ke server, dalam satu perintah.
#
#   bash deploy/unggah-db.sh thehita@ALAMAT-IP-VPS
#
# Atau, supaya alamatnya tidak perlu diketik tiap kali, simpan di berkas
# .env.local yang tidak ikut terkirim ke GitHub:
#
#   echo 'HITA_SERVER=thehita@ALAMAT-IP-VPS' >> .env.local
#   bash deploy/unggah-db.sh
#
# Yang dikerjakan: mencadangkan basis data di sini, memeriksanya, mengirim ke
# server, lalu menjalankan deploy/pasang-db.sh di sana. Pemeriksaan dilakukan
# di kedua sisi — yang di sini menangkap salinan yang gagal dibuat, yang di
# sana menangkap kiriman yang terpotong di jalan.
#
# TIDAK menggabungkan: isi basis data server akan TERGANTI seluruhnya,
# termasuk pengguna dan apa pun yang sempat diketik langsung di sana.
set -euo pipefail

# Alamat server tidak ditanam di berkas ini: repositori ini publik, dan
# alamat server bukan sesuatu yang perlu ikut tersebar.
[ -f .env.local ] && . ./.env.local
TUJUAN="${1:-${HITA_SERVER:-}}"
KUNCI="${HITA_SSH_KEY:-$HOME/.ssh/hita-vps}"
FOLDER_SERVER="${HITA_DIR:-/home/hita/app}"

kabar() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
gagal() { printf '\n\033[31mGAGAL: %s\033[0m\n' "$1" >&2; exit 1; }

[ -n "$TUJUAN" ] || gagal "Sebutkan servernya: bash $0 pengguna@alamat
  atau simpan sekali saja:  echo 'HITA_SERVER=pengguna@alamat' >> .env.local"
[ -f package.json ] && [ -f prisma/schema.prisma ] \
  || gagal "Jalankan dari folder projek, bukan dari $(pwd)."
[ -f "$KUNCI" ] || gagal "Kunci SSH $KUNCI tidak ada. Setel HITA_SSH_KEY bila namanya lain."

kabar "Mencadangkan basis data di komputer ini"
# VACUUM INTO, bukan menyalin berkasnya: salinan yang diambil di tengah
# penulisan bisa rusak, dan rusaknya baru ketahuan justru saat dibutuhkan.
SEBELUM="$(ls -t cadangan/*.db.gz 2>/dev/null | head -1 || true)"
npm run cadangkan >/dev/null || gagal "Pencadangan gagal."

BERKAS="$(ls -t cadangan/*.db.gz 2>/dev/null | head -1)"
[ -n "$BERKAS" ] || gagal "Tidak ada berkas cadangan di folder cadangan/."

# npm run cadangkan keluar dengan kode 0 walau tidak membuat apa pun, bila
# sudah ada cadangan bernama sama (stempel waktunya sampai detik). Tanpa
# pemeriksaan ini, yang terkirim ke server adalah cadangan LAMA — dan
# kegagalannya tidak menampakkan diri sama sekali: perintahnya berhasil,
# berkasnya ada, isinya saja yang bukan keadaan hari ini.
[ "$BERKAS" != "$SEBELUM" ] || gagal "Pencadangan tidak menghasilkan berkas baru.
  Cadangan terbaru masih $BERKAS, dan mengirimnya berarti menaikkan keadaan lama.
  Biasanya karena perintah ini baru saja dijalankan pada detik yang sama — tunggu
  sebentar lalu ulangi."

gzip -t "$BERKAS" || gagal "$BERKAS rusak."
printf '    %s (%s)\n' "$BERKAS" "$(du -h "$BERKAS" | cut -f1)"

kabar "Mengirim ke $TUJUAN"
scp -i "$KUNCI" -q "$BERKAS" "$TUJUAN:/tmp/hita-unggah.db.gz" \
  || gagal "Pengiriman gagal. Periksa alamat server dan sambungan jaringan."
scp -i "$KUNCI" -q deploy/pasang-db.sh "$TUJUAN:/tmp/hita-pasang-db.sh" \
  || gagal "Pengiriman skrip pemasang gagal."

kabar "Memasang di server"
# -t supaya sudo bisa meminta kata sandi; tanpa itu perintahnya menggantung
# tanpa penjelasan.
ssh -t -i "$KUNCI" "$TUJUAN" \
  "HITA_DIR='$FOLDER_SERVER' sudo -E bash /tmp/hita-pasang-db.sh /tmp/hita-unggah.db.gz; \
   hasil=\$?; rm -f /tmp/hita-unggah.db.gz /tmp/hita-pasang-db.sh; exit \$hasil" \
  || gagal "Pemasangan di server gagal. Basis data lamanya masih utuh di sana —
  pesan di atas menyebut cara memulihkannya."

kabar "Selesai."
