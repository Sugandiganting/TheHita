import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { batangTren, hariDalamBulan, hitungTren } from '../src/lib/tren-masuk';

const jt = (n: number) => n * 1_000_000;
const keJt = (n: number) => Math.round(n / 100_000) / 10;

/** Angka Oktober 2026 yang sebenarnya. */
const proyeksi = { PESIMIS: 349_978_638, NORMAL: 391_444_224, OPTIMIS: 387_290_080 };

test('jumlah hari dibaca dari periodenya, termasuk Februari kabisat', () => {
  assert.equal(hariDalamBulan('2026-10'), 31);
  assert.equal(hariDalamBulan('2026-11'), 30);
  assert.equal(hariDalamBulan('2026-02'), 28);
  assert.equal(hariDalamBulan('2028-02'), 29);
});

test('laju ditarik lurus sampai akhir bulan', () => {
  // Setengah bulan, setengah dari proyeksi normal -> tepat di normal.
  const t = hitungTren('2026-10', [{ hari: 16, masuk: proyeksi.NORMAL / 2 }], proyeksi)!;
  assert.equal(keJt(t.lajuAkhirBulan), keJt((proyeksi.NORMAL / 2) * (31 / 16)));
  assert.equal(t.porsiHari, 16 / 31);
});

test('yang terdekat diukur dari selisih, bukan dari urutan skenario', () => {
  const dekatPesimis = hitungTren('2026-10', [{ hari: 31, masuk: jt(350) }], proyeksi)!;
  assert.equal(dekatPesimis.terdekat, 'PESIMIS');

  const dekatNormal = hitungTren('2026-10', [{ hari: 31, masuk: jt(390) }], proyeksi)!;
  assert.equal(dekatNormal.terdekat, 'NORMAL');
});

test('laju di atas seluruh skenario ditandai DI_ATAS', () => {
  // 12 Oktober, Rp 174,6 jt -> setara Rp 451 jt sebulan, di atas ketiganya.
  const t = hitungTren('2026-10', [{ hari: 12, masuk: 174_593_772 }], proyeksi)!;
  assert.equal(t.posisi, 'DI_ATAS');
  assert.equal(keJt(t.lajuAkhirBulan), 451.0);
  assert.ok(t.selisihNormal > 0, 'lebih cepat daripada yang diperkirakan normal');
});

test('laju di bawah seluruh skenario ditandai DI_BAWAH', () => {
  const t = hitungTren('2026-10', [{ hari: 20, masuk: jt(150) }], proyeksi)!;
  assert.equal(t.posisi, 'DI_BAWAH');
  assert.ok(t.selisihNormal < 0);
});

test('laju di antara dua skenario ditandai DI_DALAM', () => {
  const t = hitungTren('2026-10', [{ hari: 10, masuk: jt(120) }], proyeksi)!;
  assert.equal(t.posisi, 'DI_DALAM');
});

test('rentang dibaca dari nilainya, bukan dari nama skenarionya', () => {
  // Optimis salah ketik lebih rendah daripada pesimis — penilaiannya tidak
  // boleh ikut terbalik.
  const janggal = { PESIMIS: jt(400), NORMAL: jt(380), OPTIMIS: jt(300) };
  const t = hitungTren('2026-10', [{ hari: 31, masuk: jt(500) }], janggal)!;
  assert.equal(t.posisi, 'DI_ATAS');
  assert.equal(hitungTren('2026-10', [{ hari: 31, masuk: jt(200) }], janggal)!.posisi, 'DI_BAWAH');
});

test('laporan diurutkan dan yang tanggalnya mustahil dibuang', () => {
  const t = hitungTren('2026-11', [
    { hari: 20, masuk: jt(200) },
    { hari: 5, masuk: jt(50) },
    { hari: 31, masuk: jt(999) }, // November hanya 30 hari
  ], proyeksi)!;
  assert.deepEqual(t.laporan.map((l) => l.hari), [5, 20]);
  assert.equal(t.hariTerakhir, 20);
});

test('tanpa laporan tidak ada tren', () => {
  assert.equal(hitungTren('2026-10', [], proyeksi), null);
  assert.equal(hitungTren('2026-10', [{ hari: 0, masuk: jt(10) }], proyeksi), null);
});

