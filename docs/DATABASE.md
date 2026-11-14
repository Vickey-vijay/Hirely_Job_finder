# Database

PostgreSQL (15 on the server). The API applies SQL files from `api/migrations/` automatically on start, in filename order, each in a transaction, and records them in `schema_migrations`. To change the schema, add a new file (`003_something.sql`); never edit one that has already been applied on the server.

## On your computer
Leave `DATABASE_URL` empty in `api/.env`. In development the API uses an embedded Postgres engine (PGlite) stored in `api/data/pgdata/` (git-ignored). No install needed. Delete that folder to reset your local data. This fallback is disabled when `NODE_ENV=production`.

## On the server
`sudo -u postgres psql hirely`, then `\dt` to list tables and `\q` to quit. Settings tuned for a small server are in `/etc/postgresql/15/main/conf.d/hirely-small.conf`.

## Tables
| Table | One row per | Notes |
|---|---|---|
| `users` | person | email (unique, lowercase), name, picture, `google_sub`, `is_admin` |
| `email_challenges` | emailed sign-in code | only a keyed hash of the code is stored; 10-minute expiry, single use |
| `profiles` | person | phone, WhatsApp consent and when it was given (`opt_in_at`), roles, skills, cities, experience, resume **text** (the file is never stored), alert switches, `got_job_at` |
| `subscriptions` | purchase | `plan` (starter / plus / pro), `provider` (razorpay_subscription / razorpay_pass / mock), `provider_ref` (Razorpay id), `status` (created / active / halted / cancelled / expired / replaced), `cancel_at_period_end`, period start and end |
| `payments` | captured payment | Razorpay payment id (unique), amount in paise |
| `webhook_events` | webhook already handled | makes replays harmless |
| `sources` | job source | `kind` (greenhouse, lever, ashby, smartrecruiters, recruitee, workable, adzuna, remotive, jobicy, himalayas), `token` (board name or search phrase), `enabled`, `interval_min`, health fields |
| `jobs` | job opening | company, title, location, url, plain-text description, `active` |
| `matches` | person + job | `score` 1 to 10, `reasons`, optional AI `why`, `status` (new / applied / dismissed), `feedback`, `notified_at` |
| `notifications` | alert sent | channel (whatsapp / email), kind (digest / instant), status, error |
| `tailored_resumes` | match (Pro) | the tailored text |

A user is "subscribed" when they have a `subscriptions` row with `status = 'active'` whose period has not ended (auto-renewing plans get a 36-hour grace while the renewal payment is confirmed). The exact rule is `LIVE_SQL` in `api/src/billing.ts`.

Deleting a user (`delete from users where id = ...`, or the Delete my account button) removes their profile, subscriptions, payments, matches, notifications and tailored resumes through cascading deletes.

## Backups
Nightly at 02:40 to `/var/backups/hirely/`, kept 14 days (`deploy/backup.sh`). Restore steps are in `docs/START_HERE.md` section 12. A backup you have not restored once is not a backup.
