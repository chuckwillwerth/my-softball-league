import { describe, expect, it } from 'vitest';
import { computeStandings } from './standings';
import type { Game, Team } from './types';

function team(id: string, name: string, classification: 'A' | 'B' | null = null): Team {
  return {
    id,
    seasonId: 's1',
    divisionId: 'd1',
    cityId: 'c1',
    name,
    classification,
    preferredDays: null,
  };
}

let seq = 0;
function game(homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number, status: Game['status'] = 'played'): Game {
  return {
    id: `g${seq++}`,
    seasonId: 's1',
    divisionId: 'd1',
    date: '2026-05-01',
    time: '17:30',
    fieldId: 'f1',
    homeTeamId,
    awayTeamId,
    status,
    homeScore,
    awayScore,
    forfeitingTeamId: null,
    suspended: null,
    needsReschedule: false,
    umpAssignerNotified: false,
    reportedBy: null,
    lastReminderAt: null,
    lastNagAt: null,
    history: [],
  };
}

describe('computeStandings', () => {
  it('counts a tie as half a win and half a loss', () => {
    const teams = [team('t1', 'Tigers'), team('t2', 'Lions')];
    // Tigers: 1 win + 1 tie in 2 games -> (1 + 0.5) / 2 = .750
    const rows = computeStandings(teams, [game('t1', 't2', 5, 3), game('t1', 't2', 4, 4)]);
    const tigers = rows.find((r) => r.teamId === 't1')!;
    expect(tigers.wins).toBe(1);
    expect(tigers.ties).toBe(1);
    expect(tigers.pct).toBeCloseTo(0.75);
    const lions = rows.find((r) => r.teamId === 't2')!;
    expect(lions.pct).toBeCloseTo(0.25);
  });

  it('sorts by classification first, then win pct, then runs allowed', () => {
    const teams = [
      team('b1', 'B Best', 'B'),
      team('a2', 'A Worse', 'A'),
      team('a1', 'A Better', 'A'),
      team('a3', 'A Tied Fewer Runs', 'A'),
    ];
    const games = [
      // b1 is undefeated but is a B team -> still below every A team
      game('b1', 'a2', 10, 0),
      // a1 and a3 both 1-1; a3 allowed fewer runs (5 vs 9) -> a3 above a1
      game('a1', 'a3', 4, 2),
      game('a3', 'a1', 3, 5),
      game('a2', 'a1', 6, 2),
      game('a3', 'a2', 1, 0),
    ];
    // records: a1 2-1, a2 1-2, a3 1-1... recompute:
    // a1: beat a3 (4-2), lost to a3? no — a3 home 3, a1 away 5 -> a1 wins. a1 lost to a2 (6-2).
    // a1: 2 wins 1 loss. a2: 1 win (vs a1) 2 losses (b1, a3). a3: 1 win (a2) 2 losses (both a1).
    const rows = computeStandings(teams, games);
    expect(rows.map((r) => r.teamId)).toEqual(['a1', 'a3', 'a2', 'b1']);
  });

  it('breaks equal win pct by fewest runs allowed', () => {
    const teams = [team('t1', 'One'), team('t2', 'Two'), team('t3', 'Three'), team('t4', 'Four')];
    const games = [
      game('t1', 't3', 3, 1), // t1 allows 1
      game('t2', 't4', 9, 8), // t2 allows 8
    ];
    const rows = computeStandings(teams, games);
    expect(rows[0].teamId).toBe('t1');
    expect(rows[1].teamId).toBe('t2');
  });

  it('ignores cancelled and suspended games but counts forfeits', () => {
    const teams = [team('t1', 'One'), team('t2', 'Two')];
    const games = [
      game('t1', 't2', 7, 0, 'forfeit'),
      { ...game('t1', 't2', 3, 3), status: 'cancelled' as const, homeScore: null, awayScore: null },
      { ...game('t1', 't2', 2, 1), status: 'suspended' as const },
    ];
    const rows = computeStandings(teams, games);
    const t1 = rows.find((r) => r.teamId === 't1')!;
    expect(t1.gamesPlayed).toBe(1);
    expect(t1.wins).toBe(1);
    expect(t1.runsAllowed).toBe(0);
  });
});
