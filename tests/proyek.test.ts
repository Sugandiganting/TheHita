import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bacaJumlah, hargaSatuanItem, totalItemProyek } from '../src/lib/proyek.ts';

test('total item = jumlah × harga satuan', () => {
  assert.equal(totalItemProyek(4, 2_500_000), 10_000_000);
  assert.equal(totalItemProyek(1.5, 1_000_001), 1_500_001.5);
});

test('item lama tanpa harga satuan memakai nominalnya', () => {
  assert.equal(hargaSatuanItem({ quantity: 1, unitPrice: null, amount: 5_000_000 }), 5_000_000);
  assert.equal(hargaSatuanItem({ quantity: 3, unitPrice: 200, amount: 600 }), 200);
});

test('jumlah boleh pecahan dengan koma atau titik', () => {
  assert.equal(bacaJumlah('1,5'), 1.5);
  assert.equal(bacaJumlah('2.25'), 2.25);
  assert.equal(bacaJumlah('abc'), 0);
});

/* Alur persetujuan proyek */
import { aksiTersedia, AKSI_PROYEK, statusBaku, statusEfektif } from '../src/lib/proyek.ts';

const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);

test('status lama "Direncanakan" dibaca Approved supaya tetap memotong kas', () => {
  assert.equal(statusBaku('PLANNED'), 'APPROVED');
  assert.equal(statusBaku('PROPOSED'), 'PROPOSED');
  assert.equal(statusBaku('ANEH'), 'DRAFT');
});

test('Approved menjadi In Progress begitu tanggal mulai tiba', () => {
  assert.equal(statusEfektif('APPROVED', tgl('2026-12-01'), tgl('2026-11-30')), 'APPROVED');
  assert.equal(statusEfektif('APPROVED', tgl('2026-12-01'), tgl('2026-12-01')), 'ONGOING');
  assert.equal(statusEfektif('FUNDING_REVIEW', tgl('2026-12-01'), tgl('2027-01-01')), 'FUNDING_REVIEW');
});

test('tiap tahap hanya membuka langkah berikutnya', () => {
  assert.deepEqual(aksiTersedia('DRAFT'), ['AJUKAN']);
  assert.deepEqual(aksiTersedia('PROPOSED'), ['SETUJUI_RENCANA', 'TOLAK', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTersedia('FUNDING_REVIEW'), ['SETUJUI_DANA', 'TOLAK', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTersedia('APPROVED'), ['TUNDA', 'BATALKAN', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTersedia('ONGOING'), ['SELESAI', 'TUNDA', 'BATALKAN']);
  assert.deepEqual(aksiTersedia('DONE'), []);
  assert.equal(AKSI_PROYEK.SETUJUI_DANA.ke, 'APPROVED');
});

/* Realisasi item: pembayaran sebagian, status selesai, selisih terhadap rencana */
import { rekapRealisasiItem } from '../src/lib/proyek.ts';

test('belum ada pembayaran: seluruh total masih akan keluar', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: false }, []);
  assert.equal(r.status, 'BELUM');
  assert.equal(r.sisaAkanKeluar, 10_000_000);
  assert.equal(r.selisih, null);
});

test('dibayar sebagian: sisanya masih akan keluar, selisih belum dihitung', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: false }, [{ amount: 3_000_000 }, { amount: 2_000_000 }]);
  assert.equal(r.status, 'SEBAGIAN');
  assert.equal(r.realisasi, 5_000_000);
  assert.equal(r.sisaAkanKeluar, 5_000_000);
  assert.equal(r.selisih, null);
});

test('selesai lebih murah: tidak ada lagi yang keluar, selisihnya hemat', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: true }, [{ amount: 8_500_000 }]);
  assert.equal(r.status, 'SELESAI');
  assert.equal(r.sisaAkanKeluar, 0);
  assert.equal(r.selisih, 1_500_000);
});

test('selesai lebih mahal: selisih negatif', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: true }, [{ amount: 11_200_000 }]);
  assert.equal(r.selisih, -1_200_000);
});

test('dibayar melebihi total tetapi belum selesai: sisa tidak minus', () => {
  const r = rekapRealisasiItem({ amount: 10_000_000, paid: false, done: false }, [{ amount: 12_000_000 }]);
  assert.equal(r.sisaAkanKeluar, 0);
});

test('tanda Lunas lama tanpa pembayaran dibaca selesai sebesar totalnya', () => {
  const r = rekapRealisasiItem({ amount: 2_000_000, paid: true, done: false }, []);
  assert.equal(r.status, 'SELESAI');
  assert.equal(r.realisasi, 2_000_000);
  assert.equal(r.selisih, 0);
  assert.equal(r.dariLunasLama, true);
});

