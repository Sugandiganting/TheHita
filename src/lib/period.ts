/**
 * Utilitas periode bulanan. Semua periode direpresentasikan sebagai string
 * "YYYY-MM" dan seluruh perhitungan tanggal memakai UTC supaya hasilnya
 * tidak bergeser karena zona waktu server.
 */

export type Period = string; // "YYYY-MM"

export function toPeriod(date: Date): Period {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function periodToDate(period: Period): Date {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function addMonths(period: Period, count: number): Period {
  const d = periodToDate(period);
  d.setUTCMonth(d.getUTCMonth() + count);
  return toPeriod(d);
}

/** Jarak dalam bulan dari `a` ke `b` (positif bila b setelah a). */
export function diffMonths(a: Period, b: Period): number {
  const da = periodToDate(a);
  const db = periodToDate(b);
  return (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
}

/** Daftar periode berurutan dari `start` sebanyak `count` bulan. */
export function periodRange(start: Period, count: number): Period[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => addMonths(start, i));
}

/** Seluruh periode dari `start` sampai `end` (inklusif). */
export function periodsBetween(start: Period, end: Period): Period[] {
  const n = diffMonths(start, end) + 1;
  return n <= 0 ? [] : periodRange(start, n);
}

export function currentPeriod(now: Date = new Date()): Period {
  return toPeriod(now);
}

/** Awal bulan (inklusif) sebagai Date UTC. */
export function periodStart(period: Period): Date {
  return periodToDate(period);
}

/** Awal bulan berikutnya — dipakai sebagai batas atas eksklusif pada query. */
export function periodEndExclusive(period: Period): Date {
  return periodToDate(addMonths(period, 1));
}

/** Nomor bulan 1-12, dipakai untuk indeks musiman. */
export function monthOf(period: Period): number {
  return Number(period.split('-')[1]);
}

export function daysInPeriod(period: Period): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
