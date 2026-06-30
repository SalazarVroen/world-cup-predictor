# ⚽ World Cup Predictor 2026

A lightweight, mobile-first prediction game for the company. Pick winners through the
knockout bracket, lock in before kickoff, climb the leaderboard.

**It works the moment you open `index.html`** — no setup required to try it.
Connect the Google Sheet backend (5 min) when you want a shared leaderboard across everyone.

---

## Files

| File | What it is |
|------|-----------|
| `index.html` | The entire app (HTML + CSS + JS, no dependencies). Deploy this. |
| `Code.gs` | Google Sheets backend (Apps Script Web App). Optional but needed for a *shared* leaderboard. |
| `.claude/launch.json` | Local preview config (`python -m http.server`). |

---

## Run it now (zero setup)

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 5599      # then visit http://localhost:5599
```

Sign in with any `@liveivory.com` email. Everything (bracket, picks, lock rule,
leaderboard, stats, champion) works immediately using the browser's local storage.

> In local-only mode each person sees their own data plus sample players. For a
> **real cross-user leaderboard**, connect the backend below.

---

## Connect Google Sheets (shared leaderboard) — 5 min

A read-only API key can't write scores back, so the app uses a tiny Apps Script
Web App as its database. Your sheet:
<https://docs.google.com/spreadsheets/d/1OjR95jTkuDG6ya1MEkhey_cFAfEWDq4VMlJ8C8tUcKw/edit>

1. Open the sheet → **Extensions → Apps Script**.
2. Delete the placeholder code, paste all of **`Code.gs`**, click **Save**.
3. **Deploy → New deployment → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - **Deploy**, authorize, then **copy the Web app URL**.
4. In `index.html`, set:
   ```js
   const CONFIG = {
     ...
     BACKEND_URL: 'PASTE_THE_WEB_APP_URL_HERE',
   };
   ```
5. Redeploy the site. Done — picks and scores now sync for everyone.

The tabs (`Users`, `Predictions`, `Results`, `Leaderboard`) are created automatically.

---

## One-click Google sign-in (optional)

Email entry already works and is domain-restricted to `@liveivory.com`. For a true
one-tap Google button:

1. Google Cloud Console → **Credentials → OAuth client ID → Web application**.
2. Add your site URL to *Authorized JavaScript origins*.
3. Put the client ID in `index.html` → `CONFIG.GOOGLE_CLIENT_ID`.

The Google button appears automatically and only accepts `@liveivory.com` accounts.

---

## Admin

- The **Admin** tab appears only for `admin@liveivory.com`.
- Set match results by tapping winners, then **Sync & Calculate**
  (password: `worldcup2026` — change `CONFIG.ADMIN_PASSWORD`).
- **Company Champion Picks** and **Leaderboard Snapshot** tables are built for screenshots.

---

## How it works

- **Bracket:** Round of 32 → 16 → QF → SF → Final (31 matches, 32 teams, all preloaded).
- **Picks** propagate forward; changing an upstream winner clears the now-invalid
  downstream picks automatically.
- **Lock:** a match locks `CONFIG.LOCK_HOURS` (default 8) before kickoff.
- **Scoring:** R32 = 1 pt, R16 = 2, QF = 3, SF = 5, Final = 8. Leaderboard ties
  share the same rank/medal.
- **Dates** are generated from *today + 2 days* so matches start open and editable.

All tunables live in the `CONFIG` block at the top of the `<script>` in `index.html`.

---

## Note on flag emoji

Flags render correctly on iOS, Android, and macOS (where the app is mostly used).
**Windows desktop** doesn't support flag emoji and shows the two-letter country code
instead (e.g. `BR` for Brazil) — that's a Windows limitation, not a bug.
