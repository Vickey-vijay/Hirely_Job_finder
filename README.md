# Hirely — Job Alert Platform

Sign in with Google, subscribe for ₹199, and get WhatsApp alerts for matching jobs.

- `prd.md` — full product requirements
- `docs/DEVLOG.md` — what was built and what's next
- `docs/DECISIONS.md` — decisions on open questions and design
- `docs/ROADMAP.md` — what is done, what is next (vertical slices)
- `docs/VPS_DEPLOY.md` — deploy to your VPS, step by step
- `docs/BUSINESS_SETUP.md` — registration, GST, bank, payments, WhatsApp (India)
- `docs/GOOGLE_LOGIN.md` — Google login setup
- `docs/DATABASE.md` — PostgreSQL schema and migrations
- `web/` — React front end (see `web/README.md`)
- `api/` — Node API: Google + email login, sessions, PostgreSQL
- `deploy/` — Nginx, systemd, backup and deploy scripts

Status: UI v0.1 with demo job data; Google and email login implemented and unit-tested. Next: put it live on the VPS (Slice 1). No payments or WhatsApp yet.
