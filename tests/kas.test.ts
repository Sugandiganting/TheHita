import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPayLines,
  buildReceiveLines,
  buildTransferLines,
  checkBalance,
  checkPerUnitBalance,
} from '../src/lib/accounting.ts';

const IU = { receivableId: 'iu-recv', payableId: 'iu-pay' };

/** Ringkas saldo per unit agar mudah diperiksa. */
function perUnit(lines: { unitId: string; debit: number; credit: number }[]) {
  const m: Record<string, number> = {};
  for (const l of lines) m[l.unitId] = (m[l.unitId] ?? 0) + l.debit - l.credit;
  return m;
}

/* ---------------- Transfer ---------------- */

test('transfer dalam satu unit cukup dua baris', () => {
  const lines = buildTransferLines({
    amount: 25_000_000,
    fromAccountId: 'bank', fromUnitId: 'thl',
    toAccountId: 'petty', toUnitId: 'thl',
    interUnit: IU,
  });

  assert.equal(lines.length, 2);
  assert.ok(checkBalance(lines).balanced);
  assert.equal(lines.find((l) => l.accountId === 'petty')!.debit, 25_000_000);
  assert.equal(lines.find((l) => l.accountId === 'bank')!.credit, 25_000_000);
  assert.deepEqual(checkPerUnitBalance(lines), []);
});

test('transfer antar cabang menjaga neraca tiap cabang tetap seimbang', () => {
  // Bank IGYT -> Bank The Hita Legian
  const lines = buildTransferLines({
    amount: 50_000_000,
    fromAccountId: 'bank-igyt', fromUnitId: 'igyt',
    toAccountId: 'bank-thl', toUnitId: 'thl',
    interUnit: IU,
  });

  assert.equal(lines.length, 4, 'harus ada sepasang baris antar unit');
  assert.ok(checkBalance(lines).balanced, 'jurnal keseluruhan harus balance');
  assert.deepEqual(checkPerUnitBalance(lines), [], 'tiap unit harus balance sendiri');

  // IGYT kehilangan kas tetapi memperoleh piutang antar unit.
  const igyt = lines.filter((l) => l.unitId === 'igyt');
  assert.equal(igyt.find((l) => l.accountId === 'bank-igyt')!.credit, 50_000_000);
  assert.equal(igyt.find((l) => l.accountId === 'iu-recv')!.debit, 50_000_000);

  // THL menerima kas dan mencatat hutang antar unit.
  const thl = lines.filter((l) => l.unitId === 'thl');
  assert.equal(thl.find((l) => l.accountId === 'bank-thl')!.debit, 50_000_000);
  assert.equal(thl.find((l) => l.accountId === 'iu-pay')!.credit, 50_000_000);
});

test('piutang dan hutang antar unit selalu saling meniadakan', () => {
  const lines = buildTransferLines({
    amount: 12_345_000,
    fromAccountId: 'a', fromUnitId: 'u1',
    toAccountId: 'b', toUnitId: 'u2',
    interUnit: IU,
  });
  const recv = lines.filter((l) => l.accountId === 'iu-recv').reduce((s, l) => s + l.debit - l.credit, 0);
  const pay  = lines.filter((l) => l.accountId === 'iu-pay').reduce((s, l) => s + l.credit - l.debit, 0);
  assert.equal(recv, pay);
});

test('nominal negatif pada transfer diperlakukan sebagai nilai mutlak', () => {
  const lines = buildTransferLines({
    amount: -9_000_000,
    fromAccountId: 'a', fromUnitId: 'u1', toAccountId: 'b', toUnitId: 'u1',
    interUnit: IU,
  });
  assert.equal(lines[0].debit, 9_000_000);
  assert.ok(checkBalance(lines).balanced);
});

/* ---------------- Receive Money ---------------- */

test('uang masuk satu baris: kas didebit, pendapatan dikredit', () => {
  const lines = buildReceiveLines({
    cashAccountId: 'bank', cashUnitId: 'skr',
    lines: [{ accountId: 'rev-kamar', unitId: 'skr', amount: 7_500_000 }],
    interUnit: IU,
  });

  assert.equal(lines.length, 2);
  assert.ok(checkBalance(lines).balanced);
  assert.equal(lines[0].debit, 7_500_000);
  assert.deepEqual(checkPerUnitBalance(lines), []);
});

test('satu penerimaan bisa dipecah ke beberapa akun pendapatan', () => {
  const lines = buildReceiveLines({
    cashAccountId: 'bank', cashUnitId: 'skr',
    lines: [
      { accountId: 'rev-kamar', unitId: 'skr', amount: 6_000_000 },
      { accountId: 'rev-fnb',   unitId: 'skr', amount: 2_500_000 },
      { accountId: 'rev-lain',  unitId: 'skr', amount: 500_000 },
    ],
    interUnit: IU,
  });

  const cash = lines.find((l) => l.accountId === 'bank')!;
  assert.equal(cash.debit, 9_000_000, 'kas didebit sejumlah total');
  assert.ok(checkBalance(lines).balanced);
  assert.deepEqual(checkPerUnitBalance(lines), []);
});

