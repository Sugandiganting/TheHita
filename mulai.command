#!/bin/bash
#
# The Hita Finance — klik dua kali berkas ini untuk menjalankan aplikasi.
# Berkas akan: memeriksa Node.js, memasang komponen bila perlu, menyiapkan
# database bila belum ada, lalu membuka aplikasi di browser.

cd "$(dirname "$0")" || exit 1

BIRU='\033[1;34m'; HIJAU='\033[1;32m'; MERAH='\033[1;31m'; NORMAL='\033[0m'

echo ""
echo -e "${BIRU}================================================${NORMAL}"
echo -e "${BIRU}  The Hita Finance${NORMAL}"
echo -e "${BIRU}  Akuntansi & Peramalan Kas${NORMAL}"
echo -e "${BIRU}================================================${NORMAL}"
echo ""

# --- 1. Periksa Node.js -------------------------------------------------
if ! command -v node > /dev/null 2>&1; then
  echo -e "${MERAH}Node.js belum terpasang di komputer ini.${NORMAL}"
  echo ""
  echo "  1. Buka https://nodejs.org"
  echo "  2. Unduh versi LTS untuk macOS"
  echo "  3. Pasang seperti aplikasi biasa (klik Next sampai selesai)"
  echo "  4. Tutup jendela ini, lalu klik dua kali berkas ini lagi"
  echo ""
  read -n 1 -s -r -p "Tekan tombol apa saja untuk menutup..."
  exit 1
fi

VERSI=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$VERSI" -lt 20 ]; then
  echo -e "${MERAH}Node.js terlalu lama (versi $(node -v)). Dibutuhkan versi 20 ke atas.${NORMAL}"
  echo "Unduh versi terbaru di https://nodejs.org lalu pasang ulang."
  echo ""
  read -n 1 -s -r -p "Tekan tombol apa saja untuk menutup..."
  exit 1
fi
echo -e "${HIJAU}[OK]${NORMAL} Node.js $(node -v) terdeteksi"

# --- 2. Pasang komponen -------------------------------------------------
if [ ! -d node_modules ]; then
  echo ""
  echo "Memasang komponen yang dibutuhkan (sekali saja, 1-3 menit)..."
  npm install || { echo -e "${MERAH}Pemasangan gagal. Pastikan komputer terhubung internet.${NORMAL}"; read -n 1 -s -r; exit 1; }
  echo -e "${HIJAU}[OK]${NORMAL} Komponen terpasang"
else
  echo -e "${HIJAU}[OK]${NORMAL} Komponen sudah terpasang"
fi

# --- 3. Siapkan konfigurasi & database ----------------------------------
[ -f .env ] || cp .env.example .env

if [ ! -f prisma/hita.db ]; then
  echo ""
  echo "Menyiapkan database untuk pertama kali..."
  npm run setup || { echo -e "${MERAH}Penyiapan database gagal.${NORMAL}"; read -n 1 -s -r; exit 1; }
  echo -e "${HIJAU}[OK]${NORMAL} Database siap"
else
  echo -e "${HIJAU}[OK]${NORMAL} Database ditemukan — data Anda aman"
  npx prisma generate > /dev/null 2>&1
fi

# --- 4. Jalankan --------------------------------------------------------
echo ""
echo "Menjalankan aplikasi..."

# Tunggu sampai aplikasi siap, baru buka browser.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null http://localhost:3000; then
      open http://localhost:3000
      break
    fi
    sleep 1
  done
) &

echo ""
echo -e "${BIRU}------------------------------------------------${NORMAL}"
echo -e "  Aplikasi terbuka di browser secara otomatis."
echo -e "  Bila tidak terbuka, ketik alamat ini di Safari/Chrome:"
echo -e "  ${HIJAU}http://localhost:3000${NORMAL}"
echo ""
echo -e "  ${MERAH}Jangan tutup jendela Terminal ini${NORMAL} selama"
echo -e "  aplikasi dipakai."
echo -e "  Selesai bekerja? Tekan ${HIJAU}Control + C${NORMAL}, lalu tutup jendela."
echo -e "${BIRU}------------------------------------------------${NORMAL}"
echo ""

npm run dev
