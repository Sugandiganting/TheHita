// Membuat, mengganti kata sandi, menonaktifkan dan mendaftar pengguna.
//
// Sengaja lewat baris perintah di server, bukan lewat halaman web: selama
// belum ada pembedaan hak akses, halaman "tambah pengguna" di dalam aplikasi
// berarti siapa pun yang sudah masuk bisa membuat akun baru untuk siapa saja.
//
//   npm run pengguna -- tambah <namapengguna> "<Nama Lengkap>" [kata-sandi]
//   npm run pengguna -- sandi  <namapengguna> [kata-sandi]
//   npm run pengguna -- matikan <namapengguna>
//   npm run pengguna -- hidupkan <namapengguna>
//   npm run pengguna -- daftar
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const prisma = new PrismaClient();

async function sidik(kataSandi) {
  const garam = randomBytes(16);
  const hasil = await scrypt(kataSandi, garam, 64);
  return `scrypt:${garam.toString('hex')}:${hasil.toString('hex')}`;
}

/** Kata sandi acak yang masih bisa dibacakan lewat telepon. */
function acak() {
  return randomBytes(9).toString('base64url').replace(/[-_]/g, 'x');
}

function keluar(pesan) {
  console.error(pesan);
  process.exit(1);
}

const [perintah, username, ...sisa] = process.argv.slice(2);
const nama = username?.trim().toLowerCase();

async function main() {
  switch (perintah) {
    case 'tambah': {
      if (!nama || !sisa[0]) keluar('Pemakaian: npm run pengguna -- tambah <namapengguna> "<Nama Lengkap>" [kata-sandi]');
      if (await prisma.user.findUnique({ where: { username: nama } })) keluar(`Pengguna ${nama} sudah ada.`);
      const sandi = sisa[1] ?? acak();
      if (sandi.length < 8) keluar('Kata sandi minimal 8 karakter.');
      await prisma.user.create({ data: { username: nama, name: sisa[0], password: await sidik(sandi) } });
      console.log(`Pengguna dibuat.\n  nama pengguna : ${nama}\n  kata sandi    : ${sandi}`);
      console.log('\nCatat kata sandinya sekarang — tidak bisa ditampilkan lagi.');
      break;
    }
    case 'sandi': {
      if (!nama) keluar('Pemakaian: npm run pengguna -- sandi <namapengguna> [kata-sandi]');
      const ada = await prisma.user.findUnique({ where: { username: nama } });
      if (!ada) keluar(`Pengguna ${nama} tidak ditemukan.`);
      const sandi = sisa[0] ?? acak();
      if (sandi.length < 8) keluar('Kata sandi minimal 8 karakter.');
      await prisma.user.update({ where: { username: nama }, data: { password: await sidik(sandi) } });
      console.log(`Kata sandi ${nama} diganti menjadi: ${sandi}`);
      break;
    }
    case 'matikan':
    case 'hidupkan': {
      if (!nama) keluar(`Pemakaian: npm run pengguna -- ${perintah} <namapengguna>`);
      const aktif = perintah === 'hidupkan';
      const ada = await prisma.user.findUnique({ where: { username: nama } });
      if (!ada) keluar(`Pengguna ${nama} tidak ditemukan.`);
      await prisma.user.update({ where: { username: nama }, data: { active: aktif } });
      console.log(`${nama} ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`);
      if (!aktif) console.log('Sesinya yang sedang berjalan baru putus setelah kedaluwarsa, atau setelah AUTH_SECRET diganti.');
      break;
    }
    case 'daftar': {
      const semua = await prisma.user.findMany({ orderBy: { username: 'asc' } });
      if (semua.length === 0) {
        console.log('Belum ada pengguna. Buat yang pertama dengan:\n  npm run pengguna -- tambah admin "Nama Anda"');
        break;
      }
      for (const u of semua) {
        const masuk = u.lastLogin ? u.lastLogin.toISOString().slice(0, 10) : 'belum pernah';
        console.log(`${u.active ? '  ' : '✗ '}${u.username.padEnd(16)} ${u.name.padEnd(24)} masuk terakhir: ${masuk}`);
      }
      break;
    }
    default:
      keluar([
        'Perintah tidak dikenal.',
        '',
        '  npm run pengguna -- tambah <namapengguna> "<Nama Lengkap>" [kata-sandi]',
        '  npm run pengguna -- sandi  <namapengguna> [kata-sandi]',
        '  npm run pengguna -- matikan <namapengguna>',
        '  npm run pengguna -- hidupkan <namapengguna>',
        '  npm run pengguna -- daftar',
      ].join('\n'));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
