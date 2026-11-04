#!/usr/bin/env bash
#
# Memasang basis data yang sudah diunggah, menggantikan yang sedang dipakai.
#
#   sudo bash /home/hita/app/deploy/pasang-db.sh /tmp/dbbaru.db.gz
#
# Biasanya tidak dipanggil langsung: deploy/unggah-db.sh di komputer kerja
# yang mengirim berkasnya lalu menjalankan ini. Dipisah supaya tetap bisa
# dipakai sendiri bila berkasnya sampai ke server lewat jalan lain.
#
# Urutannya disengaja. Berkasnya diperiksa dan dibuka LEBIH DULU, selagi
# aplikasi masih melayani; layanan baru dihentikan setelah semuanya terbukti
# baik. Kalau berkasnya rusak, kegagalannya terjadi sebelum ada yang mati.
set -euo pipefail

SUMBER="${1:-}"
PENGGUNA="${HITA_USER:-hita}"
FOLDER="${HITA_DIR:-/home/$PENGGUNA/app}"
LAYANAN="${HITA_SERVICE:-hita}"
CADANGAN="${HITA_BACKUP_DIR:-/home/$PENGGUNA/cadangan}"
PERIKSA="${HITA_HEALTH:-http://127.0.0.1:3000/masuk}"
DB="$FOLDER/prisma/hita.db"

kabar() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
gagal() { printf '\n\033[31mGAGAL: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || gagal "Jalankan sebagai root: sudo bash $0 <berkas.db.gz>"
[ -n "$SUMBER" ] || gagal "Sebutkan berkasnya: sudo bash $0 /tmp/dbbaru.db.gz"
[ -f "$SUMBER" ] || gagal "$SUMBER tidak ada."
[ -f "$DB" ] || gagal "$DB tidak ada. Setel HITA_DIR bila foldernya lain."

SEMENTARA="$(mktemp /tmp/hita-masuk.XXXXXX.db)"
SALINAN="$DB.sebelum-ganti"
bersihkan() { rm -f "$SEMENTARA"; }
trap bersihkan EXIT

kabar "Memeriksa berkas yang diunggah"
case "$SUMBER" in
  *.gz) gzip -t "$SUMBER" || gagal "Berkasnya rusak atau terpotong saat dikirim. Ulangi pengirimannya."
        gunzip -c "$SUMBER" > "$SEMENTARA" ;;
  *)    cp "$SUMBER" "$SEMENTARA" ;;
esac

# Berkas SQLite selalu diawali teks ini. Tanpa pemeriksaannya, berkas yang
# salah kirim baru ketahuan setelah aplikasi dinyalakan dengan basis data
# yang tidak bisa dibaca — dan saat itu yang lama sudah tertimpa.
[ "$(head -c 15 "$SEMENTARA")" = "SQLite format 3" ] \
  || gagal "Isinya bukan basis data SQLite. Pastikan yang dikirim berkas dari 'npm run cadangkan'."
printf '    utuh, %s\n' "$(du -h "$SEMENTARA" | cut -f1)"

kabar "Mencadangkan basis data yang sekarang"
su - "$PENGGUNA" -c "cd '$FOLDER' && npm run cadangkan -- '$CADANGAN'" \
  || gagal "Pencadangan gagal — penggantian dihentikan sebelum apa pun berubah."

kabar "Menghentikan layanan"
# Wajib: menimpa berkas SQLite yang sedang dipakai merusak isinya.
systemctl stop "$LAYANAN"

kabar "Mengganti basis data"
cp "$DB" "$SALINAN"
cp "$SEMENTARA" "$DB"
# Catatan sementara milik basis data LAMA. Tertinggal, isinya bertabrakan
# dengan yang baru dan kerusakannya tidak langsung kelihatan.
rm -f "$DB-wal" "$DB-shm"
chown "$PENGGUNA:$PENGGUNA" "$DB"

kabar "Menyalakan kembali"
systemctl start "$LAYANAN"

for _ in $(seq 1 30); do
  sleep 2
  if curl -fsS -o /dev/null "$PERIKSA"; then
    kabar "Selesai — basis data terganti dan aplikasinya melayani lagi."
    echo "    Salinan yang lama: $SALINAN"
    echo "    Membatalkan:"
    echo "      sudo systemctl stop $LAYANAN"
    echo "      sudo cp '$SALINAN' '$DB'"
    echo "      sudo rm -f '$DB-wal' '$DB-shm'"
    echo "      sudo chown $PENGGUNA:$PENGGUNA '$DB'"
    echo "      sudo systemctl start $LAYANAN"
    exit 0
  fi
done

printf '\n\033[31mAplikasinya tidak menjawab setelah 60 detik.\033[0m\n' >&2
echo "Catatan terakhir:" >&2
journalctl -u "$LAYANAN" -n 30 --no-pager >&2 || true
echo >&2
echo "Basis data yang lama masih utuh di $SALINAN. Memulihkannya:" >&2
echo "  sudo systemctl stop $LAYANAN && sudo cp '$SALINAN' '$DB' \\" >&2
echo "    && sudo rm -f '$DB-wal' '$DB-shm' \\" >&2
echo "    && sudo chown $PENGGUNA:$PENGGUNA '$DB' && sudo systemctl start $LAYANAN" >&2
exit 1
