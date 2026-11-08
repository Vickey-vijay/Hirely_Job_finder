# Business & Legal Setup Guide (India) — from zero to taking payments

Read this top to bottom and do the steps in order. Each step says what it is, why you need it, where to do it, what to have ready, and what it unlocks.

> **Not legal, tax or financial advice.** Rules, thresholds and fees change. Items marked **CA** should be confirmed with a Chartered Accountant (or Company Secretary / lawyer) before you act. A few hours of their time early is much cheaper than fixing mistakes later. Facts below were checked against public sources on 2026-11-08; re-check anything with a number in it.

## Order at a glance
| # | Step | Time | Unlocks |
|---|---|---|---|
| 1 | Decide your business structure | 1–3 days | everything else |
| 2 | Get documents ready | 1 day | all KYC |
| 3 | New business mobile number | 1 day | WhatsApp, bank, OTPs |
| 4 | Domain + business email | 1 day | gateway, Meta, Google, SMTP |
| 5 | Udyam registration (free) | 1 day | bank account proof, MSME status |
| 6 | Business bank (current) account | 1–2 weeks | receiving money |
| 7 | GST registration | 1–3 weeks | invoices with GST |
| 8 | Website legal pages live | 2–3 days | gateway + Meta approval |
| 9 | Razorpay account | 2–7 days | taking ₹199 payments |
| 10 | Meta Business + verification | 1–4 weeks | WhatsApp Business API |
| 11 | WhatsApp number + templates | 3–7 days | sending alerts |
| 12 | Google OAuth consent screen | 1 day | public Google login |
| 13 | Data protection (DPDP) basics | ongoing | staying legal |
| 14 | Trademark the name | 1 day to file | protecting the brand |
| 15 | Accounting, GST returns, income tax | monthly | staying legal |

Steps 1–8 can overlap. Start 10 (Meta verification) as early as you can; it is the slowest.

---

## 1. Decide your business structure (CA)
| Option | Good for | Watch out |
|---|---|---|
| **Sole proprietorship** | Fastest and cheapest start. Udyam + current account + GST all work in your own name. | You and the business are legally the same person: unlimited personal liability. Some partners and investors prefer a company. |
| **LLP** | Limited liability, low running cost, easy to add a partner. | Needs two partners. More paperwork than a proprietorship. |
| **Private Limited company** | Most credible, can raise money, limited liability. | Highest setup and compliance cost (annual filings, audit, directors). |

**Recommendation for a solo first product:** start as a **sole proprietorship** to validate (it is legal and accepted by Razorpay and Meta), and move to a Pvt Ltd or LLP once you have paying users or want investors. A CA can advise on timing; you can transfer the business later.
Whichever you pick, keep **all** business money in the business account from day one. Never mix with personal spending.

