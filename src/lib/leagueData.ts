import { where } from 'firebase/firestore';
import { useActiveSeason } from './season';
import { byId, useCol } from './hooks';
import type { City, Division, Field, Game, Season, Team } from './types';

export interface LeagueData {
  season: Season | null;
  divisions: Division[];
  cities: City[];
  fields: Field[];
  teams: Team[];
  games: Game[];
  teamById: Map<string, Team>;
  fieldById: Map<string, Field>;
  cityById: Map<string, City>;
  teamName: (id: string) => string;
  fieldName: (id: string) => string;
  cityName: (id: string) => string;
  ready: boolean;
}

/** Core collections for the active season, live-updating. */
export function useLeagueData(): LeagueData {
  const season = useActiveSeason();
  const sid = season?.id ?? null;

  const divisions = useCol<Division>(sid && 'divisions', () => [where('seasonId', '==', sid ?? '')], [sid]);
  const teams = useCol<Team>(sid && 'teams', () => [where('seasonId', '==', sid ?? '')], [sid]);
  const games = useCol<Game>(sid && 'games', () => [where('seasonId', '==', sid ?? '')], [sid]);
  const cities = useCol<City>('cities', () => [], []);
  const fields = useCol<Field>('fields', () => [], []);

  const teamById = byId(teams.data);
  const fieldById = byId(fields.data);
  const cityById = byId(cities.data);

  return {
    season,
    divisions: (divisions.data ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    cities: (cities.data ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    fields: fields.data ?? [],
    teams: (teams.data ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    games: (games.data ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    teamById,
    fieldById,
    cityById,
    teamName: (id) => teamById.get(id)?.name ?? '(deleted team)',
    fieldName: (id) => fieldById.get(id)?.name ?? '(unknown field)',
    cityName: (id) => cityById.get(id)?.name ?? '(unknown city)',
    ready: season !== null && divisions.data !== null && teams.data !== null && games.data !== null,
  };
}
