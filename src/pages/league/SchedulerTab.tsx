import { useMemo, useState } from 'react';
import { doc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { newId } from '../../lib/db';
import { useCol } from '../../lib/hooks';
import { generateSchedule } from '../../lib/scheduler';
import type { ScheduleResult } from '../../lib/scheduler';
import { fmtDate, fmtTime } from '../../lib/dates';
import type { PermitSlot } from '../../lib/types';
import type { LeagueData } from '../../lib/leagueData';

export default function SchedulerTab({ data }: { data: LeagueData }) {
  const [divisionId, setDivisionId] = useState('');
  const division = data.divisions.find((d) => d.id === divisionId) ?? data.divisions[0] ?? null;
  const [draft, setDraft] = useState<ScheduleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const slots = useCol<PermitSlot>(
    data.season && 'permitSlots',
    () => [where('seasonId', '==', data.season?.id ?? '')],
    [data.season?.id],
  );

  const divisionTeams = useMemo(
    () => data.teams.filter((t) => t.divisionId === division?.id),
    [data.teams, division?.id],
  );
  const existingGames = data.games.filter((g) => g.divisionId === division?.id);
  const openSlots = (slots.data ?? []).filter((s) => !s.gameId);
  const aCount = divisionTeams.filter((t) => t.classification === 'A').length;

  if (!data.season || !division) {
    return <p className="py-16 text-center text-stone-500">Create the season and divisions first (Season Setup tab).</p>;
  }

  const generate = () => {
    setMessage(null);
    setDraft(
      generateSchedule({
        division,
        teams: divisionTeams,
        slots: openSlots,
        gamesPerTeam: data.season!.gamesPerTeam,
      }),
    );
  };

  const publish = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      // 2 writes per game (game + slot stamp); stay under the 500-op batch cap.
      for (let i = 0; i < draft.games.length; i += 200) {
        const batch = writeBatch(db);
        for (const g of draft.games.slice(i, i + 200)) {
          const gameId = newId('games');
          batch.set(doc(db, 'games', gameId), {
            seasonId: data.season!.id,
            divisionId: division.id,
            date: g.date,
            time: g.time,
            fieldId: g.fieldId,
            homeTeamId: g.homeTeamId,
            awayTeamId: g.awayTeamId,
            status: 'scheduled',
            homeScore: null,
            awayScore: null,
            forfeitingTeamId: null,
            suspended: null,
            needsReschedule: false,
            umpAssignerNotified: false,
            reportedBy: null,
            lastReminderAt: null,
            lastNagAt: null,
            history: [],
          });
          batch.update(doc(db, 'permitSlots', g.slotId), { gameId });
        }
        await batch.commit();
      }
      setDraft(null);
      setMessage(`Published ${draft.games.length} games for ${division.name}. See the Schedule page.`);
    } catch (e) {
      setMessage(`Publish failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const clearDivision = async () => {
    const removable = existingGames.filter((g) => g.status === 'scheduled' && !g.needsReschedule);
    if (removable.length === 0) return;
    if (
      !window.confirm(
        `Delete all ${removable.length} unplayed scheduled ${division.name} games and free their permits? Games with reported results are kept. Coaches are NOT emailed — use this before the season starts.`,
      )
    )
      return;
    setBusy(true);
    try {
      const slotByGame = new Map((slots.data ?? []).filter((s) => s.gameId).map((s) => [s.gameId!, s]));
      for (let i = 0; i < removable.length; i += 200) {
        const batch = writeBatch(db);
        for (const g of removable.slice(i, i + 200)) {
          batch.delete(doc(db, 'games', g.id));
          const slot = slotByGame.get(g.id);
          if (slot) batch.update(doc(db, 'permitSlots', slot.id), { gameId: null });
        }
        await batch.commit();
      }
      setMessage(`Removed ${removable.length} games.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {data.divisions.map((d) => (
            <button
              key={d.id}
              className={`chip ${division.id === d.id ? 'chip-on' : ''}`}
              onClick={() => {
                setDivisionId(d.id);
                setDraft(null);
                setMessage(null);
              }}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span><strong>{divisionTeams.length}</strong> teams{division.classificationEnabled && <> (<strong>{aCount}</strong> A / <strong>{divisionTeams.length - aCount}</strong> B)</>}</span>
          <span><strong>{openSlots.length}</strong> open permit slots league-wide</span>
          <span><strong>{data.season.gamesPerTeam}</strong> games per team</span>
          <span>Days: <strong>{division.allowedDays ? division.allowedDays.join('/') : 'team preferences'}</strong></span>
          <span><strong>{existingGames.length}</strong> games already scheduled</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={generate} disabled={divisionTeams.length < 2 || busy}>
            Generate {division.name} schedule
          </button>
          {existingGames.length > 0 && (
            <button className="btn-danger" onClick={() => void clearDivision()} disabled={busy}>
              Clear unplayed {division.name} games
            </button>
          )}
        </div>
        {existingGames.length > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            ⚠ This division already has games. Publishing a new draft ADDS more games — clear the
            unplayed ones first if you're regenerating.
          </p>
        )}
        {message && <p className="mt-2 text-sm font-medium text-emerald-700">{message}</p>}
      </div>

      {draft && (
        <>
          <div className={`card ${draft.violations.length ? 'border-amber-300' : 'border-emerald-300'}`}>
            <h3 className="font-semibold">
              Draft: {draft.games.length} games{' '}
              {draft.violations.length === 0 ? (
                <span className="badge bg-emerald-100 text-emerald-800">all constraints satisfied</span>
              ) : (
                <span className="badge bg-amber-100 text-amber-800">{draft.violations.length} issue(s)</span>
              )}
            </h3>
            {draft.violations.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
                {draft.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={() => void publish()} disabled={busy}>
                {busy ? 'Publishing…' : `Publish ${draft.games.length} games`}
              </button>
              <button className="btn-secondary" onClick={generate} disabled={busy}>
                Re-roll draft
              </button>
              <button className="btn-secondary" onClick={() => setDraft(null)} disabled={busy}>
                Discard
              </button>
            </div>
          </div>

          <div className="card !p-0">
            <div className="border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-semibold">Draft preview</div>
            <div className="max-h-96 overflow-y-auto">
              {draft.games.map((g, i) => (
                <div key={i} className="flex flex-wrap gap-x-3 border-b border-stone-100 px-3 py-1.5 text-sm last:border-b-0">
                  <span className="w-24 text-stone-500">{fmtDate(g.date)}</span>
                  <span className="w-20 text-stone-500">{fmtTime(g.time)}</span>
                  <span className="flex-1">
                    {data.teamName(g.awayTeamId)} at {data.teamName(g.homeTeamId)}
                  </span>
                  <span className="text-stone-500">{data.fieldName(g.fieldId)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
