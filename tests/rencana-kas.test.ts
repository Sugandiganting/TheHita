import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  HORIZON_BULAN, bagiProporsional, hitungRencana, hitungRunway, jendela, lipatBelanja,
  pecahMinggu, usulkanProyeksi, type EntriBelanja, type Masukan,
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
  terpakai: 0,
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
  assert.equal(r.kategori.reduce((s, k) => s + k.jatah, 0), Math.max(0, r.skenario.NORMAL.jatah));
  // 20 : 7 — Purchasing mendapat porsi terbesar.
  assert.ok(r.kategori[0].perMinggu > r.kategori[1].perMinggu * 2);
});

test('sisa tiap kategori berjumlah sama dengan angka boleh belanja di kartu', () => {
  const r = hitungRencana({
    ...rapat9Okt,
    terpakai: undefined,
    kategori: [
      { label: 'Purchasing', weight: 20, terpakai: jt(30) },
      { label: 'Petty cash & HR', weight: 7, terpakai: jt(5) },
    ],
  });
  assert.equal(keJt(r.terpakai), 35, 'total diturunkan dari rincian kategori');
  assert.equal(keJt(r.skenario.NORMAL.jatah), 85.5);
  assert.equal(keJt(r.skenario.NORMAL.bolehBelanja), 50.5);
  assert.equal(
    r.kategori.reduce((s, k) => s + k.sisa, 0), r.skenario.NORMAL.bolehBelanja,
    'jumlah sisa kategori harus sama dengan boleh belanja, bukan memotong dua kali',
  );
});

