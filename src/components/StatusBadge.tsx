import type { Game } from '../lib/types';

const STYLES: Record<string, string> = {
  scheduled: 'bg-stone-100 text-stone-600',
  played: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-amber-100 text-amber-800',
  forfeit: 'bg-red-100 text-red-800',
  suspended: 'bg-purple-100 text-purple-800',
};

export default function StatusBadge({ game }: { game: Game }) {
  const label =
    game.status === 'scheduled' && game.needsReschedule ? 'needs reschedule' : game.status;
  return (
    <span className={`badge ${STYLES[game.status]}`}>
      {label}
      {game.needsReschedule && game.status !== 'scheduled' ? ' · needs reschedule' : ''}
    </span>
  );
}
