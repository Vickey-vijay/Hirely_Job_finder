# Dev Log

Running record of what was built, when, and why. Newest first. Update this before every push.

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
