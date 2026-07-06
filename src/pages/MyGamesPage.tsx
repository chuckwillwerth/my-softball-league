import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeagueData } from '../lib/leagueData';
import { fmtDate, isMoreThanHoursPast, todayISO } from '../lib/dates';
import type { Game } from '../lib/types';
import GameCard from '../components/GameCard';
import ReportGameDialog from '../components/ReportGameDialog';

export default function MyGamesPage() {
  const data = useLeagueData();
  const { coachTeamIds, isLeagueAdmin } = useAuth();
  const [reporting, setReporting] = useState<Game | null>(null);

  const myGames = useMemo(
    () =>
      isLeagueAdmin && coachTeamIds.length === 0
        ? data.games
        : data.games.filter(
            (g) => coachTeamIds.includes(g.homeTeamId) || coachTeamIds.includes(g.awayTeamId),
          ),
    [data.games, coachTeamIds, isLeagueAdmin],
  );

  const needsAttention = myGames.filter(
    (g) =>
      g.needsReschedule ||
      (g.status === 'scheduled' && isMoreThanHoursPast(g.date, g.time, 24)),
  );
  const today = todayISO();
  const upcoming = myGames.filter((g) => g.status === 'scheduled' && g.date >= today && !needsAttention.includes(g));
  const finished = myGames.filter((g) => g.status === 'played' || g.status === 'forfeit');

  const canReport = (g: Game) => g.status !== 'played' && g.status !== 'forfeit';
  const reportBtn = (g: Game) => (
    <button className="btn-primary !py-1" onClick={() => setReporting(g)}>
      Report
    </button>
  );
  const fixBtn = (g: Game) => (
    <button className="btn-ghost" onClick={() => setReporting(g)}>
      Fix score
    </button>
  );

  const section = (title: string, games: Game[], highlight = false) =>
    games.length > 0 && (
      <div className={`card mb-4 !p-0 ${highlight ? 'border-amber-300' : ''}`}>
        <div className={`border-b px-3 py-1.5 text-sm font-semibold ${highlight ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-stone-200 bg-stone-50'}`}>
          {title}
        </div>
        {games.map((g) => (
          <div key={g.id}>
            <div className="px-3 pt-2 text-xs font-medium text-stone-400">{fmtDate(g.date)}</div>
            <GameCard game={g} data={data} actions={canReport(g) ? reportBtn(g) : fixBtn(g)} />
          </div>
        ))}
      </div>
    );

  if (!data.season) {
    return <p className="py-16 text-center text-stone-500">No active season yet.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-bold">My Games</h1>
      {myGames.length === 0 && (
        <p className="py-16 text-center text-stone-500">
          No games found for your teams yet. If you expect some, make sure your city administrator
          entered your email on your team's coach contacts.
        </p>
      )}
      {section('⚠️ Needs attention — report a score or reschedule', needsAttention, true)}
      {section('Upcoming', upcoming)}
      {section('Finished', finished)}
      {reporting && <ReportGameDialog game={reporting} data={data} onClose={() => setReporting(null)} />}
    </div>
  );
}
