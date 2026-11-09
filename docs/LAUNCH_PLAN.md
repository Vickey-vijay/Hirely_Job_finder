# Launch plan — subscriptions live by 8 December 2026

Written 2026-11-09. You have **29 days**. Weekly plan with owners: **YOU** (registrations, accounts), **CA** (accountant/lawyer), **DEV** (code; can be done with Claude).
Details for each business step are in `docs/BUSINESS_SETUP.md`; code slices are in `docs/ROADMAP.md`.

## Reality check first
Four things take calendar time that you can't speed up: **bank account**, **GST approval**, **Razorpay live KYC**, **Meta business verification + WhatsApp template approval**. They run in parallel with coding, so **start every one this week**. The risk to 8 December is Meta/WhatsApp, not the code.

**Definition of "launched" for 8 Dec (minimum):** a stranger can sign in, pay ₹199 for real, upload a resume / set preferences, see matched jobs in the dashboard, and get alerts. 

**Fallback if WhatsApp isn't approved in time:** launch on 8 Dec with alerts by **email + in-app**, and switch WhatsApp on the day Meta approves. Subscriptions still start on time. Tell early users "WhatsApp alerts arrive in the next update". Decide on 29 Nov, not on 7 Dec.

## Critical path (start dates)
| Item | Start by | Usual wait | Blocks |
|---|---|---|---|
| Meta Business verification | **Nov 10** | 1–4 weeks | WhatsApp |
| Bank current account | **Nov 10** | 3–14 days | Razorpay live |
| GST registration (if you decide to) | **Nov 11** | 3–14 days | invoices, gateway |
| Legal pages live on the domain | **Nov 16** | — | Razorpay + Meta + Google |
| Razorpay live KYC | **Nov 20** at the latest | 2–7 days | real payments |
| WhatsApp templates submitted | **Nov 23** | 1–3 days | WhatsApp |

---

## Week 1 — Nov 9 to 15: register and get the server up
**YOU**
1. Decide structure with a CA: sole proprietorship is fine to start (see BUSINESS_SETUP step 1). Book a 1-hour CA call by Nov 11.
2. Collect documents: PAN, Aadhaar-linked mobile, address proof, photo.
3. Check the name **Hirely** for conflicts (Google, trademark search, domains). If clash, pick a new name **now**.
4. Buy the domain (e.g. `.in`) and set up business email (`support@`, `login@`, `legal@`).
5. Buy the **new business SIM**; keep WhatsApp off it.
6. Apply **Udyam** (free, udyamregistration.gov.in) — about 1 hour.
7. Apply for the **current account** (take Udyam certificate with you).
8. Start **GST** application with your CA (or decide with CA to wait).
9. Create the Meta Business portfolio and **start business verification** (needs name/address matching your documents).
10. Rent/confirm the **VPS** (Ubuntu 22.04/24.04, 2 GB RAM is enough to start).
11. Create the Google Cloud project, OAuth client, and consent screen (GOOGLE_LOGIN.md). Fix the `invalid_client` error by matching the Client ID.
12. Create an SMTP account (Brevo/SES/Zoho) and add SPF, DKIM, DMARC DNS records.

**DEV**
13. Follow `docs/VPS_DEPLOY.md` → **Slice 1**: live HTTPS site with Google and email login on your domain.
**Exit by Nov 15:** you can sign in on `https://yourdomain`; Udyam done; bank, GST, Meta verification all *submitted*.

## Week 2 — Nov 16 to 22: onboarding, legal pages, payments in test mode
**YOU**
14. Publish **Privacy Policy, Terms, Refund (7-day), Contact, Pricing, Grievance Officer** pages (CA reviews once). Required by Razorpay, Meta, Google.
15. Move Google consent screen to **In production** and add policy URLs.
16. Create the **Razorpay** account, use **Test Mode**, then **submit live KYC by Nov 20** once the bank account and legal pages exist.
17. Chase the bank, GST and Meta statuses every 2 days; answer any query within 24 hours (the usual cause of delay).