test('kategori yang lewat jatah bernilai minus, bukan dinolkan', () => {
  const r = hitungRencana({
    ...rapat9Okt,
    terpakai: undefined,
    kategori: [
      { label: 'Purchasing', weight: 20, terpakai: jt(90) },
      { label: 'Petty cash & HR', weight: 7, terpakai: 0 },
    ],
  });
  // Jatah Purchasing 20/27 x 85,5 = 63,3; terpakai 90 -> minus 26,7.
  assert.ok(r.kategori[0].sisa < 0);
  assert.equal(keJt(r.kategori[0].sisa), keJt(r.kategori[0].jatah - jt(90)));
  assert.ok(r.kategori[1].sisa > 0, 'kategori lain tidak ikut terseret');
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

/* ---------------- laporan belanja ---------------- */

const belanja = (n: number, amount: number, mode: 'TAMBAH' | 'SETEL', hari: string): EntriBelanja =>
  ({ urut: n, date: tgl(hari), amount: jt(amount), mode });

test('TAMBAH menumpuk, SETEL membuang riwayat sebelumnya', () => {
  assert.equal(lipatBelanja([
    belanja(0, 5, 'TAMBAH', '2026-10-11'),
    belanja(1, 3, 'TAMBAH', '2026-10-13'),
  ]), jt(8));

  assert.equal(lipatBelanja([
    belanja(0, 5, 'TAMBAH', '2026-10-11'),
    belanja(1, 3, 'TAMBAH', '2026-10-13'),
    belanja(2, 14, 'SETEL', '2026-10-14'),
  ]), jt(14));

  assert.equal(lipatBelanja([
    belanja(0, 14, 'SETEL', '2026-10-14'),
    belanja(1, 2, 'TAMBAH', '2026-10-15'),
  ]), jt(16));
});

test('urutan ditentukan tanggal, bukan urutan pengisian', () => {
  assert.equal(lipatBelanja([
    belanja(0, 2, 'TAMBAH', '2026-10-20'),
    belanja(1, 14, 'SETEL', '2026-10-14'),
  ]), jt(16));
});

test('dua laporan bertanggal sama tetap berurutan stabil', () => {
  assert.equal(lipatBelanja([
    belanja(1, 3, 'TAMBAH', '2026-10-14'),
    belanja(0, 10, 'SETEL', '2026-10-14'),
  ]), jt(13));
});

test('tanpa laporan, yang terpakai nol', () => {
  assert.equal(lipatBelanja([]), 0);
});

test('yang sudah terpakai mengurangi plafon, bukan jatahnya', () => {
  const r = hitungRencana({ ...rapat9Okt, terpakai: jt(20) });
  assert.equal(keJt(r.skenario.NORMAL.jatah), 85.5);
  assert.equal(keJt(r.skenario.NORMAL.bolehBelanja), 65.5);
  const total = r.minggu.reduce((s, m) => s + m.plafonDasar + m.tambahan, 0);
  assert.equal(total, Math.max(0, r.skenario.NORMAL.bolehBelanja));
});

/* ---------------- kapan kas habis ---------------- */

/**
 * Bulan-bulan berikutnya mengikuti bulan berjalan kecuali disebut lain — itu
 * perilaku bawaannya, dan membuat pengujian lama tetap menguji hal yang sama.
 */
const runway = (
  o: Omit<Parameters<typeof hitungRunway>[0], 'proyeksiBerikutnya'> & { proyeksiBerikutnya?: number },
) => hitungRunway({ ...o, proyeksiBerikutnya: () => o.proyeksiBerikutnya ?? o.proyeksiBulanan });

/** Pola September 2026: masuk Rp351 jt, keluar Rp402,8 jt termasuk cicilan. */
const runwaySeptember = {
  period: '2026-10',
  saldoKas: jt(134.5),
  pengeluaranBulanan: jt(402.8),
  // Gaji, service, dan cicilan: berulang, dan seluruhnya belum dibayar.
  komitmenBelumBayar: jt(260.6),
  komitmenRutinSebulan: jt(260.6),
  kebutuhanGaji: jt(125),
  hariTersisa: 22,
  hariSebulan: 31,
};

test('arus bersih bulanan sama dengan hitungan slide 8', () => {
  const normal = runway({ ...runwaySeptember, sisaMasuk: jt(211.6), proyeksiBulanan: jt(351) });
  assert.equal(keJt(normal.arusBersih), -51.8);

  const pesimis = runway({ ...runwaySeptember, sisaMasuk: jt(178.3), proyeksiBulanan: jt(333) });
  assert.equal(keJt(pesimis.arusBersih), -69.8);
});

test('kas yang terus menyusut punya bulan habis', () => {
  const r = runway({ ...runwaySeptember, sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) });
  assert.ok(r.habisPada, 'seharusnya habis dalam horizon');
  // Bulan terakhir adalah yang pertama minus; tidak ada bulan sesudahnya.
  assert.equal(r.bulan[r.bulan.length - 1].period, r.habisPada);
  assert.ok(r.bulan[r.bulan.length - 1].saldoAkhir < 0);
  for (const b of r.bulan.slice(0, -1)) assert.ok(b.saldoAkhir >= 0);
});

test('gaji terancam lebih dulu daripada kas habis', () => {
  const r = runway({ ...runwaySeptember, sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) });
  assert.ok(r.gajiTerancam);
  assert.ok(r.habisPada);
  assert.ok(r.gajiTerancam! <= r.habisPada!);
});

test('arus bersih positif tidak pernah menghabiskan kas', () => {
  const r = runway({ ...runwaySeptember, sisaMasuk: jt(300), proyeksiBulanan: jt(500) });
  assert.equal(r.habisPada, null);
  assert.equal(r.bulan.length, 13);
  assert.ok(r.arusBersih > 0);
});

test('horizon bisa dipersingkat dan tidak pernah tak berujung', () => {
  const r = runway({ ...runwaySeptember, sisaMasuk: jt(300), proyeksiBulanan: jt(500), horizon: 3 });
  assert.equal(r.bulan.length, 4);
});

test('komitmen sekali ini menggerakkan ramalan sebesar nominalnya', () => {
  const dasar = { ...runwaySeptember, sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) };
  const sebelum = runway(dasar);
  // Renovasi Rp 80 jt: menambah yang belum dibayar, tetapi bukan pengeluaran rutin.
  const sesudah = runway({ ...dasar, komitmenBelumBayar: jt(260.6 + 80) });

  assert.equal(
    keJt(sebelum.bulan[0].saldoAkhir - sesudah.bulan[0].saldoAkhir), 80,
    'saldo akhir bulan berjalan harus turun persis sebesar komitmennya',
  );
  // Hanya bulan berjalan yang terpukul; bulan berikutnya lajunya tetap sama.
  assert.equal(sebelum.arusBersih, sesudah.arusBersih);
});

