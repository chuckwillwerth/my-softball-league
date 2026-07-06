import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeagueData } from '../lib/leagueData';
import type { LeagueData } from '../lib/leagueData';
import { fmtDate, fmtTime } from '../lib/dates';
import type { Game } from '../lib/types';
import GameCard from '../components/GameCard';
import Modal from '../components/Modal';
import SlotPicker from '../components/SlotPicker';
import ReportGameDialog from '../components/ReportGameDialog';
import { addGame, deleteGame, editGameTeams, rescheduleGame, swapGames } from '../lib/gameOps';
import type { GameCtx, NewSlotChoice } from '../lib/gameOps';

function useCtx(data: LeagueData): GameCtx {
  const { email } = useAuth();
  return { actor: email ?? 'league admin', teamName: data.teamName, fieldName: data.fieldName };
}

function MoveModal({ game, data, onClose }: { game: Game; data: LeagueData; onClose: () => void }) {
  const ctx = useCtx(data);
  const [choice, setChoice] = useState<NewSlotChoice | null>(null);
  const [umpNotified, setUmpNotified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!choice) return setError('Pick a slot or enter a date, time and field.');
    setBusy(true);
    try {
      await rescheduleGame(game, choice, umpNotified, ctx, [game.homeTeamId, game.awayTeamId]);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Move game" onClose={onClose}>
      <p className="mb-3 text-sm text-stone-600">
        {data.teamName(game.awayTeamId)} at {data.teamName(game.homeTeamId)} — currently{' '}
        {fmtDate(game.date)} {fmtTime(game.time)}, {data.fieldName(game.fieldId)}
      </p>
      <SlotPicker game={game} data={data} value={choice} onChange={setChoice} />
      <label className="mt-3 flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={umpNotified} onChange={(e) => setUmpNotified(e.target.checked)} />
        Ump assigner notified?
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Move game'}
        </button>
      </div>
    </Modal>
  );
}

