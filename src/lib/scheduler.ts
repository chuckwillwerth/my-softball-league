import type { DayName, Division, PermitSlot, Team } from './types';
import { dayOfWeek, weekKey } from './dates';

export interface DraftGame {
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  fieldId: string;
  slotId: string;
}

export interface UnscheduledMatchup {
  teamIds: [string, string];
  reason: string;
}

export interface ScheduleResult {
  games: DraftGame[];
  unscheduled: UnscheduledMatchup[];
  violations: string[];
  score: number;
  gamesPerTeamActual: Record<string, number>;
}

export interface SchedulerInput {
  division: Division;
  teams: Team[];
  /** Open permit slots for the whole season (any city, any day). */
  slots: PermitSlot[];
  gamesPerTeam: number;
  attempts?: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Pair = [string, string];

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Build the matchup list for one division. In classified divisions, A teams
 * are paired against other A teams first (repeating opponents as needed) and
 * likewise for B; cross-classification games are only used to fill shortfalls
 * (e.g. an odd number of A teams).
 */
export function buildMatchups(
  teams: Team[],
  gamesPerTeam: number,
  classificationEnabled: boolean,
  rand: () => number,
): Pair[] {
  const count = new Map<string, number>(teams.map((t) => [t.id, 0]));
  const meetings = new Map<string, number>();
  const matchups: Pair[] = [];

  const add = (a: string, b: string) => {
    matchups.push([a, b]);
    count.set(a, count.get(a)! + 1);
    count.set(b, count.get(b)! + 1);
    meetings.set(pairKey(a, b), (meetings.get(pairKey(a, b)) ?? 0) + 1);
  };

  const fillWithin = (group: Team[]) => {
    // Repeatedly pair the neediest team with the compatible partner it has
    // met the fewest times — a round-robin that repeats cleanly past one cycle.
    for (;;) {
      const needy = shuffle(
        group.filter((t) => count.get(t.id)! < gamesPerTeam),
        rand,
      ).sort((x, y) => count.get(x.id)! - count.get(y.id)!);
      if (needy.length < 2) break;
      const t = needy[0];
      const partner = needy
        .slice(1)
        .sort(
          (x, y) =>
            (meetings.get(pairKey(t.id, x.id)) ?? 0) - (meetings.get(pairKey(t.id, y.id)) ?? 0) ||
            count.get(x.id)! - count.get(y.id)!,
        )[0];
      add(t.id, partner.id);
    }
  };

  if (classificationEnabled) {
    const groups = new Map<string, Team[]>();
    for (const t of teams) {
      const key = t.classification ?? 'B'; // unclassified teams play with the B pool
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    for (const group of groups.values()) fillWithin(group);
  }

  // Fill shortfalls (odd group sizes, unclassified divisions) across all teams.
  fillWithin(teams);

  return matchups;
}

function allowedDaysFor(division: Division, home: Team, away: Team): Set<DayName> | null {
  if (division.allowedDays && division.allowedDays.length > 0) return new Set(division.allowedDays);
  // Preference-driven division (14U): use the intersection of both teams'
  // preferred days when it exists, otherwise the union; no preferences = any day.
  const h = home.preferredDays ?? [];
  const a = away.preferredDays ?? [];
  if (h.length === 0 && a.length === 0) return null;
  if (h.length === 0) return new Set(a);
  if (a.length === 0) return new Set(h);
  const both = h.filter((d) => a.includes(d));
  return new Set(both.length > 0 ? both : [...h, ...a]);
}

function attempt(input: SchedulerInput, rand: () => number): ScheduleResult {
  const { division, teams, gamesPerTeam } = input;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const matchups = shuffle(
    buildMatchups(teams, gamesPerTeam, division.classificationEnabled, rand),
    rand,
  );

  const openSlots = shuffle(
    input.slots.filter((s) => !s.gameId),
    rand,
  ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const usedSlots = new Set<string>();
  const teamOnDate = new Set<string>(); // "teamId|date"
  const teamWeekLoad = new Map<string, number>(); // "teamId|weekMonday" -> games
  const homeCount = new Map<string, number>(teams.map((t) => [t.id, 0]));

  const weekLoad = (teamId: string, date: string) =>
    teamWeekLoad.get(`${teamId}|${weekKey(date)}`) ?? 0;

  const games: DraftGame[] = [];
  const unscheduled: UnscheduledMatchup[] = [];

  const findSlot = (home: Team, away: Team, maxWeekLoad: number): PermitSlot | null => {
    const days = allowedDaysFor(division, home, away);
    let best: PermitSlot | null = null;
    let bestLoad = Infinity;
    for (const s of openSlots) {
      if (usedSlots.has(s.id)) continue;
      if (s.cityId !== home.cityId) continue;
      if (days && !days.has(dayOfWeek(s.date))) continue;
      if (teamOnDate.has(`${home.id}|${s.date}`) || teamOnDate.has(`${away.id}|${s.date}`)) continue;
      const load = weekLoad(home.id, s.date) + weekLoad(away.id, s.date);
      if (weekLoad(home.id, s.date) >= maxWeekLoad || weekLoad(away.id, s.date) >= maxWeekLoad) continue;
      if (load < bestLoad) {
        best = s;
        bestLoad = load;
      }
    }
    return best;
  };

  const place = (home: Team, away: Team, slot: PermitSlot) => {
    usedSlots.add(slot.id);
    teamOnDate.add(`${home.id}|${slot.date}`);
    teamOnDate.add(`${away.id}|${slot.date}`);
    const wk = weekKey(slot.date);
    teamWeekLoad.set(`${home.id}|${wk}`, (teamWeekLoad.get(`${home.id}|${wk}`) ?? 0) + 1);
    teamWeekLoad.set(`${away.id}|${wk}`, (teamWeekLoad.get(`${away.id}|${wk}`) ?? 0) + 1);
    homeCount.set(home.id, homeCount.get(home.id)! + 1);
    games.push({
      homeTeamId: home.id,
      awayTeamId: away.id,
      date: slot.date,
      time: slot.time,
      fieldId: slot.fieldId,
      slotId: slot.id,
    });
  };

  for (const [id1, id2] of matchups) {
    const t1 = teamById.get(id1)!;
    const t2 = teamById.get(id2)!;
    // Prefer giving the home game to whoever has had fewer; try both orientations,
    // relaxing the 2-games-per-week target only if nothing fits.
    const orientations: [Team, Team][] =
      homeCount.get(t1.id)! <= homeCount.get(t2.id)!
        ? [
            [t1, t2],
            [t2, t1],
          ]
        : [
            [t2, t1],
            [t1, t2],
          ];
    let placed = false;
    for (const maxWeekLoad of [2, 3, Infinity]) {
      for (const [home, away] of orientations) {
        const slot = findSlot(home, away, maxWeekLoad);
        if (slot) {
          place(home, away, slot);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      unscheduled.push({
        teamIds: [id1, id2],
        reason: 'No open permit slot in either home city on an allowed day without a conflict',
      });
    }
  }

  // ----- Score + violations -----
  const gamesPerTeamActual: Record<string, number> = {};
  for (const t of teams) gamesPerTeamActual[t.id] = 0;
  for (const g of games) {
    gamesPerTeamActual[g.homeTeamId]++;
    gamesPerTeamActual[g.awayTeamId]++;
  }

  let score = unscheduled.length * 1000;
  const violations: string[] = [];
  const name = (id: string) => teamById.get(id)?.name ?? id;

  for (const u of unscheduled) {
    violations.push(`Could not schedule ${name(u.teamIds[0])} vs ${name(u.teamIds[1])}: ${u.reason}`);
  }
  for (const t of teams) {
    const n = gamesPerTeamActual[t.id];
    if (n !== gamesPerTeam) {
      violations.push(`${t.name} has ${n} games (target ${gamesPerTeam})`);
      score += Math.abs(gamesPerTeam - n) * 100;
    }
    const home = homeCount.get(t.id)!;
    const imbalance = Math.abs(home - n / 2);
    if (imbalance > 1.5) violations.push(`${t.name} has ${home} home games out of ${n}`);
    score += imbalance * 2;
  }
  for (const [key, load] of teamWeekLoad) {
    if (load > 2) {
      const [teamId, wk] = key.split('|');
      violations.push(`${name(teamId)} plays ${load} games the week of ${wk}`);
      score += (load - 2) * 40;
    }
  }

  return { games, unscheduled, violations, score, gamesPerTeamActual };
}

/**
 * Randomized greedy with restarts: run many seeded attempts and keep the
 * best-scoring schedule. Instant at league scale (~24 teams, ~150 slots).
 */
export function generateSchedule(input: SchedulerInput): ScheduleResult {
  const attempts = input.attempts ?? 150;
  let best: ScheduleResult | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = attempt(input, mulberry32(i * 2654435761 + 12345));
    if (!best || res.score < best.score) best = res;
    if (best.score === 0) break;
  }
  return best!;
}
