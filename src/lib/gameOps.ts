import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { fmtDate, fmtTime, nowISO } from './dates';
import { gameLine, notifyCoaches } from './mail';
import type { Game, SuspendedState } from './types';

export interface GameCtx {
  /** Email of the person making the change. */
  actor: string;
  teamName: (id: string) => string;
  fieldName: (id: string) => string;
}

export interface NewSlotChoice {
  date: string;
  time: string;
  fieldId: string;
  /** Permit slot to stamp, or null for a manually entered time/field. */
  slotId: string | null;
}

function hist(ctx: GameCtx, text: string): string {
  return `${nowISO().slice(0, 16).replace('T', ' ')} — ${ctx.actor}: ${text}`;
}

function matchup(game: Game, ctx: GameCtx): string {
  return `${ctx.teamName(game.awayTeamId)} at ${ctx.teamName(game.homeTeamId)}`;
}

/** Free any permit slot currently holding this game; stamp the new one if given. */
async function reassignSlot(
  batch: ReturnType<typeof writeBatch>,
  gameId: string,
  newSlotId: string | null,
): Promise<void> {
  const held = await getDocs(query(collection(db, 'permitSlots'), where('gameId', '==', gameId)));
  for (const d of held.docs) if (d.id !== newSlotId) batch.update(d.ref, { gameId: null });
  if (newSlotId) batch.update(doc(db, 'permitSlots', newSlotId), { gameId });
}

// ---------------------------------------------------------------- coach reports

export async function reportFinal(
  game: Game,
  homeScore: number,
  awayScore: number,
  ctx: GameCtx,
  notifyTeamIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'games', game.id), {
    status: 'played',
    homeScore,
    awayScore,
    needsReschedule: false,
    reportedBy: ctx.actor,
    history: arrayUnion(hist(ctx, `reported final score ${homeScore}–${awayScore}`)),
  });
  await batch.commit();
  await notifyCoaches(
    notifyTeamIds,
    `Score reported: ${matchup(game, ctx)}`,
    `A final score was reported for:\n${gameLine(game, ctx.teamName, ctx.fieldName)}\n\n${ctx.teamName(game.homeTeamId)} ${homeScore}, ${ctx.teamName(game.awayTeamId)} ${awayScore}\n\nReported by ${ctx.actor}. If this is not correct, contact the opposing coach or your league administrator.`,
  );
}

export async function reportCancelled(game: Game, ctx: GameCtx, notifyTeamIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'games', game.id), {
    status: 'cancelled',
    needsReschedule: true,
    reportedBy: ctx.actor,
    history: arrayUnion(hist(ctx, 'cancelled the game')),
  });
  await batch.commit();
  await notifyCoaches(
    notifyTeamIds,
    `Game cancelled: ${matchup(game, ctx)}`,
    `This game was cancelled:\n${gameLine(game, ctx.teamName, ctx.fieldName)}\n\nCancelled by ${ctx.actor}. It must be rescheduled — you will receive a daily reminder until a new date is set.`,
  );
}

export async function reportForfeit(
  game: Game,
  forfeitingTeamId: string,
  ctx: GameCtx,
  notifyTeamIds: string[],
): Promise<void> {
  const homeScore = forfeitingTeamId === game.homeTeamId ? 0 : 7;
  const awayScore = forfeitingTeamId === game.awayTeamId ? 0 : 7;
  const batch = writeBatch(db);
  batch.update(doc(db, 'games', game.id), {
    status: 'forfeit',
    homeScore,
    awayScore,
    forfeitingTeamId,
    needsReschedule: false,
    reportedBy: ctx.actor,
    history: arrayUnion(hist(ctx, `recorded forfeit by ${ctx.teamName(forfeitingTeamId)} (7–0)`)),
  });
  await batch.commit();
  await notifyCoaches(
    notifyTeamIds,
    `Forfeit recorded: ${matchup(game, ctx)}`,
    `A forfeit was recorded for:\n${gameLine(game, ctx.teamName, ctx.fieldName)}\n\n${ctx.teamName(forfeitingTeamId)} forfeited. Recorded as a 7–0 win for the opponent.\n\nReported by ${ctx.actor}.`,
  );
}

export async function reportSuspended(
  game: Game,
  state: SuspendedState,
  ctx: GameCtx,
  notifyTeamIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'games', game.id), {
    status: 'suspended',
    suspended: state,
    needsReschedule: true,
    reportedBy: ctx.actor,
    history: arrayUnion(
      hist(
        ctx,
        `suspended in the ${state.half} of inning ${state.inning}, score ${state.homeScore}–${state.awayScore}`,
      ),
    ),
  });
  await batch.commit();
  await notifyCoaches(
    notifyTeamIds,
    `Game suspended: ${matchup(game, ctx)}`,
    `This game was suspended:\n${gameLine(game, ctx.teamName, ctx.fieldName)}\n\nScore ${ctx.teamName(game.homeTeamId)} ${state.homeScore}, ${ctx.teamName(game.awayTeamId)} ${state.awayScore}, ${state.half} of inning ${state.inning}.\n\nIt must be rescheduled to finish — you will receive a daily reminder until a new date is set.`,
  );
}