test('komitmen berulang tidak dihitung dua kali', () => {
  const dasar = { ...runwaySeptember, sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) };
  // Seluruh pengeluaran rutin kebetulan berupa komitmen berulang: tidak ada
  // sisa operasional untuk diprorata, jadi yang dikurangi hanya komitmennya.
  const r = runway({ ...dasar, pengeluaranBulanan: jt(260.6) });
  assert.equal(keJt(r.bulan[0].saldoAkhir), keJt(jt(134.5) + jt(211.6) - jt(260.6)));
});

test('pengeluaran rutin lebih kecil daripada komitmennya tidak jadi angka negatif', () => {
  const r = runway({
    ...runwaySeptember,
    sisaMasuk: jt(211.6),
    proyeksiBulanan: jt(366.3),
    pengeluaranBulanan: jt(100),
    komitmenRutinSebulan: jt(260.6),
  });
  // Operasionalnya dinolkan, bukan dibalik menjadi penambah saldo.
  assert.equal(keJt(r.bulan[0].saldoAkhir), keJt(jt(134.5) + jt(211.6) - jt(260.6)));
});

test('komitmen yang sudah dibayar tidak lagi memukul ramalan', () => {
  const dasar = { ...runwaySeptember, sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) };
  const lunas = runway({ ...dasar, komitmenBelumBayar: 0 });
  assert.equal(
    keJt(lunas.bulan[0].saldoAkhir - runway(dasar).bulan[0].saldoAkhir), 260.6,
  );
});

test('kategori yang lewat jatah tidak diberi plafon mingguan negatif', () => {
  const r = hitungRencana({
    ...rapat9Okt,
    terpakai: undefined,
    kategori: [
      { label: 'Purchasing', weight: 20, terpakai: jt(90) },
      { label: 'Petty cash & HR', weight: 7, terpakai: 0 },
    ],
  });
  assert.ok(r.kategori[0].sisa < 0, 'sisanya memang minus');
  assert.equal(r.kategori[0].perMinggu, 0, 'tetapi plafonnya nol, bukan minus');
  assert.ok(r.kategori[1].perMinggu > 0);
});

test('bulan berikutnya memakai proyeksinya sendiri, bukan proyeksi bulan ini', () => {
  const dasar = { ...runwaySeptember, sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) };

  // Oktober musim sedang, November-Desember ramai: lajunya harus ikut berubah.
  const ramai = hitungRunway({ ...dasar, proyeksiBerikutnya: () => jt(450) });
  assert.equal(keJt(ramai.arusBersih), keJt(jt(450) - jt(402.8)));

  const sepi = hitungRunway({ ...dasar, proyeksiBerikutnya: () => jt(300) });
  assert.equal(keJt(sepi.arusBersih), keJt(jt(300) - jt(402.8)));

  // Bulan berjalan tidak ikut berubah: ia memakai sisa uang masuknya sendiri.
  assert.equal(ramai.bulan[0].saldoAkhir, sepi.bulan[0].saldoAkhir);
});

test('bulan ramai menyelamatkan kas yang akan habis bila dilihat dari bulan sepi', () => {
  // Saldo awal dibuat cukup supaya bulan berjalan belum minus; yang diuji di
  // sini adalah arah bulan-bulan sesudahnya, bukan posisi hari ini.
  const dasar = {
    ...runwaySeptember, saldoKas: jt(300), sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3),
  };
  assert.ok(hitungRunway({ ...dasar, proyeksiBerikutnya: () => jt(366.3) }).bulan[0].saldoAkhir > 0);
  assert.ok(hitungRunway({ ...dasar, proyeksiBerikutnya: () => jt(366.3) }).habisPada, 'laju turun -> habis');
  assert.equal(hitungRunway({ ...dasar, proyeksiBerikutnya: () => jt(450) }).habisPada, null, 'laju naik -> tidak habis');
});

