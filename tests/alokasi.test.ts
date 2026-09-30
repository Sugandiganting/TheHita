import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocateByWeight, round } from '../src/lib/accounting.ts';

/**
 * Pembagian beban bersama. Beban seperti gaji management di GuestPro tidak
 * bertanda cabang, jadi harus dibagi sendiri. Yang paling penting: jumlah hasil
 * bagi wajib persis sama dengan nominal aslinya, kalau tidak jurnalnya selisih
 * beberapa rupiah dan ditolak saat impor.
 */

const jumlah = (m: Map<string, number>) => round([...m.values()].reduce((a, b) => a + b, 0));

test('beban dibagi sebanding bobot', () => {
  const hasil = allocateByWeight(1000, new Map([['THL', 750], ['SKR', 250]]));
  assert.equal(hasil.get('THL'), 750);
  assert.equal(hasil.get('SKR'), 250);
});

test('bobot sama besar berarti bagi rata', () => {
  const hasil = allocateByWeight(900, new Map([['THL', 1], ['SKR', 1], ['PLD', 1]]));
  assert.deepEqual([...hasil.values()], [300, 300, 300]);
});

test('sisa pembulatan tidak hilang, ditaruh pada penerima terbesar', () => {
  // 100 dibagi tiga bobot 2:1:1 -> 50 + 25 + 25, pas. Yang menyisakan pecahan
  // adalah bobot yang tidak habis dibagi: 2:1:1 atas 100,01.
  const hasil = allocateByWeight(100, new Map([['A', 2], ['B', 1], ['C', 1], ['D', 1], ['E', 1]]));
  // 100 * 2/6 = 33,33 dan 100 * 1/6 = 16,67 -> 33,33 + 16,67*4 = 100,01, lebih 0,01.
  assert.equal(jumlah(hasil), 100);
  assert.equal(hasil.get('A'), 33.32);
});

test('jumlah hasil bagi selalu utuh untuk angka beban sungguhan', () => {
  // Beban bersama Januari 2026 dan pendapatan tiap cabang bulan itu.
  const bobot = new Map([['THL', 150904126.4], ['SKR', 42504876.75]]);
  for (const nominal of [26377602, 22373705, 14717801, 3630900, 5623300, 233000,
    360222.83, 229700, 140000, 95000, 173000, 228000]) {
    const hasil = allocateByWeight(nominal, bobot);
    assert.equal(jumlah(hasil), round(nominal), `nominal ${nominal} tidak utuh`);
  }
});

test('cabang tanpa pendapatan tidak menanggung beban bersama', () => {
  // Play Laundry belum berpendapatan pada Januari, jadi tidak ikut menanggung.
  const hasil = allocateByWeight(1000, new Map([['THL', 800], ['SKR', 200], ['PLD', 0]]));
  assert.equal(hasil.has('PLD'), false);
  assert.equal(jumlah(hasil), 1000);
});

test('tanpa bobot yang berarti hasilnya kosong, bukan bagi nol', () => {
  assert.equal(allocateByWeight(1000, new Map()).size, 0);
  assert.equal(allocateByWeight(1000, new Map([['THL', 0], ['SKR', 0]])).size, 0);
});

test('nominal nol tetap berjumlah nol', () => {
  const hasil = allocateByWeight(0, new Map([['THL', 800], ['SKR', 200]]));
  assert.equal(jumlah(hasil), 0);
});
