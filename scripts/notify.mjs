// Notification cron — run hourly by .github/workflows/notify.yml.
//
// 1. Flushes the mailQueue collection (event notifications written by the app:
//    score reported, cancelled, forfeit, rescheduled, schedule changes).
// 2. Emails both head coaches when a game was due >24h ago with no result
//    reported (at most once per 24h per game).
// 3. Emails both head coaches daily while a cancelled/suspended game still
//    needs to be rescheduled.
//
// Env vars:
//   FIREBASE_SERVICE_ACCOUNT  JSON of a service account key (repo secret) —
//                             not needed when FIRESTORE_EMULATOR_HOST is set.
//   BREVO_API_KEY             Brevo (free tier) transactional email API key.
//   MAIL_FROM                 Verified sender address in Brevo.
//   MAIL_FROM_NAME            Sender display name (optional).
//   APP_URL                   Public site URL to include in emails (optional).
//
// Flags: --dry-run  print emails instead of sending, and don't mark anything.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');
const APP_URL = process.env.APP_URL ?? '';
const FOOTER = `\n\n— Sent automatically by the league scheduling app.${APP_URL ? `\n${APP_URL}` : ''}`;

if (process.env.FIRESTORE_EMULATOR_HOST) {
  initializeApp({ projectId: 'demo-softball' });
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
} else {
  console.error('Set FIREBASE_SERVICE_ACCOUNT (or FIRESTORE_EMULATOR_HOST for local runs).');
  process.exit(1);
}

const db = getFirestore();
let sentCount = 0;

async function sendMail(to, subject, text) {
  if (to.length === 0) return;
  sentCount++;
  if (DRY_RUN) {
    console.log(`\n--- DRY RUN mail #${sentCount} ---\nTo: ${to.join(', ')}\nSubject: ${subject}\n${text}`);
    return;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: process.env.MAIL_FROM, name: process.env.MAIL_FROM_NAME ?? 'League Central' },
      to: to.map((email) => ({ email })),
      subject,
      textContent: text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------- helpers

const teamNames = new Map();
async function teamName(id) {
  if (!teamNames.has(id)) {
    const snap = await db.doc(`teams/${id}`).get();
    teamNames.set(id, snap.exists ? snap.data().name : '(unknown team)');
  }
  return teamNames.get(id);
}

async function headCoachEmails(game) {
  const snap = await db
    .collection('contacts')
    .where('teamId', 'in', [game.homeTeamId, game.awayTeamId])
    .where('role', '==', 'head')
    .get();
  return [...new Set(snap.docs.map((d) => d.data().email).filter(Boolean))];
}

async function gameLabel(game) {
  return `${await teamName(game.awayTeamId)} at ${await teamName(game.homeTeamId)} (${game.date} ${game.time})`;
}

const HOURS = 3600 * 1000;
const now = Date.now();

function gameStartMs(game) {
  return new Date(`${game.date}T${game.time || '12:00'}:00`).getTime();
}

function stampedWithin(iso, hours) {
  return iso && now - new Date(iso).getTime() < hours * HOURS;
}

// ---------------------------------------------------------------- 1. flush queue

async function flushMailQueue() {
  const snap = await db.collection('mailQueue').where('sentAt', '==', null).limit(200).get();
  console.log(`mailQueue: ${snap.size} unsent message(s)`);
  for (const docSnap of snap.docs) {
    const m = docSnap.data();
    try {
      await sendMail(m.to ?? [], m.subject ?? 'League update', (m.text ?? '') + FOOTER);
      if (!DRY_RUN) await docSnap.ref.update({ sentAt: new Date().toISOString() });
    } catch (err) {
      console.error(`  failed to send ${docSnap.id}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------- 2. missing-score reminders

async function remindMissingScores() {
  const today = new Date().toISOString().slice(0, 10);
  const snap = await db
    .collection('games')
    .where('status', 'in', ['scheduled', 'suspended'])
    .where('date', '<=', today)
    .get();

  let n = 0;
  for (const docSnap of snap.docs) {
    const g = docSnap.data();
    if (g.needsReschedule) continue; // handled by the daily nag below
    if (now - gameStartMs(g) < 24 * HOURS) continue;
    if (stampedWithin(g.lastReminderAt, 23)) continue;

    const label = await gameLabel(g);
    const isSuspended = g.status === 'suspended';
    await sendMail(
      await headCoachEmails(g),
      `Reminder: report the result of ${label}`,
      (isSuspended
        ? `The suspended game ${label} was set to resume over 24 hours ago and no final score has been reported.`
        : `The game ${label} was scheduled over 24 hours ago and no score has been reported.`) +
        `\n\nPlease open the app and report the final score — or mark the game cancelled, forfeited, rescheduled, or suspended.` +
        FOOTER,
    );
    if (!DRY_RUN) await docSnap.ref.update({ lastReminderAt: new Date().toISOString() });
    n++;
  }
  console.log(`missing-score reminders: ${n} sent`);
}

// ---------------------------------------------------------------- 3. reschedule nags

async function nagUnrescheduled() {
  const snap = await db.collection('games').where('needsReschedule', '==', true).get();

  let n = 0;
  for (const docSnap of snap.docs) {
    const g = docSnap.data();
    if (stampedWithin(g.lastNagAt, 23)) continue;

    const label = await gameLabel(g);
    await sendMail(
      await headCoachEmails(g),
      `Action needed: reschedule ${label}`,
      `The ${g.status} game ${label} still needs to be rescheduled.\n\nPlease coordinate with the opposing coach and pick a new date in the app (My Games -> Report -> Reschedule). You'll get this reminder daily until the game is rescheduled or the league administrator removes it.` +
        FOOTER,
    );
    if (!DRY_RUN) await docSnap.ref.update({ lastNagAt: new Date().toISOString() });
    n++;
  }
  console.log(`reschedule nags: ${n} sent`);
}

// ----------------------------------------------------------------

try {
  await flushMailQueue();
  await remindMissingScores();
  await nagUnrescheduled();
  console.log(`Done. ${sentCount} email(s) ${DRY_RUN ? 'printed (dry run)' : 'sent'}.`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
