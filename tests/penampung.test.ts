import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { rekapPenampung, type Bukti } from '../src/lib/penampung';

const jt = (n: number) => n * 1_000_000;
const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);
const POOL = 'kas-purchasing';
const BANK = 'bank';
const BEBAN = 'beban-pembelian';

const OKTOBER = { mulai: tgl('2026-10-01'), selesaiEksklusif: tgl('2026-11-01') };

/** Setoran: bank cabang dikredit, penampung didebit. */
const setor = (tanggal: string, unit: string, n: number): Bukti => ({
  tanggal: tgl(tanggal),
  baris: [
    { accountId: POOL, unit: 'PURCH', debit: n, credit: 0, antarUnit: false },
    { accountId: BANK, unit, debit: 0, credit: n, antarUnit: false },
    // Jembatan antar unit yang dibuat sistem; tidak boleh ikut dibaca.
    { accountId: 'piutang', unit, debit: n, credit: 0, antarUnit: true },
    { accountId: 'hutang', unit: 'PURCH', debit: 0, credit: n, antarUnit: true },
  ],
});

/** Belanja: pos beban cabang didebit, penampung dikredit. Boleh banyak cabang. */
const belanja = (tanggal: string, bagian: [string, number][]): Bukti => ({
  tanggal: tgl(tanggal),
  baris: [
    ...bagian.map(([unit, n]) => ({ accountId: BEBAN, unit, debit: n, credit: 0, antarUnit: false })),
    {
      accountId: POOL, unit: 'PURCH',
      debit: 0, credit: bagian.reduce((t, [, n]) => t + n, 0), antarUnit: false,
    },
  ],
});

test('saldo penampung adalah uang yang harus ada di tangan', () => {
  const r = rekapPenampung(
    [setor('2026-10-05', 'THL', jt(100)), belanja('2026-10-10', [['THU', jt(60)]])],
    POOL, OKTOBER,
  );
  assert.equal(r.totalMasuk, jt(100));
  assert.equal(r.totalKeluar, jt(60));
  assert.equal(r.saldoAkhir, jt(40));
});

test('cabang yang menalangi dan yang ditalangi terbaca dari selisihnya', () => {
  // THL menyetor 100, tetapi yang dibelanjakan untuknya hanya 60. Sisa 40
  // terpakai THU — itulah talangan yang selama ini tidak tercatat.
  const r = rekapPenampung(
    [setor('2026-10-05', 'THL', jt(100)), belanja('2026-10-10', [['THL', jt(60)], ['THU', jt(40)]])],
    POOL, OKTOBER,
  );
  assert.deepEqual(r.posisi, [
    { unit: 'THL', disetor: jt(100), dipakai: jt(60), net: jt(40) },
    { unit: 'THU', disetor: 0, dipakai: jt(40), net: -jt(40) },
  ]);
  // Penampungnya kosong, jadi klaim yang tersisa memang murni talangan.
  assert.equal(r.saldoAkhir, 0);
  assert.equal(r.selisih, 0);
});

test('baris jembatan antar unit tidak ikut dihitung dua kali', () => {
  // Setoran membawa baris piutang/hutang otomatis. Kalau ikut dibaca, setoran
  // THL akan terhitung 200 — dan talangannya jadi dua kali lipat.
  const r = rekapPenampung([setor('2026-10-05', 'THL', jt(100))], POOL, OKTOBER);
  assert.equal(r.posisi.length, 1);
  assert.equal(r.posisi[0].disetor, jt(100));
});

test('satu bukti belanja boleh memuat beberapa cabang sekaligus', () => {
  const r = rekapPenampung(
    [belanja('2026-10-20', [['THL', jt(30)], ['THU', jt(25)], ['IGYT', jt(10)]])],
    POOL, OKTOBER,
  );
  assert.equal(r.totalKeluar, jt(65));
  const dipakai = new Map(r.posisi.map((p) => [p.unit, p.dipakai]));
  assert.equal(dipakai.get('THL'), jt(30));
  assert.equal(dipakai.get('THU'), jt(25));
  assert.equal(dipakai.get('IGYT'), jt(10));
  // Urutannya menurut net: yang paling sedikit ditalangi lebih dulu.
  assert.deepEqual(r.posisi.map((p) => p.unit), ['IGYT', 'THU', 'THL']);
});

test('bulan sebelumnya hanya membentuk saldo awal, tidak ikut dirinci', () => {
  const r = rekapPenampung(
    [setor('2026-09-20', 'THL', jt(80)), belanja('2026-10-03', [['THU', jt(50)]])],
    POOL, OKTOBER,
  );
  assert.equal(r.saldoAwal, jt(80));
  assert.equal(r.totalMasuk, 0);
  assert.equal(r.saldoAkhir, jt(30));
  // Rincian September milik September.
  assert.deepEqual(r.posisi.map((p) => p.unit), ['THU']);
});

test('bukti sesudah rentang tidak ikut sama sekali', () => {
  const r = rekapPenampung(
    [setor('2026-10-05', 'THL', jt(100)), setor('2026-11-02', 'THU', jt(70))],
    POOL, OKTOBER,
  );
  assert.equal(r.saldoAkhir, jt(100));
  assert.deepEqual(r.posisi.map((p) => p.unit), ['THL']);
});

test('bukti yang tidak menyentuh penampung dilewati', () => {
  const lain: Bukti = {
    tanggal: tgl('2026-10-07'),
    baris: [{ accountId: BANK, unit: 'THL', debit: jt(5), credit: 0, antarUnit: false }],
  };
  const r = rekapPenampung([lain], POOL, OKTOBER);
  assert.equal(r.saldoAkhir, 0);
  assert.deepEqual(r.posisi, []);
});

test('setoran yang belum terbelanjakan tetap jadi klaim penyetornya', () => {
  // Jumlah seluruh klaim sama dengan mutasi bersih penampung, BUKAN nol.
  // Menyamakannya dengan nol akan menuduh pembukuan yang sebenarnya benar.
  const r = rekapPenampung(
    [setor('2026-10-05', 'THL', jt(100)), belanja('2026-10-10', [['THU', jt(60)]])],
    POOL, OKTOBER,
  );
  assert.equal(r.saldoAkhir, jt(40));
  assert.equal(r.posisi.reduce((t, p) => t + p.net, 0), jt(40));
  assert.equal(r.selisih, 0, 'tidak ada yang tidak terjelaskan');
});

test('belanja yang lupa disebut cabangnya ketahuan sebagai selisih', () => {
  // Pos bebannya masih memikul kode penampung, bukan kode cabang pemakainya.
  const lupa: Bukti = {
    tanggal: tgl('2026-10-12'),
    baris: [
      { accountId: BEBAN, unit: 'PURCH', debit: jt(25), credit: 0, antarUnit: false },
      { accountId: POOL, unit: 'PURCH', debit: 0, credit: jt(25), antarUnit: false },
    ],
  };
  const r = rekapPenampung([setor('2026-10-05', 'THL', jt(100)), lupa], POOL, OKTOBER);
  // PURCH ikut muncul sebagai "cabang", dan itu justru tandanya: selisihnya nol
  // tetapi ada baris atas nama penampung sendiri.
  assert.ok(r.posisi.some((p) => p.unit === 'PURCH'), 'penampung muncul sebagai pemakai');
  assert.equal(r.saldoAkhir, jt(75));
});
