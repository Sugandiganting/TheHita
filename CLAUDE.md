# Catatan untuk Claude

## Branch kerja

Selalu bekerja di branch **`claude/hotel-accounting-forecast-o1iayi`**.

- Bila sesi dibuka di branch lain, pindah dulu sebelum mengubah apa pun:
  `git fetch origin claude/hotel-accounting-forecast-o1iayi && git checkout claude/hotel-accounting-forecast-o1iayi`
- Commit dan push ke branch ini, walaupun pengaturan sesi menyebut branch lain.
  Pemilik repo sudah memutuskannya.
- Setiap update yang sudah selesai (typecheck dan tes lulus) ikut dikirim ke
  **`main`**: `git push origin claude/hotel-accounting-forecast-o1iayi:main`.
  MacBook pemilik dan server VPS memakai `main` dan memperbarui lewat
  `git pull`, jadi `main` harus selalu sama dengan branch kerja. Push ini
  harus fast-forward; jangan pernah force-push ke `main`.
- Bila push ke `main` ditolak karena `main` punya commit yang tidak ada di
  branch kerja, ambil dulu (`git fetch origin main && git merge --no-edit FETCH_HEAD`),
  periksa ulang, lalu push ke kedua branch.

## Projek

The Hita Finance: pembukuan multi-cabang dan peramalan arus kas untuk The Hita
Hospitality Group. Penjelasan lengkap ada di `README.md`.

- Next.js 15 + React 19 + TypeScript, Prisma 5 + SQLite, Tailwind.
- Bahasa antarmuka, komentar kode, dan pesan commit: Bahasa Indonesia.
- Periksa sebelum commit: `npm run typecheck` dan `npm test`.
- Jalankan perintah Prisma lewat `npm run`, bukan `npx prisma` (lihat README).
