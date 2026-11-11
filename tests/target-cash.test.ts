import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BAGIAN_KELEBIHAN, pengaliMusim, rantaiTarget, sebaranDariTargetNormal,
  targetBerikutnya, tingkatTercapai,
} from '../src/lib/target-cash.ts';
import type { PolaMusim } from '../src/lib/musim.ts';
import type { PolaTargetMargin, TargetMargin } from '../src/lib/target-margin.ts';
import type { Period } from '../src/lib/period.ts';
import type { Skenario } from '../src/lib/rencana-kas.ts';

const proyeksi = (p: number, n: number, o: number): Record<Skenario, number> =>
  ({ PESIMIS: p, NORMAL: n, OPTIMIS: o });

const pola: PolaMusim = new Map([
  [10, { code: 'MID', name: 'Mid', delta: 0 }],
  [11, { code: 'LOW', name: 'Low', delta: -7.2 }],
  [12, { code: 'HIGH', name: 'High', delta: 30 }],
]);

const margin: TargetMargin = new Map([['PESIMIS', -10], ['NORMAL', 0], ['OPTIMIS', 10]]);

/** Target yang sama untuk tiap bulan, supaya uji rantai memusat pada musimnya. */
const polaMargin: PolaTargetMargin = new Map(
  Array.from({ length: 12 }, (_, i) => [i + 1, margin]),
);

/* ------------------------------------------------- tingkat yang tercapai */

test('tingkat tertinggi yang tercapai yang dipakai, bukan yang terdekat', () => {
  const t = tingkatTercapai(400, proyeksi(300, 350, 380));
  assert.deepEqual(t, { skenario: 'OPTIMIS', t: 380 });
});

test('tepat menyentuh target sudah dihitung tercapai', () => {
  assert.deepEqual(tingkatTercapai(350, proyeksi(300, 350, 380)), { skenario: 'NORMAL', t: 350 });
});

test('di bawah pesimis tidak mencapai tingkat apa pun, dan t jatuh ke pesimis', () => {
  assert.deepEqual(tingkatTercapai(250, proyeksi(300, 350, 380)), { skenario: null, t: 300 });
});

test('proyeksi nol dilewati, bukan dianggap tercapai', () => {
  // Nol bukan target yang pernah ditetapkan seseorang. Kalau ikut dihitung,
  // tiap bulan akan terbaca melampaui targetnya.
  assert.deepEqual(tingkatTercapai(400, proyeksi(300, 350, 0)), { skenario: 'NORMAL', t: 350 });
});

test('tanpa target pesimis, tingkatnya tidak bisa ditentukan', () => {
  assert.equal(tingkatTercapai(400, proyeksi(0, 0, 0)), null);
});

/* ----------------------------------------------------------- satu langkah */

test('separuh kelebihan dibawa ke bulan berikutnya, lalu dikali musim', () => {
  // 400 melampaui target 350 sebesar 50; separuhnya 25.
  // (400 + 25) × 1 = 425
  assert.equal(targetBerikutnya(400, { skenario: 'NORMAL', t: 350 }, 1), 425);
});

test('separuh, bukan seluruhnya', () => {
  assert.equal(BAGIAN_KELEBIHAN, 0.5);
  const penuh = targetBerikutnya(400, { skenario: 'NORMAL', t: 350 }, 1);
  assert.ok(penuh < 450, 'membawa seluruh kelebihan akan menghasilkan 450');
});

test('tepat di target tidak membawa kelebihan apa pun', () => {
  assert.equal(targetBerikutnya(350, { skenario: 'NORMAL', t: 350 }, 1), 350);
});

test('di bawah target kembali ke target, bukan ikut jatuh', () => {
  // Rencana yang menyesuaikan diri ke bawah tanpa dasar berhenti jadi rencana.
  assert.equal(targetBerikutnya(250, { skenario: null, t: 300 }, 1), 300);
});

test('musim dipasang sesudah kelebihannya dihitung, bukan sebelumnya', () => {
  const c = 0.928;
  // Dibulatkan ke sen seperti modul hitung lain; (400 + 25) × c lebih dulu,
  // bukan (400 × c) + 25 — urutan itu yang membedakan 394,40 dari 396,20.
  assert.equal(targetBerikutnya(400, { skenario: 'NORMAL', t: 350 }, c), 394.4);
  assert.notEqual(targetBerikutnya(400, { skenario: 'NORMAL', t: 350 }, c), 396.2);
});

/* ------------------------------------------------------------ pengali musim */

