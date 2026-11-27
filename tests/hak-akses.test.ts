import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HAK_AKSI_PROYEK, HAK_AKSI_TAMBAHAN, SEMUA_HAK, bacaHak, hakPengguna, masihAdaPengelola, tulisHak,
} from '../src/lib/hak-akses.ts';
import { AKSI_PROYEK, AKSI_TAMBAHAN } from '../src/lib/proyek.ts';

test('hak akses dibaca dan ditulis sebagai teks; kode tak dikenal dibuang', () => {
  assert.deepEqual(bacaHak('proyek.ajukan, proyek.ngawur ,proyek.ajukan'), ['proyek.ajukan']);
  assert.deepEqual(bacaHak(''), []);
  assert.equal(tulisHak(['proyek.setujui_dana', 'proyek.ajukan']), 'proyek.ajukan,proyek.setujui_dana');
});

test('pengguna tanpa level berakses penuh; dengan level hanya yang dicentang', () => {
  assert.equal(hakPengguna(null).size, SEMUA_HAK.length);
  const h = hakPengguna({ permissions: 'proyek.ajukan' });
  assert.equal(h.has('proyek.ajukan'), true);
  assert.equal(h.has('proyek.setujui_dana'), false);
});

test('setiap langkah proyek dan pengajuan tambahan punya hak aksesnya', () => {
  for (const a of Object.keys(AKSI_PROYEK)) assert.ok(SEMUA_HAK.includes(HAK_AKSI_PROYEK[a as keyof typeof HAK_AKSI_PROYEK]), a);
  for (const a of Object.keys(AKSI_TAMBAHAN)) assert.ok(SEMUA_HAK.includes(HAK_AKSI_TAMBAHAN[a as keyof typeof HAK_AKSI_TAMBAHAN]), a);
});

test('harus tersisa satu pengguna aktif yang bisa mengelola pengguna', () => {
  const staf = { permissions: 'proyek.ajukan' };
  // Kode lama pengguna.kelola diterjemahkan menjadi hak Pengguna + User Level.
  const admin = { permissions: 'pengguna.kelola' };
  assert.equal(masihAdaPengelola([{ active: true, level: staf }]), false);
  assert.equal(masihAdaPengelola([{ active: true, level: staf }, { active: false, level: admin }]), false);
  assert.equal(masihAdaPengelola([{ active: true, level: staf }, { active: true, level: admin }]), true);
  assert.equal(masihAdaPengelola([{ active: true, level: null }]), true);
});

import { KATALOG_HAK } from '../src/lib/hak-akses.ts';
test('setiap hak punya sub menu, dan sub menu di satu menu berurutan', () => {
  for (const m of KATALOG_HAK) {
    const urutan = m.hak.map((h) => h.sub);
    for (const h of m.hak) assert.ok(h.sub.length > 0, h.kode);
    // Sub menu yang sama tidak terpecah: begitu ditinggalkan, tidak muncul lagi.
    const dilewati = new Set<string>();
    urutan.forEach((sub, i) => {
      if (i > 0 && urutan[i - 1] !== sub) dilewati.add(urutan[i - 1]);
      assert.ok(!dilewati.has(sub), `${m.modul}: ${sub} terpecah`);
    });
  }
});

import { HAK_PENGELOLA, halamanTertutup, hakMaster } from '../src/lib/hak-akses.ts';
test('master data: tiap menu punya lihat/tambah/ubah/hapus; kode lama diterjemahkan', () => {
  for (const a of ['lihat', 'tambah', 'ubah', 'hapus'] as const) assert.ok(SEMUA_HAK.includes(hakMaster('coa', a)));
  const lama = bacaHak('pengguna.kelola,proyek.ajukan');
  for (const k of HAK_PENGELOLA) assert.ok(lama.includes(k), k);
  assert.ok(lama.includes('proyek.ajukan'));
  assert.ok(lama.includes(hakMaster('user_level', 'hapus')));
});

test('menu master tanpa hak lihat disembunyikan', () => {
  const h = new Set<string>([hakMaster('coa', 'lihat'), hakMaster('unit', 'lihat')]);
  const tutup = halamanTertutup(h);
  assert.ok(!tutup.includes('/coa'));
  assert.ok(tutup.includes('/kendaraan'));
  assert.ok(tutup.includes('/user-level'));
  assert.deepEqual(halamanTertutup(new Set(SEMUA_HAK)), []);
});

test('pengelola hak akses butuh lihat + ubah Pengguna dan User Level', () => {
  const sebagian = { permissions: [hakMaster('pengguna', 'lihat'), hakMaster('pengguna', 'ubah'), hakMaster('user_level', 'lihat')].join(',') };
  assert.equal(masihAdaPengelola([{ active: true, level: sebagian }]), false);
  assert.equal(masihAdaPengelola([{ active: true, level: { permissions: HAK_PENGELOLA.join(',') } }]), true);
});
