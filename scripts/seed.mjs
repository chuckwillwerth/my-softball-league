// Seed the Firebase EMULATOR with realistic sample data for local development.
// Usage:  npm run emulators   (in one terminal)
//         npm run seed        (in another)
//
// Sign in through the app with any of these emails (the auth emulator lets you
// fake any Google account):
//   chuckwillwerth@gmail.com          league admin
//   admin.springfield@example.com     Springfield city admin
//   coach.s10u1.head@example.com      a 10U head coach
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
initializeApp({ projectId: 'demo-softball' });
const db = getFirestore();

const YEAR = new Date().getFullYear();
const START = `${YEAR}-04-27`; // late April (a Monday in 2026)
const END = `${YEAR}-06-11`; // early June

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function* datesBetween(start, end) {
  const d = new Date(`${start}T12:00:00`);
  const stop = new Date(`${end}T12:00:00`);
  while (d <= stop) {
    yield { iso: d.toISOString().slice(0, 10), day: DAY_NAMES[d.getDay()] };
    d.setDate(d.getDate() + 1);
  }
}

const batchQueue = [];
function queue(path, data) {
  batchQueue.push({ path, data });
}

const seasonId = 'season-' + YEAR;
queue(`seasons/${seasonId}`, {
  year: YEAR,
  active: true,
  gameWindowStart: START,
  gameWindowEnd: END,
  gamesPerTeam: 12,
});

const divisions = [
  { id: 'div-10u', name: '10U', allowedDays: ['Mon', 'Wed'], classificationEnabled: true, sortOrder: 0 },
  { id: 'div-12u', name: '12U', allowedDays: ['Tue', 'Thu'], classificationEnabled: true, sortOrder: 1 },
  { id: 'div-14u', name: '14U', allowedDays: null, classificationEnabled: false, sortOrder: 2 },
];
for (const d of divisions) queue(`divisions/${d.id}`, { seasonId, ...d, id: undefined });

const cities = [
  { id: 'city-springfield', name: 'Springfield' },
  { id: 'city-riverton', name: 'Riverton' },
  { id: 'city-lakeside', name: 'Lakeside' },
];
for (const c of cities) queue(`cities/${c.id}`, { name: c.name });

// Roles: league admin + one city admin per city.
queue('roles/chuckwillwerth@gmail.com', { role: 'league_admin' });
for (const c of cities) {
  queue(`roles/admin.${c.name.toLowerCase()}@example.com`, { role: 'city_admin', cityId: c.id });
}

// Fields: 2 per city, permits Mon-Thu at 5:30 & 7:30 -> plenty of slots.
let slotN = 0;
for (const c of cities) {
  for (let f = 1; f <= 2; f++) {
    const fieldId = `field-${c.id}-${f}`;
    queue(`fields/${fieldId}`, {
      cityId: c.id,
      name: `${c.name} Park #${f}`,
      address: `${100 + f} Main St, ${c.name}`,
    });
    for (const { iso, day } of datesBetween(START, END)) {
      if (!['Mon', 'Tue', 'Wed', 'Thu'].includes(day)) continue;
      for (const time of ['17:30', '19:30']) {
        queue(`permitSlots/slot-${++slotN}`, {
          seasonId,
          cityId: c.id,
          fieldId,
          date: iso,
          time,
          gameId: null,
        });
      }
    }
  }
}

// Teams + coach contacts. 10U: 12 teams (4 "A"), 12U: 9 teams, 14U: 6 teams.
const MASCOTS = ['Storm', 'Sting', 'Thunder', 'Crush', 'Blaze', 'Comets', 'Heat', 'Lightning', 'Rockets', 'Sparks', 'Fury', 'Aces'];
const coachIndex = new Map();
function addTeam(div, i, cityIdx, extra = {}) {
  const city = cities[cityIdx % cities.length];
  const teamId = `team-${div.name.toLowerCase()}-${i}`;
  queue(`teams/${teamId}`, {
    seasonId,
    divisionId: div.id,
    cityId: city.id,
    name: `${city.name} ${MASCOTS[i % MASCOTS.length]} ${div.name}`,
    classification: null,
    preferredDays: null,
    ...extra,
  });
  for (const role of ['head', 'assistant']) {
    const email = `coach.${div.name.toLowerCase()}${i}.${role}@example.com`;
    queue(`contacts/${teamId}-${role}`, {
      teamId,
      cityId: city.id,
      role,
      name: `${role === 'head' ? 'Head' : 'Asst'} Coach ${div.name} ${i}`,
      email,
      phone: `555-01${String(i).padStart(2, '0')}`,
    });
    coachIndex.set(email, [...(coachIndex.get(email) ?? []), teamId]);
  }
  return teamId;
}

divisions.forEach((div) => {
  const count = div.name === '10U' ? 12 : div.name === '12U' ? 9 : 6;
  for (let i = 1; i <= count; i++) {
    const extra = {};
    if (div.classificationEnabled) extra.classification = i <= Math.ceil(count / 3) ? 'A' : 'B';
    if (div.allowedDays === null) extra.preferredDays = i % 2 ? ['Tue', 'Thu'] : ['Mon', 'Thu'];
    addTeam(div, i, i - 1, extra);
  }
});

for (const [email, teamIds] of coachIndex) queue(`coachIndex/${email}`, { teamIds });

// Write everything in chunks of 400.
console.log(`Seeding ${batchQueue.length} documents into the emulator…`);
for (let i = 0; i < batchQueue.length; i += 400) {
  const batch = db.batch();
  for (const { path, data } of batchQueue.slice(i, i + 400)) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    batch.set(db.doc(path), clean);
  }
  await batch.commit();
}
console.log('Done. Sign in as chuckwillwerth@gmail.com (league admin) and generate a schedule.');
