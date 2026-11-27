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
  const admin = { permissions: 'pengguna.kelola' };
  assert.equal(masihAdaPengelola([{ active: true, level: staf }]), false);
  assert.equal(masihAdaPengelola([{ active: true, level: staf }, { active: false, level: admin }]), false);
  assert.equal(masihAdaPengelola([{ active: true, level: staf }, { active: true, level: admin }]), true);
  assert.equal(masihAdaPengelola([{ active: true, level: null }]), true);
});
