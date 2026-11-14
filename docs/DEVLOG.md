# Dev Log

Running record of what was built, when, and why. Newest first. Update this before every push.

## 2026-11-15 - Full v1 product, deployed in test mode (branch `feat/v1-full-product`)

**Built**
- Plans (Starter 99 / Plus 199 / Pro 499), Razorpay Subscriptions with signed checkout confirmation and webhooks, a one-time 30-day pass fallback, a no-money test mode, stop renewal at period end, upgrade, "I got a job".
- Profile set-up with resume upload (PDF / DOCX / TXT; only the text is kept) and automatic reading of roles, skills, cities and experience.
- Job collection from public JSON feeds (Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee, Workable, Adzuna India, Remotive, Jobicy, Himalayas); 58 company boards seeded after checking each returns India jobs.
- Rule-based 1 to 10 scoring with reasons, a free "how many jobs fit you" preview before payment, optional AI refinement.
- Alerts: digests at fixed India times by plan, instant alerts on Pro, email, WhatsApp Cloud API template and replies (STOP, PAUSE, RESUME, MORE).
- Pro tailored resume (Claude), capped at 5 a day, never inventing experience.
- New website: landing page with animated alert preview, set-up steps, plans and checkout, dashboard, matches, settings, policies, admin. New "Clear Sky" palette (trust blue, verified green).
- Server: PostgreSQL 15 tuned small, `hirely-api` service capped at 320 MB, nginx site, HTTPS, nightly backup, `deploy/push.sh`.
- `docs/START_HERE.md`: the owner's step-by-step guide.

**Verified**
- 16 API tests pass (PGlite). Web builds. Clicked through sign-in, set-up, a test-mode purchase, dashboard, matches and settings locally with real collected jobs. Live site answers over HTTPS; other sites on the server still answer.
- **Not verified:** real Google sign-in, real Razorpay payment, real WhatsApp message, real email delivery, Adzuna, Claude. Each needs the owner's account.

**Decisions** (reviewed with Opus; see `DECISIONS.md`)
- Kept PostgreSQL; Razorpay Subscriptions with a pass fallback; digests instead of a message per job; rules first, AI optional; "no refund, cancel renewal any time" instead of "cannot cancel".

## 2026-11-08 — Email login, PostgreSQL, VPS kit, business guide (branch `feat/email-db-vps`)

**Built**
- Email login: `POST /api/auth/email/start` and `/verify`. 6-digit code, stored only as an HMAC hash, 10-minute expiry, single use, locked after 5 wrong tries, max 3 codes per email per 10 minutes. Same response whether or not the account exists. Mailer uses any SMTP provider; in development the code prints in the API console.
- PostgreSQL replaces the JSON file: `pg` in production, auto-migrations from `api/migrations/`, `docker-compose.yml` for local DB. Google and email sign-ins merge into one account per email.
- API moved to Express 5 (async errors handled). Google login is now optional so email login works without a Google client.
- React login page: Google button, "or", email → code step with animated switch, resend cooldown, friendly errors.
- `deploy/` (Nginx, systemd unit, backup and deploy scripts), `docs/VPS_DEPLOY.md`, `docs/DATABASE.md`, `docs/ROADMAP.md` (done / to-do as vertical slices), `docs/BUSINESS_SETUP.md` (India: Udyam, GST, bank, Razorpay, Meta, WhatsApp, DPDP, trademark).

**Verified**
- 10 API tests pass against PGlite (real Postgres engine in memory); API typecheck clean; web builds; login page renders with the email form.
- **Not verified:** a real Postgres server, real SMTP delivery, real Google sign-in, the VPS scripts (written carefully, never run on a server).

**Fix (same day): Google login appeared to stop working.**
- Cause: the API required `DATABASE_URL` and a running Postgres, so with the owner's existing `.env` it exited on startup and the Google button's request failed.
- Fix: in development an empty `DATABASE_URL` now uses an embedded Postgres (PGlite) in `api/data/pgdata`. Production still requires a real `DATABASE_URL`. Google and email login both work with no database setup.
- Added a dev-only hint on the login page when `VITE_GOOGLE_CLIENT_ID` is missing, so the Google button never disappears silently.
- Verified: API boots with a Google-only style env, `/api/auth/google` reaches token verification (401 for a fake token), `/api/auth/email/start` works, and the login page shows the Google button and the email form together. 10 tests pass. A real Google sign-in is still untested.

**Decisions**
- Razorpay, not Stripe: Stripe's own docs list India as invite-only (checked 2026-11-08).
- Email codes instead of passwords: nothing to leak or reset.

## 2026-11-08 — Real Google login (branch `feat/google-login`)

**Built**
- `api/`: Express + TypeScript. `POST /api/auth/google` verifies the Google ID token server-side, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/health`. httpOnly SameSite=Lax session cookie (7 days), origin allow-list, rate limit, helmet, fail-fast config validation. JSON-file user store (temporary, replaced by PostgreSQL).
- `web/`: Google's official button via `@react-oauth/google`, session restored from `/api/auth/me` on load, real name and avatar on the dashboard, proper sign-out, friendly error messages, Vite proxy so the cookie is same-origin.
- `docs/GOOGLE_LOGIN.md`: Google Cloud setup, env config, Windows run steps, phone testing via tunnel, go-live checklist.

**Verified**
- API: typecheck clean; 7 tests pass with a fake Google verifier (cookie flags, bad token, bad origin, tampered cookie, same user on re-login, config validation).
- Web: builds; login page shows a clear "not set up yet" message when no client ID is set.
- **Not verified:** a real Google sign-in. It needs the owner's OAuth client ID (only they can create it).

**Gotchas**
- Google rejects LAN IP origins like `http://192.168.x.x:5173`. Phone testing needs an HTTPS tunnel (see the doc).
- The old demo login was removed; the app now requires the API running.

## 2026-11-08 — Web UI v0.1 (branch `feat/web-ui`)

**Built**
- `web/`: React 18 + Vite + TypeScript + React Router + Framer Motion. Plain CSS, no UI framework.
- Pages: Landing, Login (demo), Dashboard, Matches, Settings.
- Animated first-load splash (pulsing orb, rotating friendly messages).
- Page-to-page transition: three coloured panels (sage, apricot, dusk) sweep over the screen, peel away, then content rises in with a stagger. Respects `prefers-reduced-motion`.
- Shared-layout animations: nav pill, filter chips, segmented control all glide between positions.
- Score rings on matches draw themselves in.
- Drifting aurora background and a time-of-day greeting by name for a personal feel.

**Placeholders (not real yet)**
- Login is a demo button; no Google OAuth (PRD 6.1).
- Jobs come from `web/src/data.ts`; no API, no scraping (PRD 6.4, 6.5).
- No payments, no WhatsApp (PRD 6.2, 6.6).

**Environment notes**
- The Mac used today had no Node. A checksum-verified Node 22 tarball from nodejs.org was extracted to a scratch folder and used for this session only. Nothing was installed system-wide.
- Real development happens on Windows. See `web/README.md`.

**Verified**
- `npm run build` passes (typecheck + production build).
- Clicked through Landing → Login → Dashboard → Matches → Settings in the browser pane.
- Fixed: the active filter chip text was invisible (pill rendered behind the chip background).

**Next**
1. Backend scaffold (`api/`): Express + TypeScript + Postgres, Google token verification.
2. Razorpay checkout and webhook.
3. First job connectors (Adzuna India, Greenhouse, Lever).
4. WhatsApp via the official Cloud API test number (see `docs/DECISIONS.md`).
