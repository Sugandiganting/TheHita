// Menjalankan aplikasi dalam mode produksi, menyusun ulang hanya bila perlu.
//
// `npm run dev` menyusun tiap halaman saat pertama dibuka — berguna saat
// mengubah kode, tetapi untuk yang memakai aplikasinya itu berarti menunggu
// beberapa detik tiap kali berpindah menu, dan belasan detik saat pertama
// menyala. Mode produksi melayani halaman yang sudah jadi, puluhan kali lebih
// cepat, dengan harga satu kali penyusunan.
//
// Penyusunan itu hanya diulang bila ada berkas sumber yang lebih baru daripada
// hasil susunan sebelumnya, sehingga menyalakan aplikasi dua kali berturut-turut
// tidak membayar harganya dua kali.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = dirname(dirname(fileURLToPath(import.meta.url)));

/** Berkas yang perubahannya membuat hasil susunan tidak berlaku lagi. */
const SUMBER = ['src', 'prisma/schema.prisma', 'package.json', 'next.config.mjs',
  'tailwind.config.ts', 'postcss.config.mjs', 'tsconfig.json'];

function terbaru(path) {
  let s;
  try {
    s = statSync(path);
  } catch {
    return 0;
  }
  if (!s.isDirectory()) return s.mtimeMs;
  let maks = s.mtimeMs;
  for (const nama of readdirSync(path)) {
    maks = Math.max(maks, terbaru(join(path, nama)));
  }
  return maks;
}

const hasil = terbaru(join(akar, '.next', 'BUILD_ID'));
const sumber = Math.max(...SUMBER.map((p) => terbaru(join(akar, p))));

if (hasil === 0 || sumber > hasil) {
  console.log(hasil === 0
    ? 'Menyusun aplikasi untuk pertama kali — sekali ini saja, sekitar setengah menit…'
    : 'Ada perubahan kode, menyusun ulang…');
  execFileSync('npm', ['run', 'build'], { cwd: akar, stdio: 'inherit' });
} else {
  console.log('Hasil susunan masih berlaku, langsung dijalankan.');
}

execFileSync('npm', ['start'], { cwd: akar, stdio: 'inherit' });