test('musim bulan asal dilepas dulu sebelum musim tujuan dipasang', () => {
  // Oktober Mid (×1,000) ke November Low (×0,928). Pengalinya sengaja tidak
  // dibulatkan — ia dikalikan ke nominal besar, dan membulatkannya di sini
  // akan menggeser hasilnya sampai ribuan rupiah.
  const c = pengaliMusim('2026-10' as Period, '2026-11' as Period, pola)!;
  assert.ok(Math.abs(c - 0.928) < 1e-9, `c = ${c}`);
});

test('dua bulan semusim tidak mengubah apa pun', () => {
  const satu: PolaMusim = new Map([
    [10, { code: 'LOW', name: 'Low', delta: -7.2 }],
    [11, { code: 'LOW', name: 'Low', delta: -7.2 }],
  ]);
  assert.equal(pengaliMusim('2026-10' as Period, '2026-11' as Period, satu), 1);
});

test('bulan yang belum bermusim tidak melahirkan pengali', () => {
  assert.equal(pengaliMusim('2026-09' as Period, '2026-10' as Period, pola), null);
});

/* --------------------------------------------------------------- sebaran */

test('normal kembali persis ke angka yang masuk', () => {
  const s = sebaranDariTargetNormal(400, margin)!;
  assert.equal(s.NORMAL, 400);
});

test('ketiganya selalu berurut selama marginnya berurut', () => {
  const s = sebaranDariTargetNormal(400, margin)!;
  assert.ok(s.PESIMIS < s.NORMAL && s.NORMAL < s.OPTIMIS);
  // belanja tersirat 400 × (1 − 0) = 400
  assert.equal(s.PESIMIS, Math.round((400 / 1.1) * 100) / 100);
  assert.equal(s.OPTIMIS, Math.round((400 / 0.9) * 100) / 100);
});

test('target margin yang belum lengkap tidak melahirkan sebaran', () => {
  assert.equal(sebaranDariTargetNormal(400, new Map([['NORMAL', 0]])), null);
});

/* ----------------------------------------------------------------- rantai */

test('bulan pertama memakai rumus, bulan sesudahnya hanya dikali musim', () => {
  const r = rantaiTarget({
    anchor: '2026-10' as Period,
    masukNyata: 400,
    tingkat: { skenario: 'NORMAL', t: 350 },
    pola, margin: polaMargin, bulan: 2,
    periode: ['2026-11', '2026-12'] as Period[],
  });

  assert.equal(r.length, 2);
  assert.equal(r[0].dariRealisasi, true);
  assert.equal(r[0].target.NORMAL, 394.4);

  // Desember: tidak ada kelebihan lagi, hanya musim November→Desember.
  assert.equal(r[1].dariRealisasi, false);
  assert.ok(Math.abs(r[1].c - 1.3 / 0.928) < 1e-9);
  assert.equal(
    r[1].target.NORMAL,
    Math.round(r[0].target.NORMAL * r[1].c * 100) / 100,
  );
});

test('rantai berhenti di bulan yang belum bermusim, bukan menebak', () => {
  const r = rantaiTarget({
    anchor: '2026-10' as Period,
    masukNyata: 400,
    tingkat: { skenario: 'NORMAL', t: 350 },
    pola, margin: polaMargin, bulan: 4,
    periode: ['2026-11', '2026-12', '2027-01'] as Period[],
  });
  assert.equal(r.length, 2, 'Januari belum bermusim di pola uji ini');
});

test('tanpa target margin, rantainya tidak menghasilkan apa pun', () => {
  const r = rantaiTarget({
    anchor: '2026-10' as Period,
    masukNyata: 400,
    tingkat: { skenario: 'NORMAL', t: 350 },
    pola, margin: new Map(), bulan: 3,
    periode: ['2026-11', '2026-12'] as Period[],
  });
  assert.equal(r.length, 0);
});

test('rantai berhenti di bulan yang target marginnya belum ditetapkan', () => {
  // Meminjam angka bulan lain akan menghasilkan target yang tampak sah
  // padahal tidak pernah dipilih siapa pun untuk bulan itu.
  const hanyaNovember: PolaTargetMargin = new Map([[11, margin]]);
  const r = rantaiTarget({
    anchor: '2026-10' as Period,
    masukNyata: 400,
    tingkat: { skenario: 'NORMAL', t: 350 },
    pola, margin: hanyaNovember, bulan: 3,
    periode: ['2026-11', '2026-12'] as Period[],
  });
  assert.equal(r.length, 1, 'Desember targetnya belum ditetapkan');
  assert.equal(r[0].period, '2026-11');
});
