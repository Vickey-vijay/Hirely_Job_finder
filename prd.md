# Product Requirements Document (PRD)
## Job Alert Platform — "Scrape, Match, Notify"

| Field | Value |
|---|---|
| Product | Job Alert Platform (working name) |
| Version | 1.0 (MVP) |
| Owner | Product owner (user) |
| Status | Draft for review |
| Date | 2026-11-08 |
| Target market | India (pricing in INR, WhatsApp-first notifications) |

---

## 1. Executive Summary

The product is a React web application where job seekers sign in with Google, subscribe to a paid plan (₹199), upload their resume, and set job preferences. In the background, the system continuously collects job postings from publicly available sources, matches them against each subscriber's profile, and sends relevant matches to the subscriber on WhatsApp. Notifications continue until the subscription ends or the user opts out.

**Core value proposition:** One place where job seekers never miss a relevant opening, delivered where they already are (WhatsApp).

---

## 2. Problem Statement

- Job seekers check many portals (LinkedIn, Naukri, Indeed, company career pages) and most relevant posts are missed or seen late.
- Generic alerts on job portals are noisy, keyword-based, and often ignore the candidate's actual resume.
- Candidates want timely alerts on the channel they check most often: WhatsApp.

---

## 3. Goals and Non-Goals

### 3.1 Goals (MVP)
1. Users can sign up and log in with Google in one click.
2. Users can subscribe to a ₹199 plan and pay securely.
3. Users can upload a resume and/or manually enter preferences (role, skills, location, experience, salary range, job type).
4. The system aggregates job postings from approved, publicly available sources on a schedule.
5. The system ranks postings for each user and shows matches in a dashboard.
6. The system sends relevant new matches to the user on WhatsApp.
7. Users can pause or stop notifications at any time, and notifications stop automatically when the subscription expires.
8. Admin can monitor scraper health, users, subscriptions, and notification delivery.

### 3.2 Non-Goals (MVP)
- Auto-applying to jobs on behalf of users.
- Building a resume editor or ATS-score tool (may be v2).
- Scraping private or login-protected job portals (LinkedIn, Naukri logged-in pages), or bypassing CAPTCHAs/bot protection.
- Native mobile apps (web app only; mobile-responsive).
- Employer-side job posting.
- Multi-language UI (English only in MVP).

---

## 4. Target Users

| Persona | Description | Key need |
|---|---|---|
| Active job seeker | 0–5 yrs experience, applying actively | Fast alerts for fresh, relevant roles |
| Career switcher | Changing domain, uncertain keywords | Resume-based matching, not just keywords |
| Passive seeker | Open to offers, checks rarely | Low-noise, occasional high-quality matches |

---

## 5. Scope and Phasing

| Phase | Contents | Target duration |
|---|---|---|
| **Phase 1 — Foundation** | Google login, user profile, subscription (₹199) via payment gateway | 3 weeks |
| **Phase 2 — Job Data Pipeline** | Source connectors, scraper scheduler, job normalization, deduplication, job listing UI | 4 weeks |
| **Phase 3 — Matching & Resume** | Resume upload and parsing, preference form, match scoring, match dashboard | 3 weeks |
| **Phase 4 — WhatsApp Notifications** | WhatsApp opt-in, templates, alert sending, pause/stop controls, delivery tracking | 3 weeks |
| **Phase 5 — Hardening & Launch** | Admin panel, monitoring, security review, load test, beta with 20–50 users, public launch | 2–3 weeks |

Total estimated MVP: ~15–16 weeks with a team of 2–3 engineers plus part-time design and QA.

---

## 6. Functional Requirements

### 6.1 Authentication (Google Login) — Phase 1
- **FR-AUTH-1:** Users sign in with Google OAuth 2.0 (via Firebase Authentication or Auth.js/NextAuth-style flow adapted for React SPA + backend).
- **FR-AUTH-2:** On first login, a user record is created with name, email, Google ID, profile photo URL, and created timestamp.
- **FR-AUTH-3:** Session uses secure, HTTP-only cookies or short-lived JWT with refresh. No passwords are stored.
- **FR-AUTH-4:** Logout invalidates the session on both client and server.
- **FR-AUTH-5:** Protected routes redirect unauthenticated users to the login page.
- **FR-AUTH-6:** Users must confirm mobile number (required for WhatsApp) after first login. Verification via OTP (SMS or WhatsApp OTP).