test('capaian membandingkan dengan target sebulan, bukan dengan porsi hari', () => {
  // 12 dari 31 hari = 39% bulan berjalan, tetapi Rp 174,6 jt dari target
  // normal Rp 391,4 jt = 45% tercapai. Dua angka berbeda, dua-duanya benar.
  const t = hitungTren('2026-10', [{ hari: 12, masuk: 174_593_772 }], proyeksi)!;
  const c = t.capaian.NORMAL;

  assert.equal(Math.round(c.persen * 100), 45);
  assert.equal(Math.round(t.porsiHari * 100), 39);
  assert.ok(c.persen > t.porsiHari, 'lebih cepat daripada lajunya');
  assert.equal(keJt(c.kurang), keJt(proyeksi.NORMAL - 174_593_772));
  assert.equal(t.sisaHari, 19);
  assert.equal(keJt(c.perHariSisa), keJt((proyeksi.NORMAL - 174_593_772) / 19));
  assert.equal(c.tercapai, false);
});

test('target yang sudah terlampaui tidak menyisakan kekurangan', () => {
  const t = hitungTren('2026-10', [{ hari: 25, masuk: jt(400) }], proyeksi)!;
  assert.equal(t.capaian.PESIMIS.tercapai, true);
  assert.equal(t.capaian.PESIMIS.kurang, 0);
  assert.equal(t.capaian.PESIMIS.perHariSisa, 0);
  assert.ok(t.capaian.PESIMIS.persen > 1, 'persennya boleh lewat 100%');
});

test('pada hari terakhir bulan, kebutuhan per hari tidak dibagi nol', () => {
  const t = hitungTren('2026-10', [{ hari: 31, masuk: jt(100) }], proyeksi)!;
  assert.equal(t.sisaHari, 0);
  assert.equal(t.capaian.NORMAL.perHariSisa, 0);
  assert.ok(Number.isFinite(t.capaian.NORMAL.perHariSisa));
});

test('batang grafik memecah target jadi bagian berjalan dan sisanya', () => {
  const t = hitungTren('2026-10', [{ hari: 12, masuk: 174_593_772 }], proyeksi)!;
  const batang = batangTren(t);

  assert.deepEqual(batang.map((b) => b.skenario), ['PESIMIS', 'NORMAL', 'OPTIMIS']);

  const normal = batang[1];
  assert.equal(normal.targetSebulan, proyeksi.NORMAL);
  // 12 dari 31 hari: bagian gelapnya 12/31 dari target sebulan.
  assert.equal(keJt(normal.targetKini), keJt((proyeksi.NORMAL * 12) / 31));
  assert.equal(keJt(normal.targetKini + normal.targetSisa), keJt(proyeksi.NORMAL));
});

test('uang masuk sama di ketiga kelompok — satu angka diuji ke tiga target', () => {
  const t = hitungTren('2026-10', [{ hari: 12, masuk: 174_593_772 }], proyeksi)!;
  const batang = batangTren(t);
  assert.deepEqual(new Set(batang.map((b) => b.masuk)), new Set([174_593_772]));
});

test('selisih batang sepakat dengan selisih normal yang dipakai kartu di atasnya', () => {
  const t = hitungTren('2026-10', [{ hari: 12, masuk: 174_593_772 }], proyeksi)!;
  const normal = batangTren(t).find((b) => b.skenario === 'NORMAL')!;
  assert.equal(keJt(normal.selisih), keJt(t.selisihNormal));
  assert.ok(normal.selisih > 0, 'lebih cepat daripada jadwal');
});

test('target yang sudah terlampaui tidak menyisakan batang abu bagian atas', () => {
  const t = hitungTren('2026-10', [{ hari: 31, masuk: jt(400) }], proyeksi)!;
  const pesimis = batangTren(t).find((b) => b.skenario === 'PESIMIS')!;
  assert.equal(pesimis.targetSisa, 0, 'pada hari terakhir seluruh target sudah berjalan');
  assert.ok(pesimis.masuk > pesimis.targetKini);
});
