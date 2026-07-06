import type { DayName } from './types';
import { datesBetween, dayOfWeek } from './dates';

export interface PermitOccurrence {
  date: string;
  time: string;
}

/**
 * Expand a recurring permit pattern ("Mondays and Wednesdays at 5:30 from
 * Apr 27 to Jun 11") into concrete date+time occurrences. The admin can then
 * remove individual dates before saving.
 */
export function expandPermitPattern(
  days: DayName[],
  times: string[],
  startISO: string,
  endISO: string,
): PermitOccurrence[] {
  const daySet = new Set(days);
  const out: PermitOccurrence[] = [];
  for (const date of datesBetween(startISO, endISO)) {
    if (!daySet.has(dayOfWeek(date))) continue;
    for (const time of times) out.push({ date, time });
  }
  return out;
}