### 6.2 Subscription and Payments — Phase 1
- **FR-SUB-1:** Basic plan: **₹199** (inclusive of GST, per current pricing decision — confirm with accountant; see Open Questions).
- **FR-SUB-2:** Plan duration: **[Open question: 30 days recurring, or one-time 30-day pass]**. Default assumption in this PRD: 30-day period with auto-renew option.
- **FR-SUB-3:** Payments processed through **Razorpay** (UPI, cards, netbanking, wallets). Razorpay Subscriptions used for recurring billing if auto-renew is chosen.
- **FR-SUB-4:** Payment success/failure is confirmed only via **server-side webhook** verification (signature check), never by client redirect alone.
- **FR-SUB-5:** Subscription states: `NONE → PENDING → ACTIVE → PAST_DUE → EXPIRED → CANCELLED`.
- **FR-SUB-6:** A scheduled job expires subscriptions at end date and immediately stops notifications for expired users.
- **FR-SUB-7:** User can cancel auto-renew from the dashboard; access continues until the paid period ends.
- **FR-SUB-8:** Invoices/receipts sent by email and viewable in the dashboard.
- **FR-SUB-9:** Refund policy displayed at checkout; refunds handled by admin via Razorpay dashboard.

### 6.3 User Profile and Preferences — Phase 3
- **FR-PRF-1:** Users can upload a resume (PDF or DOCX, max 5 MB).
- **FR-PRF-2:** Resume is parsed to extract skills, titles, experience years, education, and location.
- **FR-PRF-3:** Users can manually add or edit: target job titles, skills, preferred locations (incl. "remote"), minimum/maximum experience, salary expectation (optional), job type (full-time, part-time, contract, internship), and excluded keywords/companies.
- **FR-PRF-4:** Users can choose to use resume-only, preferences-only, or both for matching.
- **FR-PRF-5:** Users can delete their resume and all parsed data at any time (DPDP compliance).