test('tiap bulan boleh punya proyeksinya sendiri', () => {
  const dasar = { ...runwaySeptember, saldoKas: jt(300), sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) };
  // November ramai, Desember sepi: saldonya naik dulu, lalu turun.
  const r = hitungRunway({
    ...dasar,
    proyeksiBerikutnya: (p) => (p === '2026-11' ? jt(500) : jt(300)),
    horizon: 2,
  });
  assert.ok(r.bulan[1].saldoAkhir > r.bulan[0].saldoAkhir, 'November naik');
  assert.ok(r.bulan[2].saldoAkhir < r.bulan[1].saldoAkhir, 'Desember turun');
  // Ringkasan lajunya mewakili bulan terdekat.
  assert.equal(keJt(r.arusBersih), keJt(jt(500) - jt(402.8)));
});

test('ringkasan laju mengikuti seluruh ramalan, bukan bulan depan saja', () => {
  const dasar = { ...runwaySeptember, saldoKas: jt(300), sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3) };
  // November ramai sekali, sebelas bulan sesudahnya sepi: kas tetap habis.
  const r = hitungRunway({
    ...dasar,
    proyeksiBerikutnya: (p) => (p === '2026-11' ? jt(500) : jt(300)),
  });

  assert.ok(r.arusBersih > 0, 'bulan depan memang menambah kas');
  assert.ok(r.arusRata < 0, 'tetapi sepanjang ramalan kas menyusut');
  assert.ok(r.habisPada, 'dan kasnya memang habis');
  // Kartu ringkasan tidak boleh berbunyi "bertambah" di bawah tanggal kas habis.
  assert.equal(r.arusRata < 0, r.habisPada !== null);

  assert.equal(r.arusTertinggi.period, '2026-11');
  assert.equal(keJt(r.arusTertinggi.arus), keJt(jt(500) - jt(402.8)));
  assert.equal(keJt(r.arusTerendah.arus), keJt(jt(300) - jt(402.8)));
});

test('laju tetap terbaca sampai akhir horizon meski kas sudah habis di tengah', () => {
  const r = hitungRunway({
    ...runwaySeptember, saldoKas: jt(10), sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3),
    proyeksiBerikutnya: () => jt(300),
  });
  // Daftar saldo berhenti begitu minus, tetapi lajunya tidak ikut berhenti:
  // pertanyaannya "seberapa cepat terkuras", bukan "sampai kapan dihitung".
  assert.ok(r.bulan.length < HORIZON_BULAN + 1, 'daftar saldonya memang berhenti lebih awal');
  assert.equal(keJt(r.arusRata), keJt(jt(300) - jt(402.8)));
});

test('cicilan rencana belanja memotong jatah bulan berjalan', () => {
  const polos = hitungRencana(rapat9Okt);
  const dengan = hitungRencana({ ...rapat9Okt, cicilanBelanja: jt(25) });
  assert.equal(dengan.cicilanBelanja, jt(25));
  assert.equal(keJt(polos.skenario.NORMAL.jatah - dengan.skenario.NORMAL.jatah), 25);
  // Komitmen biasa tetap terpisah, supaya keduanya bisa ditampilkan sendiri.
  assert.equal(dengan.komitmenBelumBayar, polos.komitmenBelumBayar);
});

test('cicilan di bulan-bulan berikutnya menurunkan ramalan di bulannya sendiri', () => {
  const dasar = {
    ...runwaySeptember, saldoKas: jt(300), sisaMasuk: jt(211.6), proyeksiBulanan: jt(366.3),
  };
  const polos = runway(dasar);
  const dengan = hitungRunway({
    ...dasar,
    proyeksiBerikutnya: () => jt(366.3),
    cicilanPada: (p) => (p === '2026-12' ? jt(40) : 0),
  });
  assert.equal(polos.bulan[0].saldoAkhir, dengan.bulan[0].saldoAkhir, 'Oktober tidak terpengaruh');
  assert.equal(polos.bulan[1].saldoAkhir, dengan.bulan[1].saldoAkhir, 'November tidak terpengaruh');
  assert.equal(keJt(polos.bulan[2].saldoAkhir - dengan.bulan[2].saldoAkhir), 40, 'Desember turun');
  // Penurunannya menetap, bukan hanya sebulan.
  assert.equal(keJt(polos.bulan[3].saldoAkhir - dengan.bulan[3].saldoAkhir), 40);
});
