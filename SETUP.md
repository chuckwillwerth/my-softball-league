# Setup Guide

One-time setup takes about 30 minutes and everything runs on free tiers:
GitHub Pages (hosting), Firebase (login + database), GitHub Actions (email cron), Brevo (email).

## 1. Create the Firebase project (free "Spark" plan)

1. Go to <https://console.firebase.google.com> → **Add project**. Name it (e.g. `my-softball-league`). Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method** → enable **Google**. (You can also enable Email/Password later if some coaches don't have Google accounts.)
3. **Build → Firestore Database → Create database** → production mode, pick the region closest to you.
4. **Project settings (gear icon) → General → Your apps → Web app (`</>`)**. Register an app (no hosting). Copy the `firebaseConfig` values it shows into [src/firebaseConfig.ts](src/firebaseConfig.ts). These values are safe to commit — access is controlled by the security rules, not the config.

## 2. Deploy the security rules

```
npm install -g firebase-tools     # or use npx firebase-tools
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

Re-run the last command any time `firestore.rules` changes.

## 3. Make yourself the league admin

In the Firebase console → Firestore → **Start collection**:

- Collection ID: `roles`
- Document ID: **your Google email, all lowercase** (e.g. `chuckwillwerth@gmail.com`)
- Field: `role` (string) = `league_admin`

That's the only manual database edit ever needed — every other role is granted inside the app (League Admin → Admins & Roles).

## 4. Create the GitHub repository and deploy

1. Create a **public** repo on GitHub (public = free Pages + unlimited Actions minutes).
2. Push this folder to it (`main` branch).
3. Repo **Settings → Pages → Source: GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) builds and publishes on every push. Your site will be at `https://YOUR_USERNAME.github.io/YOUR_REPO/`.
5. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** → `YOUR_USERNAME.github.io` (required for Google sign-in to work on the live site).

## 5. Set up reminder emails

Emails are sent by an hourly GitHub Actions cron (`.github/workflows/notify.yml`) — no paid Firebase plan needed.

1. **Brevo** (free: 300 emails/day): sign up at <https://www.brevo.com>, verify a sender address (**Senders & IPs → Senders**), and create an API key (**SMTP & API → API keys**).
2. **Firebase service account**: Firebase console → Project settings → **Service accounts → Generate new private key**. This downloads a JSON file. Keep it secret.
3. GitHub repo **Settings → Secrets and variables → Actions**:
   - Secret `FIREBASE_SERVICE_ACCOUNT` = the entire contents of the downloaded JSON file
   - Secret `BREVO_API_KEY` = your Brevo API key
   - Secret `MAIL_FROM` = your verified sender address
   - (Optional) Variable `APP_URL` = your GitHub Pages URL, included in email footers
4. Test it: repo **Actions → Send reminder emails → Run workflow**.

What the cron sends:
- **Within the hour**: "opponent reported a score/cancellation/forfeit/reschedule" notifications
- **Once per day per game**: missing-score reminders (game >24h old, nothing reported) to both head coaches
- **Once per day per game**: reschedule reminders for cancelled/suspended games, until rescheduled or removed by the league admin

## 6. Local development (optional)

Runs against local Firebase emulators — no real data touched, sign in with any made-up Google account:

```
npm install
npm run emulators      # terminal 1: Firestore + Auth emulators (needs firebase-tools + Java)
npm run seed           # terminal 2: load sample data (3 cities, 3 divisions, teams, permits)
$env:VITE_USE_EMULATORS='true'; npm run dev    # terminal 2: app at http://localhost:5173
node scripts/notify.mjs --dry-run              # preview reminder emails
```

## 7. Each new season

1. League Admin → Season Setup: update the year and the late-April/early-June game window (this is where each year's dates go).
2. City admins re-enter teams, coaches, and field permits for the new season.
3. League Admin → Generate Schedule per division, review the draft, publish.

## Costs

| Service | Free tier | Expected usage |
|---|---|---|
| GitHub Pages/Actions | Free on public repos | well within limits |
| Firebase Auth | Unlimited Google sign-ins | free |
| Firestore | 50K reads / 20K writes per day | a small league uses a fraction |
| Brevo | 300 emails/day | biggest day ≈ rainout of a full slate ≈ 50 emails |
