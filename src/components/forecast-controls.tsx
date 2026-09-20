'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { formatRupiah } from '@/lib/format';

export type ForecastControlValues = {
  unit: string;
  horizon: number;
  method: string;
  lookback: number;
  seasonal: boolean;
  growthRevenue: number;
  growthExpense: number;
  buffer: number;
  projects: string[];
};

export type ProjectOption = { id: string; name: string; unitCode: string; totalCost: number };

/**
 * Panel asumsi peramalan. Nilainya disimpan di URL sehingga satu skenario
 * bisa dibagikan atau di-bookmark cukup dengan menyalin alamat halaman.
 */
export function ForecastControls({
  units,
  projects,
  values,
}: {
  units: { id: string; code: string; name: string }[];
  projects: ProjectOption[];
  values: ForecastControlValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(values);

  // Selaraskan kembali bila pengguna menekan tombol back/forward.
  useEffect(() => setDraft(values), [values]);

  const apply = (next: ForecastControlValues) => {
    setDraft(next);
    const q = new URLSearchParams(params.toString());
    const set = (k: string, v: string, fallback: string) => (v === fallback ? q.delete(k) : q.set(k, v));

    set('unit', next.unit, '');
    set('horizon', String(next.horizon), '24');
    set('method', next.method, 'WEIGHTED');
    set('lookback', String(next.lookback), '12');
    set('seasonal', next.seasonal ? '1' : '0', '1');
    set('gRev', String(next.growthRevenue), '0');
    set('gExp', String(next.growthExpense), '0');
    set('buffer', String(next.buffer), '0');
    set('projects', next.projects.join(','), projects.map((p) => p.id).join(','));

    startTransition(() => router.push(`${pathname}?${q.toString()}`));
  };

  const toggleProject = (id: string) => {
    const next = draft.projects.includes(id)
      ? draft.projects.filter((p) => p !== id)
      : [...draft.projects, id];
    apply({ ...draft, projects: next });
  };

  return (
    <div className="card card-pad space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Asumsi peramalan</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Ubah asumsi di bawah — hasil ramalan langsung menyesuaikan.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="f-unit">Cakupan</label>
        <select
          id="f-unit"
          className="input"
          value={draft.unit}
          onChange={(e) => apply({ ...draft, unit: e.target.value })}
        >
          <option value="">Seluruh grup (konsolidasi)</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="f-horizon">Proyeksi (bulan)</label>
          <select
            id="f-horizon"
            className="input"
            value={draft.horizon}
            onChange={(e) => apply({ ...draft, horizon: Number(e.target.value) })}
          >
            {[6, 12, 18, 24, 36, 60].map((n) => (
              <option key={n} value={n}>{n} bulan</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-lookback">Histori dipakai</label>
          <select
            id="f-lookback"
            className="input"
            value={draft.lookback}
            onChange={(e) => apply({ ...draft, lookback: Number(e.target.value) })}
          >
            {[3, 6, 12, 18, 24, 36].map((n) => (
              <option key={n} value={n}>{n} bulan terakhir</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="f-method">Metode perhitungan</label>
        <select
          id="f-method"
          className="input"
          value={draft.method}
          onChange={(e) => apply({ ...draft, method: e.target.value })}
        >
          <option value="WEIGHTED">Rata-rata tertimbang — bulan terbaru lebih berpengaruh</option>
          <option value="AVERAGE">Rata-rata sederhana — semua bulan sama bobot</option>
          <option value="TREND">Garis tren — mengikuti arah naik/turun</option>
        </select>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={draft.seasonal}
          onChange={(e) => apply({ ...draft, seasonal: e.target.checked })}
        />
        <span>
          Pakai pola musiman
          <span className="block text-xs text-slate-500">
            Membedakan high season (Juli–Agustus, Desember) dan low season. Butuh histori minimal 12 bulan.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="f-grev">Pertumbuhan pendapatan</label>
          <div className="flex items-center gap-2">
            <input
              id="f-grev"
              type="number"
              step="1"
              className="input"
              value={draft.growthRevenue}
              onChange={(e) => setDraft({ ...draft, growthRevenue: Number(e.target.value) })}
              onBlur={() => apply(draft)}
            />
            <span className="text-sm text-slate-500">%/th</span>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="f-gexp">Kenaikan biaya</label>
          <div className="flex items-center gap-2">
            <input
              id="f-gexp"
              type="number"
              step="1"
              className="input"
              value={draft.growthExpense}
              onChange={(e) => setDraft({ ...draft, growthExpense: Number(e.target.value) })}
              onBlur={() => apply(draft)}
            />
            <span className="text-sm text-slate-500">%/th</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="f-buffer">Saldo kas minimum yang dijaga</label>
        <input
          id="f-buffer"
          inputMode="numeric"
          className="input"
          value={draft.buffer === 0 ? '' : String(draft.buffer)}
          placeholder="300000000"
          onChange={(e) => setDraft({ ...draft, buffer: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
          onBlur={() => apply(draft)}
        />
        <p className="mt-1 text-xs text-slate-500">
          {draft.buffer > 0 ? formatRupiah(draft.buffer) : 'Kosongkan bila tidak memakai batas aman.'}
        </p>
      </div>

      {projects.length > 0 && (
        <div>
          <p className="label">Proyek yang diperhitungkan</p>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.projects.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  <span>
                    {p.name}
                    <span className="block text-xs text-slate-500">
                      {p.unitCode} · {formatRupiah(p.totalCost)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Hapus centang untuk melihat kondisi kas tanpa proyek tersebut.
          </p>
        </div>
      )}

      {isPending && <p className="text-xs text-slate-500">Menghitung ulang…</p>}
    </div>
  );
}
