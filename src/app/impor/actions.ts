'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import {
  INTERUNIT_PAYABLE,
  INTERUNIT_RECEIVABLE,
  balanceUnitsWithInterUnit,
  checkBalance,
  checkPerUnitBalance,
  type DraftLine,
  type InterUnitAccounts,
} from '@/lib/accounting';
import { findHeaderRow, parseCsv, parseXlsx } from '@/lib/import/parse';
import { buildImportPlan, entryToDraftLines, type ColumnMap } from '@/lib/import/build';
import { PMS_SOURCES, type PmsSource } from '@/lib/coa-legacy';

/** Batas jumlah baris supaya satu berkas tidak membuat server kehabisan memori. */
const MAX_ROWS = 20_000;

export type ParseResult =
  | { ok: false; message: string }
  | { ok: true; rows: string[][]; headerRow: number; sheet?: string; sheetNames?: string[]; truncated: boolean };

/** Membaca berkas unggahan menjadi tabel mentah. */
export async function parseImportFile(formData: FormData): Promise<ParseResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Pilih berkas terlebih dahulu.' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, message: 'Berkas lebih dari 8 MB. Pecah per bulan atau per cabang terlebih dahulu.' };
  }

  const name = file.name.toLowerCase();

  try {
    let rows: string[][] = [];
    let sheet: string | undefined;
    let sheetNames: string[] | undefined;

    if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
      rows = parseCsv(await file.text());
    } else if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
      const sheetName = String(formData.get('sheet') ?? '') || undefined;
      const parsed = await parseXlsx(await file.arrayBuffer(), sheetName);
      rows = parsed.rows;
      sheet = parsed.sheet;
      sheetNames = parsed.sheetNames;
    } else if (name.endsWith('.xls')) {
      return {
        ok: false,
        message:
          'Berkas .xls lama belum bisa dibaca langsung. Buka di Excel atau Numbers, lalu simpan ulang ' +
          'sebagai CSV atau XLSX (File → Save As), dan unggah hasilnya.',
      };
    } else {
      return { ok: false, message: 'Format tidak dikenal. Gunakan berkas CSV atau XLSX.' };
    }

    if (rows.length === 0) return { ok: false, message: 'Berkas kosong atau tidak berisi tabel.' };

    const truncated = rows.length > MAX_ROWS;
    if (truncated) rows = rows.slice(0, MAX_ROWS);

    return { ok: true, rows, headerRow: findHeaderRow(rows), sheet, sheetNames, truncated };
  } catch (e) {
    return {
      ok: false,
      message: `Berkas gagal dibaca: ${e instanceof Error ? e.message : 'kesalahan tidak dikenal'}.`,
    };
  }
}

async function getInterUnitAccounts(): Promise<InterUnitAccounts> {
  const [recv, pay] = await Promise.all([
    prisma.account.findUnique({ where: { code: INTERUNIT_RECEIVABLE }, select: { id: true } }),
    prisma.account.findUnique({ where: { code: INTERUNIT_PAYABLE }, select: { id: true } }),
  ]);
  if (!recv || !pay) throw new Error('Akun antar unit belum ada. Jalankan penyiapan database terlebih dahulu.');
  return { receivableId: recv.id, payableId: pay.id };
}

/** Sidik jari satu bukti, dipakai mencegah berkas yang sama terimpor dua kali. */
function fingerprint(date: string, reference: string, total: number, lineCount: number): string {
  return `impor:${date}|${reference}|${Math.round(total)}|${lineCount}`;
}

export type CommitResult = {
  ok: boolean;
  message: string;
  imported: number;
  duplicates: number;
  skipped: number;
};

/**
 * Menyimpan hasil impor.
 *
 * Rencana disusun ulang di server dari baris mentah — tidak memakai hasil
 * perhitungan di layar — supaya data yang masuk selalu melewati pemeriksaan
 * yang sama, apa pun yang dikirim peramban.
 */
