import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  bagiProporsional, hitungRencana, jendela, pecahMinggu, usulkanProyeksi,
  type Masukan,
} from '../src/lib/rencana-kas';

const jt = (n: number) => n * 1_000_000;
const keJt = (n: number) => Math.round(n / 100_000) / 10;
const tgl = (s: string) => new Date(`${s}T00:00:00.000Z`);

/**
 * Angka dari rapat 9 Oktober 2026 (slide 9 & 10). Dipakai sebagai acuan karena
 * hasilnya sudah dihitung terpisah di luar sistem, jadi kalau mesin ini
 * menyimpang, yang keliru mesinnya.
 */
const rapat9Okt: Masukan = {
  period: '2026-10',
  tanggal: tgl('2026-10-09'),
  saldoKas: jt(134.5),
  masukSampaiKini: jt(154.7),
  proyeksi: { PESIMIS: jt(333), NORMAL: jt(366.3), OPTIMIS: jt(418) },
  komitmen: [
    { label: 'Cicilan bank', amount: jt(75.6), dueDay: null, paid: false },
    { label: 'Service pegawai', amount: jt(60), dueDay: 15, paid: false },
    { label: 'Gaji', amount: jt(125), dueDay: 1, paid: false },
  ],
  kategori: [
    { label: 'Purchasing', weight: 20 },
    { label: 'Petty cash & HR', weight: 7 },
  ],
};

test('sisa bulan dihitung mulai sehari setelah posisi kas dilaporkan', () => {
  const j = jendela('2026-10', tgl('2026-10-09'));
  assert.equal(j.mulai.toISOString().slice(0, 10), '2026-10-10');
  assert.equal(j.selesai.toISOString().slice(0, 10), '2026-10-31');
  assert.equal(j.hari, 22);
});

