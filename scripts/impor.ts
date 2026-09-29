/**
 * Impor transaksi dari berkas ekspor PMS lewat baris perintah.
 *
 * Dipakai untuk memasukkan data dalam jumlah besar tanpa lewat layar — mis.
 * dua belas berkas bulanan sekaligus — dan agar prosesnya bisa diulang persis
 * bila datanya perlu dimuat ulang.
 *
 * Contoh:
 *   npm run impor -- data/jurnal-maret.csv --pms=PMS2 --unit=THL
 *   npm run impor -- data/*.csv --pms=PMS2 --unit=THL --coba
 *
 * Pilihan:
 *   --pms=PMS1|PMS2   PMS asal berkas (wajib)
 *   --unit=KODE       Cabang bawaan untuk baris tanpa penanda cabang (wajib)
 *   --coba            Hanya menampilkan hasil, tidak menyimpan apa pun
 *   --judul=N         Paksa baris ke-N sebagai judul kolom (mulai dari 1)
 *   --kolom=peran:N   Paksa pemetaan satu kolom, mis. --kolom=debit:5
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  INTERUNIT_PAYABLE,
  INTERUNIT_RECEIVABLE,
  balanceUnitsWithInterUnit,
  checkBalance,
  checkPerUnitBalance,
  type DraftLine,
} from '../src/lib/accounting';
import { findHeaderRow, parseCsv, parseXlsx } from '../src/lib/import/parse';
import { buildImportPlan, guessColumns, type ColumnMap } from '../src/lib/import/build';
import { PMS_SOURCES, type PmsSource } from '../src/lib/coa-legacy';

const prisma = new PrismaClient();

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bad: (s: string) => `\x1b[31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

function parseArgs(argv: string[]) {
  const files: string[] = [];
  const opts: Record<string, string> = {};
  const columnOverrides: Partial<ColumnMap> = {};

  for (const a of argv) {
    if (!a.startsWith('--')) {
      files.push(a);
      continue;
    }
    const [key, value = 'true'] = a.slice(2).split('=');
    if (key === 'kolom') {
      const [role, idx] = value.split(':');
      columnOverrides[role as keyof ColumnMap] = Number(idx);
    } else {
      opts[key] = value;
    }
  }
  return { files, opts, columnOverrides };
}

async function readTable(file: string): Promise<string[][]> {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
    return parseCsv(await readFile(file, 'utf8'));
  }
  if (ext === '.xlsx' || ext === '.xlsm') {
    const buf = await readFile(file);
    const parsed = await parseXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    return parsed.rows;
  }
  throw new Error(
    `Format ${ext} tidak didukung. Buka di Excel atau Numbers lalu simpan ulang sebagai CSV atau XLSX.`,
  );
}

function fingerprint(date: string, reference: string, total: number, lineCount: number): string {
  return `impor:${date}|${reference}|${Math.round(total)}|${lineCount}`;
}

async function main() {
  const { files, opts, columnOverrides } = parseArgs(process.argv.slice(2));

  if (files.length === 0) {
    console.error('Sebutkan minimal satu berkas. Lihat keterangan di bagian atas scripts/impor.ts.');
    process.exit(1);
  }

  const pms = (opts.pms ?? '').toUpperCase() as PmsSource;
  if (!PMS_SOURCES[pms]) {
    console.error(`--pms wajib diisi PMS1 atau PMS2. PMS1 = ${PMS_SOURCES.PMS1.label}.`);
    process.exit(1);
  }

  const defaultUnit = (opts.unit ?? '').toUpperCase();
  const allowed = PMS_SOURCES[pms].units as readonly string[];
  if (!allowed.includes(defaultUnit)) {
    console.error(`--unit wajib salah satu dari: ${allowed.join(', ')} (milik ${PMS_SOURCES[pms].label}).`);
    process.exit(1);
  }

  const dryRun = opts.coba === 'true';

  const [accounts, units, recv, pay] = await Promise.all([
    prisma.account.findMany({ where: { active: true, isHeader: false }, select: { id: true, code: true } }),
    prisma.businessUnit.findMany({ where: { active: true }, select: { id: true, code: true } }),
    prisma.account.findUnique({ where: { code: INTERUNIT_RECEIVABLE }, select: { id: true } }),
    prisma.account.findUnique({ where: { code: INTERUNIT_PAYABLE }, select: { id: true } }),
  ]);

  if (!recv || !pay) throw new Error('Akun antar unit belum ada. Jalankan "npm run setup" terlebih dahulu.');

  const interUnit = { receivableId: recv.id, payableId: pay.id };
  const accountIdByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const unitIdByCode = new Map(units.map((u) => [u.code, u.id]));

  console.log(C.bold(`\nImpor dari ${PMS_SOURCES[pms].label}`));
  console.log(C.dim(`Cabang bawaan: ${defaultUnit}${dryRun ? '  ·  MODE COBA, tidak ada yang disimpan' : ''}\n`));

  let grandImported = 0;
  let grandDuplicates = 0;
  let grandSkipped = 0;

  for (const file of files) {
    console.log(C.bold(path.basename(file)));

    let rows: string[][];
    try {
      rows = await readTable(file);
    } catch (e) {
      console.log(`  ${C.bad('gagal dibaca')}: ${e instanceof Error ? e.message : e}\n`);
      continue;
    }

    const headerRow = opts.judul ? Number(opts.judul) - 1 : findHeaderRow(rows);
    const header = rows[headerRow] ?? [];
    const body = rows.slice(headerRow + 1);
    const columns = { ...guessColumns(header), ...columnOverrides };

    console.log(C.dim(`  ${rows.length} baris, judul di baris ${headerRow + 1}`));
    const shown = (['date', 'accountCode', 'debit', 'credit', 'amount', 'reference', 'description', 'unit'] as const)
      .filter((k) => columns[k] >= 0)
      .map((k) => `${k}="${header[columns[k]] ?? ''}"`);
    console.log(C.dim(`  kolom: ${shown.join(', ')}`));

    if (columns.date < 0 || columns.accountCode < 0) {
      console.log(`  ${C.bad('kolom tanggal atau nomor akun tidak ditemukan')} — pakai --kolom=date:N --kolom=accountCode:N\n`);
      continue;
    }

    const plan = buildImportPlan(body, {
      columns,
      pms,
      defaultUnitCode: defaultUnit,
      knownAccountCodes: new Set(accountIdByCode.keys()),
      knownUnitCodes: new Set(unitIdByCode.keys()),
    });

    const usable = plan.entries.filter((e) => e.balanced);
    const unbalanced = plan.entries.length - usable.length;

    console.log(
      `  ${usable.length} bukti seimbang, ${plan.totalLines} baris, total ${rupiah(plan.totalAmount)}` +
        (unbalanced ? C.warn(`, ${unbalanced} bukti tidak seimbang`) : ''),
    );
    if (plan.usedDefaultUnit > 0) {
      console.log(C.warn(`  ${plan.usedDefaultUnit} baris memakai cabang bawaan ${defaultUnit} — periksa apakah benar`));
    }
    if (plan.issues.length > 0) {
      console.log(C.warn(`  ${plan.issues.length} masalah:`));
      for (const i of plan.issues.slice(0, 15)) console.log(C.dim(`    baris ${i.row}: ${i.message}`));
      if (plan.issues.length > 15) console.log(C.dim(`    …dan ${plan.issues.length - 15} lainnya`));
    }

    if (dryRun || usable.length === 0) {
      grandSkipped += unbalanced;
      console.log('');
      continue;
    }

    const prints = usable.map((e) => fingerprint(e.date, e.reference, e.totalDebit, e.lines.length));
    const existing = await prisma.journalEntry.findMany({
      where: { source: 'IMPORT', notes: { in: prints } },
      select: { notes: true },
    });
    const seen = new Set(existing.map((e) => e.notes));

    let imported = 0;
    let duplicates = 0;
    let failed = 0;

    const BATCH = 100;
    for (let i = 0; i < usable.length; i += BATCH) {
      await prisma.$transaction(
        async (tx) => {
          for (const entry of usable.slice(i, i + BATCH)) {
            const print = fingerprint(entry.date, entry.reference, entry.totalDebit, entry.lines.length);
            if (seen.has(print)) {
              duplicates++;
              continue;
            }

            let lines: DraftLine[] = entry.lines.map((l) => ({
              accountId: accountIdByCode.get(l.accountCode)!,
              unitId: unitIdByCode.get(l.unitCode)!,
              debit: l.debit,
              credit: l.credit,
              memo: l.description || null,
            }));
            lines = balanceUnitsWithInterUnit(lines, interUnit, 'Penyeimbang impor antar cabang');

            if (!checkBalance(lines).balanced || checkPerUnitBalance(lines).length > 0) {
              failed++;
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

    console.log(
      `  ${C.ok(`${imported} bukti tersimpan`)}` +
        (duplicates ? C.dim(`, ${duplicates} sudah pernah diimpor`) : '') +
        (failed ? C.bad(`, ${failed} gagal`) : '') +
        '\n',
    );

    grandImported += imported;
    grandDuplicates += duplicates;
    grandSkipped += unbalanced + failed;
  }

  console.log(C.bold('Ringkasan'));
  console.log(`  tersimpan       : ${C.ok(String(grandImported))}`);
  console.log(`  sudah ada       : ${grandDuplicates}`);
  console.log(`  dilewati        : ${grandSkipped ? C.warn(String(grandSkipped)) : '0'}`);

  if (!dryRun && grandImported > 0) {
    // Pemeriksaan akhir: seluruh buku harus tetap seimbang.
    const agg = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
    const diff = (agg._sum.debit ?? 0) - (agg._sum.credit ?? 0);
    console.log(
      `  neraca seluruh buku: ${Math.abs(diff) < 1 ? C.ok('seimbang') : C.bad(`timpang ${rupiah(diff)}`)}`,
    );
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(C.bad('\nGagal: ') + (e instanceof Error ? e.message : String(e)));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
