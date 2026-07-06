import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';
import { fmtTime } from '../lib/dates';
import type { Game } from '../lib/types';
import type { LeagueData } from '../lib/leagueData';

export default function GameCard({
  game,
  data,
  actions,
}: {
  game: Game;
  data: LeagueData;
  actions?: ReactNode;
}) {
  const division = data.divisions.find((d) => d.id === game.divisionId);
  const hasScore = game.homeScore !== null && game.awayScore !== null;
  const field = data.fieldById.get(game.fieldId);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stone-100 px-3 py-2 last:border-b-0">
      <span className="w-16 text-sm font-medium text-stone-500">{fmtTime(game.time)}</span>
      <span className="min-w-0 flex-1 basis-52 text-sm">
        <span className={hasScore && game.awayScore! > game.homeScore! ? 'font-semibold' : ''}>
          {data.teamName(game.awayTeamId)}
          {hasScore && <span className="ml-1 tabular-nums">{game.awayScore}</span>}
        </span>
        <span className="mx-1.5 text-stone-400">at</span>
        <span className={hasScore && game.homeScore! > game.awayScore! ? 'font-semibold' : ''}>
          {data.teamName(game.homeTeamId)}
          {hasScore && <span className="ml-1 tabular-nums">{game.homeScore}</span>}
        </span>
        {game.status === 'suspended' && game.suspended && (
          <span className="ml-2 text-xs text-purple-700">
            ({game.suspended.awayScore}–{game.suspended.homeScore}, {game.suspended.half} {game.suspended.inning})
          </span>
        )}
      </span>
      <span className="text-xs text-stone-500" title={field?.address}>
        {data.fieldName(game.fieldId)}
      </span>
      {division && <span className="badge bg-stone-100 text-stone-500">{division.name}</span>}
      <StatusBadge game={game} />
      {actions}
    </div>
  );
}
