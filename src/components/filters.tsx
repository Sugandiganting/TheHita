'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type UnitOption = { id: string; code: string; name: string };

/**
 * Filter unit usaha + rentang periode. Semua halaman laporan memakai komponen
 * yang sama supaya cara memfilter konsisten dan tersimpan di URL.
 */
export function ReportFilters({
  units,
  showRange = true,
}: {
  units: UnitOption[];
  showRange?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value) next.delete(key);
      else next.set(key, value);
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="min-w-[200px]">
        <label className="label" htmlFor="filter-unit">
          Unit usaha
        </label>
        <select
          id="filter-unit"
          className="input"
          value={params.get('unit') ?? ''}
          onChange={(e) => setParam('unit', e.target.value)}
        >
          <option value="">Semua unit (konsolidasi)</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </select>
      </div>

      {showRange && (
        <>
          <div>
            <label className="label" htmlFor="filter-from">
              Dari bulan
            </label>
            <input
              id="filter-from"
              type="month"
              className="input"
              value={params.get('from') ?? ''}
              onChange={(e) => setParam('from', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="filter-to">
              Sampai bulan
            </label>
            <input
              id="filter-to"
              type="month"
              className="input"
              value={params.get('to') ?? ''}
              onChange={(e) => setParam('to', e.target.value)}
            />
          </div>
        </>
      )}

      {params.toString() && (
        <button type="button" className="btn-secondary" onClick={() => router.push(pathname)}>
          Reset
        </button>
      )}
    </div>
  );
}
