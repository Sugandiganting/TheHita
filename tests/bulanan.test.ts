import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { barisBulan } from '../src/lib/bulanan';

const jt = (n: number) => n * 1_000_000;

/** Proyeksi tetap, supaya yang diuji penyusunannya bukan pola musimnya. */
const proyeksi = () => ({ PESIMIS: jt(333), NORMAL: jt(366), OPTIMIS: jt(418) });

const pokok = {
  period: '2026-10',
  mundur: 3,
  maju: 5,
  proyeksi,
  laporan: [
    { period: '2026-08', masuk: jt(300), hari: 31 },
    { period: '2026-09', masuk: jt(340), hari: 28 },
  ],
  jurnal: [{ period: '2026-07', cashIn: jt(280) }],
  masukBulanIni: jt(291),
  hariBulanIni: 23,
};

test('barisnya terbentang dari beberapa bulan lalu sampai beberapa bulan depan', () => {
  const b = barisBulan(pokok);
  assert.equal(b.length, 9);
  assert.equal(b[0].period, '2026-07');
  assert.equal(b[3].period, '2026-10');
  assert.equal(b[8].period, '2027-03');
  assert.deepEqual(
    b.map((x) => x.posisi),
    ['LALU', 'LALU', 'LALU', 'INI', 'DEPAN', 'DEPAN', 'DEPAN', 'DEPAN', 'DEPAN'],
  );
});

test('tiga lapis proyeksi berjumlah sama dengan proyeksi tertinggi', () => {
  const b = barisBulan(pokok)[0];
  assert.equal(b.lapisPesimis, jt(333));
  assert.equal(b.lapisNormal, jt(33), 'selisih pesimis ke normal');
  assert.equal(b.lapisOptimis, jt(52), 'selisih normal ke optimis');
  assert.equal(b.lapisPesimis + b.lapisNormal + b.lapisOptimis, jt(418));
});

test('proyeksi yang tertukar urutannya tidak membuat lapisnya negatif', () => {
  // Sheet optimis yang tertinggal diperbarui: optimis di bawah normal.
  const janggal = () => ({ PESIMIS: jt(350), NORMAL: jt(391), OPTIMIS: jt(387) });
  const b = barisBulan({ ...pokok, proyeksi: janggal })[0];

  assert.ok(b.lapisPesimis >= 0 && b.lapisNormal >= 0 && b.lapisOptimis >= 0);
  assert.equal(
    b.lapisPesimis + b.lapisNormal + b.lapisOptimis,
    jt(391),
    'tingginya tetap sama dengan yang tertinggi',
  );
});

test('bulan lalu memakai laporan posisi kas, dan jurnal hanya bila tidak ada laporan', () => {
  const b = barisBulan(pokok);
  const juli = b.find((x) => x.period === '2026-07')!;
  const agustus = b.find((x) => x.period === '2026-08')!;
  const september = b.find((x) => x.period === '2026-09')!;

  assert.equal(agustus.masuk, jt(300));
  assert.equal(agustus.hariMasuk, 31);
  assert.equal(september.hariMasuk, 28, 'laporan terakhir September baru tanggal 28');
  assert.equal(juli.masuk, jt(280), 'Juli tidak punya laporan, jadi memakai jurnal');
  assert.equal(juli.hariMasuk, null, 'angka jurnal tidak membawa jumlah hari');
});

test('bulan depan belum punya kenyataan apa pun', () => {
  for (const b of barisBulan(pokok).filter((x) => x.posisi === 'DEPAN')) {
    assert.equal(b.masuk, null);
    assert.equal(b.perkiraanSisa, null);
  }
});

test('bulan berjalan membawa yang sudah masuk beserta perkiraan sisanya', () => {
  const ini = barisBulan(pokok).find((b) => b.posisi === 'INI')!;
  assert.equal(ini.masuk, jt(291));
  assert.equal(ini.hariMasuk, 23);
  assert.equal(ini.perkiraanSisa, jt(75), '366 dikurangi 291');
  assert.equal(ini.masuk! + ini.perkiraanSisa!, jt(366), 'tingginya sampai proyeksi normal');
});

test('uang masuk yang sudah melampaui proyeksi tidak menyisakan perkiraan negatif', () => {
  const ini = barisBulan({ ...pokok, masukBulanIni: jt(400) }).find((b) => b.posisi === 'INI')!;
  assert.equal(ini.perkiraanSisa, 0);
});

test('bulan berjalan tanpa laporan tidak dikarang angkanya', () => {
  const ini = barisBulan({ ...pokok, masukBulanIni: null, hariBulanIni: null })
    .find((b) => b.posisi === 'INI')!;
  assert.equal(ini.masuk, null);
  assert.equal(ini.perkiraanSisa, null);
});

test('bulan lalu yang laporannya nol dilewati ke jurnal', () => {
  const b = barisBulan({
    ...pokok,
    laporan: [{ period: '2026-09', masuk: 0, hari: 20 }],
    jurnal: [{ period: '2026-09', cashIn: jt(310) }],
  }).find((x) => x.period === '2026-09')!;
  assert.equal(b.masuk, jt(310));
});
