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
