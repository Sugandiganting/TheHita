/**
 * Membaca berkas ekspor menjadi tabel mentah (baris x kolom).
 *
 * Mendukung CSV dan XLSX. Berkas .xls lama dari GuestPro perlu dibuka di Excel
 * atau Numbers lalu disimpan ulang sebagai CSV/XLSX — satu langkah singkat yang
 * menghindari pustaka pembaca .xls yang punya celah keamanan diketahui.
 */

export type RawTable = {
  rows: string[][];
  /** Nama lembar yang dibaca, bila berkasnya XLSX. */
  sheet?: string;
  sheetNames?: string[];
};

/** Pemisah kolom dideteksi dari baris pertama: koma, titik koma, atau tab. */
function detectDelimiter(sample: string): string {
  const head = sample.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = [',', ';', '\t'].map((d) => ({
    d,
    n: (head.match(new RegExp(d === '\t' ? '\t' : `\\${d}`, 'g')) ?? []).length,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ',';
}

/** Pembaca CSV yang menghormati tanda kutip dan baris baru di dalam sel. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/^﻿/, ''); // buang penanda BOM dari Excel
  const d = delimiter ?? detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];

    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === d) {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') {
      cell += c;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.map((r) => r.map((v) => v.trim()));
}

/** Membaca XLSX lewat ExcelJS. Hanya dipakai di server. */
export async function parseXlsx(buffer: ArrayBuffer, sheetName?: string): Promise<RawTable> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheetNames = wb.worksheets.map((w) => w.name);
  const sheet = (sheetName && wb.getWorksheet(sheetName)) || wb.worksheets[0];
  if (!sheet) return { rows: [], sheetNames };

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    // ExcelJS memakai indeks mulai 1; indeks 0 selalu kosong.
    const arr = (row.values as unknown[]) ?? [];
    for (let i = 1; i < arr.length; i++) {
      values.push(cellToText(arr[i]));
    }
    rows.push(values);
  });

  return { rows, sheet: sheet.name, sheetNames };
}

/** Mengubah isi sel apa pun menjadi teks yang bisa diproses seragam. */
function cellToText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join('');
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    return '';
  }
  return String(v).trim();
}

/**
 * Membuang baris judul laporan di atas tabel — ekspor GuestPro menaruh nama
 * properti dan waktu cetak beberapa baris sebelum header kolom.
 *
 * Baris header dipilih sebagai baris dengan sel terisi terbanyak di antara
 * 20 baris pertama; baris di atasnya dibuang.
 */
export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestCount = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const filled = rows[i].filter((c) => c && c.trim() !== '').length;
    if (filled > bestCount) {
      bestCount = filled;
      best = i;
    }
  }
  return bestCount >= 2 ? best : 0;
}