test('uang masuk untuk cabang lain dijembatani akun antar unit', () => {
  // Uang masuk ke rekening SKR, tetapi pendapatannya milik IGYT.
  const lines = buildReceiveLines({
    cashAccountId: 'bank-skr', cashUnitId: 'skr',
    lines: [{ accountId: 'rev-cafe', unitId: 'igyt', amount: 4_000_000 }],
    interUnit: IU,
  });

  assert.ok(checkBalance(lines).balanced);
  assert.deepEqual(checkPerUnitBalance(lines), [], 'kedua unit harus balance sendiri');

  // SKR memegang uang milik IGYT -> SKR berhutang.
  const skr = lines.filter((l) => l.unitId === 'skr');
  assert.equal(skr.find((l) => l.accountId === 'bank-skr')!.debit, 4_000_000);
  assert.equal(skr.find((l) => l.accountId === 'iu-pay')!.credit, 4_000_000);

  // IGYT mengakui pendapatan dan piutang ke SKR.
  const igyt = lines.filter((l) => l.unitId === 'igyt');
  assert.equal(igyt.find((l) => l.accountId === 'rev-cafe')!.credit, 4_000_000);
  assert.equal(igyt.find((l) => l.accountId === 'iu-recv')!.debit, 4_000_000);
});

/* ---------------- Pay Money ---------------- */

test('uang keluar satu baris: beban didebit, kas dikredit', () => {
  const lines = buildPayLines({
    cashAccountId: 'bank', cashUnitId: 'thl',
    lines: [{ accountId: 'beban-listrik', unitId: 'thl', amount: 3_200_000 }],
    interUnit: IU,
  });

  assert.equal(lines.length, 2);
  assert.ok(checkBalance(lines).balanced);
  assert.equal(lines.find((l) => l.accountId === 'beban-listrik')!.debit, 3_200_000);
  assert.equal(lines.find((l) => l.accountId === 'bank')!.credit, 3_200_000);
});

test('satu tagihan listrik dibagi ke dua cabang tetap seimbang per cabang', () => {
  // Tagihan Rp 30 juta dibayar dari bank SKR, dipakai SKR 20jt dan Play Laundry 10jt.
  const lines = buildPayLines({
    cashAccountId: 'bank-skr', cashUnitId: 'skr',
    lines: [
      { accountId: 'listrik', unitId: 'skr', amount: 20_000_000 },
      { accountId: 'listrik', unitId: 'pld', amount: 10_000_000 },
    ],
    interUnit: IU,
  });

  assert.ok(checkBalance(lines).balanced);
  assert.deepEqual(checkPerUnitBalance(lines), []);

  const cash = lines.find((l) => l.accountId === 'bank-skr')!;
  assert.equal(cash.credit, 30_000_000, 'kas keluar sejumlah total tagihan');

  // PLD menanggung bebannya sendiri lewat hutang antar unit.
  const pld = lines.filter((l) => l.unitId === 'pld');
  assert.equal(pld.find((l) => l.accountId === 'listrik')!.debit, 10_000_000);
  assert.equal(pld.find((l) => l.accountId === 'iu-pay')!.credit, 10_000_000);

  // SKR menalangi, jadi punya piutang 10jt ke PLD.
  const skrRecv = lines.filter((l) => l.unitId === 'skr' && l.accountId === 'iu-recv');
  assert.equal(skrRecv.reduce((s, l) => s + l.debit, 0), 10_000_000);
});

test('baris kosong atau bernilai nol diabaikan', () => {
  const lines = buildPayLines({
    cashAccountId: 'bank', cashUnitId: 'thl',
    lines: [
      { accountId: 'beban', unitId: 'thl', amount: 1_000_000 },
      { accountId: '',      unitId: 'thl', amount: 500_000 },
      { accountId: 'beban2', unitId: 'thl', amount: 0 },
    ],
    interUnit: IU,
  });

  assert.equal(lines.length, 2);
  assert.equal(lines.find((l) => l.accountId === 'bank')!.credit, 1_000_000);
});

test('checkPerUnitBalance menangkap jurnal lintas unit yang tidak dijembatani', () => {
  // Pencatatan naif tanpa akun antar unit — inilah yang harus dicegah.
  const naive = [
    { accountId: 'bank-a', unitId: 'igyt', debit: 0, credit: 5_000_000 },
    { accountId: 'bank-b', unitId: 'thl',  debit: 5_000_000, credit: 0 },
  ];
  assert.ok(checkBalance(naive).balanced, 'total tetap balance');
  const broken = checkPerUnitBalance(naive);
  assert.equal(broken.length, 2, 'tetapi kedua unit timpang');
  assert.deepEqual(broken.map((b) => b.unitId).sort(), ['igyt', 'thl']);
});
