import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatRupiah } from '@/lib/format';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-slate-900">{children}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning';
}) {
  const toneClass = {
    neutral: 'text-slate-900',
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    warning: 'text-amber-600',
  }[tone];

  // Nilai rupiah bisa sangat panjang (miliaran). Kecilkan ukuran huruf agar
  // angka tetap utuh di dalam kartu, bukan terpotong.
  const sizeClass = value.length > 15 ? 'text-lg' : value.length > 12 ? 'text-xl' : 'text-2xl';

  return (
    <div className="card card-pad min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${sizeClass} ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Money({ value, colored = false }: { value: number; colored?: boolean }) {
  const cls = !colored ? '' : value < 0 ? 'text-red-600' : value > 0 ? 'text-emerald-600' : 'text-slate-500';
  return <span className={`tabular-nums ${cls}`}>{formatRupiah(value)}</span>;
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="card card-pad text-center">
      <p className="font-medium text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary mt-4">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const style = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone];

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${style}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-0.5' : ''}>{children}</div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-sky-100 text-sky-700',
    brand: 'bg-brand-100 text-brand-800',
  };
  return <span className={`badge ${map[tone] ?? map.slate}`}>{children}</span>;
}