function SwapModal({ game, data, onClose }: { game: Game; data: LeagueData; onClose: () => void }) {
  const ctx = useCtx(data);
  const [otherId, setOtherId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidates = data.games.filter((g) => g.id !== game.id && g.status === 'scheduled');

  const save = async () => {
    const other = candidates.find((g) => g.id === otherId);
    if (!other) return setError('Choose a game to swap with.');
    setBusy(true);
    try {
      await swapGames(game, other, ctx);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Swap two games" onClose={onClose}>
      <p className="mb-3 text-sm text-stone-600">
        Swap the date, time and field of{' '}
        <strong>
          {data.teamName(game.awayTeamId)} at {data.teamName(game.homeTeamId)}
        </strong>{' '}
        ({fmtDate(game.date)} {fmtTime(game.time)}) with:
      </p>
      <select className="input" value={otherId} onChange={(e) => setOtherId(e.target.value)}>
        <option value="">Choose a game…</option>
        {candidates.map((g) => (
          <option key={g.id} value={g.id}>
            {fmtDate(g.date)} {fmtTime(g.time)} — {data.teamName(g.awayTeamId)} at {data.teamName(g.homeTeamId)} ({data.fieldName(g.fieldId)})
          </option>
        ))}
      </select>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Swap games'}
        </button>
      </div>
    </Modal>
  );
}

function EditTeamsModal({ game, data, onClose }: { game: Game; data: LeagueData; onClose: () => void }) {
  const ctx = useCtx(data);
  const [homeTeamId, setHomeTeamId] = useState(game.homeTeamId);
  const [awayTeamId, setAwayTeamId] = useState(game.awayTeamId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const divisionTeams = data.teams.filter((t) => t.divisionId === game.divisionId);

  const save = async () => {
    if (homeTeamId === awayTeamId) return setError('Home and away must be different teams.');
    setBusy(true);
    try {
      await editGameTeams(game, homeTeamId, awayTeamId, ctx);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit teams" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Away team</label>
          <select className="input" value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}>
            {divisionTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Home team</label>
          <select className="input" value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}>
            {divisionTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddGameModal({ data, onClose }: { data: LeagueData; onClose: () => void }) {
  const ctx = useCtx(data);
  const [divisionId, setDivisionId] = useState(data.divisions[0]?.id ?? '');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [choice, setChoice] = useState<NewSlotChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const divisionTeams = data.teams.filter((t) => t.divisionId === divisionId);

  // A placeholder game so the slot picker can rank slots by home/away city.
  const pseudoGame: Game | null =
    homeTeamId && awayTeamId
      ? {
          id: '__new__',
          seasonId: data.season!.id,
          divisionId,
          date: '',
          time: '',
          fieldId: '',
          homeTeamId,
          awayTeamId,
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
        }
      : null;

  const save = async () => {
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return setError('Pick two different teams.');
    if (!choice) return setError('Pick a slot or enter a date, time and field.');
    setBusy(true);
    try {
      await addGame({ seasonId: data.season!.id, divisionId, homeTeamId, awayTeamId }, choice, ctx);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const teamSelect = (label: string, value: string, set: (v: string) => void) => (
    <div className="flex-1">
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Choose…</option>
        {divisionTeams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal title="Add a game" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Division</label>
          <select
            className="input"
            value={divisionId}
            onChange={(e) => {
              setDivisionId(e.target.value);
              setHomeTeamId('');
              setAwayTeamId('');
            }}
          >
            {data.divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          {teamSelect('Away team', awayTeamId, setAwayTeamId)}
          {teamSelect('Home team', homeTeamId, setHomeTeamId)}
        </div>
        {pseudoGame ? (
          <SlotPicker game={pseudoGame} data={data} value={choice} onChange={setChoice} />
        ) : (
          <p className="text-sm text-stone-500">Choose both teams to see open field slots.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Add game'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type Dialog =
  | { kind: 'move'; game: Game }
  | { kind: 'swap'; game: Game }
  | { kind: 'edit'; game: Game }
  | { kind: 'report'; game: Game }
  | { kind: 'add' }
  | null;

export default function SchedulePage() {
  const data = useLeagueData();
  const { isLeagueAdmin, email } = useAuth();
  const [divisionId, setDivisionId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [cityId, setCityId] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  const ctx = useCtx(data);

  const filtered = useMemo(
    () =>
      data.games.filter((g) => {
        if (divisionId && g.divisionId !== divisionId) return false;
        if (teamId && g.homeTeamId !== teamId && g.awayTeamId !== teamId) return false;
        if (cityId) {
          const home = data.teamById.get(g.homeTeamId);
          const away = data.teamById.get(g.awayTeamId);
          if (home?.cityId !== cityId && away?.cityId !== cityId) return false;
        }
        return true;
      }),
    [data.games, data.teamById, divisionId, teamId, cityId],
  );

  const byDate = useMemo(() => {
    const groups = new Map<string, Game[]>();
    for (const g of filtered) groups.set(g.date, [...(groups.get(g.date) ?? []), g]);
    return [...groups.entries()];
  }, [filtered]);

  const remove = async (game: Game) => {
    if (!window.confirm(`Remove ${data.teamName(game.awayTeamId)} at ${data.teamName(game.homeTeamId)} on ${fmtDate(game.date)} from the schedule? Coaches will be notified.`)) return;
    await deleteGame(game, { ...ctx, actor: email ?? 'league admin' });
  };

  if (!data.season) {
    return <p className="py-16 text-center text-stone-500">No active season yet. The league administrator sets one up under League Admin.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-bold">{data.season.year} Schedule</h1>
        {isLeagueAdmin && (
          <button className="btn-primary" onClick={() => setDialog({ kind: 'add' })}>
            + Add game
          </button>
        )}
        <div>
          <label className="label">Division</label>
          <select className="input w-32" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
            <option value="">All</option>
            {data.divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">City</label>
          <select className="input w-40" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">All</option>
            {data.cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Team</label>
          <select className="input w-48" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">All</option>
            {data.teams
              .filter((t) => !divisionId || t.divisionId === divisionId)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        </div>
      </div>

      {byDate.length === 0 && (
        <p className="py-16 text-center text-stone-500">
          No games scheduled yet{divisionId || teamId || cityId ? ' for these filters' : ''}.
        </p>
      )}

      <div className="space-y-4">
        {byDate.map(([date, games]) => (
          <div key={date} className="card !p-0">
            <div className="border-b border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-semibold">
              {fmtDate(date)}
            </div>
            {games.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                data={data}
                actions={
                  isLeagueAdmin ? (
                    <span className="flex gap-1">
                      <button className="btn-ghost" onClick={() => setDialog({ kind: 'report', game: g })}>Report</button>
                      <button className="btn-ghost" onClick={() => setDialog({ kind: 'move', game: g })}>Move</button>
                      <button className="btn-ghost" onClick={() => setDialog({ kind: 'swap', game: g })}>Swap</button>
                      <button className="btn-ghost" onClick={() => setDialog({ kind: 'edit', game: g })}>Teams</button>
                      <button className="btn-ghost !text-red-600" onClick={() => void remove(g)}>Delete</button>
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>

      {dialog?.kind === 'move' && <MoveModal game={dialog.game} data={data} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'swap' && <SwapModal game={dialog.game} data={data} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <EditTeamsModal game={dialog.game} data={data} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'report' && <ReportGameDialog game={dialog.game} data={data} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'add' && <AddGameModal data={data} onClose={() => setDialog(null)} />}
    </div>
  );
}