### 6.4 Job Data Pipeline (Scraping and Aggregation) — Phase 2
- **FR-JOB-1:** The system collects postings only from **approved sources** (see Section 8 — Source Policy).
- **FR-JOB-2:** Each source has a connector module that fetches listings, extracts fields, and normalizes them to a common job schema.
- **FR-JOB-3:** Common job schema fields: `id`, `source`, `source_url`, `title`, `company`, `location`, `remote_flag`, `job_type`, `experience_min`, `experience_max`, `salary_min`, `salary_max`, `description_text`, `skills_extracted[]`, `posted_at`, `first_seen_at`, `last_seen_at`, `is_active`, `content_hash`.
- **FR-JOB-4:** Deduplication: same job from multiple sources is merged using a normalized (company + title + location) key plus content similarity.
- **FR-JOB-5:** Scheduler runs connectors on a configurable interval (default: every 30–60 minutes per source; respecting each source's rate limits).
- **FR-JOB-6:** Jobs not seen for 7 consecutive days are marked inactive and excluded from matching.
- **FR-JOB-7:** Each run logs: source, start/end time, jobs found, new, updated, failed, and errors.
- **FR-JOB-8:** If a source fails 5 times in a row, it is paused and an admin alert is raised.
- **FR-JOB-9:** Job listings are viewable in-app (search, filter by source/location/date), subject to the copyright and attribution rules in Section 8.

### 6.5 Matching Engine — Phase 3
- **FR-MTC-1:** For each active subscriber, the engine scores every new or updated active job.
- **FR-MTC-2:** Scoring combines: skill overlap (weighted), title similarity, location/remote fit, experience fit, job-type fit, and exclusion filters (hard reject).
- **FR-MTC-3:** Approach: Stage 1 — rule-based filters and keyword/skill overlap (fast, cheap). Stage 2 — embedding-based semantic similarity between resume and job description for top candidates (optional in MVP, recommended by Phase 3 end).
- **FR-MTC-4:** Each match gets a score from 0–100. Only matches above a **threshold (default 70, user-adjustable: Low/Medium/High)** are eligible for notifications.
- **FR-MTC-5:** A job is matched to a user at most once (no duplicate notifications for the same job).
- **FR-MTC-6:** Matches appear in the user's dashboard with a short "why matched" explanation (e.g., "Matched skills: React, Node.js; Location: Bengaluru").

### 6.6 WhatsApp Notifications — Phase 4
- **FR-WA-1:** Notifications are sent via the **WhatsApp Business Cloud API (Meta)**, or a licensed BSP (Business Solution Provider) such as Gupshup, Twilio, or Interakt.
- **FR-WA-2:** Users must **explicitly opt in** to WhatsApp messages (checkbox with clear consent text) before any message is sent. Opt-in is recorded with timestamp and IP/user agent.
- **FR-WA-3:** Outside the 24-hour customer-service window, only **pre-approved message templates** may be sent. Templates must be submitted and approved by Meta before launch (e.g., `job_match_alert` with job title, company, location, and link variables).
- **FR-WA-4:** Notification batching: multiple matches within the same scheduler cycle are grouped into one message (max 3 per message; a digest if more) to avoid spam.
- **FR-WA-5:** Each message includes: job title, company, location, match score, a short reason, and a tracked link to the job page on our site (for click analytics).
- **FR-WA-6:** **Stop commands:** Users can reply `STOP` (or `PAUSE`, `RESUME`) on WhatsApp; the webhook updates the preference immediately and confirms with an auto-reply.
- **FR-WA-7:** Notifications stop automatically when the subscription expires or is cancelled.
- **FR-WA-8:** Delivery status (sent, delivered, read, failed) is tracked via webhooks and visible to admin.
- **FR-WA-9:** Quiet hours: default no notifications between 22:00 and 08:00 IST (user configurable).
- **FR-WA-10:** Daily cap per user (default 10 notifications/day) to prevent fatigue.

### 6.7 User Dashboard — Phase 3–4
- Overview: subscription status and renewal date, notification status, matches this week.
- Matches list with filter, sort, and "Applied / Not interested / Saved" status tags (user-tracked, manual).
- Profile and preferences editor.
- Notification settings (WhatsApp on/off, pause until date, quiet hours, threshold).
- Billing: plan, invoices, cancel auto-renew, delete account.

### 6.8 Admin Panel — Phase 5
- User list with search, subscription status, and manual extend/refund-trigger actions.
- Source health dashboard: last run, success rate, jobs collected per source.
- Notification dashboard: sent/delivered/failed counts, template usage, opt-outs.
- Moderation: disable a source, block a job, edit a template variable mapping.
- Audit log of admin actions.

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Dashboard first load < 2.5s on 4G (p75). API p95 < 500ms for read endpoints. |
| Freshness | New postings from enabled sources reach the job database within 60 minutes of publication (best effort). Alerts sent within 15 minutes of match. |
| Scalability (MVP) | Support 5,000 subscribers and 200,000 job records; design for 10x growth without rewrite. |
| Availability | 99.5% monthly uptime for web app and API. Scheduler jobs retry with exponential backoff. |
| Security | HTTPS everywhere; encryption at rest for resumes and phone numbers; secrets in a secret manager; OWASP Top 10 review before launch; rate limiting on auth and upload endpoints. |
| Privacy & compliance | Compliant with India's **Digital Personal Data Protection Act, 2023 (DPDP)**: consent notice, purpose limitation, data principal rights (access, correction, erasure), grievance contact, breach notification process. Privacy Policy and Terms of Service published. |
| Accessibility | WCAG 2.1 AA for core flows. Mobile-first responsive layout, 16px side gutter, no horizontal scroll. |
| Observability | Structured logs, error tracking (e.g., Sentry), metrics for scraper runs, match counts, notification delivery rates, and payment webhooks. |
| Backups | Daily automated database backups, 14-day retention; restore test monthly. |
| Localization | INR currency, IST timezone for schedules and quiet hours. |

---

## 8. Source Policy and Legal Guardrails (Important)

Scraping job postings is legally and technically sensitive. The following rules are mandatory:

1. **Prefer official or public APIs and feeds first:**
   - Job aggregator APIs (e.g., Adzuna, Jooble, Reed for UK, The Muse, etc., subject to their terms and free-tier limits).
   - Public ATS job boards that expose JSON/RSS endpoints (e.g., Greenhouse, Lever, Ashby, Workable public job board endpoints) for companies that publish them.
   - Company career pages that provide RSS/sitemaps.
   - Government job portals (e.g., NCS — National Career Service) where terms allow.
2. **Respect `robots.txt`, rate limits, and each site's Terms of Service.** Sources whose ToS prohibit automated access are excluded.
3. **No scraping behind logins**, no CAPTCHA bypass, no bot-detection evasion, no fake user agents or IP rotation to evade blocks.
4. **Identify the crawler** with a clear user agent and a contact URL.
5. **Store minimum data:** title, company, location, link, short snippet, and metadata. Do not republish full job descriptions verbatim; show a summary plus a "View on source" link.
6. **Link back to the original source** on every listing.
7. **Remove on request:** Any source or employer can request removal; the system must honor it within 5 business days.
8. **Legal review** of each source before enabling it in production. Owner must approve the source list.

> The PRD assumes the owner will obtain legal advice on scraping and aggregation before public launch. This is not legal advice.

---

## 9. System Architecture

### 9.1 High-Level Components

```
                     ┌──────────────────────────┐
  User browser ─────▶│  React SPA (Vite + TS)   │
                     └────────────┬─────────────┘
                                  │ HTTPS (REST/JSON)
                     ┌────────────▼─────────────┐        ┌──────────────────┐
                     │  API Server (Node/Express│◀──────▶│  PostgreSQL      │
                     │  or NestJS, TypeScript)  │        │  (users, subs,   │
                     └───┬──────────┬───────────┘        │   jobs, matches) │
                         │          │                    └──────────────────┘
          ┌──────────────▼┐   ┌─────▼──────────┐   ┌────────────────────┐
          │ Razorpay      │   │ Auth provider  │   │ Object storage     │
          │ (payments +   │   │ (Google OAuth) │   │ (S3/R2 — resumes)  │
          │ webhooks)     │   └────────────────┘   └────────────────────┘
          └───────────────┘
                         │ enqueue jobs
                     ┌───▼───────────────┐      ┌──────────────────────┐
                     │ Redis + Queue     │◀────▶│ Worker: Scraper      │
                     │ (BullMQ)          │      │ (Node/Playwright or  │
                     │                   │      │  Python/Scrapy for   │
                     │                   │      │  static sources)     │
                     │                   │      └──────────────────────┘
                     │                   │      ┌──────────────────────┐
                     │                   │◀────▶│ Worker: Matcher      │
                     │                   │      └──────────────────────┘
                     │                   │      ┌──────────────────────┐
                     │                   │◀────▶│ Worker: Notifier     │──▶ WhatsApp Cloud API
                     └───────────────────┘      └──────────────────────┘        (via webhook back
                                                                                  for STOP/status)
```

### 9.2 Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 18+, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS | Requested React; fast builds; typed; strong ecosystem |
| Backend API | Node.js 20+, Express or NestJS, TypeScript | Single language across stack; mature |
| Database | PostgreSQL 16 (managed: Neon, Supabase, RDS, or Cloud SQL) | Relational data, transactions for subscriptions |
| ORM | Prisma or Drizzle | Type-safe migrations |
| Queue / cache | Redis + BullMQ | Scheduled scrapes, matching, retries |
| Scraper | Node with Cheerio (static HTML), Playwright only where JS rendering is allowed | Cheap for static sources; heavy tools used sparingly |
| Resume parsing | PDF/DOCX text extraction (pdf-parse, mammoth) + LLM-based field extraction (Claude API) | Accurate structured extraction |
| Semantic matching (Phase 3+) | Embeddings (Claude/voyage or OpenAI-compatible embedding model) stored in pgvector | Better matching than keywords |
| Auth | Google OAuth 2.0 via Firebase Auth or Auth.js; server verifies ID token | Managed, secure |
| Payments | Razorpay Subscriptions + Webhooks | India-first; UPI support |
| WhatsApp | Meta WhatsApp Business Cloud API (or BSP: Gupshup/Twilio/Interakt) | Official, approved templates |
| File storage | S3-compatible (AWS S3 or Cloudflare R2) with server-side encryption | Resume storage |
| Email | Resend, SendGrid, or Amazon SES | Receipts, OTPs fallback, support |
| Hosting | Frontend: Vercel or Cloudflare Pages. Backend + workers: Render, Railway, Fly.io, or AWS ECS. | Simple managed deploys |
| Monitoring | Sentry (errors), Better Stack or Grafana (logs/uptime), PostHog (product analytics) | Standard tooling |
| CI/CD | GitHub Actions: lint, test, build, deploy on merge to `main`; staging on `develop` | Standard |

### 9.3 Data Model (Core Tables)

| Table | Key fields |
|---|---|
| `users` | id, google_sub, email, name, avatar_url, phone_e164, phone_verified_at, created_at |
| `subscriptions` | id, user_id, plan_code, status, razorpay_subscription_id, current_period_start, current_period_end, cancel_at_period_end, created_at |
| `payments` | id, user_id, subscription_id, razorpay_payment_id, amount_paise, currency, status, invoice_url, created_at |
| `resumes` | id, user_id, storage_key, file_hash, uploaded_at, parsed_json, deleted_at |
| `preferences` | user_id, target_titles[], skills[], locations[], remote_ok, exp_min, exp_max, salary_min, job_types[], exclusions[], match_threshold, use_resume, use_prefs |
| `whatsapp_consent` | user_id, opted_in_at, consent_text_version, ip, user_agent, opted_out_at |
| `notification_settings` | user_id, whatsapp_enabled, paused_until, quiet_hours_start, quiet_hours_end, daily_cap |
| `sources` | id, name, type (api/feed/html), base_url, enabled, rate_limit_per_min, last_run_at, consecutive_failures, terms_reviewed_by, terms_reviewed_at |
| `scrape_runs` | id, source_id, started_at, ended_at, status, found, new, updated, errors |
| `jobs` | id, source_id, source_url, title, company, location, remote_flag, job_type, exp_min, exp_max, salary_min, salary_max, snippet, skills[], content_hash, dedupe_key, posted_at, first_seen_at, last_seen_at, is_active |
| `job_embeddings` | job_id, vector (pgvector) — Phase 3+ |
| `matches` | id, user_id, job_id, score, reasons_json, created_at, notified_at, user_status (new/saved/applied/dismissed) — unique (user_id, job_id) |
| `notifications` | id, user_id, match_ids[], channel, template, provider_message_id, status (queued/sent/delivered/read/failed), error, created_at |
| `admin_audit_log` | id, admin_user_id, action, target, payload, created_at |

Personal data (`phone_e164`, resumes) is encrypted at rest; access is logged.

### 9.4 Key Flows

**A. Sign-up and login**
1. User clicks "Continue with Google".
2. Google OAuth consent → redirect back to app.
3. Backend verifies ID token, creates or fetches user, issues session.
4. If phone not verified → onboarding step to add phone and verify OTP.

**B. Subscribe**
1. User picks ₹199 plan → backend creates Razorpay order or subscription.
2. Razorpay checkout opens in-app.
3. Razorpay webhook (`subscription.activated`, `payment.captured`) → backend verifies signature → subscription set to ACTIVE with period end.
4. Confirmation email and receipt.

**C. Onboard for matching**
1. Upload resume → stored encrypted → parsed asynchronously → user reviews extracted fields.
2. Set preferences and threshold → opt in to WhatsApp (separate consent screen).
3. Matching becomes active.

**D. Scrape → match → notify (core loop)**
1. Scheduler enqueues a scrape job per enabled source every N minutes.
2. Connector fetches, normalizes, dedupes, and upserts jobs; marks new/updated jobs.
3. For each new/updated active job, matcher evaluates eligible active subscribers (filters first, then scoring).
4. Matches above threshold are stored in `matches` (unique per user + job).
5. Notifier groups unsent matches per user, applies quiet hours, paused status, daily cap, and subscription status.
6. Message sent via WhatsApp template; provider status webhooks update `notifications`.
7. Replies `STOP`/`PAUSE`/`RESUME` update `notification_settings` and `whatsapp_consent`.

**E. End of subscription**
1. Daily expiry job marks subscriptions past period end as EXPIRED.
2. Notifier checks subscription status before each send → no messages sent to expired users.
3. User receives one final WhatsApp message: "Your plan has ended. Renew to keep receiving alerts." (only if template approved and user has opted in; otherwise email).

---

## 10. UX / Screen List

1. Landing page (value proposition, pricing ₹199, FAQ, Privacy Policy link)
2. Login page (Continue with Google)
3. Onboarding wizard: (a) Phone verification, (b) Resume upload, (c) Preferences, (d) WhatsApp opt-in, (e) Choose plan and pay
4. Dashboard (status, recent matches, notifications summary)
5. Matches list and match detail (with source link)
6. Job search/browse (all active jobs, filters)
7. Profile and preferences
8. Notifications settings (pause, quiet hours, threshold, WhatsApp on/off)
9. Billing (plan, invoices, cancel, renew)
10. Account settings (delete account and data)
11. Admin panel (users, sources, notifications, audit log)
12. Static: Privacy Policy, Terms, Refund Policy, Contact/Grievance

**UX rules:** Clear consent language; one-click "Pause alerts"; show why a job matched; never imply guaranteed job placement.

---

## 11. Notification Message Examples (Templates)

**Template: `job_match_alert` (utility, pre-approved)**
> Hi {{1}}, we found {{2}} new job match(es) for you on Job Alert.
> 1. {{3}} at {{4}} — {{5}}
> View details: {{6}}
> Reply STOP to pause alerts.

**Template: `subscription_expiring` (utility)**
> Hi {{1}}, your Job Alert plan ends on {{2}}. Renew for ₹199 to keep getting alerts: {{3}}

**Template: `subscription_ended` (utility)**
> Hi {{1}}, your Job Alert plan has ended and alerts are paused. Renew anytime: {{2}}

Templates must be submitted for Meta approval early (Phase 4 start, allow 1–3 days of review time).

---

## 12. Pricing and Plans

| Plan | Price | Includes |
|---|---|---|
| Basic | ₹199 (incl. GST — confirm) per period | Resume matching, preference matching, WhatsApp alerts (up to 10/day), dashboard |

Future (not in MVP): higher tier with more alerts, priority matching, email alerts, resume tips.

Unit economics to validate before launch:
- Payment gateway fee (~2% + GST typical; confirm with Razorpay).
- WhatsApp message cost per utility/marketing message (verify current Meta rates for India).
- Infra and LLM/embedding cost per user per month.
- Target: contribution margin positive per subscriber at ₹199 with expected message volume.

---

## 13. Analytics and Success Metrics

| Metric | Target (first 90 days post-launch) |
|---|---|
| Signup → paid conversion | ≥ 8% |
| Paid users completing resume + prefs onboarding | ≥ 80% |
| WhatsApp opt-in rate among paid users | ≥ 70% |
| Notification delivery rate (delivered / sent) | ≥ 95% |
| Match-to-click rate on WhatsApp alerts | ≥ 15% |
| Monthly subscriber retention (renewal) | ≥ 60% |
| Scraper success rate per enabled source | ≥ 95% |
| Opt-out rate (STOP) per month | ≤ 5% (monitor reasons) |
| User-reported irrelevant matches | ≤ 20% of matches |

---

## 14. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Source blocks scraper or changes HTML | High | High | Prefer APIs/feeds; monitor health; quick connector updates; alert admin |
| Legal challenge over scraping/aggregation | High | Medium | Source policy (Section 8), legal review, honor removal requests, link to sources |
| WhatsApp template rejected or account restricted | High | Medium | Early template submission; follow Meta policy; opt-in consent; low-volume start |
| Spam complaints from users | High | Medium | Opt-in, daily caps, quiet hours, easy STOP |
| Poor match quality | Medium | High | Resume + prefs, feedback buttons ("Relevant / Not relevant"), iterate thresholds |
| Personal data breach (resumes, phone numbers) | High | Low | Encryption, least privilege, audit logs, breach response plan |
| Payment webhook failures | Medium | Medium | Idempotent handlers, reconciliation job, retries |
| Low paid conversion | High | Medium | Free preview of matches (e.g., count only), pilot testing, pricing experiments |
| Duplicate notifications | Medium | Medium | Unique (user_id, job_id) constraint; notification ledger |
| Subscriber not getting alerts after expiry (or getting them after) | High | Low | Expiry checks inside notifier, not only cron; automated tests |

---

## 15. Development Plan (Step by Step)

### Step 0 — Preparation (Week 0)
- Confirm open questions (Section 17).
- Create repositories: `web` (React), `api` (Node), `worker` (scheduler/scrapers/matchers/notifier) — or a monorepo.
- Set up Google Cloud project (OAuth client), Razorpay test account, Meta Business account, WhatsApp Business number, and submit message templates.
- Legal: draft Privacy Policy, Terms, Refund Policy, consent texts.

### Step 1 — Project Foundation (Week 1)
- Scaffold React + Vite + TypeScript app; Node + TypeScript API; Postgres + Prisma; Redis; Docker Compose for local development.
- Set up linting (ESLint, Prettier), testing (Vitest, Jest/Supertest, Playwright for E2E), and commit hooks.
- Set up environment config (`.env.example`), secret management pattern.
- CI pipeline: lint, test, build.

### Step 2 — Authentication (Week 1–2)
- Implement Google login (frontend button → backend verification of ID token → session cookie).
- Implement logout, session expiry, protected routes.
- Create `users` table and migration.
- Tests: login success, invalid token rejection, session expiry, route protection.

### Step 3 — Phone Verification (Week 2)
- OTP via WhatsApp or SMS provider; rate-limit OTP requests; store only hashed OTP with expiry.

### Step 4 — Subscription and Payments (Week 2–3)
- Razorpay plan created ("Basic ₹199").
- Checkout integration on frontend; order/subscription creation on backend.
- Webhook endpoint with signature verification, idempotency keys, event log.
- Subscription state machine and expiry job.
- Billing page (status, invoices, cancel auto-renew).
- Tests: webhook signature, duplicate webhook handling, expiry transitions, failed payment handling.

### Step 5 — Job Data Model and Source Connectors (Week 4–5)
- Create `sources`, `scrape_runs`, `jobs` tables.
- Build connector interface: `fetchListings()`, `normalize(raw)`, `rateLimit`, `retryPolicy`.
- Implement first 2–3 approved sources (start with API-based sources).
- Scheduler with BullMQ repeatable jobs.
- Deduplication logic and inactive-job expiry (7 days).
- Source health monitoring and auto-pause on repeated failures.
- Tests: connector fixtures (recorded responses), normalization tests, dedupe tests.

### Step 6 — Job Browse UI (Week 5)
- Job list with search and filters; job detail page with source link.
- Pagination and caching with TanStack Query.

### Step 7 — Resume and Preferences (Week 6–7)
- Resume upload to S3/R2 via pre-signed URL; file type and size validation; virus scanning (ClamAV or provider scanning).
- Parsing worker: text extraction → LLM structured extraction → save to `resumes.parsed_json`.
- Preferences form with validation.
- Delete resume and data endpoint.
- Tests: file validation, parsing fixture tests (sample resumes), deletion verified.

### Step 8 — Matching Engine (Week 7–8)
- Hard filters (location, job type, experience, exclusions).
- Scoring (skill overlap + title similarity + location fit).
- Threshold logic and `matches` persistence with uniqueness.
- Match explanation text.
- Feedback buttons (relevant / not relevant) to log quality signals.
- Tests: golden test set (sample users × sample jobs → expected matches); score regression tests.
- Phase 3b (optional for MVP): embeddings + pgvector re-ranking.

### Step 9 — WhatsApp Integration (Week 9–10)
- WhatsApp opt-in screen and consent record.
- Template sender with BSP or Cloud API.
- Batching, quiet hours, daily cap, paused state, subscription-status check.
- Inbound webhook: handle `STOP`, `PAUSE`, `RESUME`, `START`, and `HELP`.
- Delivery status webhook → `notifications` table.
- Tests: opt-out honored immediately, expired user receives nothing, cap enforced, duplicate job not re-sent.

### Step 10 — Admin Panel (Week 11)
- User search, subscription overrides, notification metrics, source toggles, audit log.
- Role-based access (admin role flag; MFA for admin accounts).

### Step 11 — Security, Privacy, and Compliance (Week 12)
- OWASP ASVS checklist review; dependency scanning; secret scanning.
- Rate limits on login, OTP, upload, and API endpoints.
- Data subject request flow (access, correction, deletion) within DPDP timelines.
- Penetration test or at least automated DAST scan on staging.
- Consent logs and retention policy (e.g., delete inactive accounts after 12 months, configurable).

### Step 12 — QA, Performance, and Beta (Week 13–14)
- End-to-end tests (Playwright): signup → pay → onboard → match → WhatsApp (in sandbox).
- Load test: 5,000 simulated users, 200k jobs.
- Beta with 20–50 invited users for 2 weeks; collect feedback; tune thresholds and templates.

### Step 13 — Deployment and Launch (Week 15–16)
- Environments: `dev` (local), `staging` (cloud, test keys), `production` (live keys).
- Deploy frontend (Vercel/Cloudflare), API and workers (Render/Railway/Fly/ECS), managed Postgres and Redis.
- Configure custom domain, TLS, DNS, and CORS.
- Set up Razorpay live mode and production webhook URLs.
- Set up Meta production WhatsApp number and approved templates.
- Enable monitoring, alerts (on-call channel), and backups.
- Launch checklist (see Section 16).

### Step 14 — Post-Launch (Ongoing)
- Weekly review of source health, match feedback, and opt-outs.
- Monthly review of costs and unit economics.
- Add sources, improve matching, consider v2 features (email alerts, higher tier, resume tips).

---

## 16. Deployment and Operations Checklist

**Pre-launch**
- [ ] Privacy Policy, Terms, Refund Policy, Grievance Officer contact published
- [ ] Razorpay live account activated; webhook secret stored in secret manager
- [ ] Google OAuth consent screen approved with production domain
- [ ] WhatsApp Business number verified; templates approved
- [ ] All enabled sources reviewed and approved by owner and legal
- [ ] Backups tested (restore drill)
- [ ] Sentry and uptime monitoring active; on-call alerts configured
- [ ] Rate limits and CORS configured
- [ ] Load test passed
- [ ] Beta feedback addressed

**Runbooks to write**
- Scraper source broken → disable source, notify admin, fix connector.
- WhatsApp template rejected or quality rating drops → pause sends, review content.
- Payment webhook backlog → replay from Razorpay dashboard, reconcile job.
- Data breach → incident response plan, notify CERT-In and affected users per applicable rules.
- Rollback → previous container image, DB migration rollback plan (forward-only migrations preferred).

---

## 17. Open Questions (Decisions Needed from Owner)

1. **Plan model:** Is ₹199 a 30-day pass or a monthly auto-renewing subscription? (PRD assumes 30-day with optional auto-renew.)
2. **GST:** Is ₹199 inclusive or exclusive of GST? Who is the seller of record?
3. **Job sources:** Which first 3–5 sources should we start with? Any preferred job categories or cities?
4. **Matching depth:** Is keyword/skill-based matching enough for MVP, or do we need semantic AI matching from day one?
5. **WhatsApp provider:** Direct Meta Cloud API, or a BSP (Gupshup, Interakt, Twilio)?
6. **Trial:** Is there a free trial or free preview of matches before payment?
7. **Team:** Who builds it (in-house, freelancers, agency) and what is the budget/timeline?
8. **Legal entity:** Which company/entity will hold the Razorpay account and privacy compliance obligations?
9. **Notification cap:** Is 10 per day the right default?
10. **Refund policy:** Full refund window (e.g., 7 days) or none?

---

## 18. Assumptions

- Users are primarily in India and have WhatsApp on a personal number.
- Public job sources continue to permit the chosen access methods; source list may change.
- The owner accepts Meta's WhatsApp Business policies and template rules.
- Google OAuth and Razorpay are available in the target market.
- The product is not a recruitment agency and does not guarantee job placement (must be stated clearly in Terms).

---

## 19. Glossary

- **ATS:** Applicant Tracking System (e.g., Greenhouse, Lever).
- **BSP:** WhatsApp Business Solution Provider.
- **DPDP:** Digital Personal Data Protection Act, 2023 (India).
- **Template (WhatsApp):** Pre-approved message format used for business-initiated messages.
- **Utility message:** WhatsApp category for transactional/alert messages.
- **Match score:** 0–100 relevance measure between a user profile and a job.
- **Scraper / Connector:** Module that fetches job data from one approved source.

---

## 20. Appendix: Suggested Repository Structure

```
job-alert-platform/
├── web/                      # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── features/         # auth, billing, jobs, profile, notifications
│   │   ├── lib/              # api client, query setup
│   │   └── routes.tsx
├── api/                      # Node + Express/NestJS
│   ├── src/
│   │   ├── auth/
│   │   ├── billing/          # Razorpay + webhooks
│   │   ├── users/
│   │   ├── resumes/
│   │   ├── preferences/
│   │   ├── jobs/
│   │   ├── matches/
│   │   ├── notifications/    # WhatsApp send + inbound webhook
│   │   └── admin/
│   ├── prisma/schema.prisma
│   └── tests/
├── worker/                   # BullMQ workers and schedulers
│   ├── connectors/           # one file per approved source
│   ├── scheduler/
│   ├── matcher/
│   └── notifier/
├── docs/
│   ├── prd.md                # this document
│   ├── source-policy.md
│   └── runbooks/
├── docker-compose.yml
└── .github/workflows/        # CI/CD
```

---

## 21. Approval

| Role | Name | Decision | Date |
|---|---|---|---|
| Product owner | | | |
| Engineering lead | | | |
| Legal / compliance | | | |
| Design | | | |
