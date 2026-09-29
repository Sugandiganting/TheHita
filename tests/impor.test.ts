import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv, findHeaderRow } from '../src/lib/import/parse.ts';
import { buildImportPlan, guessColumns, parseDate, parseNumber, EMPTY_MAP } from '../src/lib/import/build.ts';
import { resolveLegacyAccount } from '../src/lib/coa-legacy.ts';

/* ---------------- Pembaca CSV ---------------- */

test('CSV dengan tanda kutip dan koma di dalam sel terbaca utuh', () => {
  const rows = parseCsv('Tanggal,Keterangan,Debit\n01/03/2026,"Bayar PLN, Maret",1500000');
  assert.deepEqual(rows[1], ['01/03/2026', 'Bayar PLN, Maret', '1500000']);
});

test('CSV bertitik koma (gaya Excel Indonesia) terdeteksi sendiri', () => {
  const rows = parseCsv('Tanggal;Akun;Debit\n01/03/2026;6120.01;1.500.000');
  assert.deepEqual(rows[1], ['01/03/2026', '6120.01', '1.500.000']);
});

test('tanda kutip ganda di dalam sel dibaca sebagai satu kutip', () => {
  const rows = parseCsv('A,B\n1,"kata ""penting"" di sini"');
  assert.equal(rows[1][1], 'kata "penting" di sini');
});

test('penanda BOM dari Excel tidak ikut terbaca', () => {
  const rows = parseCsv('﻿Tanggal,Debit\n01/03/2026,100');
  assert.equal(rows[0][0], 'Tanggal');
});

test('baris judul laporan di atas tabel dilewati', () => {
  const rows = [
    ['The Hita Uluwatu'], [''], ['Generated at: 24 Sep 2026'],
    ['Tanggal', 'Kode Akun', 'Keterangan', 'Debit', 'Kredit'],
    ['01/03/2026', '612.01', 'Listrik', '1500000', ''],
  ];
  assert.equal(findHeaderRow(rows), 3);
});

/* ---------------- Pembacaan angka ---------------- */

test('angka gaya Indonesia dan Inggris sama-sama terbaca', () => {
  assert.equal(parseNumber('1.500.000'), 1_500_000);
  assert.equal(parseNumber('1,500,000'), 1_500_000);
  assert.equal(parseNumber('1.500.000,50'), 1_500_000.5);
  assert.equal(parseNumber('1,500,000.50'), 1_500_000.5);
  assert.equal(parseNumber('Rp 2.750.000'), 2_750_000);
  assert.equal(parseNumber(''), 0);
});

test('angka dalam kurung dibaca negatif', () => {
  assert.equal(parseNumber('(500.000)'), -500_000);
  assert.equal(parseNumber('-500.000'), -500_000);
});

/* ---------------- Pembacaan tanggal ---------------- */

test('berbagai bentuk tanggal terbaca, hari-dulu diutamakan', () => {
  assert.equal(parseDate('01/03/2026'), '2026-03-01');
  assert.equal(parseDate('1-3-2026'), '2026-03-01');
  assert.equal(parseDate('2026-03-01'), '2026-03-01');
  assert.equal(parseDate('15 Mar 2026'), '2026-03-15');
  assert.equal(parseDate('15 Agu 2026'), '2026-08-15');
  assert.equal(parseDate('bukan tanggal'), null);
  assert.equal(parseDate(''), null);
});

test('angka seri Excel terbaca sebagai tanggal', () => {
  assert.equal(parseDate('46082'), '2026-03-01');
});

/* ---------------- Tebakan kolom ---------------- */

test('kolom ditebak dari judulnya', () => {
  const m = guessColumns(['Tanggal', 'No Bukti', 'Kode Akun', 'Nama Akun', 'Keterangan', 'Debit', 'Kredit']);
  assert.equal(m.date, 0);
  assert.equal(m.reference, 1);
  assert.equal(m.accountCode, 2);
  assert.equal(m.accountName, 3);
  assert.equal(m.description, 4);
  assert.equal(m.debit, 5);
  assert.equal(m.credit, 6);
});

test('judul berbahasa Inggris juga tertebak', () => {
  const m = guessColumns(['Date', 'Account Code', 'Description', 'Debit', 'Credit']);
  assert.equal(m.date, 0);
  assert.equal(m.accountCode, 1);
  assert.equal(m.debit, 3);
  assert.equal(m.credit, 4);
});

