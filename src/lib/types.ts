export type DayName = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export type Role = 'league_admin' | 'city_admin' | 'coach';

export interface Season {
  id: string;
  year: number;
  active: boolean;
  gameWindowStart: string; // ISO date, e.g. "2026-04-27"
  gameWindowEnd: string;
  gamesPerTeam: number;
}

export interface Division {
  id: string;
  seasonId: string;
  name: string; // "10U" | "12U" | "14U" | ...
  /** Days this division plays on; null = driven by team preferences (14U). */
  allowedDays: DayName[] | null;
  classificationEnabled: boolean;
  sortOrder: number;
}

export interface City {
  id: string;
  name: string;
}

/** Doc id = lowercase email. Coaches get access via `contacts`, not a role doc. */
export interface RoleDoc {
  role: 'league_admin' | 'city_admin';
  cityId?: string;
}

export interface Field {
  id: string;
  cityId: string;
  name: string;
  address: string;
}

export interface PermitSlot {
  id: string;
  seasonId: string;
  cityId: string;
  fieldId: string;
  date: string; // ISO date
  time: string; // "17:30"
  gameId: string | null;
}

export interface Team {
  id: string;
  seasonId: string;
  divisionId: string;
  cityId: string;
  name: string;
  classification: 'A' | 'B' | null;
  /** Only used when the division has allowedDays = null (14U). */
  preferredDays: DayName[] | null;
}

export interface Contact {
  id: string;
  teamId: string;
  cityId: string;
  name: string;
  email: string; // lowercase
  phone: string;
  role: 'head' | 'assistant';
}

export type GameStatus = 'scheduled' | 'played' | 'cancelled' | 'forfeit' | 'suspended';

export interface SuspendedState {
  inning: number;
  half: 'top' | 'bottom';
  homeScore: number;
  awayScore: number;
}

export interface Game {
  id: string;
  seasonId: string;
  divisionId: string;
  date: string; // ISO date
  time: string; // "17:30"
  fieldId: string;
  homeTeamId: string;
  awayTeamId: string;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  forfeitingTeamId: string | null;
  suspended: SuspendedState | null;
  needsReschedule: boolean;
  umpAssignerNotified: boolean;
  reportedBy: string | null; // email
  lastReminderAt: string | null; // ISO datetime, set by notify cron
  lastNagAt: string | null; // ISO datetime, set by notify cron
  history: string[]; // human-readable audit trail
}

export interface MailMessage {
  id: string;
  to: string[];
  subject: string;
  text: string;
  createdAt: string; // ISO datetime
  sentAt: string | null;
}

/** Doc id = lowercase coach email. Maintained by app code when contacts change. */
export interface CoachIndex {
  teamIds: string[];
}
