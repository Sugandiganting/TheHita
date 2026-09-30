/**
 * Mengubah tabel mentah hasil ekspor PMS menjadi jurnal yang siap disimpan.
 *
 * Seluruh fungsi di sini murni (tanpa akses database) supaya bisa diuji dan
 * supaya pratinjau di layar memakai perhitungan yang sama persis dengan yang
 * nanti benar-benar disimpan.
 */

import { round, type DraftLine } from '../accounting';
import { resolveLegacyAccount, type PmsSource } from '../coa-legacy';

/** Peran tiap kolom pada berkas. Nilainya indeks kolom, -1 berarti tidak dipakai. */
export type ColumnMap = {
  date: number;
  accountCode: number;
  accountName: number;
  debit: number;
  credit: number;
  /** Dipakai bila berkas hanya punya satu kolom nominal bertanda. */
  amount: number;
  unit: number;
  description: number;
  reference: number;
};

export const EMPTY_MAP: ColumnMap = {
  date: -1, accountCode: -1, accountName: -1, debit: -1, credit: -1,
  amount: -1, unit: -1, description: -1, reference: -1,
};

/** Kata kunci untuk menebak peran kolom dari judulnya. */
const HINTS: Record<keyof ColumnMap, string[]> = {
  date: ['tanggal', 'tgl', 'date', 'trans date', 'posting date'],
  accountCode: ['kode akun', 'no akun', 'nomor akun', 'account code', 'acc code', 'coa', 'kode', 'account'],
  accountName: ['nama akun', 'account name', 'keterangan akun', 'nama perkiraan'],
  debit: ['debit', 'debet', 'dr'],
  credit: ['kredit', 'credit', 'cr'],
  amount: ['nominal', 'jumlah', 'amount', 'nilai', 'total'],
  unit: ['unit', 'cabang', 'property', 'properti', 'outlet', 'branch', 'department'],
  description: ['keterangan', 'uraian', 'deskripsi', 'description', 'memo', 'narasi'],
  reference: ['no bukti', 'nomor bukti', 'voucher', 'ref', 'reference', 'no jurnal', 'no transaksi', 'doc no'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Menebak peran tiap kolom dari baris header. Pengguna tetap bisa mengubahnya. */
export function guessColumns(header: string[]): ColumnMap {
  const map = { ...EMPTY_MAP };
  const used = new Set<number>();

  // Cocokkan yang persis dulu, baru yang sekadar mengandung kata kunci.
  for (const exact of [true, false]) {
    for (const role of Object.keys(HINTS) as (keyof ColumnMap)[]) {
      if (map[role] !== -1) continue;
      for (let i = 0; i < header.length; i++) {
        if (used.has(i)) continue;
        const h = norm(header[i] ?? '');
        if (!h) continue;
        const hit = HINTS[role].some((k) => (exact ? h === k : h.includes(k)));
        if (hit) {
          map[role] = i;
          used.add(i);
          break;
        }
      }
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Pembacaan nilai                                                     */
/* ------------------------------------------------------------------ */

/**
 * Membaca angka bergaya Indonesia maupun Inggris.
 * "1.500.000,50" dan "1,500,000.50" sama-sama dibaca 1500000,5.
 * Angka dalam kurung dianggap negatif, kebiasaan laporan akuntansi.
 */
export function parseNumber(raw: string): number {
  if (!raw) return 0;
  let s = String(raw).trim();
  if (!s) return 0;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }

  s = s.replace(/[^\d.,]/g, '');
  if (!s) return 0;

  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;

  if (dots > 0 && commas > 0) {
    // Keduanya hadir: yang muncul terakhir adalah pemisah desimal,
    // yang satunya pemisah ribuan.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (dots > 0 || commas > 0) {
    const sep = dots > 0 ? '.' : ',';
    const count = dots > 0 ? dots : commas;
    const after = s.length - s.lastIndexOf(sep) - 1;
    // Muncul berkali-kali, atau sekali dengan tepat tiga angka di belakangnya:
    // itu pemisah ribuan. Nilai rupiah nyaris tidak pernah berdesimal tiga.
    const grouping = count > 1 || after === 3;
    s = grouping
      ? s.split(sep).join('')
      : s.replace(sep, '.');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

/**
 * Membaca tanggal dalam beberapa bentuk umum dan mengembalikannya sebagai
 * "YYYY-MM-DD". Format hari-dulu diutamakan karena itu kebiasaan Indonesia.
 */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return fmt(+iso[1], +iso[2], +iso[3]);

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let year = Number(y);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return fmt(year, Number(m), Number(d));
  }

  const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
    agu: 8, aug: 8, ags: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
  };
  const named = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (named) {
    const m = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (m) return fmt(Number(named[3]), m, Number(named[1]));
  }

  // Angka seri Excel (hari sejak 30 Desember 1899).
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000);
    return fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  return null;
}

function fmt(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Penyusunan jurnal                                                   */
/* ------------------------------------------------------------------ */

export type ImportOptions = {
  columns: ColumnMap;
  /** Dari PMS mana berkas ini berasal — menentukan arti penanda cabang. */
  pms: PmsSource;
  /** Cabang bawaan bila baris tidak menyebutkan dan akunnya tidak menyiratkan. */
  defaultUnitCode: string;
  /** Kode akun yang tersedia di sistem, untuk memeriksa hasil terjemahan. */
  knownAccountCodes: Set<string>;
  /** Kode unit yang tersedia di sistem. */
  knownUnitCodes: Set<string>;
};

export type ImportIssue = { row: number; message: string };

export type ImportedLine = {
  /** Nomor baris pada berkas, untuk menunjuk kesalahan. */
  row: number;
  date: string;
  accountCode: string;
  accountName: string;
  /** Kode akun lama apa adanya, ditampilkan pada pratinjau. */
  sourceCode: string;
  unitCode: string;
  debit: number;
  credit: number;
  description: string;
  reference: string;
};

export type ImportedEntry = {
  key: string;
  date: string;
  description: string;
  reference: string;
  lines: ImportedLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  /** Cabang yang tersentuh; lebih dari satu berarti perlu baris antar unit. */
  unitCodes: string[];
};

export type ImportPlan = {
  entries: ImportedEntry[];
  issues: ImportIssue[];
  skipped: number;
  totalLines: number;
  totalAmount: number;
  /** Baris yang cabangnya tidak tersirat di mana pun, jadi memakai cabang bawaan. */
  usedDefaultUnit: number;
};

/**
 * Menyusun baris-baris berkas menjadi kumpulan jurnal.
 *
 * Baris dikelompokkan menjadi satu bukti berdasarkan nomor bukti bila ada.
 * Bila tidak ada, pengelompokan memakai gabungan tanggal dan keterangan —
 * inilah yang biasanya dipakai ekspor buku besar tanpa nomor voucher.
 */
export function buildImportPlan(rows: string[][], options: ImportOptions): ImportPlan {
  const { columns: c, pms } = options;
  const issues: ImportIssue[] = [];
  const lines: ImportedLine[] = [];
  let skipped = 0;
  let usedDefaultUnit = 0;

  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? (r[i] ?? '').trim() : '');

  rows.forEach((r, idx) => {
    const rowNo = idx + 1;
    const isEmpty = r.every((v) => !v || !v.trim());
    if (isEmpty) return;

    const rawCode = cell(r, c.accountCode);
    const dateText = cell(r, c.date);

    // Baris subtotal atau judul kelompok: tidak punya akun maupun tanggal.
    if (!rawCode && !dateText) {
      skipped++;
      return;
    }

    let debit = c.debit >= 0 ? parseNumber(cell(r, c.debit)) : 0;
    let credit = c.credit >= 0 ? parseNumber(cell(r, c.credit)) : 0;

    if (c.amount >= 0 && debit === 0 && credit === 0) {
      const amt = parseNumber(cell(r, c.amount));
      if (amt >= 0) debit = amt;
      else credit = -amt;
    }

    // Nominal negatif pada kolom debit/kredit dipindah ke sisi lawannya.
    if (debit < 0) { credit += -debit; debit = 0; }
    if (credit < 0) { debit += -credit; credit = 0; }

    debit = round(debit);
    credit = round(credit);

    if (debit === 0 && credit === 0) {
      skipped++;
      return;
    }

    const date = parseDate(dateText);
    if (!date) {
      issues.push({ row: rowNo, message: `Tanggal tidak terbaca: "${dateText}".` });
      return;
    }

    if (!rawCode) {
      issues.push({ row: rowNo, message: 'Nomor akun kosong.' });
      return;
    }

    // Terjemahkan nomor akun GuestPro; bila sudah memakai nomor baru, pakai apa adanya.
    // Nama akun ikut disertakan karena beberapa nomor GuestPro dipakai untuk
    // dua akun berbeda, dan hanya namanya yang membedakan.
    const rawName = cell(r, c.accountName);
    const legacy = resolveLegacyAccount(rawCode, pms, rawName || undefined);
    let code = legacy ? legacy.newCode : rawCode.trim();

    if (legacy && !legacy.newCode) {
      issues.push({
        row: rowNo,
        message: `Akun ${rawCode} (${legacy.name}) bertanda tidak dipakai lagi dan tidak punya padanan.`,
      });
      return;
    }
    if (!options.knownAccountCodes.has(code)) {
      issues.push({
        row: rowNo,
        message: legacy
          ? `Akun ${rawCode} diterjemahkan ke ${code}, tetapi akun itu tidak ada di COA.`
          : `Nomor akun ${rawCode} tidak dikenal, dan tidak ada padanannya di COA GuestPro.`,
      });
      return;
    }

    // Cabang: dari kolom bila ada, kalau tidak dari penanda pada akun lama,
    // kalau tidak juga pakai cabang bawaan yang dipilih pengguna.
    const unitFromColumn = cell(r, c.unit).toUpperCase();
    const fromColumn = unitFromColumn && options.knownUnitCodes.has(unitFromColumn) ? unitFromColumn : '';
    const unitCode = fromColumn || legacy?.unit || options.defaultUnitCode;
    if (!fromColumn && !legacy?.unit) usedDefaultUnit++;

    if (!options.knownUnitCodes.has(unitCode)) {
      issues.push({ row: rowNo, message: `Unit usaha "${unitCode}" tidak dikenal.` });
      return;
    }

    lines.push({
      row: rowNo,
      date,
      accountCode: code,
      accountName: legacy?.name ?? '',
      sourceCode: rawCode,
      unitCode,
      debit,
      credit,
      description: cell(r, c.description),
      reference: cell(r, c.reference),
    });
  });

  // Kelompokkan menjadi bukti.
  const groups = new Map<string, ImportedLine[]>();
  for (const l of lines) {
    const key = l.reference ? `REF:${l.reference}` : `DD:${l.date}|${l.description}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  const entries: ImportedEntry[] = [...groups.entries()].map(([key, group]) => {
    const totalDebit = round(group.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round(group.reduce((s, l) => s + l.credit, 0));
    return {
      key,
      date: group[0].date,
      description: group.find((l) => l.description)?.description || 'Impor dari GuestPro',
      reference: group[0].reference,
      lines: group,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.5,
      unitCodes: [...new Set(group.map((l) => l.unitCode))],
    };
  });

  entries.sort((a, b) => a.date.localeCompare(b.date));

  for (const e of entries) {
    if (!e.balanced) {
      issues.push({
        row: e.lines[0].row,
        message:
          `Bukti "${e.reference || e.description}" tidak seimbang: ` +
          `debit ${e.totalDebit.toLocaleString('id-ID')} vs kredit ${e.totalCredit.toLocaleString('id-ID')}.`,
      });
    }
  }

  return {
    entries,
    issues,
    skipped,
    totalLines: lines.length,
    totalAmount: round(entries.reduce((s, e) => s + e.totalDebit, 0)),
    usedDefaultUnit,
  };
}

/** Mengubah satu bukti hasil impor menjadi baris jurnal siap simpan. */
export function entryToDraftLines(
  entry: ImportedEntry,
  accountIdByCode: Map<string, string>,
  unitIdByCode: Map<string, string>,
): DraftLine[] {
  return entry.lines.map((l) => ({
    accountId: accountIdByCode.get(l.accountCode)!,
    unitId: unitIdByCode.get(l.unitCode)!,
    debit: l.debit,
    credit: l.credit,
    memo: l.description || null,
  }));
}
