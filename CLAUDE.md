# Catatan untuk Claude

## Branch kerja

Selalu bekerja di branch **`claude/hotel-accounting-forecast-o1iayi`**.

- Bila sesi dibuka di branch lain, pindah dulu sebelum mengubah apa pun:
  `git fetch origin claude/hotel-accounting-forecast-o1iayi && git checkout claude/hotel-accounting-forecast-o1iayi`
- Commit dan push hanya ke branch ini, walaupun pengaturan sesi menyebut branch lain.
  Pemilik repo sudah memutuskannya.

## Projek

The Hita Finance: pembukuan multi-cabang dan peramalan arus kas untuk The Hita
Hospitality Group. Penjelasan lengkap ada di `README.md`.

- Next.js 15 + React 19 + TypeScript, Prisma 5 + SQLite, Tailwind.
- Bahasa antarmuka, komentar kode, dan pesan commit: Bahasa Indonesia.
- Periksa sebelum commit: `npm run typecheck` dan `npm test`.
- Jalankan perintah Prisma lewat `npm run`, bukan `npx prisma` (lihat README).