## 2. Get documents ready
- PAN card (personal; for a company, the company PAN)
- Aadhaar linked to your **active mobile number** (needed for Udyam and many OTPs)
- Address proof for the business address (rent agreement + electricity bill, or own-property papers; a home address is accepted for a home-based business with owner's consent if rented)
- Passport-size photo, signature, cancelled cheque of your personal account (some forms ask)
- For a company/LLP: director IDs, DSC (digital signature), registered office proof, MoA/AoA (your CA/CS handles this)

## 3. Buy a new mobile number for the business
**Why:** WhatsApp Business API needs a number that can receive an OTP by SMS or voice, and **that number cannot be in use on regular WhatsApp or the WhatsApp Business app** (or you delete that account first). Using your personal number would lock you out of your own WhatsApp.
**How:**
1. Buy a new SIM (Jio / Airtel / Vi). Prefer a plan you will never let lapse. If the number is recycled, WhatsApp and Meta lose it. Keep auto-recharge on.
2. Complete the SIM KYC in your own (or the business owner's) name.
3. Insert it in a phone and confirm it receives SMS and calls.
4. **Do not install WhatsApp on it.** Leave it for Meta onboarding (step 11).
5. Optionally use this same number as the contact on the bank, GST and gateway forms so everything matches.

## 4. Domain and business email
- Buy the domain (e.g. `hirely.in`) from a registrar. `.in` is cheap and trusted in India. **Check the name first** (see step 14).
- Create email on your domain: `you@yourdomain` via Google Workspace or Zoho Mail. Use it on every registration so the business does not depend on a personal Gmail.
- Set `support@`, `legal@` (grievance) and `login@` (for sending codes) addresses.

## 5. Udyam registration (free)
**What:** Government MSME registration. Gives you an Udyam number and certificate. Many banks accept it as business proof for a current account, and it is useful for later schemes and credit.
**Where:** the official portal **udyamregistration.gov.in**. It is **free**. Anyone charging a fee on a look-alike site is an agent; you don't need one.
**Have ready:** Aadhaar (linked to mobile), PAN, business name and address, bank account details (can be added later), NIC activity code (a CA or the portal's search can pick "software / computer programming / information service").
**Steps:** Open the site → "New Entrepreneur not yet Registered" → Aadhaar number + OTP → PAN verify → fill business details → submit → download the certificate.
**Result:** Udyam Registration Number + certificate PDF.

## 6. Open a business current account
**Why:** Razorpay settles money here; mixing with personal savings creates tax and legal mess.
**Where:** a bank that supports small online businesses (HDFC, ICICI, Axis, Kotak, or a neo-bank such as RazorpayX/Open/Zoho Money; compare monthly minimum balance and charges).
**Have ready:** PAN, Aadhaar, Udyam certificate (often accepted as business proof), address proof, photo, and for a proprietorship usually GST or Udyam in the business name. Banks differ; ask what they accept.
**Result:** account number + IFSC + cancelled cheque in the business name, which you will upload to Razorpay.

## 7. GST registration (CA)
**What:** Goods and Services Tax registration gives you a GSTIN so you can charge and collect GST and file returns.
**Do you need it now?** Public sources indicate the compulsory limit for **services** is annual turnover above **₹20 lakh** (₹10 lakh in some special-category states), counted across India on one PAN. Separately, rules for some online digital services can require registration regardless of turnover, and a CA should confirm how your ₹199 subscription is treated. Even below the limit, many founders **register voluntarily** to issue proper GST invoices, claim input tax credit on software and hosting, and look credible to gateways and partners. **Ask your CA before skipping it.**
**Where:** official portal **gst.gov.in** → Services → Registration → New Registration.
**Have ready:** PAN, Aadhaar (authentication), mobile and email (OTPs), business address proof, bank account proof, photo, and for a proprietorship your own details.
**Steps:** Part A (PAN, mobile, email OTPs → TRN) → Part B (details, documents) → submit → Aadhaar authentication → ARN issued → officer approval (usually 3–7 working days) → GSTIN.
**Pricing impact:** The PRD assumes ₹199 includes GST. At 18% GST, that is about ₹168.64 + ₹30.36 tax. Confirm the rate for your service (IT services were reported at 18% after the 2025 rate reform).
**After you have it:** issue a GST invoice for every payment (Razorpay can generate receipts; your CA files GSTR-1 and GSTR-3B).

## 8. Put the legal pages on your website
Razorpay, Meta and Google will all visit your site. It must be **live over HTTPS** with these pages linked in the footer:
1. **Privacy Policy** — what you collect (name, email, phone, resume, job preferences), why, who sees it, how long you keep it, how to delete it, grievance contact.
2. **Terms of Service** — what the service is, ₹199 pricing, that you are **not a recruiter and don't guarantee jobs**, acceptable use, termination.
3. **Refund & Cancellation Policy** — e.g. full refund within 7 days (per `docs/DECISIONS.md`).
4. **Contact Us** — real business address, email, phone.
5. **Pricing** — clear ₹199 plan with what it includes.
6. **Grievance Officer** — name and email, required for handling complaints.
Have a lawyer review once (CA). Generator templates are fine as a first draft, but edit them to match what the product really does, especially the WhatsApp consent and scraping/source-attribution parts.

## 9. Payment gateway: Razorpay (not Stripe)
You mentioned Stripe. As of 2026 Stripe's own documentation still lists India as available **by invitation only** for new accounts, so you cannot count on opening one. **Razorpay** is the standard choice for Indian businesses accepting UPI, cards and netbanking, and the PRD is built around it. Cashfree and PayU are alternatives.
**Where:** razorpay.com → Sign up → complete KYC.
**Have ready:** PAN, Aadhaar, business PAN/GSTIN (if any), Udyam, bank account + cancelled cheque, live website with the legal pages from step 8, business description and expected volume.
**Steps:**
1. Sign up with your business email and mobile.
2. Use **Test Mode** first: you get test keys and can build the whole payment slice without KYC.
3. Submit KYC and the website URL for **Live Mode** activation.
4. Create the plan (₹199) and set the webhook URL to `https://yourdomain/api/webhooks/razorpay` (we build this in Slice 3).
5. Store keys only in `api/.env` on the server, never in git.
**Fees:** Razorpay charges a percentage per transaction plus GST on that fee. Check the current rate on their pricing page, because it varies by payment method. Put it in your margin calculation.

## 10. Meta Business Account and verification
WhatsApp Business Platform requires a verified business.
**Where:** business.facebook.com (Meta Business Suite) → create a Business Portfolio. Then **Business Settings → Security Center → Start Verification**.
**Have ready:** legal business name exactly as on documents, address, phone, website (live), and documents Meta accepts, typically GST certificate, Udyam certificate, incorporation certificate, utility bill or bank statement showing the business name and address. The name, address and website must **match across documents**.
**Notes:** Verification can take days to a few weeks. Mismatched names are the #1 cause of rejection. Add a verified domain in Brand Safety → Domains, using a DNS TXT record.

## 11. WhatsApp Business Platform
**Where:** developers.facebook.com → create an app (type: Business) → add **WhatsApp** product → link your Meta business.
**Steps:**
1. Use Meta's **free test number** first (messages to up to 5 verified phones) to build and demo Slice 6.
2. Register your **new SIM from step 3** as the production number (OTP by SMS/voice). Set a **display name** that matches your brand and website; Meta reviews it.
3. Create a **system user** access token (permanent) and keep it in `api/.env` on the server.
4. Submit **message templates** (e.g. `job_match_alert`, `subscription_expiring`). Category *Utility*. Approval often takes minutes to 2 days.
5. Add a payment method in Meta for message fees.
6. Configure the webhook URL `https://yourdomain/api/webhooks/whatsapp` for delivery status and `STOP` replies.
**Cost:** Meta charges per message by category and country. Public guides report India utility-template rates of roughly ₹0.11–₹0.25 per message and say rates and the free window rules changed during 2025–2026, so **read Meta's official rate card before budgeting** (developers.facebook.com → WhatsApp → Pricing). With 5 messages/day/user the monthly cost is not trivial; model it against ₹199 before launch.
**Rules you must follow:** only message users who **opted in** with clear wording; honour `STOP` immediately; no spam. Violations lower your quality rating and can get the number blocked.
**Do not** use unofficial WhatsApp automation libraries for real users; they break WhatsApp's terms and numbers get banned (see `docs/DECISIONS.md`).

## 12. Google OAuth consent screen (public login)
In Google Cloud Console → OAuth consent screen:
1. Move **Publishing status** from *Testing* to *In production*.
2. Fill app name, support email, logo (optional), **Privacy Policy** and **Terms** URLs, authorized domain (your domain, verified in Google Search Console).
3. Scopes: only the defaults (email, profile, openid). These are non-sensitive, so you generally don't need Google's lengthy security review.
4. If Google asks for brand verification, follow its prompts; it can take a few days.

## 13. Data protection basics (DPDP Act, 2023) (CA / lawyer)
You will hold personal data (name, email, phone, resume). As a baseline:
- Ask clear consent for each purpose (account, job matching, WhatsApp alerts) and keep a record of when it was given.
- Collect only what you need; delete it when no longer needed or when the user asks. Build "delete my account" before launch.
- Publish a grievance contact and respond promptly.
- Protect data (encryption, access limits, backups) and have a plan to report a breach to users and the authorities.
- Check the current Rules under the Act for deadlines and thresholds, since they are being phased in.
- Job listings come from public sources: honour each source's terms, link back, and remove content on request (see PRD Section 8). Get a lawyer's view on aggregation before launch.

## 14. Trademark and name check
Before you spend on branding, search for an existing business named **Hirely** (the name used in this project; several companies use similar names). Search: IP India's public trademark search, Google, app stores, domain registrars. If it is taken or close, choose another name now; changing later costs more. If clear, file a trademark application (classes commonly used for software: 9, 35, 42) at ipindia.gov.in, directly or through an attorney.

## 15. Accounting, GST returns and income tax (CA)
- Keep every invoice and receipt (hosting, domain, SMS, software) in a folder or an app (Zoho Books, Vyapar, etc.).
- If registered: file GST returns on time (your CA will tell you the schedule). Late fees add up.
- Income tax: file your return yearly. A proprietorship's profit is added to your personal income; companies file their own.
- Set aside a share of every payment for tax in a separate bucket.
- Review your numbers monthly: revenue, Razorpay fees, WhatsApp cost, hosting, profit per subscriber.

---

## Who does what
| You | CA / lawyer | Developer (me / you) |
|---|---|---|
| SIM, domain, email, Udyam, bank, Razorpay and Meta signups | Structure choice, GST decision and filing, policy review, DPDP check, trademark | App features, deployment, webhooks, consent records |

## Where the code needs these (so nothing is blocked)
| Step done | Unblocks |
|---|---|
| 4 domain | VPS HTTPS, Google production origin, SMTP |
| 6, 7, 8, 9 | Slice 3 (live payments) |
| 3, 10, 11 | Slice 6 (WhatsApp alerts) |
| 8, 12 | Public Google login |

## Printable checklist
- [ ] Structure chosen (CA)
- [ ] PAN, Aadhaar-linked mobile, address proof ready
- [ ] New business SIM bought, no WhatsApp on it
- [ ] Brand name checked for conflicts
- [ ] Domain + business email
- [ ] Udyam certificate
- [ ] Current account open
- [ ] GST decision made / GSTIN received
- [ ] Privacy, Terms, Refund, Contact, Pricing, Grievance pages live over HTTPS
- [ ] Razorpay test mode working, live KYC submitted
- [ ] Meta Business verification submitted
- [ ] WhatsApp number registered, templates approved
- [ ] Google consent screen in production
- [ ] "Delete my account" built and tested
- [ ] Accountant engaged, tax money bucket set up
- [ ] Trademark filed
