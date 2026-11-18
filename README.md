# Hirely: personal job alerts

People sign in, say what job they want, upload a resume, and pick a monthly plan (₹99 / ₹199 / ₹299). Hirely watches public job sources, scores each opening 1 to 10 against the person's profile, and sends only the ones that fit by email, Telegram, WhatsApp and a dashboard. The Pro plan also writes a tailored resume for each strong match and sends it as a Word file.

**Start with [`docs/START_HERE.md`](docs/START_HERE.md).** It is the step-by-step guide from "deployed in test mode" to "taking real payments": domain, Google sign-in, email, Razorpay, WhatsApp, business registration, costs, daily operations and troubleshooting.

## What is in this repo
| Folder | What |
|---|---|
| `api/` | Node 22 + Express + TypeScript + PostgreSQL. Sign-in, profiles, payments (Razorpay), job collection, matching, alerts, admin |
| `web/` | React 18 + Vite + Framer Motion website |
| `deploy/` | `setup-server.sh` (one-time server setup), `push.sh` (publish a new version), nginx site, systemd service, backup script |
| `docs/` | Guides. `START_HERE.md` is the main one |

## How the server code is organised (`api/src/`)
| File | Job |
|---|---|
| `index.ts`, `app.ts` | Start-up, sign-in routes, security middleware |
| `routes.ts` | Profile, matches, billing, webhooks, admin routes |
| `plans.ts` | The three plans, prices, alert times and limits |
| `billing.ts` | Razorpay subscriptions, one-time pass fallback, test mode, webhooks |
| `sources.ts`, `seed.ts` | Job source connectors and the starting list of company boards |
| `match.ts` | The 1 to 10 scoring rules |
| `pipeline.ts` | The worker that runs every minute: collect, score, alert, clean up |
| `notify.ts` | WhatsApp (official Cloud API) and email alerts, STOP / PAUSE / RESUME / MORE |
| `llm.ts` | Optional AI: resume reading, score refinement, tailored resumes |
| `resume.ts`, `taxonomy.ts` | Resume text extraction; job fields, roles, skills, cities |

## Run on your computer
```
cd api && npm install && npm run dev      # http://localhost:4000, embedded database, sign-in codes print here
cd web && npm install && npm run dev      # http://localhost:5173
cd api && npm test                        # 16 tests
```
Copy `api/.env.example` to `api/.env` first and set `JWT_SECRET`.

## Publish
```
bash deploy/push.sh
```

## Status (15 Nov 2026)
Deployed in test mode at https://hirely.35-226-195-159.sslip.io. Collecting India jobs from 58 company boards. Sign-in, real payments, email, WhatsApp, Adzuna and AI are built and unit-tested but switched off until their keys are added (see the guide). None of those six has been run against the real service yet.
