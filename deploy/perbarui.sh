#!/usr/bin/env bash
#
# Memperbarui The Hita Finance yang sudah berjalan di VPS, dalam satu perintah.
#
#   sudo bash /home/hita/app/deploy/perbarui.sh
#
# Urutannya disengaja: dicadangkan dulu, baru ditarik, baru dibangun, dan
# layanannya hanya dinyalakan ulang bila pembangunannya berhasil. Kalau
# pembangunan gagal, versi lama tetap melayani karena prosesnya belum
# disentuh — jadi kegagalan di tengah tidak pernah membuat aplikasinya mati.
#
# Folder dan nama layanan bisa diubah lewat peubah lingkungan bila
# pemasangannya tidak mengikuti DEPLOY.md:
#
#   HITA_USER=hita HITA_DIR=/home/hita/app HITA_SERVICE=hita sudo -E bash ...
set -euo pipefail

PENGGUNA="${HITA_USER:-hita}"
FOLDER="${HITA_DIR:-/home/$PENGGUNA/app}"
LAYANAN="${HITA_SERVICE:-hita}"
PERIKSA="${HITA_HEALTH:-http://127.0.0.1:3000/masuk}"
CADANGAN="${HITA_BACKUP_DIR:-/home/$PENGGUNA/cadangan}"

sebagai_app() { su - "$PENGGUNA" -c "cd '$FOLDER' && $1"; }
kabar() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
gagal() { printf '\n\033[31mGAGAL: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || gagal "Jalankan sebagai root: sudo bash $0"
[ -d "$FOLDER/.git" ] || gagal "$FOLDER bukan salinan git. Setel HITA_DIR bila foldernya lain."

kabar "Mencadangkan basis data"
sebagai_app "npm run cadangkan -- '$CADANGAN'" || gagal "Pencadangan gagal — pembaruan dihentikan sebelum apa pun berubah."

SEBELUM="$(git -C "$FOLDER" rev-parse HEAD)"
CABANG="$(git -C "$FOLDER" rev-parse --abbrev-ref HEAD)"

kabar "Mengambil versi terbaru ($CABANG)"
sebagai_app "git fetch --quiet origin '$CABANG'"
SESUDAH="$(git -C "$FOLDER" rev-parse "origin/$CABANG")"

if [ "$SEBELUM" = "$SESUDAH" ] && [ "${1:-}" != "--paksa" ]; then
  kabar "Sudah versi terbaru — tidak ada yang perlu dikerjakan."
  echo "Pakai --paksa untuk tetap membangun ulang."
  exit 0
fi

# --ff-only, bukan reset --hard: kalau ada yang pernah menyunting berkas di
# server, perintah ini berhenti dan mengeluh alih-alih membuang suntingannya
# diam-diam. Berkas .env dan basis datanya sendiri tidak diikuti git.
sebagai_app "git pull --ff-only --quiet origin '$CABANG'" \
  || gagal "git pull ditolak. Periksa 'git -C $FOLDER status' — mungkin ada berkas yang disunting di server."

kabar "Memasang pustaka"
# Bukan --omit=dev: tailwind, typescript dan prisma ada di devDependencies, dan
# ketiganya dibutuhkan saat membangun.
sebagai_app "npm ci" || gagal "npm ci gagal. Aplikasi lama masih berjalan."

# Membangun sekaligus menyamakan struktur basis data dengan skema terbaru —
# langkah itu sudah menempel pada "prebuild", jadi penambahan tabel atau kolom
# tidak perlu diingat sendiri.
kabar "Membangun"
if ! sebagai_app "npm run build"; then
  printf '\n\033[31mPembangunan gagal. Layanan TIDAK dinyalakan ulang, versi lama masih melayani.\033[0m\n' >&2
  echo "Untuk kembali ke versi sebelumnya:" >&2
  echo "  su - $PENGGUNA -c \"cd $FOLDER && git reset --hard $SEBELUM && npm ci && npm run build\"" >&2
  exit 1
fi

kabar "Menyalakan ulang layanan"
systemctl restart "$LAYANAN"

kabar "Memeriksa"
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null "$PERIKSA"; then
    git -C "$FOLDER" --no-pager log --oneline "$SEBELUM..$SESUDAH" | sed 's/^/  /' || true
    printf '\n\033[32mSelesai. Aplikasi berjalan pada versi %s.\033[0m\n' "$(git -C "$FOLDER" rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done

printf '\n\033[31mAplikasi tidak menjawab di %s.\033[0m\n' "$PERIKSA" >&2
journalctl -u "$LAYANAN" -n 30 --no-pager >&2
echo >&2
echo "Untuk kembali ke versi sebelumnya:" >&2
echo "  su - $PENGGUNA -c \"cd $FOLDER && git reset --hard $SEBELUM && npm ci && npm run build\" && systemctl restart $LAYANAN" >&2
exit 1
