import type { Game, PermitSlot, Team } from './types';

export type SlotPriority = 'homeField' | 'homeCity' | 'awayCity' | 'other';

export const PRIORITY_LABELS: Record<SlotPriority, string> = {
  homeField: "Home team's usual field",
  homeCity: "Home team's city",
  awayCity: "Away team's city",
  other: 'Other cities',
};

const PRIORITY_ORDER: SlotPriority[] = ['homeField', 'homeCity', 'awayCity', 'other'];

export interface RankedSlot {
  slot: PermitSlot;
  priority: SlotPriority;
}

/**
 * Rank open permit slots for rescheduling/moving a game:
 * home team's usual field(s) first, then the home city's other fields,
 * then the away city's fields, then everything else.
 *
 * "Usual fields" = fields where the home team already has home games scheduled.
 */
export function prioritizeSlots(
  slots: PermitSlot[],
  game: Game,
  homeTeam: Team,
  awayTeam: Team,
  allGames: Game[],
): RankedSlot[] {
  const homeFieldIds = new Set(
    allGames.filter((g) => g.homeTeamId === homeTeam.id && g.id !== game.id).map((g) => g.fieldId),
  );

  const ranked: RankedSlot[] = slots
    .filter((s) => !s.gameId)
    .map((slot) => {
      let priority: SlotPriority = 'other';
      if (homeFieldIds.has(slot.fieldId)) priority = 'homeField';
      else if (slot.cityId === homeTeam.cityId) priority = 'homeCity';
      else if (slot.cityId === awayTeam.cityId) priority = 'awayCity';
      return { slot, priority };
    });

  ranked.sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
      a.slot.date.localeCompare(b.slot.date) ||
      a.slot.time.localeCompare(b.slot.time),
  );
  return ranked;
}