import { realisasiDibuka } from '../src/lib/proyek.ts';
test('realisasi baru dibuka setelah dana disetujui', () => {
  for (const s of ['DRAFT', 'PROPOSED', 'FUNDING_REVIEW', 'REJECTED'] as const) assert.equal(realisasiDibuka(s), false, s);
  for (const s of ['APPROVED', 'ONGOING', 'DONE', 'CANCELLED'] as const) assert.equal(realisasiDibuka(s), true, s);
});

import { rekapHematProyek } from '../src/lib/proyek.ts';
test('hemat proyek: RAB − realisasi dari item yang sudah selesai saja', () => {
  const r = rekapHematProyek([
    // Selesai lebih murah: hemat 500 rb.
    { amount: 3_000_000, paid: false, done: true, pembayaran: [{ amount: 1_000_000 }, { amount: 1_500_000 }] },
    // Selesai lebih mahal: lebih 200 rb.
    { amount: 1_000_000, paid: false, done: true, pembayaran: [{ amount: 1_200_000 }] },
    // Baru sebagian: belum punya angka hemat walau realisasinya di bawah RAB.
    { amount: 5_000_000, paid: false, done: false, pembayaran: [{ amount: 1_000_000 }] },
    // Lunas lama: selesai, pas RAB.
    { amount: 700_000, paid: true, done: false, pembayaran: [] },
  ]);
  assert.deepEqual(r, { hemat: 500_000, lebih: 200_000, bersih: 300_000, itemSelesai: 3, itemTotal: 4 });
});

test('hemat proyek kosong bila belum ada item selesai', () => {
  const r = rekapHematProyek([{ amount: 2_000_000, paid: false, done: false, pembayaran: [] }]);
  assert.deepEqual(r, { hemat: 0, lebih: 0, bersih: 0, itemSelesai: 0, itemTotal: 1 });
});

import { keluarProyekPada, keluarProyekUntukKas } from '../src/lib/proyek.ts';
test('uang proyek untuk rencana kas: sisa, pembayaran sesudah posisi, dan realisasi item selesai', () => {
  const posisi = tgl('2026-11-15');
  const hariIni = tgl('2026-11-20');
  const proyek = (status: string, items: Parameters<typeof keluarProyekUntukKas>[0][number]['items']) => ({
    id: status, name: `P ${status}`, status, startDate: tgl('2026-12-01'), items,
  });
  const item = (id: string, amount: number, plannedDate: string, done: boolean, bayar: [string, number][] = []) => ({
    id, name: id, amount, paid: false, done, plannedDate: tgl(plannedDate),
    pembayaran: bayar.map(([d, a]) => ({ date: tgl(d), amount: a })),
  });
  const daftar = keluarProyekUntukKas([
    proyek('APPROVED', [
      item('belum', 3_000_000, '2026-11-20', false),
      // DP 1 jt sesudah posisi + sisa 2 jt di tanggal rencana bulan depan.
      item('sebagian', 3_000_000, '2026-12-10', false, [['2026-11-18', 1_000_000]]),
      // Selesai lebih murah sesudah posisi: realisasinya saja, hemat tidak ikut.
      item('hemat', 3_000_000, '2026-11-25', true, [['2026-11-18', 2_500_000]]),
      // Selesai sebelum posisi: sudah ada di saldo.
      item('lama', 3_000_000, '2026-11-10', true, [['2026-11-10', 2_500_000]]),
      // Lewat tanggal rencana, belum dibayar: tetap dihitung bulan berjalan.
      item('telat', 500_000, '2026-11-05', false),
    ]),
    proyek('FUNDING_REVIEW', [item('draf', 9_000_000, '2026-11-20', false)]),
    proyek('DONE', [item('beres', 9_000_000, '2026-11-20', false)]),
  ], posisi, '2026-11', hariIni);

  assert.deepEqual(
    daftar.map((k) => [k.itemId, k.jenis, k.period, k.amount, k.terlambat]),
    [
      ['telat', 'SISA', '2026-11', 500_000, true],
      ['sebagian', 'BAYAR', '2026-11', 1_000_000, false],
      ['hemat', 'BAYAR', '2026-11', 2_500_000, false],
      ['belum', 'SISA', '2026-11', 3_000_000, false],
      ['sebagian', 'SISA', '2026-12', 2_000_000, false],
    ],
  );
  assert.equal(keluarProyekPada(daftar, '2026-11'), 7_000_000);
  assert.equal(keluarProyekPada(daftar, '2026-12'), 2_000_000);
});

import { qtyTerealisasi } from '../src/lib/proyek.ts';
test('qty terealisasi hanya dari pembayaran yang mencatat qty', () => {
  assert.equal(qtyTerealisasi([]), null);
  assert.equal(qtyTerealisasi([{ quantity: null }]), null);
  assert.equal(qtyTerealisasi([{ quantity: 1 }, { quantity: null }, { quantity: 0.5 }]), 1.5);
});

