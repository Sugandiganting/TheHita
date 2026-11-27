import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AKUN_BARU_SELARAS, GANTI_NAMA_AKUN, PINDAH_AKUN_BARANG } from '../src/lib/coa-selaras.ts';
import { COA_TEMPLATE } from '../src/lib/coa-template.ts';

const template = new Map(COA_TEMPLATE.map((a) => [a.code, a.name]));

test('akun bawaan memakai nama baru, jadi instalasi baru sama dengan yang sudah diselaraskan', () => {
  for (const g of GANTI_NAMA_AKUN) assert.equal(template.get(g.code), g.jadi, g.code);
  for (const code of AKUN_BARU_SELARAS) assert.ok(template.has(code), code);
});

test('nama akun hasil penyelarasan tidak kembar dengan akun lain', () => {
  const nama = COA_TEMPLATE.map((a) => a.name.toLowerCase());
  for (const g of GANTI_NAMA_AKUN) {
    assert.equal(nama.filter((n) => n === g.jadi.toLowerCase()).length, 1, g.jadi);
  }
});

test('barang hanya dipindah ke akun yang ada', () => {
  for (const p of PINDAH_AKUN_BARANG) {
    assert.ok(template.has(p.dari) && template.has(p.ke), `${p.kode}: ${p.dari} → ${p.ke}`);
    assert.notEqual(p.dari, p.ke);
  }
});
