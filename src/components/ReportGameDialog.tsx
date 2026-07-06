import { useState } from 'react';
import Modal from './Modal';
import SlotPicker from './SlotPicker';
import { useAuth } from '../context/AuthContext';
import { fmtDate, fmtTime } from '../lib/dates';
import type { Game } from '../lib/types';
import type { LeagueData } from '../lib/leagueData';
import {
  reportCancelled,
  reportFinal,
  reportForfeit,
  reportSuspended,
  rescheduleGame,
} from '../lib/gameOps';
import type { GameCtx, NewSlotChoice } from '../lib/gameOps';

type Mode = 'final' | 'cancelled' | 'forfeit' | 'reschedule' | 'suspended';

const MODES: { key: Mode; label: string }[] = [
  { key: 'final', label: 'Final score' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'forfeit', label: 'Forfeit' },
  { key: 'reschedule', label: 'Reschedule' },
  { key: 'suspended', label: 'Suspended' },
];

export default function ReportGameDialog({
  game,
  data,
  onClose,
}: {
  game: Game;
  data: LeagueData;
  onClose: () => void;
}) {
  const { email, coachTeamIds } = useAuth();
  const [mode, setMode] = useState<Mode>(game.needsReschedule ? 'reschedule' : 'final');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [forfeitingTeamId, setForfeitingTeamId] = useState('');
  const [inning, setInning] = useState('4');
  const [half, setHalf] = useState<'top' | 'bottom'>('top');
  const [slotChoice, setSlotChoice] = useState<NewSlotChoice | null>(null);
  const [umpNotified, setUmpNotified] = useState(false);

  const ctx: GameCtx = {
    actor: email ?? 'unknown',
    teamName: data.teamName,
    fieldName: data.fieldName,
  };
  // Notify the teams the reporter does NOT coach (both, for league admins).
  const opposing = [game.homeTeamId, game.awayTeamId].filter((id) => !coachTeamIds.includes(id));
  const notifyTeamIds = opposing.length > 0 ? opposing : [game.homeTeamId, game.awayTeamId];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'final') {
        const h = Number(homeScore);
        const a = Number(awayScore);
        if (homeScore === '' || awayScore === '' || h < 0 || a < 0 || !Number.isInteger(h) || !Number.isInteger(a)) {
          throw new Error('Enter a whole-number score for both teams.');
        }
        await reportFinal(game, h, a, ctx, notifyTeamIds);
      } else if (mode === 'cancelled') {
        await reportCancelled(game, ctx, notifyTeamIds);
      } else if (mode === 'forfeit') {
        if (!forfeitingTeamId) throw new Error('Choose which team forfeited.');
        await reportForfeit(game, forfeitingTeamId, ctx, notifyTeamIds);
      } else if (mode === 'suspended') {
        const h = Number(homeScore);
        const a = Number(awayScore);
        const inn = Number(inning);
        if (homeScore === '' || awayScore === '' || !Number.isInteger(inn) || inn < 1) {
          throw new Error('Enter the current score and inning.');
        }
        await reportSuspended(game, { inning: inn, half, homeScore: h, awayScore: a }, ctx, notifyTeamIds);
      } else if (mode === 'reschedule') {
        if (!slotChoice) throw new Error('Pick an open slot or enter a date, time and field.');
        await rescheduleGame(game, slotChoice, umpNotified, ctx, notifyTeamIds);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const scoreInputs = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">{data.teamName(game.homeTeamId)} (home)</label>
        <input type="number" min="0" className="input" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} />
      </div>
      <div>
        <label className="label">{data.teamName(game.awayTeamId)} (away)</label>
        <input type="number" min="0" className="input" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} />
      </div>
    </div>
  );

  return (
    <Modal title="Report game" onClose={onClose}>
      <p className="text-sm text-stone-600">
        {data.teamName(game.awayTeamId)} at {data.teamName(game.homeTeamId)} —{' '}
        {fmtDate(game.date)} {fmtTime(game.time)}, {data.fieldName(game.fieldId)}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`chip ${mode === m.key ? 'chip-on' : ''}`}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {mode === 'final' && scoreInputs}

        {mode === 'cancelled' && (
          <p className="text-sm text-stone-600">
            The game will be marked cancelled (rainout, etc.). Both teams' coaches will get a daily
            email reminder until it is rescheduled. Only the league administrator can remove it
            from the schedule entirely.
          </p>
        )}

        {mode === 'forfeit' && (
          <div>
            <label className="label">Which team forfeited?</label>
            <select className="input" value={forfeitingTeamId} onChange={(e) => setForfeitingTeamId(e.target.value)}>
              <option value="">Choose…</option>
              <option value={game.homeTeamId}>{data.teamName(game.homeTeamId)}</option>
              <option value={game.awayTeamId}>{data.teamName(game.awayTeamId)}</option>
            </select>
            <p className="mt-2 text-sm text-stone-500">Recorded as a 7–0 win for the other team.</p>
          </div>
        )}

        {mode === 'suspended' && (
          <>
            {scoreInputs}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Inning</label>
                <input type="number" min="1" max="9" className="input" value={inning} onChange={(e) => setInning(e.target.value)} />
              </div>
              <div>
                <label className="label">Half</label>
                <select className="input" value={half} onChange={(e) => setHalf(e.target.value as 'top' | 'bottom')}>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
            </div>
            <p className="text-sm text-stone-500">
              You'll get a daily reminder until the game is rescheduled to finish.
            </p>
          </>
        )}

        {mode === 'reschedule' && (
          <>
            <SlotPicker game={game} data={data} value={slotChoice} onChange={setSlotChoice} />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={umpNotified} onChange={(e) => setUmpNotified(e.target.checked)} />
              Ump assigner notified?
            </label>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