import {
  aksiTambahanTersedia, itemBaruLewatTambahan, itemBerlaku,
} from '../src/lib/proyek.ts';
test('proyek bisa ditandai On Hold (mangkrak), dilanjutkan, atau dibatalkan dari sana', () => {
  assert.ok(aksiTersedia('ONGOING').includes('TUNDA'));
  assert.ok(aksiTersedia('APPROVED').includes('TUNDA'));
  assert.deepEqual(aksiTersedia('ON_HOLD'), ['LANJUTKAN', 'BATALKAN']);
  assert.equal(AKSI_PROYEK.TUNDA.butuhCatatan, true);
  assert.equal(AKSI_PROYEK.LANJUTKAN.ke, 'APPROVED');
  // Dilanjutkan sesudah tanggal mulai: terbaca In Progress lagi.
  assert.equal(statusEfektif('APPROVED', tgl('2026-11-01'), tgl('2026-11-20')), 'ONGOING');
  assert.equal(statusEfektif('ON_HOLD', tgl('2026-11-01'), tgl('2026-11-20')), 'ON_HOLD');
  assert.equal(realisasiDibuka('ON_HOLD'), true);
});

test('pengajuan tambahan: alur sama dengan proyek, yang Approved tidak bisa ditarik', () => {
  assert.deepEqual(aksiTambahanTersedia('DRAFT'), ['AJUKAN']);
  assert.deepEqual(aksiTambahanTersedia('PROPOSED'), ['SETUJUI_RENCANA', 'TOLAK', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTambahanTersedia('FUNDING_REVIEW'), ['SETUJUI_DANA', 'TOLAK', 'KEMBALI_DRAF']);
  assert.deepEqual(aksiTambahanTersedia('APPROVED'), []);
  assert.deepEqual(aksiTambahanTersedia('REJECTED'), ['KEMBALI_DRAF']);
});

test('item tambahan baru berlaku setelah pengajuannya Approved', () => {
  assert.equal(itemBerlaku({}), true);
  assert.equal(itemBerlaku({ addendum: null }), true);
  assert.equal(itemBerlaku({ addendum: { status: 'FUNDING_REVIEW' } }), false);
  assert.equal(itemBerlaku({ addendum: { status: 'APPROVED' } }), true);
});

test('item baru masuk rencana awal sebelum Approved, pengajuan tambahan sesudahnya', () => {
  for (const s of ['DRAFT', 'PROPOSED', 'FUNDING_REVIEW', 'REJECTED'] as const) assert.equal(itemBaruLewatTambahan(s), 'RENCANA');
  for (const s of ['APPROVED', 'ONGOING'] as const) assert.equal(itemBaruLewatTambahan(s), 'TAMBAHAN');
  for (const s of ['ON_HOLD', 'DONE', 'CANCELLED'] as const) assert.equal(itemBaruLewatTambahan(s), 'DITUTUP');
});

test('proyek mangkrak atau selesai: sisa tidak dihitung, pembayaran sesudah posisi tetap; item tambahan menunggu persetujuan', () => {
  const posisi = tgl('2026-11-15');
  const hariIni = tgl('2026-11-20');
  const item = (id: string, addendum: { status: string } | null = null) => ({
    id, name: id, amount: 3_000_000, paid: false, done: false, plannedDate: tgl('2026-11-25'),
    pembayaran: [{ date: tgl('2026-11-18'), amount: 1_000_000 }], addendum,
  });
  const proyek = (status: string, items: ReturnType<typeof item>[]) => ({
    id: status, name: status, status, startDate: tgl('2026-11-01'), items,
  });
  const ringkas = (status: string, items: ReturnType<typeof item>[]) =>
    keluarProyekUntukKas([proyek(status, items)], posisi, '2026-11', hariIni).map((k) => [k.itemId, k.jenis, k.amount]);

  assert.deepEqual(ringkas('ON_HOLD', [item('a')]), [['a', 'BAYAR', 1_000_000]]);
  assert.deepEqual(ringkas('DONE', [item('a')]), [['a', 'BAYAR', 1_000_000]]);
  assert.deepEqual(ringkas('APPROVED', [item('a'), item('t', { status: 'PROPOSED' })]), [
    ['a', 'BAYAR', 1_000_000], ['a', 'SISA', 2_000_000],
  ]);
  assert.deepEqual(ringkas('APPROVED', [item('t', { status: 'APPROVED' })]), [
    ['t', 'BAYAR', 1_000_000], ['t', 'SISA', 2_000_000],
  ]);
  assert.deepEqual(ringkas('PROPOSED', [item('a')]), []);
});

import { kelompokProyek } from '../src/lib/proyek.ts';
test('kelompok proyek untuk penyaring daftar', () => {
  assert.equal(kelompokProyek('DONE'), 'SELESAI');
  assert.equal(kelompokProyek('ON_HOLD'), 'MANGKRAK');
  assert.equal(kelompokProyek('CANCELLED'), 'BATAL');
  assert.equal(kelompokProyek('ONGOING'), 'BERJALAN');
  assert.equal(kelompokProyek('REJECTED'), 'PENGAJUAN');
});