/** Reschedule a cancelled/suspended/upcoming game to a new date, time and field. */
export async function rescheduleGame(
  game: Game,
  choice: NewSlotChoice,
  umpAssignerNotified: boolean,
  ctx: GameCtx,
  notifyTeamIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  await reassignSlot(batch, game.id, choice.slotId);
  batch.update(doc(db, 'games', game.id), {
    date: choice.date,
    time: choice.time,
    fieldId: choice.fieldId,
    // a suspended game stays suspended (it resumes); anything else goes back on the schedule
    status: game.status === 'suspended' ? 'suspended' : 'scheduled',
    needsReschedule: false,
    umpAssignerNotified,
    reportedBy: ctx.actor,
    history: arrayUnion(
      hist(
        ctx,
        `rescheduled from ${fmtDate(game.date)} ${fmtTime(game.time)} to ${fmtDate(choice.date)} ${fmtTime(choice.time)} at ${ctx.fieldName(choice.fieldId)}`,
      ),
    ),
  });
  await batch.commit();
  await notifyCoaches(
    notifyTeamIds,
    `Game rescheduled: ${matchup(game, ctx)}`,
    `This game has been rescheduled:\n\nWas: ${fmtDate(game.date)} ${fmtTime(game.time)} at ${ctx.fieldName(game.fieldId)}\nNow: ${fmtDate(choice.date)} ${fmtTime(choice.time)} at ${ctx.fieldName(choice.fieldId)}\n\n${matchup(game, ctx)}\nUmpire assigner notified: ${umpAssignerNotified ? 'yes' : 'NO — please make sure umpires are arranged'}\n\nChanged by ${ctx.actor}.`,
  );
}

// ---------------------------------------------------------------- league admin edits

/** Manually add a single game — e.g. to cover a matchup the generator couldn't place. */
export async function addGame(
  info: { seasonId: string; divisionId: string; homeTeamId: string; awayTeamId: string },
  choice: NewSlotChoice,
  ctx: GameCtx,
): Promise<void> {
  const gameId = doc(collection(db, 'games')).id;
  const batch = writeBatch(db);
  batch.set(doc(db, 'games', gameId), {
    ...info,
    date: choice.date,
    time: choice.time,
    fieldId: choice.fieldId,
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
    history: [hist(ctx, 'game added to the schedule')],
  });
  if (choice.slotId) batch.update(doc(db, 'permitSlots', choice.slotId), { gameId });
  await batch.commit();
  await notifyCoaches(
    [info.homeTeamId, info.awayTeamId],
    `New game scheduled: ${ctx.teamName(info.awayTeamId)} at ${ctx.teamName(info.homeTeamId)}`,
    `The league administrator added a game to the schedule:\n\n${ctx.teamName(info.awayTeamId)} at ${ctx.teamName(info.homeTeamId)}, ${fmtDate(choice.date)} ${fmtTime(choice.time)}, ${ctx.fieldName(choice.fieldId)}`,
  );
}

export async function swapGames(a: Game, b: Game, ctx: GameCtx): Promise<void> {
  const batch = writeBatch(db);
  const slotOf = async (gameId: string) =>
    (await getDocs(query(collection(db, 'permitSlots'), where('gameId', '==', gameId)))).docs[0] ?? null;
  const [slotA, slotB] = [await slotOf(a.id), await slotOf(b.id)];
  if (slotA) batch.update(slotA.ref, { gameId: b.id });
  if (slotB) batch.update(slotB.ref, { gameId: a.id });
  batch.update(doc(db, 'games', a.id), {
    date: b.date,
    time: b.time,
    fieldId: b.fieldId,
    history: arrayUnion(hist(ctx, `swapped slots with ${matchup(b, ctx)}`)),
  });
  batch.update(doc(db, 'games', b.id), {
    date: a.date,
    time: a.time,
    fieldId: a.fieldId,
    history: arrayUnion(hist(ctx, `swapped slots with ${matchup(a, ctx)}`)),
  });
  await batch.commit();
  await notifyCoaches(
    [a.homeTeamId, a.awayTeamId, b.homeTeamId, b.awayTeamId],
    'Schedule change: two games swapped',
    `The league administrator swapped these games:\n\n${matchup(a, ctx)} — now ${fmtDate(b.date)} ${fmtTime(b.time)} at ${ctx.fieldName(b.fieldId)}\n${matchup(b, ctx)} — now ${fmtDate(a.date)} ${fmtTime(a.time)} at ${ctx.fieldName(a.fieldId)}`,
  );
}

export async function editGameTeams(
  game: Game,
  homeTeamId: string,
  awayTeamId: string,
  ctx: GameCtx,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'games', game.id), {
    homeTeamId,
    awayTeamId,
    history: arrayUnion(
      hist(ctx, `teams changed to ${ctx.teamName(awayTeamId)} at ${ctx.teamName(homeTeamId)}`),
    ),
  });
  await batch.commit();
  await notifyCoaches(
    [...new Set([game.homeTeamId, game.awayTeamId, homeTeamId, awayTeamId])],
    'Schedule change: game teams updated',
    `The league administrator changed the teams for the game on ${fmtDate(game.date)} ${fmtTime(game.time)} at ${ctx.fieldName(game.fieldId)}.\n\nNow: ${ctx.teamName(awayTeamId)} at ${ctx.teamName(homeTeamId)}`,
  );
}

/** Remove a game entirely — league admin only (enforced by security rules too). */
export async function deleteGame(game: Game, ctx: GameCtx): Promise<void> {
  const batch = writeBatch(db);
  await reassignSlot(batch, game.id, null);
  batch.delete(doc(db, 'games', game.id));
  await batch.commit();
  await notifyCoaches(
    [game.homeTeamId, game.awayTeamId],
    `Game removed: ${matchup(game, ctx)}`,
    `The league administrator removed this game from the schedule:\n${gameLine(game, ctx.teamName, ctx.fieldName)}`,
  );
}