test('posisi kas sebelum bulan berjalan tidak memundurkan awal jendela', () => {
  const j = jendela('2026-11', tgl('2026-10-09'));
  assert.equal(j.mulai.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(j.hari, 30);
});

test('bulan yang sudah lewat tidak menyisakan hari', () => {
  assert.equal(jendela('2026-10', tgl('2026-10-31')).hari, 0);
  assert.equal(jendela('2026-10', tgl('2026-11-05')).hari, 0);
});

test('sisa 22 hari dipecah 7-7-8, bukan 7-7-7-1', () => {
  const m = pecahMinggu(tgl('2026-10-10'), tgl('2026-10-31'));
  assert.deepEqual(m.map((x) => x.hari), [7, 7, 8]);
  assert.equal(m[0].mulai.toISOString().slice(0, 10), '2026-10-10');
  assert.equal(m[0].selesai.toISOString().slice(0, 10), '2026-10-16');
  assert.equal(m[2].selesai.toISOString().slice(0, 10), '2026-10-31');
});

test('sisa kurang dari sepekan tetap menjadi satu minggu', () => {
  assert.deepEqual(pecahMinggu(tgl('2026-10-27'), tgl('2026-10-31')).map((x) => x.hari), [5]);
});

test('pembagian proporsional selalu berjumlah persis sama dengan totalnya', () => {
  for (const total of [jt(52.2), jt(85.5), 1, 999_999, 0]) {
    for (const bobot of [[7, 7, 8], [1], [3, 1], [5, 5, 5, 5]]) {
      const bagian = bagiProporsional(total, bobot);
      assert.equal(bagian.reduce((s, v) => s + v, 0), total, `${total} / ${bobot}`);
    }
  }
});

test('bobot nol tidak menghasilkan NaN', () => {
  assert.deepEqual(bagiProporsional(jt(10), [0, 0]), [0, 0]);
});

test('ketiga skenario sama dengan hitungan rapat 9 Oktober', () => {
  const r = hitungRencana(rapat9Okt);
  assert.equal(keJt(r.komitmenBelumBayar), 260.6);
  assert.equal(keJt(r.skenario.PESIMIS.bolehBelanja), 52.2);
  assert.equal(keJt(r.skenario.NORMAL.bolehBelanja), 85.5);
  assert.equal(keJt(r.skenario.OPTIMIS.bolehBelanja), 137.2);
});

test('komitmen yang sudah dibayar tidak lagi mengurangi anggaran', () => {
  const lunas = {
    ...rapat9Okt,
    komitmen: rapat9Okt.komitmen.map((k) => (k.label === 'Cicilan bank' ? { ...k, paid: true } : k)),
  };
  const r = hitungRencana(lunas);
  assert.equal(keJt(r.komitmenBelumBayar), 185);
  assert.equal(keJt(r.skenario.NORMAL.bolehBelanja), 85.5 + 75.6);
});

test('target uang masuk mingguan sama dengan tabel slide 10', () => {
  const r = hitungRencana(rapat9Okt);
  assert.deepEqual(r.minggu.map((m) => Math.round(m.targetMasuk / 1_000_000)), [222, 289, 366]);
});

test('plafon dasar dan tambahan berjumlah sama dengan anggaran normal', () => {
  const r = hitungRencana(rapat9Okt);
  const dasar = r.minggu.reduce((s, m) => s + m.plafonDasar, 0);
  const tambahan = r.minggu.reduce((s, m) => s + m.tambahan, 0);
  assert.equal(keJt(dasar), 52.2);
  assert.equal(keJt(dasar + tambahan), 85.5);
});

test('uang masuk yang sudah melampaui proyeksi tidak membuat sisa menjadi negatif', () => {
  const r = hitungRencana({ ...rapat9Okt, masukSampaiKini: jt(400) });
  assert.equal(r.skenario.PESIMIS.sisaMasuk, 0);
  assert.equal(keJt(r.skenario.PESIMIS.bolehBelanja), keJt(jt(134.5) - jt(260.6)));
  // Targetnya tidak boleh mundur ke bawah angka yang sudah tercapai.
  for (const m of r.minggu) assert.ok(m.targetMasuk >= jt(400));
});

test('anggaran yang minus tidak menghasilkan plafon negatif', () => {
  const r = hitungRencana({ ...rapat9Okt, saldoKas: 0, proyeksi: { PESIMIS: jt(100), NORMAL: jt(120), OPTIMIS: jt(150) } });
  assert.ok(r.skenario.PESIMIS.bolehBelanja < 0);
  for (const m of r.minggu) {
    assert.equal(m.plafonDasar, 0);
    assert.equal(m.tambahan, 0);
  }
});

test('porsi kategori mengikuti bobot dan berjumlah sama dengan anggaran normal', () => {
  const r = hitungRencana(rapat9Okt);
  assert.deepEqual(r.kategori.map((k) => k.label), ['Purchasing', 'Petty cash & HR']);
  assert.equal(r.kategori.reduce((s, k) => s + k.sisaBulan, 0), Math.max(0, r.skenario.NORMAL.bolehBelanja));
  // 20 : 7 — Purchasing mendapat porsi terbesar.
  assert.ok(r.kategori[0].perMinggu > r.kategori[1].perMinggu * 2);
});

test('tanpa kategori, rencana tetap terhitung', () => {
  const r = hitungRencana({ ...rapat9Okt, kategori: [] });
  assert.deepEqual(r.kategori, []);
  assert.equal(keJt(r.skenario.NORMAL.bolehBelanja), 85.5);
});

test('usulan skenario memakai terendah, tertimbang, dan tertinggi', () => {
  const u = usulkanProyeksi([jt(300), jt(419.9), jt(351)]);
  assert.ok(u);
  assert.equal(keJt(u.PESIMIS), 300);
  assert.equal(keJt(u.OPTIMIS), 419.9);
  // (300x1 + 419,9x2 + 351x3) / 6
  assert.equal(keJt(u.NORMAL), keJt((jt(300) + jt(419.9) * 2 + jt(351) * 3) / 6));
});

test('riwayat kosong tidak menghasilkan usulan', () => {
  assert.equal(usulkanProyeksi([]), null);
  assert.equal(usulkanProyeksi([0, 0]), null);
});

test('plafon dan target selalu bulat, karena dibacakan sebagai aturan', () => {
  const r = hitungRencana(rapat9Okt);
  const bulat = (n: number) => n % 100_000 === 0;
  for (const m of r.minggu) {
    assert.ok(bulat(m.plafonDasar), `plafon ${m.plafonDasar}`);
    assert.ok(bulat(m.tambahan), `tambahan ${m.tambahan}`);
    assert.ok(bulat(m.targetMasuk), `target ${m.targetMasuk}`);
  }
  for (const s of ['PESIMIS', 'NORMAL', 'OPTIMIS'] as const) {
    assert.ok(bulat(r.skenario[s].perMinggu), `per minggu ${s}`);
  }
  for (const k of r.kategori) assert.ok(bulat(k.perMinggu), `kategori ${k.label}`);
});

test('plafon mingguan tidak pernah melampaui anggaran normal', () => {
  const kasus = [
    rapat9Okt,
    // Kas defisit: pesimis dan normal sama-sama minus, tetapi selisihnya positif.
    { ...rapat9Okt, saldoKas: jt(120), masukSampaiKini: jt(235) },
    // Pesimis minus, normal masih positif.
    { ...rapat9Okt, saldoKas: jt(120), masukSampaiKini: jt(200) },
  ];
  for (const m of kasus) {
    const r = hitungRencana(m);
    const total = r.minggu.reduce((s, w) => s + w.plafonDasar + w.tambahan, 0);
    assert.equal(total, Math.max(0, r.skenario.NORMAL.bolehBelanja),
      `saldo ${m.saldoKas}, masuk ${m.masukSampaiKini}`);
    for (const w of r.minggu) {
      assert.ok(w.plafonDasar >= 0 && w.tambahan >= 0, 'plafon tidak boleh negatif');
    }
  }
});