export async function commitImport(payload: {
  rows: string[][];
  columns: ColumnMap;
  pms: PmsSource;
  defaultUnitCode: string;
}): Promise<CommitResult> {
  const fail = (message: string): CommitResult => ({ ok: false, message, imported: 0, duplicates: 0, skipped: 0 });

  if (!Array.isArray(payload.rows) || payload.rows.length === 0) return fail('Tidak ada baris untuk diimpor.');
  if (payload.rows.length > MAX_ROWS) return fail(`Maksimal ${MAX_ROWS.toLocaleString('id-ID')} baris per berkas.`);

  // Berkas dari satu PMS tidak boleh jatuh ke cabang milik PMS lain — kekeliruan
  // seperti itu masuk diam-diam dan sulit ditelusuri belakangan.
  const allowed = PMS_SOURCES[payload.pms]?.units as readonly string[] | undefined;
  if (!allowed) return fail('Sumber PMS tidak dikenal.');
  if (!allowed.includes(payload.defaultUnitCode)) {
    return fail(
      `Cabang bawaan "${payload.defaultUnitCode}" bukan bagian dari ${PMS_SOURCES[payload.pms].label}. ` +
        `Pilih salah satu dari: ${allowed.join(', ')}.`,
    );
  }

  const [accounts, units] = await Promise.all([
    prisma.account.findMany({ where: { active: true, isHeader: false }, select: { id: true, code: true } }),
    prisma.businessUnit.findMany({ where: { active: true }, select: { id: true, code: true } }),
  ]);

  const accountIdByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const unitIdByCode = new Map(units.map((u) => [u.code, u.id]));

  const plan = buildImportPlan(payload.rows, {
    columns: payload.columns,
    pms: payload.pms,
    defaultUnitCode: payload.defaultUnitCode,
    knownAccountCodes: new Set(accountIdByCode.keys()),
    knownUnitCodes: new Set(unitIdByCode.keys()),
  });

  const usable = plan.entries.filter((e) => e.balanced);
  if (usable.length === 0) {
    return fail('Tidak ada bukti yang seimbang untuk diimpor. Periksa daftar masalah di bawah.');
  }

  const interUnit = await getInterUnitAccounts();

  // Bukti yang sudah pernah masuk sebelumnya dilewati.
  const prints = usable.map((e) => fingerprint(e.date, e.reference, e.totalDebit, e.lines.length));
  const existing = await prisma.journalEntry.findMany({
    where: { source: 'IMPORT', notes: { in: prints } },
    select: { notes: true },
  });
  const seen = new Set(existing.map((e) => e.notes));

  let imported = 0;
  let duplicates = 0;
  const problems: string[] = [];

  // Disimpan bertahap agar berkas besar tidak menahan satu transaksi terlalu lama.
  const BATCH = 100;
  for (let i = 0; i < usable.length; i += BATCH) {
    const batch = usable.slice(i, i + BATCH);

    await prisma.$transaction(
      async (tx) => {
        for (const entry of batch) {
          const print = fingerprint(entry.date, entry.reference, entry.totalDebit, entry.lines.length);
          if (seen.has(print)) {
            duplicates++;
            continue;
          }

          let lines: DraftLine[] = entryToDraftLines(entry, accountIdByCode, unitIdByCode);
          // Data PMS lama tidak mengenal akun antar unit; tambalkan bila perlu.
          lines = balanceUnitsWithInterUnit(lines, interUnit, 'Penyeimbang impor antar cabang');

          if (!checkBalance(lines).balanced || checkPerUnitBalance(lines).length > 0) {
            problems.push(entry.reference || entry.description);
            continue;
          }

          const [y, m, d] = entry.date.split('-').map(Number);
          await tx.journalEntry.create({
            data: {
              date: new Date(Date.UTC(y, m - 1, d)),
              unitId: unitIdByCode.get(entry.lines[0].unitCode)!,
              description: entry.description,
              reference: entry.reference || null,
              source: 'IMPORT',
              notes: print,
              lines: { create: lines },
            },
          });
          seen.add(print);
          imported++;
        }
      },
      { timeout: 60_000 },
    );
  }

  revalidatePath('/');
  revalidatePath('/transaksi');
  revalidatePath('/laporan');
  revalidatePath('/peramalan');
  revalidatePath('/kas');

  const unbalanced = plan.entries.length - usable.length;

  const parts = [`${imported.toLocaleString('id-ID')} bukti berhasil diimpor`];
  if (duplicates > 0) parts.push(`${duplicates} dilewati karena sudah pernah diimpor`);
  if (unbalanced > 0) parts.push(`${unbalanced} dilewati karena tidak seimbang`);
  if (problems.length > 0) parts.push(`${problems.length} gagal disimpan`);

  // Tidak ada yang masuk karena semuanya sudah pernah diimpor bukanlah kegagalan —
  // justru itu yang diharapkan saat berkas yang sama diunggah ulang.
  const allDuplicates = imported === 0 && duplicates > 0 && problems.length === 0;

  return {
    ok: imported > 0 || allDuplicates,
    message: allDuplicates
      ? `Semua ${duplicates} bukti pada berkas ini sudah pernah diimpor, jadi tidak ada yang ditambahkan.` +
        (unbalanced > 0 ? ` ${unbalanced} bukti lain dilewati karena tidak seimbang.` : '')
      : parts.join(', ') + '.',
    imported,
    duplicates,
    skipped: plan.entries.length - usable.length + problems.length,
  };
}
