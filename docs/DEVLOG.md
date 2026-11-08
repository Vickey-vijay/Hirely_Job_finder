# Dev Log

Running record of what was built, when, and why. Newest first. Update this before every push.

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
