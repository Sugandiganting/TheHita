'use client';

import { useState } from 'react';
import { QuickEntryForm, type AccountOption, type UnitOption } from './quick-entry-form';
import { JournalForm } from './journal-form';

export function EntryTabs({
  units,
  accounts,
  defaultDate,
}: {
  units: UnitOption[];
  accounts: AccountOption[];
  defaultDate: string;
}) {
  const [tab, setTab] = useState<'quick' | 'journal'>('quick');

  return (
    <div className="card card-pad">
      <div className="mb-4 flex gap-2 border-b border-slate-200">
        {(
          [
            ['quick', 'Entri cepat'],
            ['journal', 'Jurnal manual'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-slate-500">
        {tab === 'quick'
          ? 'Cukup pilih kategori dan kas — sistem membuat jurnal debit/kredit secara otomatis.'
          : 'Untuk transaksi yang menyentuh banyak akun atau dibagi ke beberapa cabang sekaligus.'}
      </p>

      {tab === 'quick' ? (
        <QuickEntryForm units={units} accounts={accounts} defaultDate={defaultDate} />
      ) : (
        <JournalForm units={units} accounts={accounts} defaultDate={defaultDate} />
      )}
    </div>
  );
}
