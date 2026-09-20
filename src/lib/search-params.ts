import { addMonths, currentPeriod, type Period } from './period';

export type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function validPeriod(value: string | undefined): Period | null {
  return value && PERIOD_RE.test(value) ? value : null;
}

/** Rentang periode dari URL; default 12 bulan terakhir termasuk bulan berjalan. */
export function resolveRange(params: SearchParams, defaultMonths = 12): { from: Period; to: Period } {
  const now = currentPeriod();
  const to = validPeriod(single(params.to)) ?? now;
  const from = validPeriod(single(params.from)) ?? addMonths(to, -(defaultMonths - 1));
  return from > to ? { from: to, to: from } : { from, to };
}

/** Filter unit dari URL. Mengembalikan null bila semua unit dipilih. */
export function resolveUnit(params: SearchParams): string[] | null {
  const unit = single(params.unit);
  return unit ? [unit] : null;
}
