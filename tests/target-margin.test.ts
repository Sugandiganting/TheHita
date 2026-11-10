import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  batasBelanjaDariMargin, golonganMargin, marginTercapai, targetBerurut,
  targetLengkap, targetMasukDariMargin, type TargetMargin,
} from '../src/lib/target-margin.ts';

const target = (p: number, n: number, o: number): TargetMargin =>
  new Map([['PESIMIS', p], ['NORMAL', n], ['OPTIMIS', o]]);

/* ------------------------------------------ ke depan: target uang masuk */

test('belanja 340 jt dengan margin 15% menuntut uang masuk 400 jt', () => {
  assert.equal(targetMasukDariMargin(340_000_000, 15), 400_000_000);
});

test('margin nol menuntut uang masuk persis sebesar belanjanya', () => {
  assert.equal(targetMasukDariMargin(340_000_000, 0), 340_000_000);
});

test('margin negatif menuntut uang masuk lebih kecil daripada belanja', () => {
  // Pesimis −10% memang berarti boleh tekor: belanja 330 jt masih "tercapai"
  // walau yang masuk hanya 300 jt.
  assert.equal(targetMasukDariMargin(330_000_000, -10), 300_000_000);
});

test('margin 100% atau lebih tidak punya uang masuk yang memenuhinya', () => {
  assert.equal(targetMasukDariMargin(340_000_000, 100), null);
  assert.equal(targetMasukDariMargin(340_000_000, 150), null);
});

test('belanja yang belum diketahui tidak melahirkan target', () => {
  assert.equal(targetMasukDariMargin(null, 15), null);
  assert.equal(targetMasukDariMargin(0, 15), null);
});

/* ---------------------------------------- ke samping: batas belanja */

test('uang masuk 400 jt dengan margin 15% membatasi belanja di 340 jt', () => {
  assert.equal(batasBelanjaDariMargin(400_000_000, 15), 340_000_000);
});

test('kedua arah saling membalik tepat', () => {
  // Inilah sebabnya ramalan tidak boleh diisi dari target: kalau iya, kedua
  // arah bertemu di angka yang sama dan batasnya berhenti mengatakan apa pun.
  const masuk = targetMasukDariMargin(340_000_000, 15)!;
  assert.equal(batasBelanjaDariMargin(masuk, 15), 340_000_000);
});

test('margin negatif membolehkan belanja melebihi uang masuk', () => {
  assert.equal(batasBelanjaDariMargin(300_000_000, -10), 330_000_000);
});

/* ------------------------------------------ ke belakang: golongan bulan */

const t = target(-10, 0, 10);

test('margin di atas target optimis tergolong optimis', () => {
  assert.equal(golonganMargin(22.5, t), 'OPTIMIS');
  assert.equal(golonganMargin(10, t), 'OPTIMIS');
});

test('margin di antara normal dan optimis tergolong normal', () => {
  assert.equal(golonganMargin(3.5, t), 'NORMAL');
  assert.equal(golonganMargin(0, t), 'NORMAL');
});

test('margin di antara pesimis dan normal tergolong pesimis', () => {
  assert.equal(golonganMargin(-5, t), 'PESIMIS');
  assert.equal(golonganMargin(-10, t), 'PESIMIS');
});

test('di bawah target pesimis tidak digolongkan pesimis', () => {
  // Bulan seperti itu tidak ada di dalam rencana mana pun. Menyebutnya pesimis
  // akan membuat bulan terburuk terbaca seolah masih terkendali.
  assert.equal(golonganMargin(-18, t), 'DI_BAWAH_PESIMIS');
});

test('target yang belum lengkap tidak menggolongkan apa pun', () => {
  const separuh: TargetMargin = new Map([['PESIMIS', -10], ['NORMAL', 0]]);
  assert.equal(golonganMargin(5, separuh), null);
  assert.equal(golonganMargin(null, t), null);
});

/* ------------------------------------------------------ margin tercapai */

test('margin tercapai dihitung terhadap uang masuk', () => {
  assert.equal(marginTercapai(400_000_000, 340_000_000), 15);
});

test('belanja melebihi pemasukan menghasilkan margin negatif', () => {
  assert.equal(marginTercapai(400_000_000, 500_000_000), -25);
});

test('bulan tanpa uang masuk belum punya margin, bukan margin nol', () => {
  assert.equal(marginTercapai(0, 50_000_000), null);
});

/* ----------------------------------------------------------- urutan */

test('urutan naik diterima, urutan terbalik ditolak', () => {
  assert.equal(targetBerurut(target(-10, 0, 10)), true);
  assert.equal(targetBerurut(target(10, 0, -10)), false);
  assert.equal(targetBerurut(target(0, 0, 10)), false);
});

test('lengkap berarti ketiganya ada', () => {
  assert.equal(targetLengkap(target(-10, 0, 10)), true);
  assert.equal(targetLengkap(new Map([['PESIMIS', -10]])), false);
});
