import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { advisePurchase, planPurchase } from '../src/lib/forecast';
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
    saldoAwal: jt(200 - 20 * i),
    masuk: jt(100),
    keluar: jt(120),
    saldoAkhir: jt(200 - 20 * (i + 1)),
    cukupGaji: true,
    kurangGaji: 0,
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

/* ------------- panjang bulan pertama & tanggal mulai ------------- */

/**
 * Rencana kas berangkat dari tanggal posisi kas, bukan dari awal bulan. Posisi
 * kas 12 Oktober menyisakan 19 hari, jadi hari ke-19 sudah masuk November.
 */
const konteksSisaBulan = () => konteksPembelian(runwayMenurun, jt(200), jt(50), 19);

test('bulan pertama hanya sepanjang sisa hari, bukan sebulan penuh', () => {
  const rencana = planPurchase(konteksSisaBulan(), jt(12), 6, 'WEEKLY', 1);
  // Cicilan jatuh pada hari ke-1, 8, 15, 22, 29, 36 sejak posisi kas.
  assert.deepEqual(
    rencana.schedule.map((c) => c.period),
    ['2026-10', '2026-10', '2026-10', '2026-11', '2026-11', '2026-11'],
  );
});

test('sisa kas ikut melompat ke bulan berikutnya pada hari yang benar', () => {
  const rencana = planPurchase(konteksSisaBulan(), jt(6), 4, 'WEEKLY', 0);
  const akhir = rencana.schedule[3];
  assert.equal(akhir.dayOffset, 21);
  assert.equal(akhir.period, '2026-11');
  // Hari ke-19 menutup Oktober di Rp 180 jt; dua hari November menggerusnya
  // 2/30 dari Rp 20 jt, lalu dikurangi empat cicilan Rp 6 jt.
  assert.equal(keJt(akhir.balanceAfter), keJt(jt(180) - (jt(20) * 2) / 30 - jt(6)));
});

test('tanggal mulai menggeser seluruh jadwal', () => {
  const k = konteksSisaBulan();
  const segera = planPurchase(k, jt(6), 2, 'WEEKLY', 0);
  const nanti = planPurchase(k, jt(6), 2, 'WEEKLY', 14);
  assert.deepEqual(segera.schedule.map((c) => c.dayOffset), [0, 7]);
  assert.deepEqual(nanti.schedule.map((c) => c.dayOffset), [14, 21]);
  assert.deepEqual(nanti.schedule.map((c) => c.period), ['2026-10', '2026-11']);
  // Kas yang menyusut: menunda membuat sisanya lebih kecil, bukan lebih besar.
  assert.ok(nanti.schedule[1].balanceAfter < segera.schedule[1].balanceAfter);
});

test('tanpa keterangan sisa hari, bulan pertama tetap dihitung sebulan penuh', () => {
  // Ramalan di menu Peramalan memang berangkat dari awal bulan, dan perilaku
  // lamanya tidak boleh ikut berubah.
  const rencana = planPurchase(konteksPembelian(runwayMenurun, jt(200), jt(50)), jt(12), 6, 'WEEKLY', 1);
  assert.deepEqual(
    rencana.schedule.map((c) => c.period),
    ['2026-10', '2026-10', '2026-10', '2026-10', '2026-10', '2026-11'],
  );
});

/* ------------------------------------------------------------------ */
/* Optimis: batas aman hanya di akhir bulan                            */
/* ------------------------------------------------------------------ */

// Pola November pemilik, dibulatkan: saldo hari ini 131, akhir Nov 185
// (Optimis), akhir Des 440, batas aman (gaji awal Desember) 56. Satuan juta.
const kontekNov = (akhirBulanSaja: boolean) => konteksPembelian(
  {
    bulan: [
      { period: '2026-11', saldoAwal: 131, masuk: 0, keluar: 0, saldoAkhir: 185, cukupGaji: true, kurangGaji: 0 },
      { period: '2026-12', saldoAwal: 185, masuk: 0, keluar: 0, saldoAkhir: 440, cukupGaji: true, kurangGaji: 0 },
    ],
  } as unknown as Parameters<typeof konteksPembelian>[0],
  131, 56, 12, akhirBulanSaja,
);

test('aturan biasa: kemampuan hari ini dibatasi saldo hari ini dikurangi batas aman', () => {
  assert.equal(kontekNov(false).maxAffordableNow, 131 - 56);
});

test('Optimis: hari ini cukup tidak minus, akhir bulan tetap harus menutup batas aman', () => {
  // min(saldo hari ini 131, akhir Nov 185 − 56 = 129, akhir Des 440 − 56) = 129
  assert.equal(kontekNov(true).maxAffordableNow, 129);
});

test('Optimis: pembelian yang membuat saldo hari itu di bawah batas aman tetap aman bila akhir bulannya tertutup', () => {
  // 131 − 100 = 31 ≥ 0 di hari bayar; akhir Nov 185 − 100 = 85 ≥ 56.
  assert.equal(planPurchase(kontekNov(true), 100, 1, 'WEEKLY', 0).affordable, true);
  assert.equal(planPurchase(kontekNov(false), 100, 1, 'WEEKLY', 0).affordable, false);
});

test('Optimis: kas minus di hari bayar tetap ditolak', () => {
  const tinggi = konteksPembelian(
    {
      bulan: [
        { period: '2026-11', saldoAwal: 131, masuk: 0, keluar: 0, saldoAkhir: 300, cukupGaji: true, kurangGaji: 0 },
        { period: '2026-12', saldoAwal: 300, masuk: 0, keluar: 0, saldoAkhir: 500, cukupGaji: true, kurangGaji: 0 },
      ],
    } as unknown as Parameters<typeof konteksPembelian>[0],
    131, 56, 12, true,
  );
  const p = planPurchase(tinggi, 140, 1, 'WEEKLY', 0);
  assert.equal(p.affordable, false);
  assert.equal(p.lowest?.batas, 0); // 131 − 140 = −9
  assert.equal(p.shortfall, 9);
});

test('Optimis: akhir bulan yang tidak menutup batas aman ditolak dengan kekurangannya', () => {
  const p = planPurchase(kontekNov(true), 130, 1, 'WEEKLY', 0);
  // Hari bayar 131 − 130 = 1 ≥ 0, tetapi akhir Nov 185 − 130 = 55 < 56.
  assert.equal(p.affordable, false);
  assert.equal(p.lowest?.batas, 56);
  assert.equal(p.lowest?.period, '2026-11');
  assert.equal(p.shortfall, 1);
});

test('Optimis: pembayaran tanggal 1-7 bulan berikutnya bersaing dengan gaji, jadi batas aman tetap berlaku', () => {
  // Hari 12 = 1 Desember: saldo 185, dibayar 140 → 45 < 56.
  const p = planPurchase(kontekNov(true), 140, 1, 'WEEKLY', 12);
  assert.equal(p.affordable, false);
  assert.equal(p.lowest?.batas, 56);
});

test('Optimis: pembayaran sesudah tanggal 7 cukup tidak minus', () => {
  // Hari 22 = 11 Desember: 185 + 255 × 10/31 − 140 ≥ 0; akhir Des 440 − 140 ≥ 56.
  assert.equal(planPurchase(kontekNov(true), 140, 1, 'WEEKLY', 22).affordable, true);
});
