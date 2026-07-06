import { describe, expect, it } from 'vitest';
import { buildMatchups, generateSchedule, mulberry32 } from './scheduler';
import { expandPermitPattern } from './permits';
import { dayOfWeek, weekKey } from './dates';
import type { Division, PermitSlot, Team } from './types';

// ---- Fixture: 24-team 10U division, 8 "A" teams, 4 cities, Mon/Wed play ----

const CITIES = ['springfield', 'riverton', 'lakeside', 'mapleton'];
const SEASON_START = '2026-04-27'; // a Monday
const SEASON_END = '2026-06-11';

function makeTeams(): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i < 24; i++) {
    teams.push({
      id: `team-${i}`,
      seasonId: 's1',
      divisionId: 'd10u',
      cityId: CITIES[i % 4],
      name: `Team ${i}`,
      classification: i < 8 ? 'A' : 'B',
      preferredDays: null,
    });
  }
  return teams;
}

function makeSlots(): PermitSlot[] {
  // Each city has 3 fields with Mon+Wed permits at two times — plenty of capacity.
  const slots: PermitSlot[] = [];
  let n = 0;
  for (const cityId of CITIES) {
    for (let f = 0; f < 3; f++) {
      for (const occ of expandPermitPattern(['Mon', 'Wed'], ['17:30', '19:30'], SEASON_START, SEASON_END)) {
        slots.push({
          id: `slot-${n++}`,
          seasonId: 's1',
          cityId,
          fieldId: `${cityId}-field-${f}`,
          date: occ.date,
          time: occ.time,
          gameId: null,
        });
      }
    }
  }
  return slots;
}

const division: Division = {
  id: 'd10u',
  seasonId: 's1',
  name: '10U',
  allowedDays: ['Mon', 'Wed'],
  classificationEnabled: true,
  sortOrder: 0,
};

describe('buildMatchups', () => {
  it('gives every team exactly the target number of games', () => {
    const teams = makeTeams();
    const matchups = buildMatchups(teams, 12, true, mulberry32(1));
    const count = new Map<string, number>();
    for (const [a, b] of matchups) {
      count.set(a, (count.get(a) ?? 0) + 1);
      count.set(b, (count.get(b) ?? 0) + 1);
    }
    for (const t of teams) expect(count.get(t.id)).toBe(12);
  });

  it('keeps A teams playing A teams and B teams playing B teams when counts allow', () => {
    const teams = makeTeams(); // 8 A + 16 B, both even — no cross-class games needed
    const byId = new Map(teams.map((t) => [t.id, t]));
    const matchups = buildMatchups(teams, 12, true, mulberry32(2));
    for (const [a, b] of matchups) {
      expect(byId.get(a)!.classification).toBe(byId.get(b)!.classification);
    }
  });

  it('fills shortfalls across classifications instead of leaving teams short', () => {
    // 7 A teams (odd) — someone must play cross-class or repeat; nobody ends short.
    const teams = makeTeams().slice(1);
    const matchups = buildMatchups(teams, 12, true, mulberry32(3));
    const count = new Map<string, number>();
    for (const [a, b] of matchups) {
      count.set(a, (count.get(a) ?? 0) + 1);
      count.set(b, (count.get(b) ?? 0) + 1);
    }
    for (const t of teams) expect(count.get(t.id)).toBe(12);
  });
});

describe('generateSchedule', () => {
  const teams = makeTeams();
  const result = generateSchedule({
    division,
    teams,
    slots: makeSlots(),
    gamesPerTeam: 12,
    attempts: 60,
  });

  it('schedules every matchup (no violations with ample capacity)', () => {
    expect(result.unscheduled).toHaveLength(0);
    for (const t of teams) expect(result.gamesPerTeamActual[t.id]).toBe(12);
  });

  it('only uses the division allowed days', () => {
    for (const g of result.games) {
      expect(['Mon', 'Wed']).toContain(dayOfWeek(g.date));
    }
  });

  it('plays games at the home team city', () => {
    const byId = new Map(teams.map((t) => [t.id, t]));
    for (const g of result.games) {
      expect(g.fieldId.startsWith(byId.get(g.homeTeamId)!.cityId)).toBe(true);
    }
  });

  it('never double-books a field slot or a team on one day', () => {
    const slotSeen = new Set<string>();
    const teamDay = new Set<string>();
    for (const g of result.games) {
      const slotKey = `${g.fieldId}|${g.date}|${g.time}`;
      expect(slotSeen.has(slotKey)).toBe(false);
      slotSeen.add(slotKey);
      for (const teamId of [g.homeTeamId, g.awayTeamId]) {
        const key = `${teamId}|${g.date}`;
        expect(teamDay.has(key)).toBe(false);
        teamDay.add(key);
      }
    }
  });

  it('keeps teams at two games per week', () => {
    const load = new Map<string, number>();
    for (const g of result.games) {
      for (const teamId of [g.homeTeamId, g.awayTeamId]) {
        const key = `${teamId}|${weekKey(g.date)}`;
        load.set(key, (load.get(key) ?? 0) + 1);
      }
    }
    for (const n of load.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it('balances home and away games reasonably', () => {
    const home = new Map<string, number>();
    for (const g of result.games) home.set(g.homeTeamId, (home.get(g.homeTeamId) ?? 0) + 1);
    for (const t of teams) {
      const h = home.get(t.id) ?? 0;
      expect(h).toBeGreaterThanOrEqual(4);
      expect(h).toBeLessThanOrEqual(8);
    }
  });

  it('respects 14U team day preferences when the division has no fixed days', () => {
    const d14: Division = { ...division, id: 'd14u', name: '14U', allowedDays: null, classificationEnabled: false };
    const teams14: Team[] = makeTeams()
      .slice(0, 8)
      .map((t, i) => ({
        ...t,
        divisionId: 'd14u',
        classification: null,
        preferredDays: i % 2 === 0 ? ['Tue', 'Thu'] : ['Tue', 'Fri'],
      }));
    const slots: PermitSlot[] = [];
    let n = 0;
    for (const cityId of CITIES) {
      for (const occ of expandPermitPattern(['Tue', 'Thu', 'Fri'], ['18:00'], SEASON_START, SEASON_END)) {
        slots.push({
          id: `s14-${n++}`,
          seasonId: 's1',
          cityId,
          fieldId: `${cityId}-field-14`,
          date: occ.date,
          time: occ.time,
          gameId: null,
        });
      }
    }
    const res = generateSchedule({ division: d14, teams: teams14, slots, gamesPerTeam: 6, attempts: 40 });
    const byId = new Map(teams14.map((t) => [t.id, t]));
    for (const g of res.games) {
      const day = dayOfWeek(g.date);
      const h = byId.get(g.homeTeamId)!.preferredDays!;
      const a = byId.get(g.awayTeamId)!.preferredDays!;
      const intersection = h.filter((d) => a.includes(d));
      const allowed = intersection.length > 0 ? intersection : [...h, ...a];
      expect(allowed).toContain(day);
    }
  });
});
