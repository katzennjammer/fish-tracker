// Every record carries a local calendar date as 'YYYY-MM-DD'.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return iso(new Date());
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function addMonths(date: string, n: number): string {
  const d = parse(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return iso(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS);
}

export type Period = 'day' | 'week' | 'month';

/** Inclusive [start, end] of the period containing `anchor`. Weeks start Monday. */
export function periodRange(period: Period, anchor: string): [string, string] {
  if (period === 'day') return [anchor, anchor];
  const d = parse(anchor);
  if (period === 'week') {
    const offset = (d.getDay() + 6) % 7;
    const start = addDays(anchor, -offset);
    return [start, addDays(start, 6)];
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [iso(start), iso(end)];
}

export function shiftPeriod(period: Period, anchor: string, dir: 1 | -1): string {
  if (period === 'day') return addDays(anchor, dir);
  if (period === 'week') return addDays(anchor, 7 * dir);
  return addMonths(anchor, dir);
}

export function periodLabel(period: Period, anchor: string): string {
  const [start, end] = periodRange(period, anchor);
  if (period === 'day') return relativeDay(anchor) ?? short(anchor, true);
  if (period === 'month') {
    const d = parse(anchor);
    return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  }
  const s = parse(start);
  const e = parse(end);
  if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
  return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
}

export function relativeDay(date: string): string | null {
  const diff = daysBetween(today(), date);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return null;
}

/** "Oct 19" or "Mon, Oct 19" */
export function short(date: string, weekday = false): string {
  const d = parse(date);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const withYear = d.getFullYear() !== new Date().getFullYear() ? `${base}, ${d.getFullYear()}` : base;
  return weekday ? `${WEEKDAYS[d.getDay()]}, ${withYear}` : withYear;
}

/** "Monday" / "October 19, 2026" pair for big headers. */
export function longParts(date: string): { weekday: string; date: string } {
  const d = parse(date);
  return {
    weekday: WEEKDAYS_LONG[d.getDay()],
    date: `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
  };
}

export function ago(date: string): string {
  const n = daysBetween(date, today());
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} wk ago`;
  return `${Math.round(n / 30)} mo ago`;
}

export function nowStamp(): string {
  return new Date().toISOString();
}
