import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  MUSIM_BAWAAN, dasarAcuan, musimAcuan, pengali, polaBervariasi, proyeksiBulan,
  proyeksiMusim, type Musim, type PolaMusim,
} from '../src/lib/musim';

const jt = (n: number) => n * 1_000_000;
const keJt = (n: number) => Math.round(n / 100_000) / 10;

const LOW: Musim = { code: 'LOW', name: 'Low', delta: -25 };
const MID: Musim = { code: 'MID', name: 'Mid', delta: 0 };
const HIGH: Musim = { code: 'HIGH', name: 'High', delta: 30 };

/** Oktober mid, November dan Desember high, Januari low. */
const pola: PolaMusim = new Map([[10, MID], [11, HIGH], [12, HIGH], [1, LOW]]);

test('pengali mengubah persen menjadi faktor', () => {
  assert.equal(pengali(MID), 1);
  assert.equal(pengali(HIGH), 1.3);
  assert.equal(pengali(LOW), 0.75);
  assert.equal(pengali(undefined), 1, 'bulan tanpa musim dianggap acuan');
});

test('bulan acuan menjadikan proyeksinya sendiri sebagai dasar', () => {
  assert.equal(dasarAcuan(jt(391.4), MID), jt(391.4));
});

test('bulan ramai disimpulkan balik ke dasar yang lebih rendah', () => {
  // Oktober high 30% dan bernilai 390 -> dasarnya 300.
  assert.equal(keJt(dasarAcuan(jt(390), HIGH)!), 300);
});

test('musim yang menghapus pendapatan tidak dipakai sebagai pembagi', () => {
  assert.equal(dasarAcuan(jt(100), { code: 'X', name: 'X', delta: -100 }), null);
  assert.equal(dasarAcuan(jt(100), { code: 'X', name: 'X', delta: -150 }), null);
});

test('proyeksi tiap bulan mengikuti musimnya', () => {
  const dasar = dasarAcuan(jt(391.4), MID);
  assert.equal(keJt(proyeksiMusim('2026-11', dasar, pola)!), keJt(jt(391.4) * 1.3));
  assert.equal(keJt(proyeksiMusim('2027-01', dasar, pola)!), keJt(jt(391.4) * 0.75));
});

test('bulan yang sama berulang tiap tahun', () => {
  const dasar = dasarAcuan(jt(391.4), MID);
  assert.equal(proyeksiMusim('2026-11', dasar, pola), proyeksiMusim('2027-11', dasar, pola));
});

test('bulan yang belum diberi musim tidak diramalkan', () => {
  assert.equal(proyeksiMusim('2026-07', dasarAcuan(jt(391.4), MID), pola), null);
});

test('bulan tanpa musim diramalkan sebagai musim acuan', () => {
  // Oktober high 30% bernilai 390 -> dasarnya 300. Juli belum diberi musim,
  // jadi ia 300, bukan ikut 390 seperti bulan berjalan.
  const dasar = dasarAcuan(jt(390), HIGH)!;
  assert.equal(keJt(proyeksiBulan('2026-07', dasar, pola)), 300);
  assert.equal(keJt(proyeksiBulan('2026-11', dasar, pola)), 390, 'bulan bermusim tetap mengikuti musimnya');
});

test('ketika bulan berjalan memang acuan, bulan kosong kebetulan sama dengannya', () => {
  const dasar = dasarAcuan(jt(391.4), MID)!;
  assert.equal(proyeksiBulan('2026-07', dasar, pola), jt(391.4));
});

test('tanpa pola atau tanpa dasar, tidak ada proyeksi musim', () => {
  assert.equal(proyeksiMusim('2026-11', jt(300), new Map()), null);
  assert.equal(proyeksiMusim('2026-11', null, pola), null);
});

test('pola yang seluruh bulannya satu musim dianggap belum berguna', () => {
  const semuaMid: PolaMusim = new Map([[1, MID], [2, MID], [3, MID]]);
  assert.equal(polaBervariasi(semuaMid), false);
  assert.equal(polaBervariasi(new Map()), false);
  assert.equal(polaBervariasi(pola), true);
});

test('musim acuan adalah yang deltanya nol', () => {
  assert.equal(musimAcuan([LOW, MID, HIGH])?.code, 'MID');
  assert.equal(musimAcuan([LOW, HIGH]), undefined);
});

test('musim bawaan punya tepat satu acuan dan kodenya unik', () => {
  assert.equal(MUSIM_BAWAAN.filter((m) => m.delta === 0).length, 1);
  assert.equal(new Set(MUSIM_BAWAAN.map((m) => m.code)).size, MUSIM_BAWAAN.length);
  // Urut dari paling sepi ke paling ramai.
  const delta = MUSIM_BAWAAN.map((m) => m.delta);
  assert.deepEqual(delta, [...delta].sort((a, b) => a - b));
});
