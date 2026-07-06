import { useEffect, useState } from 'react';
import { newId, removeDoc, saveDoc } from '../../lib/db';
import type { DayName, Division } from '../../lib/types';
import type { LeagueData } from '../../lib/leagueData';
import DayChips from '../../components/DayChips';

function SeasonCard({ data }: { data: LeagueData }) {
  const season = data.season;
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [gamesPerTeam, setGamesPerTeam] = useState('12');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (season) {
      setYear(String(season.year));
      setStart(season.gameWindowStart);
      setEnd(season.gameWindowEnd);
      setGamesPerTeam(String(season.gamesPerTeam));
    }
  }, [season]);

  const save = async () => {
    const id = season?.id ?? newId('seasons');
    await saveDoc('seasons', id, {
      year: Number(year),
      active: true,
      gameWindowStart: start,
      gameWindowEnd: end,
      gamesPerTeam: Number(gamesPerTeam) || 12,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card">
      <h2 className="mb-2 font-semibold">{season ? `${season.year} Season` : 'Create the season'}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Year</label>
          <input className="input !w-24" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div>
          <label className="label">Games start (late April)</label>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">Games end (early June)</label>
          <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <label className="label">Games per team</label>
          <input className="input !w-20" type="number" value={gamesPerTeam} onChange={(e) => setGamesPerTeam(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => void save()} disabled={!start || !end}>
          {season ? 'Save' : 'Create season'}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
      </div>
    </div>
  );
}

function DivisionsCard({ data }: { data: LeagueData }) {
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim() || !data.season) return;
    await saveDoc('divisions', newId('divisions'), {
      seasonId: data.season.id,
      name: name.trim(),
      allowedDays: null,
      classificationEnabled: false,
      sortOrder: data.divisions.length,
    });
    setName('');
  };

  const patch = async (d: Division, changes: Partial<Division>) => {
    const { id: _id, ...rest } = { ...d, ...changes };
    await saveDoc('divisions', d.id, rest);
  };

  const del = async (d: Division) => {
    if (data.teams.some((t) => t.divisionId === d.id)) {
      alert('This division has teams in it. Remove those first.');
      return;
    }
    if (window.confirm(`Delete division ${d.name}?`)) await removeDoc('divisions', d.id);
  };

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Divisions</h2>
      <p className="mb-3 text-xs text-stone-500">
        Fixed days (e.g. 10U on Mon/Wed, 12U on Tue/Thu) constrain the scheduler. "Flexible" uses
        each team's preferred days instead (14U). A/B classification makes teams prioritize
        opponents with the same classification.
      </p>
      <div className="space-y-3">
        {data.divisions.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-md border border-stone-200 p-3">
            <span className="w-14 font-semibold">{d.name}</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={d.allowedDays !== null}
                onChange={(e) => void patch(d, { allowedDays: e.target.checked ? ['Mon', 'Wed'] : null })}
              />
              Fixed days
            </label>
            {d.allowedDays !== null ? (
              <DayChips value={d.allowedDays} onChange={(days: DayName[]) => void patch(d, { allowedDays: days })} />
            ) : (
              <span className="badge bg-sky-100 text-sky-800">Flexible — team preferences</span>
            )}
            <label className="ml-auto flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={d.classificationEnabled}
                onChange={(e) => void patch(d, { classificationEnabled: e.target.checked })}
              />
              A/B classification
            </label>
            <button className="btn-ghost !text-red-600" onClick={() => void del(d)}>Delete</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="input !w-40"
          placeholder="e.g. 10U"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button className="btn-primary" onClick={() => void add()} disabled={!name.trim() || !data.season}>
          Add division
        </button>
      </div>
    </div>
  );
}

function CitiesCard({ data }: { data: LeagueData }) {
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await saveDoc('cities', newId('cities'), { name: name.trim() });
    setName('');
  };

  const del = async (id: string, cityName: string) => {
    if (data.teams.some((t) => t.cityId === id) || data.fields.some((f) => f.cityId === id)) {
      alert('This city has teams or fields. Remove those first.');
      return;
    }
    if (window.confirm(`Delete ${cityName}?`)) await removeDoc('cities', id);
  };

  return (
    <div className="card">
      <h2 className="mb-2 font-semibold">Cities</h2>
      <div className="flex flex-wrap gap-1.5">
        {data.cities.map((c) => (
          <span key={c.id} className="badge bg-stone-100 text-stone-700">
            {c.name}
            <button className="ml-1.5 cursor-pointer hover:text-red-600" onClick={() => void del(c.id, c.name)}>✕</button>
          </span>
        ))}
        {data.cities.length === 0 && <span className="text-sm text-stone-400">None yet.</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="input !w-48"
          placeholder="City name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button className="btn-primary" onClick={() => void add()} disabled={!name.trim()}>
          Add city
        </button>
      </div>
    </div>
  );
}

export default function SetupTab({ data }: { data: LeagueData }) {
  return (
    <div className="space-y-4">
      <SeasonCard data={data} />
      {data.season && (
        <>
          <DivisionsCard data={data} />
          <CitiesCard data={data} />
        </>
      )}
    </div>
  );
}
