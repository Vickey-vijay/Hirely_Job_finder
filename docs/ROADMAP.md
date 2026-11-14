# Roadmap

Last updated: 2026-11-15. What to do next, step by step, is in [`START_HERE.md`](START_HERE.md).

## Built
| What | Where | Tested how |
|---|---|---|
| Google and email-code sign-in, 30-day sessions | `api/src/app.ts` | automated tests (fake Google) |
| Set-up steps: resume upload and reading, roles, skills, cities, WhatsApp consent | `web/src/pages/Onboarding.tsx`, `api/src/resume.ts` | automated + by hand locally |
| Three plans, Razorpay subscriptions, one-time pass fallback, test mode, stop renewal, upgrade, "I got a job" | `api/src/billing.ts`, `plans.ts` | automated (fake Razorpay) + test-mode purchase by hand |
| Job collection from company career boards (6 hiring systems) and Adzuna; 58 boards seeded. Remote-job feed connectors exist but are off pending their terms | `api/src/sources.ts`, `seed/sources.json` | live on the server |
| 1 to 10 scoring with reasons; free preview before payment | `api/src/match.ts` | automated + real jobs |
| Alerts: daily digests by plan, instant alerts on Pro, email, WhatsApp template + STOP / PAUSE / RESUME / MORE | `api/src/notify.ts` | automated (fake WhatsApp) |
| Optional AI: resume reading, score refinement, Pro tailored resume | `api/src/llm.ts` | not yet run against the real service |
| Dashboard, matches, tailored resume page, settings, account deletion | `web/src/pages/` | by hand locally |
| Terms, Privacy, Refund and Contact pages | `web/src/pages/Legal.tsx` | drafts; need a lawyer's read |
| Admin page: numbers, switches, job sources, users | `web/src/pages/Admin.tsx` | by hand locally |
| Server: PostgreSQL, service, nginx site, HTTPS, nightly backup, one-command publish | `deploy/` | live |

## Needs you (accounts only you can open)
Domain, Google client, email provider, Adzuna keys, Razorpay, WhatsApp number and Meta verification, Anthropic key. Each is a section of `START_HERE.md`. Until each is done, that feature is off and has never met the real service.

## Worth building next, in rough order of value
1. More job sources, especially for non-tech roles (more company boards weekly; a second licensed search API beside Adzuna).
2. Phone number confirmation by a WhatsApp code before the first alert, so a mistyped number never receives someone else's alerts.
3. A weekly "how your search is going" email (matches sent, applied, strongest fields).
4. Use the thumbs up / down feedback to adjust each user's scores.
5. Error tracking (Sentry free tier) and a daily summary email to the owner.
6. Hindi and Tamil versions of the alert template and the website.
7. GST invoices by email once GST-registered.
8. A referral code for influencers so you can see which post brought which customers.
