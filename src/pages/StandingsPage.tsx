import { useMemo, useState } from 'react';
import { useLeagueData } from '../lib/leagueData';
import { computeStandings } from '../lib/standings';
import type { StandingRow } from '../lib/standings';

function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-200 text-left text-xs tracking-wide text-stone-500 uppercase">
          <th className="py-1.5 pl-3">Team</th>
          <th className="px-2 text-center">W</th>
          <th className="px-2 text-center">L</th>
          <th className="px-2 text-center">T</th>
          <th className="px-2 text-center">Pct</th>
          <th className="px-2 text-center">RS</th>
          <th className="px-2 pr-3 text-center">RA</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.teamId} className={`border-b border-stone-100 last:border-b-0 ${i % 2 ? 'bg-stone-50/50' : ''}`}>
            <td className="py-1.5 pl-3 font-medium">{r.name}</td>
            <td className="px-2 text-center tabular-nums">{r.wins}</td>
            <td className="px-2 text-center tabular-nums">{r.losses}</td>
            <td className="px-2 text-center tabular-nums">{r.ties}</td>
            <td className="px-2 text-center tabular-nums">{r.pct.toFixed(3).replace(/^0/, '')}</td>
            <td className="px-2 text-center tabular-nums">{r.runsScored}</td>
            <td className="px-2 pr-3 text-center tabular-nums">{r.runsAllowed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StandingsPage() {
  const data = useLeagueData();
  const [divisionId, setDivisionId] = useState('');
  const division = data.divisions.find((d) => d.id === divisionId) ?? data.divisions[0] ?? null;

  const rows = useMemo(() => {
    if (!division) return [];
    return computeStandings(
      data.teams.filter((t) => t.divisionId === division.id),
      data.games.filter((g) => g.divisionId === division.id),
    );
  }, [division, data.teams, data.games]);

  // Split into classification sections when the division uses A/B.
  const sections = useMemo(() => {
    if (!division?.classificationEnabled) return [{ label: null as string | null, rows }];
    const out: { label: string | null; rows: StandingRow[] }[] = [];
    for (const cls of ['A', 'B'] as const) {
      const cRows = rows.filter((r) => (r.classification ?? 'B') === cls);
      if (cRows.length > 0) out.push({ label: `${cls} Teams`, rows: cRows });
    }
    return out;
  }, [division, rows]);

  if (!data.season) {
    return <p className="py-16 text-center text-stone-500">No active season yet.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">{data.season.year} Standings</h1>
        <div className="flex gap-1.5">
          {data.divisions.map((d) => (
            <button
              key={d.id}
              className={`chip ${division?.id === d.id ? 'chip-on' : ''}`}
              onClick={() => setDivisionId(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-stone-500">
        Ties count as half a win and half a loss. Teams are ranked by winning percentage, then
        fewest runs allowed.
      </p>

      {sections.map((s, i) => (
        <div key={i} className="card mb-4 !p-0">
          {s.label && (
            <div className="border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-semibold">{s.label}</div>
          )}
          <StandingsTable rows={s.rows} />
        </div>
      ))}
    </div>
  );
}