test('satu kolom tidak dipakai untuk dua peran sekaligus', () => {
  const m = guessColumns(['Kode Akun', 'Nama Akun']);
  assert.notEqual(m.accountCode, m.accountName);
});

/* ---------------- Terjemahan akun GuestPro ---------------- */

test('nomor akun GuestPro diterjemahkan ke nomor baru', () => {
  assert.equal(resolveLegacyAccount('612.01', 'PMS1')?.newCode, '6120.01');   // Biaya Listrik
  assert.equal(resolveLegacyAccount('6120.03-10', 'PMS2')?.newCode, '6120.01');
  assert.equal(resolveLegacyAccount('6120.03-30', 'PMS2')?.newCode, '6120.01');
});

test('penanda cabang pada akun lama menyiratkan unit', () => {
  assert.equal(resolveLegacyAccount('6120.03-10', 'PMS2')?.unit, 'THL');
  assert.equal(resolveLegacyAccount('6120.03-30', 'PMS2')?.unit, 'SKR');
  assert.equal(resolveLegacyAccount('111.05', 'PMS1')?.unit, 'IGYT');        // IGYT - Kas Pemasukan
});

test('nomor akun yang sama bisa berarti berbeda di dua PMS', () => {
  const a = resolveLegacyAccount('111.01', 'PMS1');
  assert.equal(a?.name, 'TH - Kas Pemasukan');
  assert.equal(a?.unit, 'THU', 'pada PMS 1, "TH" berarti The Hita Uluwatu');
});

/* ---------------- Penyusunan jurnal ---------------- */

const KNOWN_ACCOUNTS = new Set(['6120.01', '1120.01', '4110.01', '1110.01']);
const KNOWN_UNITS = new Set(['THU', 'IGYT', 'THL', 'SKR', 'PLD']);

const baseOptions = {
  columns: { ...EMPTY_MAP, date: 0, reference: 1, accountCode: 2, description: 3, debit: 4, credit: 5 },
  pms: 'PMS2' as const,
  defaultUnitCode: 'THL',
  knownAccountCodes: KNOWN_ACCOUNTS,
  knownUnitCodes: KNOWN_UNITS,
};

test('dua baris dengan nomor bukti sama menjadi satu jurnal', () => {
  const plan = buildImportPlan(
    [
      ['01/03/2026', 'JV-001', '6120.03-10', 'Listrik Maret', '1500000', ''],
      ['01/03/2026', 'JV-001', '1120.01', 'Listrik Maret', '', '1500000'],
    ],
    baseOptions,
  );

  assert.equal(plan.issues.length, 0);
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].lines.length, 2);
  assert.ok(plan.entries[0].balanced);
  assert.equal(plan.entries[0].lines[0].accountCode, '6120.01', 'nomor lama diterjemahkan');
  assert.equal(plan.entries[0].lines[0].unitCode, 'THL', 'cabang disimpulkan dari akhiran -10');
});

test('akhiran cabang berbeda menghasilkan unit berbeda dalam satu bukti', () => {
  const plan = buildImportPlan(
    [
      ['01/03/2026', 'JV-002', '6120.03-10', 'Listrik bersama', '1000000', ''],
      ['01/03/2026', 'JV-002', '6120.03-30', 'Listrik bersama', '500000', ''],
      ['01/03/2026', 'JV-002', '1120.01', 'Listrik bersama', '', '1500000'],
    ],
    baseOptions,
  );

  assert.equal(plan.entries.length, 1);
  assert.deepEqual(plan.entries[0].unitCodes.sort(), ['SKR', 'THL']);
  assert.ok(plan.entries[0].balanced);
});

test('tanpa nomor bukti, pengelompokan memakai tanggal dan keterangan', () => {
  const opts = { ...baseOptions, columns: { ...baseOptions.columns, reference: -1 } };
  const plan = buildImportPlan(
    [
      ['01/03/2026', '', '6120.03-10', 'Listrik Maret', '1500000', ''],
      ['01/03/2026', '', '1120.01', 'Listrik Maret', '', '1500000'],
      ['02/03/2026', '', '6120.03-10', 'Internet Maret', '500000', ''],
      ['02/03/2026', '', '1120.01', 'Internet Maret', '', '500000'],
    ],
    opts,
  );
  assert.equal(plan.entries.length, 2);
  assert.ok(plan.entries.every((e) => e.balanced));
});

