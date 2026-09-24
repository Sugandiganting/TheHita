import { formatDate, formatRupiah } from '@/lib/format';
import { Badge, Card, SectionTitle } from '@/components/ui';
import { deleteEntry } from '@/app/actions';

type Entry = {
  id: string;
  date: Date;
  description: string;
  reference: string | null;
  source: string;
  unit: { code: string };
  lines: {
    id: string;
    debit: number;
    credit: number;
    account: { code: string; name: string; isCash: boolean; subtype: string | null };
    unit: { code: string };
  }[];
};

/** Daftar transaksi kas terakhir, ditampilkan di bawah setiap formulir. */
export function CashEntryList({
  entries,
  title,
  hint,
}: {
  entries: Entry[];
  title: string;
  hint: string;
}) {
  return (
    <Card className="card-pad">
      <SectionTitle hint={hint}>{title}</SectionTitle>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Belum ada transaksi.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const total = entry.lines.reduce((s, l) => s + l.debit, 0);
            const interUnit = entry.lines.some((l) => l.account.subtype === 'INTERUNIT');
            return (
              <li key={entry.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{entry.description}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatDate(entry.date)}</span>
                      <Badge tone="brand">{entry.unit.code}</Badge>
                      {entry.reference && <span className="font-mono">{entry.reference}</span>}
                      {interUnit && <Badge tone="blue">antar unit</Badge>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums text-slate-900">{formatRupiah(total)}</span>
                    <form action={deleteEntry}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                        Hapus
                      </button>
                    </form>
                  </div>
                </div>

                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {entry.lines.map((line) => (
                      <tr key={line.id} className="text-slate-600">
                        <td className="py-0.5 pr-2 font-mono text-slate-400">{line.account.code}</td>
                        <td className="py-0.5 pr-2">{line.account.name}</td>
                        <td className="py-0.5 pr-2 text-slate-400">{line.unit.code}</td>
                        <td className="py-0.5 pr-2 text-right tabular-nums">
                          {line.debit > 0 ? formatRupiah(line.debit) : ''}
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {line.credit > 0 ? formatRupiah(line.credit) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
