import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adaTarget, batasBelanjaMargin, marginTercapai, sebaranDariNormal,
  type PolaTarget, type TargetBulan,
} from '../src/lib/target-bulan.ts';

const target = (o: Partial<TargetBulan> = {}): TargetBulan => ({
  month: 11, cashMargin: null, optimisticUp: null, pessimisticDown: null, ...o,
});

/* ---------------------------------------------------------- batas belanja */

test('margin 15% dari ramalan 400 jt menyisakan belanja 340 jt', () => {
  assert.equal(batasBelanjaMargin(400_000_000, 15), 340_000_000);
});

test('margin 0% membolehkan seluruh uang masuk dibelanjakan', () => {
  assert.equal(batasBelanjaMargin(400_000_000, 0), 400_000_000);
});

test('margin di atas 100% menghasilkan nol, bukan batas negatif', () => {
  // Tidak ada belanja yang kurang daripada tidak belanja sama sekali.
  assert.equal(batasBelanjaMargin(400_000_000, 120), 0);
});

test('target yang belum ditetapkan tidak melahirkan batas', () => {
  // Batas yang dikarang dari angka yang belum ada terbaca sama meyakinkannya
  // dengan batas yang benar — justru itu bahayanya.
  assert.equal(batasBelanjaMargin(400_000_000, null), null);
  assert.equal(batasBelanjaMargin(null, 15), null);
  assert.equal(batasBelanjaMargin(0, 15), null);
});

test('persen negatif ditolak, bukan dibalik jadi menaikkan batas', () => {
  assert.equal(batasBelanjaMargin(400_000_000, -10), null);
});

/* --------------------------------------------------------- margin tercapai */

test('margin tercapai dihitung terhadap uang masuk', () => {
  assert.equal(marginTercapai(400_000_000, 340_000_000), 15);
});

test('belanja melebihi pemasukan menghasilkan margin negatif', () => {
  assert.equal(marginTercapai(400_000_000, 500_000_000), -25);
});

test('bulan tanpa uang masuk belum punya margin, bukan margin nol', () => {
  assert.equal(marginTercapai(0, 50_000_000), null);
});

/* ----------------------------------------------------------------- sebaran */

test('sebaran menaikkan dan menurunkan dari normal yang sama', () => {
  const s = sebaranDariNormal(400_000_000, target({ optimisticUp: 12, pessimisticDown: 8 }));
  assert.equal(s.optimis, 448_000_000);
  assert.equal(s.pesimis, 368_000_000);
});

test('sisi yang persennya belum diisi dikembalikan null, sisi lain tetap jalan', () => {
  const s = sebaranDariNormal(400_000_000, target({ optimisticUp: 12 }));
  assert.equal(s.optimis, 448_000_000);
  assert.equal(s.pesimis, null);
});

test('penurunan 100% atau lebih berhenti di nol', () => {
  assert.equal(sebaranDariNormal(400_000_000, target({ pessimisticDown: 150 })).pesimis, 0);
});

test('optimis tidak pernah jatuh di bawah normal', () => {
  // Inilah sebabnya sebaran dihitung dari normal, bukan diketik sendiri-sendiri:
  // tiga angka yang berdiri terpisah bisa bergerak saling bertentangan.
  for (const naik of [0, 5, 40]) {
    const s = sebaranDariNormal(400_000_000, target({ optimisticUp: naik }));
    assert.ok(s.optimis !== null && s.optimis >= 400_000_000);
  }
});

test('tanpa target sama sekali, kedua sisinya null', () => {
  const s = sebaranDariNormal(400_000_000, undefined);
  assert.equal(s.optimis, null);
  assert.equal(s.pesimis, null);
});

/* ------------------------------------------------------------------- pola */

test('pola yang seluruhnya kosong dianggap belum ditetapkan', () => {
  const pola: PolaTarget = new Map([[1, target()], [2, target({ month: 2 })]]);
  assert.equal(adaTarget(pola), false);
});

test('satu bulan terisi sudah membuat polanya berlaku', () => {
  const pola: PolaTarget = new Map([[1, target()], [2, target({ month: 2, cashMargin: 10 })]]);
  assert.equal(adaTarget(pola), true);
});
