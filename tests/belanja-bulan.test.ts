import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  itemJatuhTempo, itemKomitmen, itemProyek, itemRab, keluarItem, rekapBelanja, tanggalDalamBulan, urutkanBelanja,
} from '../src/lib/belanja-bulan.ts';
import { keluarProyekPada, keluarProyekUntukKas } from '../src/lib/proyek.ts';

const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);
const posisi = tgl('2026-11-15');
const tanpaLama = { nilai: null, quantity: null, unitPrice: null, tanggal: null, catatan: null };
const rab = (o: Partial<Parameters<typeof itemRab>[0]>) => itemRab({
  id: 'r', label: 'Gaji', asal: 'RAB HR · THL', href: '/rab/x', anggaran: 10_000_000,
  tanggal: tgl('2026-11-25'), lama: tanpaLama, pembayaran: [], selesai: false, ...o,
}, posisi);

test('baris RAB belum dibayar: seluruh anggaran akan keluar pada tanggal rencananya', () => {
  const i = rab({});
  assert.equal(i.sisa, 10_000_000);
  assert.equal(keluarItem(i), 10_000_000);
  assert.equal(i.status, 'BELUM');
  assert.deepEqual(i.jadwal, [{ tanggal: tgl('2026-11-25'), nilai: 10_000_000 }]);
});

test('baris RAB dibayar sebagian: bayar sebelum posisi sudah di saldo, sesudahnya belum', () => {
  const i = rab({ pembayaran: [
    { date: tgl('2026-11-10'), amount: 3_000_000, quantity: null, note: null },
    { date: tgl('2026-11-18'), amount: 2_000_000, quantity: null, note: null },
  ] });
  assert.equal(i.dibayar, 5_000_000);
  assert.equal(i.sisa, 5_000_000);
  assert.equal(i.sesudahPosisi, 2_000_000);
  assert.equal(keluarItem(i), 7_000_000);
  assert.equal(i.status, 'SEBAGIAN');
});

test('baris RAB selesai lebih murah: hanya realisasinya, hemat tidak dihitung', () => {
  const i = rab({ selesai: true, pembayaran: [{ date: tgl('2026-11-18'), amount: 8_000_000, quantity: null, note: null }] });
  assert.equal(i.sisa, 0);
  assert.equal(keluarItem(i), 8_000_000);
  assert.equal(i.diSaldo, false);
  const lunasLama = rab({ selesai: true, pembayaran: [{ date: tgl('2026-11-02'), amount: 8_000_000, quantity: null, note: null }] });
  assert.equal(keluarItem(lunasLama), 0);
  assert.equal(lunasLama.diSaldo, true);
});

test('baris RAB lewat tanggal dan belum dibayar tetap dihitung, ditandai terlambat', () => {
  const i = rab({ tanggal: tgl('2026-11-05') });
  assert.equal(i.terlambat, true);
  assert.equal(keluarItem(i), 10_000_000);
});

test('komitmen: tanggal jatuh tempo di bulan itu, yang dibayar sudah di saldo', () => {
  const k = itemKomitmen({ id: 'k', label: 'Cicilan Bank', amount: 75_000_000, dueDay: 31, paid: false, recurring: true }, '2026-11', posisi);
  assert.deepEqual(k.tanggal, tgl('2026-11-30'));
  assert.equal(keluarItem(k), 75_000_000);
  const lunas = itemKomitmen({ id: 'k', label: 'x', amount: 5, dueDay: null, paid: true, recurring: false }, '2026-11', posisi);
  assert.equal(keluarItem(lunas), 0);
  assert.equal(lunas.status, 'SELESAI');
});

test('kewajiban dan cicilan: sebelum posisi sudah di saldo', () => {
  const dasar = { kunci: 'w', sumber: 'KEWAJIBAN' as const, label: 'PBB', asal: 'Kewajiban', href: null, amount: 1_000_000 };
  assert.equal(keluarItem(itemJatuhTempo({ ...dasar, jatuhTempo: tgl('2026-11-10') }, posisi)), 0);
  assert.equal(keluarItem(itemJatuhTempo({ ...dasar, jatuhTempo: tgl('2026-11-20') }, posisi)), 1_000_000);
});

test('item proyek bulan ini cocok dengan uang proyek di ramalan kas', () => {
  const item = (id: string, amount: number, planned: string, done: boolean, bayar: [string, number][] = []) => ({
    id, name: id, amount, paid: false, done, plannedDate: tgl(planned),
    pembayaran: bayar.map(([d, a]) => ({ date: tgl(d), amount: a })),
  });
  const projects = [
    { id: 'p', name: 'Renovasi', status: 'APPROVED', startDate: tgl('2026-12-01'), items: [
      item('a', 3_000_000, '2026-11-20', false, [['2026-11-18', 1_000_000]]),
      item('b', 2_000_000, '2026-12-10', false),
      item('c', 4_000_000, '2026-11-05', true, [['2026-11-03', 3_500_000]]),
      item('d', 1_000_000, '2026-10-20', false),
    ] },
    { id: 'q', name: 'Draf', status: 'DRAFT', startDate: tgl('2026-12-01'), items: [item('z', 9_000_000, '2026-11-20', false)] },
  ];
  const hariIni = tgl('2026-11-20');
  const daftar = itemProyek(projects, posisi, '2026-11', hariIni);
  assert.deepEqual(daftar.map((i) => i.kunci).sort(), ['proyek-a', 'proyek-c', 'proyek-d']);
  const total = rekapBelanja(daftar).keluar;
  assert.equal(total, keluarProyekPada(keluarProyekUntukKas(projects, posisi, '2026-11', hariIni), '2026-11'));
  assert.equal(total, 4_000_000); // a: 1 jt sesudah posisi + 2 jt sisa; d: 1 jt terlambat
  const c = daftar.find((i) => i.kunci === 'proyek-c')!;
  assert.equal(c.status, 'SELESAI');
  assert.equal(c.diSaldo, true);
});

test('urutan: menurut tanggal, yang tanpa tanggal di akhir', () => {
  const a = rab({ id: 'a', tanggal: null });
  const b = rab({ id: 'b', tanggal: tgl('2026-11-20') });
  const c = itemKomitmen({ id: 'c', label: 'x', amount: 1, dueDay: 1, paid: false, recurring: true }, '2026-11', posisi);
  assert.deepEqual(urutkanBelanja([a, b, c]).map((i) => i.kunci), ['komitmen-c', 'rab-b', 'rab-a']);
  assert.deepEqual(tanggalDalamBulan('2026-02', 31), tgl('2026-02-28'));
});
