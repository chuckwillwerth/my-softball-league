import type { DayName } from '../lib/types';
import { WEEKDAYS } from '../lib/dates';

/** Clickable day-of-week chips ("Mondays and Wednesdays" style selection). */
export default function DayChips({
  value,
  onChange,
  days = WEEKDAYS,
}: {
  value: DayName[];
  onChange: (days: DayName[]) => void;
  days?: DayName[];
}) {
  const toggle = (d: DayName) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {days.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`chip ${value.includes(d) ? 'chip-on' : ''}`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
