import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { advisePurchase } from '../src/lib/forecast';
import { cicilanPada, cicilanSetelah, jadwalCicilan, konteksPembelian } from '../src/lib/rencana-belanja';
import type { Runway } from '../src/lib/rencana-kas';

const jt = (n: number) => n * 1_000_000;
const keJt = (n: number) => Math.round(n / 100_000) / 10;
const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);
const hari = (d: Date) => d.toISOString().slice(0, 10);

test('cicilan bulanan jatuh pada tanggal yang sama tiap bulan', () => {
  const j = jadwalCicilan(jt(90), 3, 'MONTHLY', tgl('2026-10-15'));
  assert.deepEqual(j.map((c) => hari(c.jatuhTempo)), ['2026-10-15', '2026-11-15', '2026-12-15']);
});

test('tanggal 31 ditarik ke hari terakhir bulan yang lebih pendek', () => {
  const j = jadwalCicilan(jt(90), 4, 'MONTHLY', tgl('2026-10-31'));
  // November hanya 30 hari, Februari 28 — jangan melompat ke bulan berikutnya.
  assert.deepEqual(j.map((c) => hari(c.jatuhTempo)),
    ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31']);
});

test('cicilan mingguan berjarak tujuh hari', () => {
  const j = jadwalCicilan(jt(40), 4, 'WEEKLY', tgl('2026-10-12'));
  assert.deepEqual(j.map((c) => hari(c.jatuhTempo)),
    ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
});

test('jumlah seluruh cicilan selalu persis sama dengan harganya', () => {
  for (const harga of [jt(80), 1, 999_999, 100_000_000.5]) {
    for (const n of [1, 3, 7, 24]) {
      const j = jadwalCicilan(harga, n, 'MONTHLY', tgl('2026-10-01'));
      assert.equal(Math.round(j.reduce((s, c) => s + c.amount, 0) * 100) / 100,
        Math.round(harga * 100) / 100, `${harga} / ${n}`);
    }
  }
});

test('sekali bayar menghasilkan satu cicilan pada tanggal mulainya', () => {
  const j = jadwalCicilan(jt(80), 1, 'MONTHLY', tgl('2026-10-20'));
  assert.equal(j.length, 1);
  assert.equal(j[0].amount, jt(80));
  assert.equal(hari(j[0].jatuhTempo), '2026-10-20');
});

test('hanya cicilan bulan itu yang dihitung', () => {
  const j = jadwalCicilan(jt(90), 3, 'MONTHLY', tgl('2026-10-15'));
  assert.equal(keJt(cicilanPada(j, '2026-10')), 30);
  assert.equal(keJt(cicilanPada(j, '2026-11')), 30);
  assert.equal(cicilanPada(j, '2027-05'), 0);
});

test('cicilan sebelum tanggal posisi kas tidak ikut memotong lagi', () => {
  const j = jadwalCicilan(jt(40), 4, 'WEEKLY', tgl('2026-10-05'));
  // 5, 12, 19, 26 Oktober. Posisi kas 12 Okt: dua yang pertama sudah di saldo.
  assert.equal(keJt(cicilanSetelah(j, '2026-10', tgl('2026-10-12'))), 20);
  assert.equal(keJt(cicilanSetelah(j, '2026-10', tgl('2026-10-01'))), 40);
  assert.equal(cicilanSetelah(j, '2026-10', tgl('2026-10-31')), 0);
});

/* ---------------- jembatan ke mesin penilaian ---------------- */

/** Kas menyusut rata Rp 20 jt sebulan dari Rp 200 jt. */
const runwayMenurun: Runway = {
  arusBersih: jt(-20),
  arusRata: jt(-20),
  arusTerendah: { period: '2026-11', arus: jt(-20) },
  arusTertinggi: { period: '2026-11', arus: jt(-20) },
  habisPada: null,
  gajiTerancam: null,
  bulan: Array.from({ length: 10 }, (_, i) => ({
    period: `2026-${String(10 + i).padStart(2, '0')}`.replace('2026-13', '2027-01'),
    saldoAkhir: jt(200 - 20 * (i + 1)),
    cukupGaji: true,
  })),
};

test('konteks pembelian mengikuti saldo dan batas aman rencana kas', () => {
  const k = konteksPembelian(runwayMenurun, jt(200), jt(50));
  assert.equal(k.openingCash, jt(200));
  assert.equal(k.minCashBuffer, jt(50));
  assert.equal(keJt(k.rows[0].netCash), -20, 'arus bulan pertama dari saldo awal');
  assert.equal(keJt(k.rows[1].netCash), -20);
  // Titik terendah Rp 0 pada bulan terakhir, dikurangi batas aman Rp 50 jt.
  assert.equal(k.maxAffordableNow, 0);
});

test('kas yang tumbuh menyisakan ruang belanja sebesar saldo terendah', () => {
  const naik: Runway = {
    ...runwayMenurun,
    arusBersih: jt(10),
    bulan: runwayMenurun.bulan.map((b, i) => ({ ...b, saldoAkhir: jt(200 + 10 * (i + 1)) })),
  };
  // Terendah adalah saldo hari ini, Rp 200 jt, dikurangi batas aman Rp 50 jt.
  assert.equal(keJt(konteksPembelian(naik, jt(200), jt(50)).maxAffordableNow), 150);
});

test('pembelian yang tidak terjangkau sekaligus disarankan dipecah', () => {
  const k = konteksPembelian(runwayMenurun, jt(200), jt(50));
  const saran = advisePurchase(k, jt(100), 1, 'MONTHLY');
  assert.equal(saran.requested.affordable, false, 'sekaligus tidak aman');
  assert.ok(saran.requested.shortfall > 0);
  // Kas yang terus menyusut: memecahnya tidak menolong, dan itu harus dikatakan.
  assert.equal(saran.minimumInstalments, null);
  assert.equal(saran.recommended, null);
});

test('pada kas yang tumbuh, memecah pembelian membuatnya aman', () => {
  const naik: Runway = {
    ...runwayMenurun,
    arusBersih: jt(30),
    bulan: runwayMenurun.bulan.map((b, i) => ({ ...b, saldoAkhir: jt(100 + 30 * (i + 1)) })),
  };
  const k = konteksPembelian(naik, jt(100), jt(50));
  const sekaligus = advisePurchase(k, jt(120), 1, 'MONTHLY');
  assert.equal(sekaligus.requested.affordable, false);
  assert.ok(sekaligus.minimumInstalments && sekaligus.minimumInstalments > 1,
    'ada jumlah cicilan yang membuatnya aman');
  assert.equal(sekaligus.recommended?.affordable, true);
  assert.equal(
    Math.round(sekaligus.recommended!.schedule.reduce((s, c) => s + c.amount, 0)), jt(120),
    'seluruh cicilan tetap berjumlah sama dengan harganya',
  );
});

test('pembelian kecil langsung aman tanpa dipecah', () => {
  const naik: Runway = {
    ...runwayMenurun,
    arusBersih: jt(30),
    bulan: runwayMenurun.bulan.map((b, i) => ({ ...b, saldoAkhir: jt(100 + 30 * (i + 1)) })),
  };
  const saran = advisePurchase(konteksPembelian(naik, jt(100), jt(50)), jt(5), 1, 'MONTHLY');
  assert.equal(saran.requested.affordable, true);
  assert.equal(saran.minimumInstalments, 1);
  assert.equal(saran.requested.shortfall, 0);
});

test('kas yang sudah di bawah batas aman menolak pembelian sekecil apa pun', () => {
  // Bukan pembeliannya yang salah: garis kasnya memang sudah menembus batas.
  // Layar harus mengatakan itu, bukan menyalahkan barang seharga sejuta.
  const k = konteksPembelian(runwayMenurun, jt(200), jt(50));
  const saran = advisePurchase(k, jt(1), 1, 'MONTHLY');
  assert.equal(saran.requested.affordable, false);
  assert.equal(saran.minimumInstalments, null);
  assert.equal(k.maxAffordableNow, 0, 'ruang belanjanya memang nol');
});
