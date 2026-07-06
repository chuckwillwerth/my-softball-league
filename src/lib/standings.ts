import type { Game, Team } from './types';

export interface StandingRow {
  teamId: string;
  name: string;
  classification: 'A' | 'B' | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  /** Winning percentage; a tie counts as half a win and half a loss. */
  pct: number;
  runsScored: number;
  runsAllowed: number;
}

const CLASS_RANK: Record<string, number> = { A: 0, B: 1 };

function classRank(c: 'A' | 'B' | null): number {
  return c ? CLASS_RANK[c] : 2;
}

/** Games that count toward standings: final results with both scores reported. */
export function isFinal(g: Game): boolean {
  return (
    (g.status === 'played' || g.status === 'forfeit') &&
    g.homeScore !== null &&
    g.awayScore !== null
  );
}

export function computeStandings(teams: Team[], games: Game[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [
      t.id,
      {
        teamId: t.id,
        name: t.name,
        classification: t.classification,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pct: 0,
        runsScored: 0,
        runsAllowed: 0,
      },
    ]),
  );

  for (const g of games) {
    if (!isFinal(g)) continue;
    const home = rows.get(g.homeTeamId);
    const away = rows.get(g.awayTeamId);
    if (!home || !away) continue;
    const hs = g.homeScore!;
    const as = g.awayScore!;
    home.gamesPlayed++;
    away.gamesPlayed++;
    home.runsScored += hs;
    home.runsAllowed += as;
    away.runsScored += as;
    away.runsAllowed += hs;
    if (hs > as) {
      home.wins++;
      away.losses++;
    } else if (as > hs) {
      away.wins++;
      home.losses++;
    } else {
      home.ties++;
      away.ties++;
    }
  }

  const out = [...rows.values()];
  for (const r of out) {
    r.pct = r.gamesPlayed === 0 ? 0 : (r.wins + r.ties * 0.5) / r.gamesPlayed;
  }
  out.sort(
    (a, b) =>
      classRank(a.classification) - classRank(b.classification) ||
      b.pct - a.pct ||
      a.runsAllowed - b.runsAllowed ||
      a.name.localeCompare(b.name),
  );
  return out;
}
