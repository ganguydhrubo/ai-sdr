/** Display helpers shared by the admin pages (pure functions, safe on client and server). */

export const USD_TO_INR = 83;

export function timeAgo(iso?: string, now: number = Date.now()): string {
  if (!iso) return '—';
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function dueIn(iso?: string, now: number = Date.now()): string {
  if (!iso) return 'No due date';
  const diff = new Date(iso).getTime() - now;
  const h = Math.round(Math.abs(diff) / 3600000);
  if (diff < 0) return h < 24 ? `Overdue by ${h} hr${h === 1 ? '' : 's'}` : `Overdue by ${Math.round(h / 24)} day(s)`;
  if (h < 1) return 'Due within the hour';
  if (h < 24) return `Due in ${h} hr${h === 1 ? '' : 's'}`;
  return `Due in ${Math.round(h / 24)} day(s)`;
}

export function formatInr(amount: number, opts: { decimals?: number } = {}): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: opts.decimals ?? 0, minimumFractionDigits: opts.decimals ?? 0 })}`;
}

export function usdToInr(usd: number): number {
  return Math.round(usd * USD_TO_INR * 100) / 100;
}

export function formatDateTimeIst(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
