# Database

PostgreSQL 16. The API applies SQL files from `api/migrations/` automatically on start, in filename order, each in a transaction, and records them in `schema_migrations`. To change the schema, add a new file (`002_something.sql`); never edit an applied one.

## Run locally (Windows or Mac, Docker Desktop)
```powershell
docker compose up -d db          # from the repo root
# api/.env:  DATABASE_URL=postgres://hirely:hirely@localhost:5432/hirely
```
Look inside: `docker compose exec db psql -U hirely hirely` then `\dt` and `select * from users;`.

## Tables that exist now (migration 001)
**users** — one row per person.
| Column | Notes |
|---|---|
| id | uuid, primary key |
| email | unique, always lowercase |
| name, picture | from Google, or the part before `@` for email sign-ups |
| google_sub | Google's stable account id; null for email-only users |
| email_verified_at | set when Google or an emailed code proves ownership |
| created_at, last_login_at | timestamps |

Signing in with Google and with email codes using the same address lands on **one** account.

**email_challenges** — emailed login codes. Stores a keyed hash (HMAC) of the code, never the code. Expires in 10 minutes, single use, locked after 5 wrong tries, max 3 codes per email per 10 minutes.

## Tables planned (added slice by slice, each as a new migration)
| Slice | Tables |
|---|---|
| Onboarding | `profiles` (phone_e164, phone_verified_at), `preferences` (titles, skills, locations, experience, salary, job types, exclusions, match threshold), `resumes` (storage key, parsed JSON, deleted_at) |
| Payments | `subscriptions` (status, period start/end, razorpay ids), `payments` (amount in paise, status, invoice), `webhook_events` (idempotency) |
| Jobs | `sources` (name, type, enabled, last_run, failures, terms_reviewed_at), `scrape_runs`, `jobs` (normalized fields, dedupe_key, first/last seen, is_active) |
| Matching | `matches` (user_id, job_id, score, reasons; unique per user+job) |
| WhatsApp | `whatsapp_consent` (opt-in/out with timestamps), `notification_settings` (paused_until, quiet hours, daily cap), `notifications` (provider id, status), `inbound_messages` |
| Admin | `admin_audit_log` |

Full column lists are in `prd.md` Section 9.3.

## Backups
See `docs/VPS_DEPLOY.md` step 10. Rule: a backup you haven't restored once is not a backup.

## Privacy notes (DPDP)
Resumes and phone numbers are personal data: encrypt at rest, delete on request, and delete a user's data when they delete their account. Build the "delete my account" flow before launch.
