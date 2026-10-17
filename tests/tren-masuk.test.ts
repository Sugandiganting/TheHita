import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hariDalamBulan, hitungTren, titikGrafik } from '../src/lib/tren-masuk';

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

test('titik grafik selalu punya pangkal nol dan ujung akhir bulan', () => {
  const t = hitungTren('2026-10', [{ hari: 12, masuk: 174_593_772 }], proyeksi)!;
  const titik = titikGrafik(t);

  assert.deepEqual(titik.map((p) => p.hari), [0, 12, 31]);
  assert.equal(titik[0].aktual, 0, 'mulai dari nol');
  assert.equal(titik[1].aktual, 174_593_772);
  assert.equal(titik[2].aktual, null, 'akhir bulan belum punya angka aktual');

  // Ujung kanan tiap garis acuan tepat sama dengan proyeksinya.
  assert.equal(keJt(titik[2].normal), keJt(proyeksi.NORMAL));
  assert.equal(keJt(titik[2].pesimis), keJt(proyeksi.PESIMIS));
  assert.equal(titik[0].normal, 0);
});
