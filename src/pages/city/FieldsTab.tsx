import { useMemo, useState } from 'react';
import { doc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { newId, removeDoc, saveDoc } from '../../lib/db';
import { useCol } from '../../lib/hooks';
import { expandPermitPattern } from '../../lib/permits';
import { fmtDate, fmtTime } from '../../lib/dates';
import type { DayName, Field, PermitSlot } from '../../lib/types';
import type { LeagueData } from '../../lib/leagueData';
import DayChips from '../../components/DayChips';
import Modal from '../../components/Modal';

function PermitPatternModal({
  field,
  data,
  onClose,
}: {
  field: Field;
  data: LeagueData;
  onClose: () => void;
}) {
  const season = data.season!;
  const [days, setDays] = useState<DayName[]>([]);
  const [times, setTimes] = useState<string[]>(['17:30']);
  const [start, setStart] = useState(season.gameWindowStart);
  const [end, setEnd] = useState(season.gameWindowEnd);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const occurrences = useMemo(
    () => expandPermitPattern(days, times.filter(Boolean), start, end),
    [days, times, start, end],
  );
  const kept = occurrences.filter((o) => !removed.has(`${o.date}|${o.time}`));

  const toggle = (key: string) => {
    const next = new Set(removed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setRemoved(next);
  };

  const save = async () => {
    if (kept.length === 0) return setError('Pick at least one day and time.');
    setBusy(true);
    try {
      // Firestore batches cap at 500 ops — chunk to be safe.
      for (let i = 0; i < kept.length; i += 400) {
        const batch = writeBatch(db);
        for (const occ of kept.slice(i, i + 400)) {
          batch.set(doc(db, 'permitSlots', newId('permitSlots')), {
            seasonId: season.id,
            cityId: field.cityId,
            fieldId: field.id,
            date: occ.date,
            time: occ.time,
            gameId: null,
          });
        }
        await batch.commit();
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Add permits — ${field.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <label className="label">Which days do you have permits?</label>
          <DayChips value={days} onChange={setDays} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Game times</label>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((t, i) => (
                <span key={i} className="flex items-center gap-1">
                  <input
                    type="time"
                    className="input !w-32"
                    value={t}
                    onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  {times.length > 1 && (
                    <button className="btn-ghost" onClick={() => setTimes(times.filter((_, j) => j !== i))}>✕</button>
                  )}
                </span>
              ))}
              <button className="btn-secondary" onClick={() => setTimes([...times, '19:30'])}>+ time</button>
            </div>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {occurrences.length > 0 && (
          <div>
            <label className="label">
              Preview — click a date to remove it ({kept.length} permit{kept.length === 1 ? '' : 's'} will be created)
            </label>
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-stone-200 p-2">
              {occurrences.map((o) => {
                const key = `${o.date}|${o.time}`;
                const isRemoved = removed.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={`chip ${isRemoved ? 'line-through opacity-40' : ''}`}
                    title={isRemoved ? 'Click to restore' : 'Click to remove'}
                  >
                    {fmtDate(o.date)} {fmtTime(o.time)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={() => void save()} disabled={busy || kept.length === 0}>
            {busy ? 'Saving…' : `Save ${kept.length} permits`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function FieldsTab({ cityId, data }: { cityId: string; data: LeagueData }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [permitField, setPermitField] = useState<Field | null>(null);

  const fields = data.fields.filter((f) => f.cityId === cityId).sort((a, b) => a.name.localeCompare(b.name));

  const slots = useCol<PermitSlot>(
    data.season && 'permitSlots',
    () => [where('seasonId', '==', data.season?.id ?? ''), where('cityId', '==', cityId)],
    [data.season?.id, cityId],
  );

  const addField = async () => {
    if (!name.trim()) return;
    await saveDoc('fields', newId('fields'), { cityId, name: name.trim(), address: address.trim() });
    setName('');
    setAddress('');
  };

  const deleteField = async (f: Field) => {
    const fieldSlots = (slots.data ?? []).filter((s) => s.fieldId === f.id);
    if (fieldSlots.some((s) => s.gameId)) {
      alert('This field has games scheduled on it. Move those games first.');
      return;
    }
    if (!window.confirm(`Delete ${f.name} and its ${fieldSlots.length} permits?`)) return;
    for (const s of fieldSlots) await removeDoc('permitSlots', s.id);
    await removeDoc('fields', f.id);
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-2 font-semibold">Add a field</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="label">Field name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Veterans Park #2" />
          </div>
          <div className="min-w-64 flex-2">
            <label className="label">Address</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          <button className="btn-primary" onClick={() => void addField()} disabled={!name.trim()}>
            Add field
          </button>
        </div>
      </div>

      {fields.map((f) => {
        const fieldSlots = (slots.data ?? [])
          .filter((s) => s.fieldId === f.id)
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        return (
          <div key={f.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-auto">
                <h3 className="font-semibold">{f.name}</h3>
                <p className="text-xs text-stone-500">{f.address}</p>
              </div>
              <button className="btn-primary" onClick={() => setPermitField(f)}>+ Add permits</button>
              <button className="btn-danger" onClick={() => void deleteField(f)}>Delete field</button>
            </div>
            {fieldSlots.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fieldSlots.map((s) => (
                  <span
                    key={s.id}
                    className={`badge ${s.gameId ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}
                    title={s.gameId ? 'A game is scheduled in this slot' : 'Open permit'}
                  >
                    {fmtDate(s.date)} {fmtTime(s.time)}
                    {!s.gameId && (
                      <button
                        className="ml-1 cursor-pointer hover:text-red-600"
                        title="Remove this permit"
                        onClick={() => void removeDoc('permitSlots', s.id)}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-400">No permits entered yet.</p>
            )}
          </div>
        );
      })}
      {fields.length === 0 && <p className="py-8 text-center text-stone-500">No fields yet — add your first one above.</p>}

      {permitField && <PermitPatternModal field={permitField} data={data} onClose={() => setPermitField(null)} />}
    </div>
  );
}
