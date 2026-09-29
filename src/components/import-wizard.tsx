'use client';

import { useMemo, useState, useTransition } from 'react';
import { commitImport, parseImportFile, type CommitResult } from '@/app/impor/actions';
import { buildImportPlan, guessColumns, EMPTY_MAP, type ColumnMap } from '@/lib/import/build';
import { PMS_SOURCES, type PmsSource } from '@/lib/coa-legacy';
import { formatRupiah } from '@/lib/format';
import { Alert, Badge, Card, SectionTitle, StatCard } from '@/components/ui';

type UnitOption = { code: string; name: string };

const ROLES: { key: keyof ColumnMap; label: string; hint: string; required?: boolean }[] = [
  { key: 'date', label: 'Tanggal', hint: 'Tanggal transaksi', required: true },
  { key: 'accountCode', label: 'Nomor akun', hint: 'Nomor akun GuestPro atau nomor baru', required: true },
  { key: 'debit', label: 'Debit', hint: 'Kolom debit' },
  { key: 'credit', label: 'Kredit', hint: 'Kolom kredit' },
  { key: 'amount', label: 'Nominal tunggal', hint: 'Bila hanya ada satu kolom nominal bertanda' },
  { key: 'reference', label: 'No. bukti', hint: 'Pengelompok baris menjadi satu jurnal' },
  { key: 'description', label: 'Keterangan', hint: 'Uraian transaksi' },
  { key: 'unit', label: 'Cabang', hint: 'Bila berkas menyebutkan cabang' },
  { key: 'accountName', label: 'Nama akun', hint: 'Hanya untuk ditampilkan' },
];

