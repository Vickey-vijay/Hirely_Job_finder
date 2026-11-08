# Roadmap — vertical slices

Each slice is a thin, working, shippable piece from screen to database, not a layer built in isolation. A slice is "done" only when its exit check passes.

Last updated: 2026-11-08

## Done so far
| # | What | Evidence |
|---|---|---|
| 0.1 | Product requirements (PRD) | `prd.md` |
| 0.2 | Decisions on open questions (via Opus review) | `docs/DECISIONS.md` |
| 0.3 | React UI: splash, animated page transitions, landing, dashboard, matches, settings (demo data) | `web/` |
| 0.4 | Google login: server-side token verification, secure session cookie | `api/`, `docs/GOOGLE_LOGIN.md` |
| 0.5 | Email login: 6-digit code, hashed, expiring, single use, attempt-limited | `api/src/app.ts`, tests |
| 0.6 | PostgreSQL layer with auto-migrations; users and login-code tables | `api/migrations/`, `docs/DATABASE.md` |
| 0.7 | 10 API tests (against a real in-memory Postgres) | `npm test` in `api/` |
| 0.8 | VPS deployment kit: Nginx, systemd, backups, deploy script, guide | `deploy/`, `docs/VPS_DEPLOY.md` |
| 0.9 | Business and legal setup guide | `docs/BUSINESS_SETUP.md` |

**Honest status:** Google login and the VPS steps are written and unit-tested but have **not** been run against real Google or a real server yet. Slice 1 proves them.

## Still to do (in order)

### Slice 1 — Live login on your VPS (next)
Domain + HTTPS + Postgres + SMTP + Google client, following `docs/VPS_DEPLOY.md`.
**Exit check:** you sign in with Google and with an emailed code on `https://yourdomain`, refresh, stay signed in, and see your row in `users`.
Needs from you: domain, VPS access, Google Cloud client, SMTP account.

### Slice 2 — Onboarding and profile
Phone number + OTP verification, preferences form, resume upload (PDF/DOCX, 5 MB), resume parsing, "delete my data".
**Exit check:** a new user completes onboarding; their preferences and parsed resume are in the DB; deleting the account removes everything.

### Slice 3 — Subscription and payment (₹199)
Razorpay checkout, signed webhook, `subscriptions` state machine, 30-day expiry job, billing page, receipts.
**Exit check:** a test-mode payment activates a plan; a replayed webhook changes nothing; an expired plan flips to EXPIRED by itself.
Needs from you: Razorpay account (KYC done, see business guide).

### Slice 4 — Job pipeline
Connectors for Adzuna India, Greenhouse and Lever public boards; scheduler; dedupe; inactive-job cleanup; source health.
**Exit check:** real jobs appear in the DB within an hour of being posted; a broken source pauses itself and alerts you.
Needs from you: Adzuna API key; legal sign-off on the source list.

### Slice 5 — Matching and real dashboard
Rule-based scoring, threshold, "why matched", replace demo data in the UI, relevant / not-relevant feedback.
**Exit check:** a test user with a known resume gets the expected matches from a fixed sample of jobs.

### Slice 6 — WhatsApp alerts
Meta Cloud API, opt-in consent, approved templates, batching, quiet hours, 5/day cap, STOP/PAUSE/RESUME, delivery status.
**Exit check:** a real message reaches your phone; `STOP` halts everything instantly; an expired plan never gets a message.
Needs from you: Meta business verification, WhatsApp number, template approval (1–3 days).

### Slice 7 — Admin and operations
Admin panel, error tracking (Sentry), uptime monitor, alerts to your phone, tested restore.
**Exit check:** you can see users, sources, and failed messages without touching the database.

### Slice 8 — Launch
Privacy policy, terms, refund page, grievance contact, 20–50 person beta, fix list, public launch.
**Exit check:** 20 beta users complete the full journey; no open "severe" bug.

## Parallel track: business and legal
Starts **today**, not after the code. Several items take weeks (business verification, template approval, bank KYC). See `docs/BUSINESS_SETUP.md`. Slice 3 and 6 are blocked until it reaches steps 6–10 and 11 respectively.

## Rough timing (solo, part-time, realistic)
Slice 1: days · Slice 2: 1–2 wks · Slice 3: 1–2 wks · Slice 4: 2–3 wks · Slice 5: 1–2 wks · Slice 6: 2 wks · Slice 7: 1 wk · Slice 8: 2 wks.
