/**
 * Titik masuk untuk Phusion Passenger — menu "Setup Node.js App" di cPanel.
 *
 * Di server biasa aplikasinya dijalankan dengan "npm start". Di hosting cPanel
 * tidak ada yang menjalankan perintah: Passenger sendiri yang memanggil berkas
 * ini, menyalakan aplikasinya saat ada kunjungan pertama, dan menyalakannya
 * lagi bila mati. Karena itu berkas ini memakai require biasa, bukan impor
 * ESM, dan tidak boleh mengandalkan skrip "prestart" di package.json yang
 * tidak pernah ikut dijalankan.
 */
const { createServer } = require('node:http');
const { parse } = require('node:url');
const { loadEnvConfig } = require('@next/env');
const next = require('next');

// Berkas .env dimuat sendiri di sini. "next start" melakukannya otomatis,
// tetapi Passenger tidak menjalankan perintah itu — tanpa baris ini Prisma
// menyala tanpa DATABASE_URL dan aplikasinya mati sebelum satu halaman pun
// sempat tampil.
loadEnvConfig(__dirname);

// Passenger menentukan sendiri porta yang dipakainya dan mengabaikan angka di
// bawah ini; nilainya hanya berguna saat berkas ini dicoba di komputer sendiri.
const port = Number(process.env.PORT) || 3000;

const app = next({ dev: false, dir: __dirname });
const tangani = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => tangani(req, res, parse(req.url, true)))
      .listen(port, () => console.log(`[hita] siap melayani di porta ${port}`));
  })
  .catch((e) => {
    // Dicetak supaya muncul di stderr.log aplikasi; tanpa ini kegagalannya
    // hanya terlihat sebagai layar 503 tanpa keterangan apa pun.
    console.error('[hita] gagal menyalakan aplikasi:', e);
    process.exit(1);
  });