test('bukti yang tidak seimbang dilaporkan sebagai masalah', () => {
  const plan = buildImportPlan(
    [
      ['01/03/2026', 'JV-003', '6120.03-10', 'Listrik', '1500000', ''],
      ['01/03/2026', 'JV-003', '1120.01', 'Listrik', '', '1400000'],
    ],
    baseOptions,
  );
  assert.equal(plan.entries[0].balanced, false);
  assert.ok(plan.issues.some((i) => i.message.includes('tidak seimbang')));
});

test('akun tak dikenal dilaporkan, baris lain tetap diproses', () => {
  const plan = buildImportPlan(
    [
      ['01/03/2026', 'JV-004', '9999.99', 'Entah apa', '100000', ''],
      ['01/03/2026', 'JV-005', '6120.03-10', 'Listrik', '200000', ''],
      ['01/03/2026', 'JV-005', '1120.01', 'Listrik', '', '200000'],
    ],
    baseOptions,
  );
  assert.ok(plan.issues.some((i) => i.row === 1 && i.message.includes('tidak dikenal')));
  assert.equal(plan.entries.filter((e) => e.balanced).length, 1);
});

test('baris kosong dan baris subtotal dilewati tanpa dianggap kesalahan', () => {
  const plan = buildImportPlan(
    [
      ['01/03/2026', 'JV-006', '6120.03-10', 'Listrik', '100000', ''],
      ['', '', '', '', '', ''],
      ['', '', '', 'TOTAL', '100000', '100000'],
      ['01/03/2026', 'JV-006', '1120.01', 'Listrik', '', '100000'],
    ],
    baseOptions,
  );
  assert.equal(plan.issues.length, 0);
  assert.equal(plan.skipped, 1, 'baris TOTAL tanpa akun & tanggal dilewati');
  assert.equal(plan.entries.length, 1);
});

test('satu kolom nominal bertanda ikut didukung', () => {
  const opts = {
    ...baseOptions,
    columns: { ...EMPTY_MAP, date: 0, reference: 1, accountCode: 2, description: 3, amount: 4 },
  };
  const plan = buildImportPlan(
    [
      ['01/03/2026', 'JV-007', '6120.03-10', 'Listrik', '1500000'],
      ['01/03/2026', 'JV-007', '1120.01', 'Listrik', '-1500000'],
    ],
    opts,
  );
  assert.equal(plan.entries.length, 1);
  assert.ok(plan.entries[0].balanced);
  assert.equal(plan.entries[0].lines[1].credit, 1_500_000);
});

test('nominal negatif pada kolom debit dipindah ke sisi kredit', () => {
  const plan = buildImportPlan(
    [
      ['01/03/2026', 'JV-008', '6120.03-10', 'Koreksi', '(250000)', ''],
      ['01/03/2026', 'JV-008', '1120.01', 'Koreksi', '250000', ''],
    ],
    baseOptions,
  );
  assert.equal(plan.entries[0].lines[0].credit, 250_000);
  assert.equal(plan.entries[0].lines[0].debit, 0);
  assert.ok(plan.entries[0].balanced);
});

test('kolom unit pada berkas mengalahkan tebakan dari akun', () => {
  const opts = { ...baseOptions, columns: { ...baseOptions.columns, unit: 6 } };
  const plan = buildImportPlan(
    [['01/03/2026', 'JV-009', '6120.03-10', 'Listrik', '100000', '', 'PLD']],
    opts,
  );
  assert.equal(plan.entries[0].lines[0].unitCode, 'PLD');
});

test('akun tanpa penanda cabang memakai cabang bawaan yang dipilih', () => {
  const plan = buildImportPlan(
    [['01/03/2026', 'JV-010', '1120.01', 'Setoran', '100000', '']],
    { ...baseOptions, defaultUnitCode: 'SKR' },
  );
  assert.equal(plan.entries[0].lines[0].unitCode, 'SKR');
});

test('pemisah ribuan tunggal tidak tertukar dengan desimal', () => {
  assert.equal(parseNumber('1.500'), 1_500, 'rupiah: titik = ribuan');
  assert.equal(parseNumber('1,500'), 1_500, 'rupiah: koma = ribuan');
  assert.equal(parseNumber('1,5'), 1.5, 'satu angka di belakang = desimal');
  assert.equal(parseNumber('0,75'), 0.75);
  assert.equal(parseNumber('2750000'), 2_750_000);
  assert.equal(parseNumber('12.345.678,90'), 12_345_678.9);
});
