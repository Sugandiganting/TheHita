const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const rupiahCompact = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

const plain = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0';
  return rupiah.format(Math.round(value));
}

/** Versi ringkas untuk label grafik, mis. "Rp 1,2 jt". */
export function formatRupiahShort(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0';
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp ${rupiahCompact.format(Math.abs(Math.round(value)))}`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return plain.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(digits)}%`;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-03" -> "Maret 2026" */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** "2026-03" -> "Mar 26" */
export function formatPeriodShort(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

/** Tanggal untuk <input type="date"> tanpa pergeseran zona waktu. */
export function toDateInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
