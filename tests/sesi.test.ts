import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { UMUR_SESI_HARI, bacaToken, buatToken } from '../src/lib/sesi';
import { cocokKataSandi, sidikKataSandi } from '../src/lib/auth';
import { catatGagal, lupakan, sisaKunci } from '../src/lib/gembok';

// Kuncinya dibaca saat fungsinya dipanggil, bukan saat berkasnya dimuat, jadi
// menetapkannya di sini sudah cukup.
process.env.AUTH_SECRET = 'kunci-uji-yang-cukup-panjang-123456';

const orang = { id: 'u1', username: 'admin', name: 'Sugandi' };

test('token yang dibuat bisa dibaca kembali', async () => {
  const sesi = await bacaToken(await buatToken(orang));
  assert.equal(sesi?.id, 'u1');
  assert.equal(sesi?.username, 'admin');
  assert.equal(sesi?.name, 'Sugandi');
});

test('token berakhir sesuai umur sesi', async () => {
  const sesi = await bacaToken(await buatToken(orang));
  const hari = (sesi!.exp - Date.now()) / 86_400_000;
  assert.ok(Math.abs(hari - UMUR_SESI_HARI) < 0.01);
});

test('isi yang diutak-atik membuat tandanya tidak cocok lagi', async () => {
  const token = await buatToken(orang);
  const [data, sig] = token.split('.');

  // Mengganti id di dalam muatan, tanda tangannya dibiarkan apa adanya.
  const isi = JSON.parse(Buffer.from(data, 'base64url').toString());
  isi.id = 'u2';
  const palsu = `${Buffer.from(JSON.stringify(isi)).toString('base64url')}.${sig}`;

  assert.equal(await bacaToken(palsu), null);
});

test('token yang sudah kedaluwarsa ditolak', async () => {
  const isi = { ...orang, exp: Date.now() - 1000 };
  const data = Buffer.from(JSON.stringify(isi)).toString('base64url');
  // Ditandatangani dengan benar — yang salah hanya waktunya.
  const token = await buatToken(orang);
  const sigBenar = token.split('.')[1];
  assert.equal(await bacaToken(`${data}.${sigBenar}`), null);
});

test('token kosong, rusak, atau tanpa tanda tangan ditolak', async () => {
  assert.equal(await bacaToken(undefined), null);
  assert.equal(await bacaToken(''), null);
  assert.equal(await bacaToken('bukan-token'), null);
  assert.equal(await bacaToken('a.b'), null);
});

test('token yang ditandatangani kunci lain ditolak', async () => {
  const token = await buatToken(orang);
  const asli = process.env.AUTH_SECRET;
  try {
    process.env.AUTH_SECRET = 'kunci-lain-yang-juga-cukup-panjang';
    assert.equal(await bacaToken(token), null);
  } finally {
    process.env.AUTH_SECRET = asli;
  }
});

test('kata sandi tidak pernah tersimpan sebagai teks biasa', async () => {
  const sidik = await sidikKataSandi('rahasia-sekali');
  assert.ok(sidik.startsWith('scrypt:'));
  assert.ok(!sidik.includes('rahasia-sekali'));
});

test('sidik kata sandi yang sama selalu berbeda karena garamnya acak', async () => {
  assert.notEqual(await sidikKataSandi('sama'), await sidikKataSandi('sama'));
});

test('kata sandi benar cocok, yang salah tidak', async () => {
  const sidik = await sidikKataSandi('kata-sandi-benar');
  assert.equal(await cocokKataSandi('kata-sandi-benar', sidik), true);
  assert.equal(await cocokKataSandi('kata-sandi-salah', sidik), false);
  assert.equal(await cocokKataSandi('', sidik), false);
});

test('sidik yang bentuknya rusak tidak pernah dianggap cocok', async () => {
  assert.equal(await cocokKataSandi('apa pun', 'bukan-sidik'), false);
  assert.equal(await cocokKataSandi('apa pun', 'scrypt:'), false);
  assert.equal(await cocokKataSandi('apa pun', ''), false);
});

test('percobaan masuk dibatasi per alamat', () => {
  const alamat = '203.0.113.7';

  assert.equal(sisaKunci(alamat), 0);
  for (let i = 0; i < 9; i += 1) catatGagal(alamat);
  assert.equal(sisaKunci(alamat), 0, 'sembilan kali masih boleh');

  catatGagal(alamat);
  assert.ok(sisaKunci(alamat) > 0, 'sepuluh kali terkunci');

  // Alamat lain tidak ikut terkunci — kalau ikut, satu penebak bisa
  // mengunci seluruh kantor.
  assert.equal(sisaKunci('203.0.113.8'), 0);

  lupakan(alamat);
  assert.equal(sisaKunci(alamat), 0, 'masuk yang berhasil menghapus hitungannya');
});
