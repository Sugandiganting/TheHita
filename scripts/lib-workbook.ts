/**
 * Pembacaan workbook Excel yang dipakai bersama oleh skrip impor.
 *
 * Dipisahkan ke sini karena dua skrip membaca workbook proyeksi yang sama:
 * `impor-kondisi-kas.ts` mengambil satu bulan berjalan secara lengkap, dan
 * `impor-riwayat-kas.ts` mengambil posisi kas banyak bulan sekaligus. Tabel
 * nama bulan khususnya harus sama di keduanya — kalau digandakan, cepat atau
 * lambat yang satu diperbaiki dan yang lain tertinggal.
 */

import { readFile } from 'node:fs/promises';

export type Sheet = import('exceljs').Worksheet;
export type Workbook = import('exceljs').Workbook;

/** Nama bulan Inggris dan Indonesia dipakai bercampur di dalam workbook. */
export const BULAN: Record<number, string[]> = {
  1: ['january', 'januari'], 2: ['february', 'februari'], 3: ['march', 'maret'],
  4: ['april'], 5: ['may', 'mei'], 6: ['june', 'juni'], 7: ['july', 'juli'],
  8: ['august', 'agustus'], 9: ['september'], 10: ['october', 'oktober'],
  11: ['november'], 12: ['december', 'desember'],
};

/** Nomor bulan dari namanya, atau null bila bukan nama bulan. */
export function nomorBulan(nama: string): number | null {
  const n = nama.trim().toLowerCase();
  const hit = Object.entries(BULAN).find(([, daftar]) => daftar.includes(n));
  return hit ? Number(hit[0]) : null;
}

export const teks = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null) {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.result !== undefined) return teks(o.result);
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if (o.text !== undefined) return String(o.text);
  }
  return String(v);
};

export const angka = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const r = (v as { result?: unknown }).result;
    if (typeof r === 'number') return r;
  }
  return null;
};

/**
 * Tanggal di kolom saldo diketik sebagai teks biasa, mis. "12 Oktober 2026",
 * bukan sebagai tanggal Excel — jadi keduanya harus bisa dibaca.
 */
export function bacaTanggal(v: unknown): Date | null {
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  const m = /^\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/.exec(teks(v));
  if (!m) return null;
  const bulan = nomorBulan(m[2]);
  if (!bulan) return null;
  return new Date(Date.UTC(Number(m[3]), bulan - 1, Number(m[1])));
}

export async function bukaWorkbook(path: string): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(path)).buffer as ArrayBuffer);
  return wb;
}

export function ambilSheet(wb: Workbook, nama: string): Sheet {
  const ws = wb.getWorksheet(nama);
  if (!ws) {
    throw new Error(
      `Sheet "${nama}" tidak ada. Yang tersedia: ${wb.worksheets.map((w) => w.name).join(', ')}`,
    );
  }
  return ws;
}

/** Nomor baris yang kolom A-nya persis berbunyi `label`. */
export function cariBaris(ws: Sheet, label: string, sampai = 80): number {
  for (let r = 1; r <= sampai; r += 1) {
    if (teks(ws.getCell(r, 1).value).trim().toLowerCase() === label.toLowerCase()) return r;
  }
  throw new Error(`Baris "${label}" tidak ditemukan di sheet ${ws.name}`);
}

export const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bad: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/** Tanda minus di depan "Rp", seperti kebiasaan menulis rupiah negatif. */
export const rupiah = (n: number) => {
  const bulat = Math.round(n);
  return (bulat < 0 ? '-Rp ' : 'Rp ') + Math.abs(bulat).toLocaleString('id-ID');
};