**DEV**
18. **Slice 2:** phone verification, preferences form, resume upload (PDF/DOCX), "delete my account".
19. **Slice 3 (start):** Razorpay checkout in test mode, signed webhook, subscription table.
**Exit by Nov 22:** policies live, Razorpay live KYC submitted, onboarding works end to end.

## Week 3 — Nov 23 to 29: payments, jobs, matching
**YOU**
20. Pick the first job sources (recommended: **Adzuna India API**, **Greenhouse** and **Lever** public boards for 20–30 companies you choose). Get the Adzuna API key. Get a lawyer/CA glance at source terms.
21. Develop the WhatsApp number setup: register the new SIM in WhatsApp Business Platform, set display name, **submit templates** (`job_match_alert`, `subscription_expiring`, `subscription_ended`). Add a payment method in Meta.
22. **Nov 29 decision:** is Meta verification approved? If not, confirm the **email-alerts-first fallback**.

**DEV**
23. **Slice 3 (finish):** payments activate a 30-day plan, replayed webhooks are harmless, expiry job, receipts, billing page.
24. **Slice 4:** job connectors, scheduler, dedupe, source health.
25. **Slice 5:** rule-based matching, replace demo data with real jobs, "why matched".
**Exit by Nov 29:** a test-mode payment activates a plan; real jobs flow in; matches show for a test user.

## Week 4 — Nov 30 to Dec 6: alerts, live payments, beta
**YOU**
26. Razorpay **live mode** activated: do one real ₹199 payment with your own card/UPI, then refund it. Confirm money reaches the bank account.
27. Invite **10–20 friends** as beta users (free coupon or real payment). Collect problems in one list.
28. Confirm GST invoice flow with CA (what the receipt must show).

**DEV**
29. **Slice 6:** WhatsApp (or email) alerts: opt-in, templates, batching, 5/day cap, quiet hours, STOP/PAUSE, expired plan never messaged.
30. **Slice 7 (minimum):** error tracking, uptime monitor, daily backup running, restore tested once, simple admin view of users and payments.
31. Fix beta bugs. Freeze features on **Dec 4**.
**Exit by Dec 6:** 10+ beta users completed the journey; a real payment worked; alerts delivered.

## Dec 7–8 — Launch
32. Dec 7: final checklist (below), take a backup, rehearse "sign up → pay → onboard → alert" on a fresh phone.
33. **Dec 8: open subscriptions.** Post on your channels, watch logs and payments all day.

## Launch-day checklist
- [ ] HTTPS site live, `NODE_ENV=production`, Secure cookies
- [ ] Google login in production mode; email codes arriving in inbox (not spam)
- [ ] Policy pages linked in footer; consent text for WhatsApp shown at opt-in
- [ ] Razorpay **live** keys in server `.env`, webhook verified, refund tested
- [ ] Bank account receiving settlements
- [ ] GST/invoice approach agreed with CA
- [ ] Alerts working (WhatsApp, or email fallback)
- [ ] STOP works instantly; expired plan gets nothing
- [ ] Backups running, one restore tested
- [ ] You can see users, payments and errors without touching the database
- [ ] Support email monitored

## What to cut if you fall behind (in this order)
1. WhatsApp → email alerts first
2. Third job source → keep Adzuna + Greenhouse
3. Resume parsing → manual preferences first
4. Admin panel → use database queries
**Never cut:** policies, refund flow, STOP/unsubscribe, backups, webhook signature check, "delete my account".

## Risks
| Risk | Mitigation |
|---|---|
| Meta verification slow or rejected (name/address mismatch) | Start Nov 10; match every document exactly; fallback email alerts |
| Razorpay asks for more documents | Submit by Nov 20; keep website, policies and bank proof ready |
| Bank account delay | Apply Nov 10; consider a neo-bank/RazorpayX current account |
| Name conflict ("Hirely") | Check this week, before buying the domain |
| Job sources block or change | Prefer APIs and public boards; source health alerts |
| Solo dev overload | Cut list above; freeze features Dec 4 |

## Your first three actions today
1. Book the CA call and start Udyam.
2. Check the name and buy the domain.
3. Apply for the current account and start the Meta Business verification.
