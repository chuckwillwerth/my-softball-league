import type { DayName } from './types';

export const DAY_NAMES: DayName[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS: DayName[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Parse an ISO date at local noon to dodge DST/timezone edge cases. */
function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayOfWeek(iso: string): DayName {
  return DAY_NAMES[toDate(iso).getDay()];
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function datesBetween(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  for (let d = startISO; d <= endISO; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Monday of the week containing the date — used to group games into league weeks. */
export function weekKey(iso: string): string {
  const d = toDate(iso);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return toISO(d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** "2026-04-27" -> "Mon 4/27" */
export function fmtDate(iso: string): string {
  const d = toDate(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

/** "17:30" -> "5:30 PM" */
export function fmtTime(time: string): string {
  const [hStr, m] = time.split(':');
  const h = Number(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

/** True when the game's scheduled start is more than `hours` in the past. */
export function isMoreThanHoursPast(dateISO: string, time: string, hours: number): boolean {
  const start = new Date(`${dateISO}T${time || '12:00'}:00`);
  return Date.now() - start.getTime() > hours * 3600 * 1000;
}
