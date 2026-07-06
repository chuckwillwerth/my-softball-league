# League Central — Youth Softball League Manager

A free-to-run web app for a multi-city youth softball league: field permits, automatic schedule
generation, score reporting, email reminders, and standings.

**Stack:** React + Vite + Tailwind (static site on GitHub Pages) · Firebase Auth (Google sign-in) ·
Firestore (free tier) · GitHub Actions cron + Brevo for reminder emails. Total cost: $0.

➡ **New here? Follow [SETUP.md](SETUP.md).**

## Who does what

| Role | How they get access | What they can do |
|---|---|---|
| Anyone (parents) | no login | view schedule and standings |
| Coach | city admin lists their email as a team contact | report scores (final / cancelled / forfeit / suspended), reschedule games |
| City admin | league admin grants role | enter fields, field permits ("Mondays and Wednesdays…"), teams, A/B classification, coach contacts |
| League admin | `roles` doc (see SETUP.md) | seasons, divisions, cities, roles, generate + edit + delete schedule |

## Key behaviors

- **Scheduling**: each team gets 12 games (configurable), twice a week inside the season window.
  10U plays Mon/Wed, 12U Tue/Thu (configurable per division); 14U uses per-team preferred days.
  In classified divisions, A teams are matched against A teams first. Games land on the home
  team's city's permitted field slots. The league admin reviews a draft (with a constraint
  report) before publishing, and can move/swap/edit/delete games afterward — coaches are emailed
  about every change.
- **Score reporting**: coaches report from "My Games". Forfeits record 7–0. Suspended games
  capture score + inning + half. Cancelled/suspended games nag both head coaches daily by email
  until rescheduled; games with no result 24h after start remind both head coaches. Reschedules
  offer open permit slots prioritized: home team's usual field → home city → away city, plus an
  "Ump assigner notified?" checkbox. Opposing coaches are notified of every report.
- **Standings**: per division, sorted by classification (A above B), then winning percentage
  (a tie counts as half a win and half a loss), then fewest runs allowed.

## Commands

```
npm run dev         # dev server (VITE_USE_EMULATORS=true to use local emulators)
npm test            # unit tests (scheduler, standings, permits)
npm run build       # production build (also runs in CI)
npm run emulators   # local Firebase emulators
npm run seed        # sample data into the emulators
npm run notify      # run the reminder cron manually (--dry-run supported)
```
