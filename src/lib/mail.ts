import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { withId } from './db';
import { nowISO, fmtDate, fmtTime } from './dates';
import type { Contact, Game } from './types';

export async function queueMail(to: string[], subject: string, text: string): Promise<void> {
  const recipients = [...new Set(to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return;
  await addDoc(collection(db, 'mailQueue'), {
    to: recipients,
    subject,
    text,
    createdAt: nowISO(),
    sentAt: null,
  });
}

export async function contactsForTeams(teamIds: string[]): Promise<Contact[]> {
  if (teamIds.length === 0) return [];
  const snap = await getDocs(query(collection(db, 'contacts'), where('teamId', 'in', teamIds)));
  return snap.docs.map((d) => withId<Contact>(d.id, d.data()));
}

export function gameLine(game: Game, teamName: (id: string) => string, fieldName: (id: string) => string): string {
  return `${teamName(game.awayTeamId)} at ${teamName(game.homeTeamId)}, ${fmtDate(game.date)} ${fmtTime(game.time)}, ${fieldName(game.fieldId)}`;
}

/**
 * Notify the coaches of `teamIds` (head + assistant) about a change to a game.
 * Used when the other team reports something, and for league-admin edits.
 */
export async function notifyCoaches(
  teamIds: string[],
  subject: string,
  body: string,
): Promise<void> {
  const contacts = await contactsForTeams(teamIds);
  // The cron that flushes the queue appends the app footer/link.
  await queueMail(contacts.map((c) => c.email), subject, body);
}
