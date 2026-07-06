import { useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { useCol } from '../lib/hooks';
import { PRIORITY_LABELS, prioritizeSlots } from '../lib/slots';
import type { SlotPriority } from '../lib/slots';
import { fmtDate, fmtTime, todayISO } from '../lib/dates';
import type { Game, PermitSlot } from '../lib/types';
import type { LeagueData } from '../lib/leagueData';
import type { NewSlotChoice } from '../lib/gameOps';

/**
 * Pick a new date/time/field for a game. Open permit slots are listed first,
 * ordered: home team's usual field(s) -> home city -> away city -> other.
 * A manual entry fallback covers arrangements the app doesn't know about.
 */
export default function SlotPicker({
  game,
  data,
  value,
  onChange,
}: {
  game: Game;
  data: LeagueData;
  value: NewSlotChoice | null;
  onChange: (choice: NewSlotChoice | null) => void;
}) {
  const [manual, setManual] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('17:30');
  const [manualFieldId, setManualFieldId] = useState('');

  const slots = useCol<PermitSlot>(
    data.season && 'permitSlots',
    () => [where('seasonId', '==', data.season?.id ?? ''), where('gameId', '==', null)],
    [data.season?.id],
  );

  const ranked = useMemo(() => {
    const home = data.teamById.get(game.homeTeamId);
    const away = data.teamById.get(game.awayTeamId);
    if (!home || !away) return [];
    const today = todayISO();
    return prioritizeSlots(
      (slots.data ?? []).filter((s) => s.date >= today),
      game,
      home,
      away,
      data.games,
    );
  }, [slots.data, game, data.teamById, data.games]);

  const pickSlot = (s: PermitSlot) => {
    setManual(false);
    onChange({ date: s.date, time: s.time, fieldId: s.fieldId, slotId: s.id });
  };

  const updateManual = (date: string, time: string, fieldId: string) => {
    setManualDate(date);
    setManualTime(time);
    setManualFieldId(fieldId);
    onChange(date && time && fieldId ? { date, time, fieldId, slotId: null } : null);
  };

  let lastPriority: SlotPriority | null = null;

  return (
    <div>
      <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-stone-200 p-2">
        {slots.data === null && <p className="p-2 text-sm text-stone-500">Loading open field permits…</p>}
        {slots.data !== null && ranked.length === 0 && (
          <p className="p-2 text-sm text-stone-500">
            No open permit slots available — use manual entry below.
          </p>
        )}
        {ranked.map(({ slot, priority }) => {
          const header = priority !== lastPriority ? PRIORITY_LABELS[priority] : null;
          lastPriority = priority;
          const selected = !manual && value?.slotId === slot.id;
          return (
            <div key={slot.id}>
              {header && (
                <div className="mt-2 mb-1 text-xs font-semibold tracking-wide text-stone-400 uppercase first:mt-0">
                  {header}
                </div>
              )}
              <button
                type="button"
                onClick={() => pickSlot(slot)}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  selected ? 'bg-emerald-700 text-white' : 'hover:bg-stone-100'
                }`}
              >
                {fmtDate(slot.date)} · {fmtTime(slot.time)} · {data.fieldName(slot.fieldId)}{' '}
                <span className={selected ? 'text-emerald-100' : 'text-stone-400'}>
                  ({data.cityName(slot.cityId)})
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={manual}
          onChange={(e) => {
            setManual(e.target.checked);
            onChange(
              e.target.checked && manualDate && manualTime && manualFieldId
                ? { date: manualDate, time: manualTime, fieldId: manualFieldId, slotId: null }
                : null,
            );
          }}
        />
        Enter a date, time and field manually
      </label>

      {manual && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={manualDate}
              onChange={(e) => updateManual(e.target.value, manualTime, manualFieldId)}
            />
          </div>
          <div>
            <label className="label">Time</label>
            <input
              type="time"
              className="input"
              value={manualTime}
              onChange={(e) => updateManual(manualDate, e.target.value, manualFieldId)}
            />
          </div>
          <div>
            <label className="label">Field</label>
            <select
              className="input"
              value={manualFieldId}
              onChange={(e) => updateManual(manualDate, manualTime, e.target.value)}
            >
              <option value="">Choose…</option>
              {data.fields
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({data.cityName(f.cityId)})
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