export function ImportWizard({
  units,
  accountCodes,
}: {
  units: UnitOption[];
  accountCodes: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [rows, setRows] = useState<string[][] | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [columns, setColumns] = useState<ColumnMap>(EMPTY_MAP);
  const [pms, setPms] = useState<PmsSource>('PMS2');

  // Hanya cabang milik PMS terpilih yang boleh menjadi cabang bawaan — berkas
  // dari GuestPro 2 tidak boleh jatuh ke IGYT atau The Hita Uluwatu.
  const pmsUnits = useMemo(
    () => units.filter((u) => (PMS_SOURCES[pms].units as readonly string[]).includes(u.code)),
    [units, pms],
  );
  const [defaultUnit, setDefaultUnit] = useState(
    units.find((u) => (PMS_SOURCES.PMS2.units as readonly string[]).includes(u.code))?.code ?? units[0]?.code ?? '',
  );

  function changePms(next: PmsSource) {
    setPms(next);
    const allowed = PMS_SOURCES[next].units as readonly string[];
    if (!allowed.includes(defaultUnit)) {
      setDefaultUnit(units.find((u) => allowed.includes(u.code))?.code ?? '');
    }
  }
  const [result, setResult] = useState<CommitResult | null>(null);

  const knownAccounts = useMemo(() => new Set(accountCodes), [accountCodes]);
  const knownUnits = useMemo(() => new Set(units.map((u) => u.code)), [units]);

  const header = rows?.[headerRow] ?? [];
  const bodyRows = useMemo(() => (rows ? rows.slice(headerRow + 1) : []), [rows, headerRow]);

  const plan = useMemo(() => {
    if (!rows || columns.date < 0 || columns.accountCode < 0) return null;
    return buildImportPlan(bodyRows, {
      columns,
      pms,
      defaultUnitCode: defaultUnit,
      knownAccountCodes: knownAccounts,
      knownUnitCodes: knownUnits,
    });
  }, [rows, bodyRows, columns, pms, defaultUnit, knownAccounts, knownUnits]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setResult(null);
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await parseImportFile(form);
      if (!res.ok) {
        setError(res.message);
        setRows(null);
        return;
      }
      setRows(res.rows);
      setHeaderRow(res.headerRow);
      setTruncated(res.truncated);
      setColumns(guessColumns(res.rows[res.headerRow] ?? []));
    });
  }

  function onCommit() {
    if (!rows) return;
    setError('');
    startTransition(async () => {
      const res = await commitImport({ rows: bodyRows, columns, pms, defaultUnitCode: defaultUnit });
      setResult(res);
      if (!res.ok) setError(res.message);
    });
  }

  const usable = plan?.entries.filter((e) => e.balanced) ?? [];
  const unbalanced = plan ? plan.entries.length - usable.length : 0;

  return (
    <div className="space-y-6">
      {/* ---------- Langkah 1 ---------- */}
      <Card className="card-pad">
        <SectionTitle hint="Berkas .xls lama perlu dibuka di Excel atau Numbers lalu disimpan ulang sebagai CSV atau XLSX.">
          1. Pilih berkas ekspor
        </SectionTitle>

        <form onSubmit={onUpload} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="i-file">Berkas (CSV / XLSX)</label>
              <input id="i-file" name="file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="i-pms">Berkas ini dari PMS mana?</label>
              <select id="i-pms" className="input" value={pms} onChange={(e) => changePms(e.target.value as PmsSource)}>
                {Object.entries(PMS_SOURCES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Menentukan arti penanda cabang pada nomor akun lama.</p>
            </div>
            <div>
              <label className="label" htmlFor="i-unit">Cabang bawaan</label>
              <select id="i-unit" className="input" value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)}>
                {pmsUnits.map((u) => (
                  <option key={u.code} value={u.code}>{u.code} — {u.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Dipakai bila baris tidak menyebut cabang apa pun. Pilihan dibatasi pada cabang milik PMS di sebelah kiri.</p>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Membaca…' : 'Baca berkas'}
          </button>
        </form>

        {error && !result && (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
      </Card>

      {/* ---------- Langkah 2 ---------- */}
      {rows && (
        <Card className="card-pad">
          <SectionTitle hint={`${rows.length.toLocaleString('id-ID')} baris terbaca. Sistem sudah menebak isi tiap kolom — periksa dan betulkan bila perlu.`}>
            2. Cocokkan kolom
          </SectionTitle>

          {truncated && (
            <div className="mb-4">
              <Alert tone="warning">
                Berkas sangat besar, hanya 20.000 baris pertama yang dibaca. Pecah per bulan agar lengkap.
              </Alert>
            </div>
          )}

          <div className="mb-4">
            <label className="label" htmlFor="i-header">Baris judul kolom</label>
            <select
              id="i-header"
              className="input sm:max-w-xs"
              value={headerRow}
              onChange={(e) => {
                const n = Number(e.target.value);
                setHeaderRow(n);
                setColumns(guessColumns(rows[n] ?? []));
              }}
            >
              {rows.slice(0, 20).map((r, i) => (
                <option key={i} value={i}>
                  Baris {i + 1}: {r.filter(Boolean).slice(0, 4).join(' | ').slice(0, 60) || '(kosong)'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role) => (
              <div key={role.key}>
                <label className="label" htmlFor={`col-${role.key}`}>
                  {role.label}
                  {role.required && <span className="text-red-600"> *</span>}
                </label>
                <select
                  id={`col-${role.key}`}
                  className="input"
                  value={columns[role.key]}
                  onChange={(e) => setColumns({ ...columns, [role.key]: Number(e.target.value) })}
                >
                  <option value={-1}>— Tidak ada —</option>
                  {header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Kolom ${i + 1}`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">{role.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="label">Cuplikan lima baris pertama</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {header.map((h, i) => (
                      <th key={i} className="th whitespace-nowrap">{h || `Kolom ${i + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bodyRows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {header.map((_, c) => (
                        <td key={c} className="td whitespace-nowrap">{r[c] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ---------- Langkah 3 ---------- */}
      {plan && (
        <Card className="card-pad">
          <SectionTitle hint="Periksa hasilnya sebelum disimpan. Yang disimpan hanya bukti yang seimbang.">
            3. Pratinjau &amp; simpan
          </SectionTitle>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bukti siap diimpor" value={usable.length.toLocaleString('id-ID')} tone={usable.length ? 'positive' : 'neutral'} />
            <StatCard
              label="Baris terbaca"
              value={plan.totalLines.toLocaleString('id-ID')}
              hint={`${plan.skipped} baris dilewati`}
            />
            <StatCard label="Total nilai" value={formatRupiah(plan.totalAmount)} />
            <StatCard
              label="Perlu diperiksa"
              value={String(plan.issues.length)}
              hint={unbalanced > 0 ? `${unbalanced} bukti tidak seimbang` : undefined}
              tone={plan.issues.length ? 'warning' : 'positive'}
            />
          </div>

          {plan.usedDefaultUnit > 0 && (
            <div className="mt-4">
              <Alert tone="warning" title={`${plan.usedDefaultUnit} baris memakai cabang bawaan`}>
                Baris tersebut tidak menyebut cabang dan nomor akunnya tidak membawa penanda cabang, jadi
                semuanya masuk ke <strong>{defaultUnit}</strong>. Periksa apakah itu memang benar —
                akun bersama seperti bank dan gaji sering perlu dipisah per cabang.
              </Alert>
            </div>
          )}

          {plan.issues.length > 0 && (
            <div className="mt-4">
              <p className="label">Masalah yang ditemukan</p>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50">
                <ul className="divide-y divide-amber-100 text-sm">
                  {plan.issues.slice(0, 200).map((issue, i) => (
                    <li key={i} className="px-3 py-1.5 text-amber-900">
                      <span className="mr-2 font-mono text-xs text-amber-700">baris {issue.row}</span>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
              {plan.issues.length > 200 && (
                <p className="mt-1 text-xs text-slate-500">…dan {plan.issues.length - 200} masalah lain.</p>
              )}
            </div>
          )}

          {usable.length > 0 && (
            <div className="mt-5">
              <p className="label">Contoh bukti yang akan disimpan</p>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                {usable.slice(0, 10).map((e) => (
                  <div key={e.key} className="border-b border-slate-100 px-3 py-2 last:border-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-slate-900">{e.description}</span>
                      <span className="text-xs text-slate-500">{e.date}</span>
                      {e.reference && <span className="font-mono text-xs text-slate-500">{e.reference}</span>}
                      {e.unitCodes.map((u) => <Badge key={u} tone="brand">{u}</Badge>)}
                      {e.unitCodes.length > 1 && <Badge tone="blue">antar unit</Badge>}
                      <span className="ml-auto tabular-nums text-slate-900">{formatRupiah(e.totalDebit)}</span>
                    </div>
                    <table className="mt-1 w-full text-xs">
                      <tbody>
                        {e.lines.map((l, i) => (
                          <tr key={i} className="text-slate-600">
                            <td className="py-0.5 pr-2 font-mono text-slate-400">{l.sourceCode}</td>
                            <td className="py-0.5 pr-2 text-slate-400">→</td>
                            <td className="py-0.5 pr-2 font-mono">{l.accountCode}</td>
                            <td className="py-0.5 pr-2">{l.unitCode}</td>
                            <td className="py-0.5 pr-2 text-right tabular-nums">{l.debit > 0 ? formatRupiah(l.debit) : ''}</td>
                            <td className="py-0.5 text-right tabular-nums">{l.credit > 0 ? formatRupiah(l.credit) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              {usable.length > 10 && (
                <p className="mt-1 text-xs text-slate-500">…dan {usable.length - 10} bukti lain.</p>
              )}
            </div>
          )}

          {result && (
            <div className="mt-4">
              <Alert tone={result.ok ? 'success' : 'danger'} title={result.ok ? 'Impor selesai' : 'Impor gagal'}>
                {result.message}
              </Alert>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={onCommit} disabled={pending || usable.length === 0}>
              {pending ? 'Menyimpan…' : `Impor ${usable.length.toLocaleString('id-ID')} bukti`}
            </button>
            <p className="text-xs text-slate-500">
              Bukti yang sudah pernah diimpor akan dilewati otomatis, jadi aman bila berkas yang sama terunggah dua kali.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
