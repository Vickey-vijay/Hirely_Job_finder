# Decisions

Answers to the open questions in PRD Section 17, plus decisions made during UI work. Reached after consulting Opus; the owner can override any of them.

## WhatsApp for development
- **Decision:** Use the official WhatsApp Business Cloud API with Meta's free test number (up to 5 verified recipient phones) from day one.
- **Why:** `whatsapp-web.js` automates WhatsApp Web, which WhatsApp's terms forbid. Bans are common and permanent, and a ban can hurt later Meta Business verification. The owner wants the product to be completely legal.
- **If the owner still wants `whatsapp-web.js` for local testing:** throwaway SIM only, messages to the owner's own phones only, behind a feature flag that is off by default, never deployed, never used with real users. `.wwebjs_auth/` and `.wwebjs_cache/` are already in `.gitignore`.
- **No WhatsApp MCP was connected** in the session that wrote this, so the integration is planned against the library and API directly.

## PRD Section 17 defaults
| # | Question | Decision |
|---|---|---|
| 1 | Plan model | 30-day prepaid pass, no auto-renew in the MVP |
| 2 | GST | ₹199 includes GST; confirm registration threshold with an accountant |
| 3 | First sources | Adzuna India API, Greenhouse and Lever public boards; NCS only if its terms allow |
| 4 | Matching | Rule-based skills/keywords first; embeddings later |
| 5 | WhatsApp provider | Meta Cloud API directly; Gupshup or Interakt as fallback |
| 6 | Trial | None; show a free match count before payment |
| 7 | Team | Solo build; realistic MVP is ~16 weeks |
| 8 | Legal entity | Sole proprietorship or Pvt Ltd with PAN and bank account |
| 9 | Notification cap | 5 per day, up to 3 jobs per message |
| 10 | Refund | Full refund within 7 days |

## Design decisions (UI)
- **Palette "Lichen & Dusk":** mist `#EFE9F6`, paper `#F8F4FB`, ink `#2F2B4A`, dusk periwinkle `#8C84D4`, sage `#8FBFAE`, apricot `#F4B79B`. No pure black or white. Chosen to feel calm, trustworthy and a little unusual rather than the usual blue-and-white job-board look.
- **Motion carries the personality, layout stays minimal.** Page switches, the splash and shared-element glides are where the effort went.
- **Fonts:** Fraunces (headings, warm serif) and Inter (body).
- **Windows-first dev:** `.gitattributes` forces LF line endings; no spaces in paths.

## Decisions for v1 (2026-11-15)
These replace the earlier answers above where they differ. Reviewed with Opus before building.

| Question | Decision | Why |
|---|---|---|
| Plans | Starter 99 (1 role), Plus 199 (5 roles), Pro 499 (tailored resumes) | Owner's brief |
| Billing | Monthly auto-debit through Razorpay Subscriptions; one-time 30-day pass as a fallback switch | Owner asked for auto-debit; Subscriptions may need separate approval for a new merchant |
| Refunds | None for a period that has started; four narrow exceptions (double charge, charge after cancelling, never activated, 7+ days outage) | Owner asked for no refunds; the exceptions are the cases no merchant can defend |
| Cancellation | Always available, effective at period end | A UPI mandate can be cancelled from the customer's own app, and hiding cancellation is a listed dark pattern (CCPA guidelines, 2023) |
| Upgrade | New purchase replaces the old plan immediately, no credit | UPI Autopay subscriptions cannot be switched in place |
| Database | PostgreSQL tuned small (shared_buffers 32 MB) | Existing code and tests already used it; about 60 to 90 MB |
| Alert volume | Digests: 1 / 2 / 3 a day by plan, up to 5 jobs each, score 6 or more; Pro adds up to 2 instant alerts for 9+ | WhatsApp per-message cost; Meta may class alerts as Marketing |
| Matching | Rules (title 50%, skills 27%, location 15%, experience 8%); optional Claude Haiku second opinion on the best unsent matches | Works with no AI bill; every score is explainable |
| Tailored resume | Generated when the user asks, 5 a day, only from the uploaded resume | Cost, and honesty |
| Job sources | Public documented JSON feeds only; each polled every 20 minutes or more | "Every minute" per source would be abusive and finds nothing extra |
| Palette | "Clear Sky": navy ink, trust blue, verified green, a little amber | Owner asked for trusted, verified, honest colours |
