# Hirely: start here

This is the one document to follow, top to bottom, to take Hirely from "built and deployed in test mode" to "taking real money from real customers". Everything is written so you can do it by hand, without AI help.

Last updated: 15 November 2026

> **Not legal, tax or financial advice.** I am software, not a CA or lawyer. Fees, thresholds and rules change. Anything marked **(confirm)** is something I could not verify on an official page and you should check before relying on it. A one-hour paid session with a Chartered Accountant before you take your first payment is money well spent.

---

## 1. Where things stand today

**Your site is live in test mode:** https://hirely.35-226-195-159.sslip.io
(That odd address is a free temporary name that points at your server. You replace it with your own domain in step 4.)

| Piece | State today | What switches it on |
|---|---|---|
| Website (landing, sign-up steps, plans, dashboard, matches, settings, policies, admin) | Live over HTTPS | done |
| Job collection from 58 company career boards (India jobs only) | Running on the server | done |
| Matching and 1 to 10 scoring with reasons | Running | done |
| Sign-in | **Off: nobody can sign in yet** | step 3 (Google) and/or step 5 (email) |
| Payments | Test mode: a "Test mode" banner shows and no money moves | step 7 (Razorpay) |
| Email alerts | Off | step 5 |
| WhatsApp alerts | Off | step 8 |
| Telegram alerts | Off until `TELEGRAM_BOT_TOKEN` is set | step 8g (free bot) |
| Non-tech jobs (sales, accounts, nursing, teaching...) | **Thin.** The 58 boards are mostly tech companies | step 6 (Adzuna keys). Do this before any marketing |
| AI score refinement and Pro tailored resumes | Off | step 9 (Anthropic key) |

What I tested: 34 automated tests pass (sign-in, payment signature checks, renewal webhooks, replayed webhooks, cancel at period end, matching, the 09:00 summary, the daily alert limit, Telegram linking and the webhook secret, the Pro WhatsApp cap of 5 a day, tailored Word files, WhatsApp STOP). I also clicked through sign-in, profile set-up, a test-mode purchase, the dashboard and matches on my own machine with real collected jobs, and confirmed the live site answers over HTTPS.

What I could **not** test, because it needs accounts only you can open: a real Google sign-in, a real Razorpay payment, a real WhatsApp message, real email delivery, Adzuna, and the AI features. The code for each is written and unit-tested against fake versions of those services. Expect to fix a small thing or two the first time each one meets the real service; section 14 tells you where to look.

---

## 2. Three things to know before you spend a rupee

**a) Check your employment contract first.** You are a salaried engineer. Read your offer letter and company policy for clauses on outside work, conflict of interest, exclusivity and intellectual property. Many Indian IT employers require written permission for any side business. If it is unclear, ask HR in writing. Do this before you register as a merchant anywhere, because Razorpay, GST and Udyam all create public records in your name.

**b) "Subscriptions cannot be cancelled" is not possible, and I did not build it that way.** You asked for no cancellation. What the product does instead: **no refund for a month that has started, but the customer can turn off renewal at any time and keeps access until the month ends.** Reasons:
- A customer can cancel a UPI Autopay mandate from their own UPI app whenever they like. You cannot prevent it.
- India's 2023 guidelines on "dark patterns" (Central Consumer Protection Authority) list the "subscription trap", which includes making cancellation hard or hidden.
- Razorpay reviews your refund and cancellation page before activating you, and chargebacks from angry customers can get an account suspended.
"No refunds, cancel renewal any time" is lawful as long as it is shown clearly before payment, and it is: on the landing page, on the plans page (with a tick box), and in the policy pages. I kept four narrow refund cases (charged twice, charged after cancelling, paid but never activated, 7+ days of outage on our side) because refusing those would be indefensible.

**c) The biggest risk to this business is not code. It is whether there are enough relevant jobs.** Your Instagram audience will include people looking for sales, BPO, accounts and teaching jobs in Indian cities. Company career boards are mostly tech roles. If people pay ₹99 and get nothing useful, they complain, ask for money back and dispute charges. Protections already built in:
- Before paying, every user sees **how many current jobs fit their profile**, with examples. If it is zero the page says so honestly and suggests they do not pay yet.
- We stay silent rather than send weak matches (only scores of 6 or more are sent).
Your part: finish step 6 (Adzuna), then use the admin page for a week to see how many jobs exist per role and city **before** any influencer posts. Launch to the fields where supply is good.

---

## 3. Make yourself admin and switch on Google sign-in (30 minutes, free)

### 3a. Connect to your server
Double-click the `.bat` file you already use, or in PowerShell:
```
ssh -i C:\Users\Vicke\.ssh\ssh-key.key ubuntu@35.226.195.159
```

### 3b. Open the settings file
All settings live in one file on the server. You will edit it many times.
```
sudo nano /srv/hirely/api/.env
```
Move with arrow keys. Save with `Ctrl+O` then `Enter`. Exit with `Ctrl+X`. After every change, restart the app:
```
sudo systemctl restart hirely-api
```
and check it started cleanly (the last line lists what is on and off):
```
sudo journalctl -u hirely-api -n 20 --no-pager
```

Set your own email now so you can see the admin page:
```
ADMIN_EMAILS=youremail@gmail.com
```

### 3c. Create the Google sign-in client
1. Go to https://console.cloud.google.com and create a project named `Hirely`.
2. Menu → **APIs & Services** → **OAuth consent screen**. User type **External**. App name `Hirely`, your support email, your developer email. Scopes: leave the defaults. Save.
3. Menu → **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**. Type **Web application**.
4. Under **Authorised JavaScript origins** add `https://hirely.35-226-195-159.sslip.io` (and later your real domain, see step 4). Leave redirect URIs empty.
5. Copy the **Client ID** (ends with `.apps.googleusercontent.com`). You do not need the client secret.
6. In `.env` set `GOOGLE_CLIENT_ID=` to that value. Restart.
7. Open the site, click Sign in, sign in with Google. Then open `/admin`.
8. While the consent screen is in **Testing**, only test users you add can sign in. Before launch press **Publish app** on the consent screen page. Name, email and profile are non-sensitive scopes, so Google normally does not ask for a review.

More detail and troubleshooting: `docs/GOOGLE_LOGIN.md`.

---

## 4. Buy a domain and point it at the server (1 hour, about ₹200 to ₹900 a year)

You need your own domain before Razorpay, Meta and email providers will take you seriously.

1. **Check the name first.** Other companies already use names like "Hirely". Search Google, the Play Store and the IP India trademark search (https://tmrsearch.ipindia.gov.in). If the name is taken in your category, pick a different one now; changing later is painful. The name appears in one place in settings (`BUSINESS_NAME`) and in the website text.
2. **Buy it.** A `.in` is cheap and trusted in India. Use a well-known registrar (GoDaddy India, BigRock, Namecheap, Hostinger). First-year offers are low (roughly ₹200 to ₹500) and renewals are higher (roughly ₹800 to ₹1,000 plus GST) **(confirm on the registrar's page)**. Decline every add-on (hosting, email, "protection"); you need only the domain. Turn on auto-renew.
3. **Point it at your server.** In the registrar's DNS settings add:
   - Type `A`, name `@`, value `35.226.195.159`
   - Type `A`, name `www`, value `35.226.195.159`
   Wait 10 to 30 minutes. Check from your PC: `nslookup yourdomain.in` should show that IP.
4. **Tell the server about it** (replace `yourdomain.in` everywhere):
   ```
   sudo sed -i 's/server_name .*/server_name yourdomain.in www.yourdomain.in;/' /etc/nginx/sites-available/hirely
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d yourdomain.in -d www.yourdomain.in --redirect
   ```
   Certbot gets a free HTTPS certificate and renews it by itself.
5. In `.env` change both lines, then restart:
   ```
   APP_URL=https://yourdomain.in
   ALLOWED_ORIGINS=https://yourdomain.in,https://www.yourdomain.in
   ```
6. In Google Cloud (step 3c) add `https://yourdomain.in` and `https://www.yourdomain.in` to Authorised JavaScript origins.
7. Make sure your Google Cloud server keeps the same IP: Google Cloud console → VPC network → IP addresses → your VM's external IP should say **Static**. If it says Ephemeral, click **Reserve**. Otherwise the IP can change on a restart and your domain will point nowhere.

---

## 5. Business email and sending email (1 to 2 hours, free to start)

Email does two jobs: sign-in codes for people without Google, and job alerts. It needs your own domain (step 4).

1. Create a free account at **Brevo** (brevo.com). The free plan allowed 300 emails a day when I last knew it **(confirm)**. Alternatives: Zoho ZeptoMail, Amazon SES, Resend.
2. In Brevo: **Senders & domains** → add your domain → it shows DNS records (DKIM, DMARC, and a verification code). Add each one at your registrar exactly as shown. Wait until Brevo marks the domain as authenticated. Without this your mail lands in spam.
3. **SMTP & API** → SMTP tab → copy the server, port, login and SMTP key.
4. In `.env`:
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=(the login Brevo shows)
   SMTP_PASS=(the SMTP key)
   MAIL_FROM="Hirely <alerts@yourdomain.in>"
   CONTACT_EMAIL=support@yourdomain.in
   ```
   Restart. On the sign-in page, "Email me a code" should now deliver a 6-digit code.
5. For receiving mail at `support@yourdomain.in`: Zoho Mail has a free plan for one domain **(confirm)**, or use your registrar's email forwarding to your Gmail.

---

## 6. Adzuna keys: the jobs for everyone who is not in tech (15 minutes, free)

1. Sign up at https://developer.adzuna.com and create an application. Copy the **Application ID** and **Application Key**.
2. In `.env` set `ADZUNA_APP_ID=` and `ADZUNA_APP_KEY=`. Restart.
3. Nothing else to do. Hirely automatically runs one India search for each distinct role your users have chosen, spaced out to stay inside the free daily limit (about 200 calls a day in total; the free tier allowed around 250 **(confirm)**).
4. **Read Adzuna's terms of service for API use before launch.** Their API is meant for showing their listings with a link back to Adzuna (the apply link we send already goes through Adzuna). I could not confirm whether using it inside a paid alert product needs their written permission **(confirm; email them and keep the reply)**. If they say no, ask about a paid plan, or switch to another licensed feed such as Jooble or Careerjet (each needs a small connector in `api/src/sources.ts`).

---

## 7. Razorpay: taking money (start today, live in about a week)

### 7a. What you need to be a "business" on day one
You do not need a company. A **sole proprietorship** is just you trading under a name. Minimum sensible set-up:

| Item | Needed now? | Notes |
|---|---|---|
| PAN and Aadhaar (linked to your mobile) | Yes | For every KYC |
| **Udyam registration** | Yes, it is free and takes 20 minutes | https://udyamregistration.gov.in only. It is free; any site charging a fee is an agent. Choose a software or information-service activity code. This certificate is your "business proof" for the bank, Razorpay and Meta |
| Bank account | Start with what your bank allows | No law forces a sole proprietor to have a current account, and Razorpay generally accepts an individual's or proprietor's account **(confirm during sign-up)**. But banks dislike business receipts in a savings account. **Open a current account once you pass roughly 30 to 50 paying customers or ₹10,000 a month**, and from then on keep all business money there |
| GST registration | **Not at the start** | Compulsory for services once turnover crosses ₹20 lakh in a financial year (₹10 lakh in some special-category states). At ₹99 to ₹499 a customer you are far below it. Selling to customers in other states does not by itself force registration for services under the threshold **(confirm with a CA; sources I found disagree)**. Without GST you simply do not charge or show GST |
| Shop & Establishment licence | Depends on your state | Rules for home-based online businesses differ by state **(confirm)**. Some banks ask for it for a current account |
| Trademark | Later | File once you see traction (about ₹4,500 government fee for an individual **(confirm)**) |

**When to move up a level**

| When | Do this |
|---|---|
| First paying customers | Udyam done, policies live, a simple income and expense sheet started |
| About 50 customers or ₹10,000 a month | Current account. Hire a CA for a yearly filing |
| Revenue heading towards ₹20 lakh a year | GST registration, monthly returns, GST invoices. Decide whether prices include GST |
| Taking investment, a co-founder, or serious liability worries | Convert to an LLP or Private Limited company |

**Income tax:** profit from Hirely is business income added to your salary income in your yearly return. Small businesses can usually use the presumptive scheme (section 44AD: tax on 6% of digital receipts) and file ITR-4 instead of keeping full books **(confirm with a CA)**. Either way, keep every invoice (server, domain, Meta, Razorpay, Anthropic).

### 7b. Open the account
1. Sign up at https://razorpay.com with your business email and the business mobile number.
2. You immediately get **Test mode**. Use it first; nothing in test mode moves money.
3. Submit KYC for **Live mode**: PAN, Aadhaar, bank account, business proof (Udyam), and your **website address**. Razorpay staff open your site and look for: pricing, Terms, Privacy, Refund and Cancellation, and Contact pages with a real address and email. All of these exist. Fill in the business details first:
   ```
   BUSINESS_NAME=Hirely
   CONTACT_EMAIL=support@yourdomain.in
   BUSINESS_ADDRESS=Your full postal address
   GRIEVANCE_NAME=Your full name
   ```
   Restart, then read `/terms`, `/privacy`, `/refunds` and `/contact` on your site and correct anything that is not true for you (the text lives in `web/src/pages/Legal.tsx`).
4. Fees: about 2% per successful payment plus 18% GST on that fee, no set-up fee **(confirm on razorpay.com/pricing; the fee for UPI Autopay subscriptions was listed as "on request")**. On ₹99 that is roughly ₹2.40.

### 7c. Test mode on your site
1. Razorpay dashboard, **Test mode** switch on → **Account & Settings** → **API keys** → Generate. Copy Key ID and Key Secret.
2. **Subscriptions** → **Plans** → create three plans, billing frequency monthly:
   - `Hirely Starter`, ₹99
   - `Hirely Plus`, ₹199
   - `Hirely Pro`, ₹299
   Copy each Plan ID (starts with `plan_`). If you already made a Pro plan at ₹499, make a new one at ₹299: a Razorpay plan's price cannot be changed. Use the new ID for `RAZORPAY_PLAN_PRO`. Existing Pro subscribers keep their old price until they cancel.
3. **Account & Settings** → **Webhooks** → Add:
   - URL: `https://yourdomain.in/api/webhooks/razorpay`
   - Secret: make up a long random string and keep it
   - Events: `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `payment.captured`
4. In `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=(the secret you made up)
   RAZORPAY_PLAN_STARTER=plan_...
   RAZORPAY_PLAN_PLUS=plan_...
   RAZORPAY_PLAN_PRO=plan_...
   ```
   Restart. The log line should now say `payments: subscription` and the Test mode banner disappears (Razorpay's own test mode is still in force because the key starts with `rzp_test_`).
5. Buy a plan on your site using Razorpay's published test card or test UPI ID (see Razorpay docs, "Test cards"). Check: the dashboard shows the plan, Settings shows the payment, and `/admin` shows one paying user.
6. In Settings press **Stop renewal** and confirm the Razorpay dashboard shows the subscription as cancelled at cycle end.

### 7d. If Razorpay has not enabled Subscriptions for you yet
Recurring payments sometimes need separate approval for a new merchant. Until it is granted you can still sell: leave the three `RAZORPAY_PLAN_...` lines empty (or set `BILLING_MODE=pass`). Hirely then sells a **one-time 30-day pass** at the same prices with normal UPI or card payment, and the site wording changes by itself to say it does not renew. When Subscriptions is approved, fill in the plan IDs and remove `BILLING_MODE`.

### 7e. Go live
1. After KYC approval, switch the dashboard to **Live mode** and repeat 7c steps 1 to 3 there (live keys, three live plans, live webhook). Test and live are separate worlds.
2. Replace the six values in `.env` with the live ones. Set `ALLOW_MOCK_PAYMENTS=false`. Restart.
3. Make one real ₹99 purchase with your own UPI. Stop the renewal afterwards.

---

## 8. Phone number and WhatsApp (start early; 1 to 3 weeks)

### 8a. The phone number
- Buy a **new SIM** used only for this business. Jio is fine; so are Airtel and Vi. What matters is: the number has **never been registered on WhatsApp** (or you delete that WhatsApp account first), it can **receive an SMS or a voice call** for the one-time code, and it **never lapses**. A prepaid SIM that expires gets recycled to a stranger and you lose your WhatsApp identity, so keep a long-validity plan with auto-recharge.
- KYC the SIM in your own name. **Do not install WhatsApp or WhatsApp Business on it.**
- Use this same number on Razorpay, the bank and Meta so your records match.

### 8b. Meta set-up
1. https://business.facebook.com → create a **Business portfolio** with your legal business name (exactly as on your Udyam certificate) and your domain email.
2. https://developers.facebook.com → **My Apps** → **Create app** → use case "Connect with customers through WhatsApp" → attach your business portfolio.
3. In the app: **WhatsApp** → **API Setup**. Meta gives you a **test number** immediately. Add your own phone as a recipient and send the sample message to prove the route works.
4. **Add phone number** → enter your new SIM's number → verify with the SMS or voice code → choose a display name that matches your brand and website (Meta reviews it).
5. **Permanent token:** Business settings → **Users** → **System users** → Add (Admin) → **Assign assets**: your app (full control) and your WhatsApp account (full control) → **Generate token** with permissions `whatsapp_business_messaging`, `whatsapp_business_management` and `business_management`. Copy it once; it is shown only once.
6. Note the **Phone number ID** (API Setup page) and the **App secret** (App settings → Basic).
7. Add a payment method in WhatsApp Manager, otherwise template messages stop after the free allowance.

### 8c. The message template
WhatsApp Manager → **Message templates** → Create. Use exactly this so it matches the code:
- Name: `job_digest`
- Category: **Utility**
- Language: **English** (code `en`)
- Body:
  ```
  Hi {{1}}, {{2}} new job(s) match your Hirely profile today. Best match: {{3}} (fit {{4}}/10). Reply MORE to see the full list here, or open your dashboard to view and apply.
  ```
  Sample values: `Asha`, `3`, `Data Analyst at Acme`, `9`
- Buttons (optional): a **Quick reply** button labelled `MORE`, and a **Visit website** button with the fixed address `https://yourdomain.in/matches`.

Keep the wording free of anything promotional (no "upgrade", no offers). Meta re-labels templates with sales language as Marketing, which costs several times more. Review usually takes minutes to a day. If Meta files it under Marketing anyway, it still works; see costs below.

### 8d. Connect it
In `.env`:
```
WHATSAPP_TOKEN=(the system user token)
WHATSAPP_PHONE_ID=(Phone number ID)
WHATSAPP_APP_SECRET=(App secret)
```
`WHATSAPP_VERIFY_TOKEN` is already filled with a random value; read it with `sudo grep WHATSAPP_VERIFY /srv/hirely/api/.env`. Restart. Then in the Meta app: **WhatsApp** → **Configuration** → Webhook:
- Callback URL: `https://yourdomain.in/api/webhooks/whatsapp`
- Verify token: that value
- Subscribe to the **messages** field.

Test: set your own number in your Hirely profile with WhatsApp ticked, have a plan, and wait for the summary at 09:00 India time the next morning (it lists yesterday's matches). On Pro, a new strong match also goes out on WhatsApp straight away. Reply `MORE`, `PAUSE`, `RESUME` and `STOP` and check each answer.

### 8e. Business verification
Meta Business settings → **Security centre** → Start verification. Upload documents showing your business name and address; guides for India commonly list the Udyam certificate, GST certificate, a bank statement or a utility bill **(confirm in the upload screen; Meta's own list was not readable when I checked)**. The name must match letter for letter across the portfolio, the documents and the website. Until verified (or until you build a sending history) a new account is limited to **250 different people per 24 hours**; the next steps are 2,000, 10,000 and 100,000.

### 8f. What WhatsApp costs, and how the product keeps it down
Meta charges per delivered template message. Reported India rates in 2026: about **₹0.115 for Utility and ₹0.86 for Marketing** per message **(confirm on Meta's rate card; I could not read the official figures)**. Messages you send as a normal reply within 24 hours of the customer writing to you are much cheaper or free within a monthly allowance **(confirm)**.

| Plan | WhatsApp messages a day | Worst case a month if Marketing | If Utility |
|---|---|---|---|
| Starter ₹99 | 1 summary | about ₹26 | about ₹3.50 |
| Plus ₹199 | 1 summary | about ₹26 | about ₹3.50 |
| Pro ₹299 | 1 summary + up to 5 instant | about ₹155 | about ₹21 |

How the code limits cost: one short template for the morning summary (never one per job), Pro instant WhatsApp capped at `WHATSAPP_INSTANT_MAX_PER_DAY` (5) and never more than the user's daily limit, nothing sent when there is no match scoring 6 or more, and the "Reply MORE" button so the full list goes out as a cheap reply message. Email, Telegram (free) and the dashboard cost almost nothing.

Do **not** use unofficial WhatsApp tools (anything that scans a QR code and automates WhatsApp Web) for customers. It breaks WhatsApp's terms and numbers get banned permanently.

---

### 8g. Telegram bot (free, about 10 minutes)
Telegram costs nothing per message, so it is the cheap instant channel for every plan. Nothing else needs buying.
1. In Telegram, open **@BotFather**, send `/newbot`, and choose a display name and a username that ends in `bot`. BotFather replies with a **token** (it looks like `123456:ABC...`). Keep it private.
2. On the server, edit `/srv/hirely/api/.env` and set the three values (see section 3b for how to edit the file):
   ```
   TELEGRAM_BOT_TOKEN=(the token from BotFather)
   TELEGRAM_BOT_USERNAME=(the bot's username, without the @)
   TELEGRAM_WEBHOOK_SECRET=(random, 16 or more letters, digits, _ or -)
   ```
   For the secret, run `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` and paste the output.
3. Restart the app: `sudo systemctl restart hirely-api`. The log should show `telegram: webhook set to https://your-domain/api/webhooks/telegram`. If it says it could not set the webhook, check that `APP_URL` is your public HTTPS address.
4. Test: sign in, open **Settings**, tap **Connect Telegram**, and press **Start** in the chat that opens. The page changes to "Connected". Then ask someone to match a job, or wait for the next match, and check the alert arrives.

If `TELEGRAM_BOT_TOKEN` is empty, Telegram is switched off everywhere and the site hides it. Connecting uses a link that expires after 30 minutes. A user who blocks the bot is disconnected automatically.

## 9. AI: smarter scores and the Pro tailored resume (15 minutes)

1. Create an account at https://console.anthropic.com, add a small prepaid balance (about $5 to start), create an API key.
2. In `.env` set `ANTHROPIC_API_KEY=`. Leave `LLM_MODEL=claude-haiku-5-5` (the cheapest current model). Restart.
3. What turns on: resume reading at sign-up becomes much more accurate, the best matches get a one-line "why this fits you", and Pro users get the **Tailor my resume** button (up to 5 a day each).
4. Cost is small: a tailored resume is roughly ₹0.10 to ₹0.20 and a score check is a fraction of a paisa **(estimate from the published price per token; watch the console for a week)**. Set a monthly spend limit in the Anthropic console.
5. The tailoring instructions forbid inventing experience and the page tells the user to check every line. Keep it that way; a fabricated resume is the fastest route to a furious customer.
6. Your privacy policy already says resume text is sent to Anthropic for this. If you change provider, change that sentence.

**Until this key is set, do not sell Pro.** The Pro card promises tailored resumes. Either add the key first, or hide Pro by removing it from `PLAN_ORDER` in `api/src/plans.ts`.

---

## 10. Legal checklist before you take real money

- [ ] Employment contract checked (section 2a)
- [ ] `BUSINESS_NAME`, `CONTACT_EMAIL`, `BUSINESS_ADDRESS`, `GRIEVANCE_NAME` filled in, and all four policy pages read by you
- [ ] A lawyer or CA has read the Terms, Privacy and Refund pages once. They are careful plain-language drafts, not a lawyer's work
- [ ] Refund and cancellation rules visible before payment (already on the plans page with a tick box; do not remove it)
- [ ] You answer complaints within 48 hours and settle them within a month (Consumer Protection (E-Commerce) Rules, 2020). You are the grievance officer
- [ ] Data protection (Digital Personal Data Protection Act, 2023; Rules notified November 2025, with most duties applying from about May 2027 **(confirm)**). Already built: consent tick box and timestamp for WhatsApp, account deletion that erases everything, resume file never stored (text only), a privacy notice listing every company that touches the data. Your duties: keep the server patched, do not share the database with anyone, tell users and the Data Protection Board if there is a breach
- [ ] Job sources: only public company career feeds and licensed APIs are used. Connectors for three remote-job feeds (Remotive, Jobicy, Himalayas) exist but are switched off: Remotive's API terms forbid showing its listings to collect sign-ups, and the other two are unchecked. Do not add them in `/admin` without reading their terms and getting permission. Never add scraping of LinkedIn, Naukri or Indeed; their terms forbid it. Adzuna's terms checked (step 6)
- [ ] Never promise a job or a number of matches in an Instagram post. Say what the product does: "only the jobs that fit you, scored 1 to 10". Influencer posts must be marked as paid partnerships (ASCI influencer guidelines)
- [ ] About "we make no profit": the note on the landing page is true only while it is true. If margins improve, soften or remove it. Voluntary support through UPI (set `SUPPORT_UPI=yourupi@bank`) is ordinary income; declare it

---

## 11. Money: what each customer costs you

Rough monthly cost per Starter customer: Razorpay about ₹2.40, WhatsApp ₹3.50 to ₹26, email and AI under ₹1. So ₹99 leaves roughly ₹70 to ₹92 before fixed costs.

Fixed monthly costs: server (below), domain (about ₹70 a month averaged), email (free tier at first), Meta (pay as you go), Anthropic (pay as you go), CA (about ₹5,000 to ₹15,000 a year once you need one).

So the business breaks even at a few dozen customers, and the "no profit" line is too pessimistic unless Meta classes your alerts as Marketing and most customers are on Starter. Watch `/admin` monthly: money collected against Meta, Razorpay, server and AI bills.

### Server: when to upgrade
Your server has 1 GB of memory and already runs Signal Hub, Prop Desk and another Node app. Hirely adds PostgreSQL and its own process and is capped at 320 MB so it cannot starve the others. It runs, but with little room.

| Stage | Server (Google Cloud) | Memory | Rough price |
|---|---|---|---|
| Now, testing, first 50 users | current | 1 GB | what you pay now |
| **Before influencer posts** | e2-small | 2 GB | about $12 to $14 a month **(confirm)** |
| 500+ users, or Adzuna on with many roles | e2-medium | 4 GB | about $25 a month **(confirm)** |
| 5,000+ users | separate database server | 8 GB+ | decide then |

To resize: Google Cloud console → Compute Engine → stop the VM → Edit → Machine type → Save → Start. About 5 minutes of downtime for everything on the server. With a **static** IP (step 4.7) nothing else changes. After moving to 2 GB or more, raise the limits: in `/etc/systemd/system/hirely-api.service` change `MemoryMax=320M` to `800M` and `--max-old-space-size=220` to `600`; in `/etc/postgresql/15/main/conf.d/hirely-small.conf` set `shared_buffers = 128MB`; then `sudo systemctl daemon-reload && sudo systemctl restart postgresql hirely-api`.

A bursty Instagram launch on the 1 GB server is a risk I would not take. Upgrade first.

---

## 12. Running it day to day (the manual)

### Where everything is
| Thing | Place |
|---|---|
| Code on your PC | this folder. `api/` server, `web/` website, `deploy/` server scripts, `docs/` guides |
| Live app | `/srv/hirely/` on the server |
| Settings and secrets | `/srv/hirely/api/.env` (server only, never in git) |
| Database | PostgreSQL, database `hirely`, on the same server |
| Backups | `/var/backups/hirely/`, nightly at 02:40, kept 14 days |
| Web server config | `/etc/nginx/sites-available/hirely` |
| Service | `hirely-api` (systemd) |

### Everyday commands (on the server)
```
sudo systemctl status hirely-api            # is it running?
sudo systemctl restart hirely-api           # after any .env change
sudo journalctl -u hirely-api -n 100 --no-pager   # recent log
sudo journalctl -u hirely-api -f            # live log, Ctrl+C to stop
free -m                                     # memory
df -h /                                     # disk
```

### Publishing a code change (on your PC, in Git Bash, from this folder)
```
bash deploy/push.sh
```
It runs the tests, builds both parts, uploads them, installs, restarts and checks health. If a test fails it stops and nothing is changed on the server.

### Running it on your PC to try a change
Two terminals:
```
cd api
npm install
npm run dev
```
```
cd web
npm install
npm run dev
```
Open http://localhost:5173. On your PC, sign-in codes are printed in the first terminal instead of being emailed, and payments are simulated (`api/.env` has `ALLOW_MOCK_PAYMENTS=true`). Run `npm test` inside `api/` before every push.

### The admin page (`/admin`)
- Top row: users, paying users by plan, money this month, open jobs, matches and alerts in the last 24 hours, failed alerts.
- **Switches** row: shows which of payments, Google, email, WhatsApp, AI and Adzuna are on.
- **Job sources:** every career board being watched, how many India jobs it holds, and any error. Add a company: pick the type and type the board name. To find a board name, open the company's careers page and look at the address of a job, for example `boards.greenhouse.io/razorpay/...` (type `greenhouse`, name `razorpay`), `jobs.lever.co/paytm/...` (type `lever`, name `paytm`), `jobs.ashbyhq.com/tekion/...` (type `ashby`, name `tekion`), `jobs.smartrecruiters.com/Swiggy/...` (type `smartrecruiters`, name `swiggy`). A source that fails 30 times in a row switches itself off.
- **Users:** who signed up, their plan, roles, and who has reported getting a job.

**Add more companies every week.** Fifty-eight boards is a start, not a business. Each one takes a minute.

### Changing prices or plan limits
Edit `api/src/plans.ts` (prices are in paise: 9900 is ₹99), create matching new plans in Razorpay (a Razorpay plan's price cannot be edited), put the new plan IDs in `.env`, run `bash deploy/push.sh`. Existing subscribers stay on their old price until they cancel. Email them 15 days before any increase, as the Terms promise.

### Changing alert times, number of alerts, or the score threshold
`api/src/plans.ts`: `DIGEST_TIME_IST_MIN` (the morning summary time, 540 = 09:00 India time), `NOTIFY_MIN_SCORE` (instant alerts, 6), `TAILOR_MIN_SCORE` (Pro resumes, 7), `ALERTS_PER_DAY_MIN` / `ALERTS_PER_DAY_MAX` / `ALERTS_PER_DAY_DEFAULT` (the daily limit, 1 to 10, default 5), `WHATSAPP_INSTANT_MAX_PER_DAY` (Pro WhatsApp, 5). Each WhatsApp message costs money, so raise that last one only on purpose.

### Refunding one of the allowed cases
Razorpay dashboard → Payments → find the payment ID (the customer sees it in Settings) → Refund. Then stop their renewal if it is still on: Subscriptions → find it → Cancel.

### Looking at the database
```
sudo -u postgres psql hirely
```
Useful: `\dt` (tables), `select email, created_at from users order by created_at desc limit 20;`, `select plan, status, current_period_end from subscriptions order by created_at desc limit 20;`, `\q` to quit. Table meanings are in `docs/DATABASE.md`.

### Restoring a backup
```
ls -lh /var/backups/hirely/
sudo systemctl stop hirely-api
sudo -u postgres dropdb hirely && sudo -u postgres createdb -O hirely hirely
gunzip -c /var/backups/hirely/hirely-DATE.sql.gz | sudo -u postgres psql hirely
sudo systemctl start hirely-api
```
Practise this once on a quiet day. Also copy a backup to your PC or Google Drive weekly; a backup on the same disk does not survive losing the server:
```
scp -i C:\Users\Vicke\.ssh\ssh-key.key ubuntu@35.226.195.159:/var/backups/hirely/hirely-DATE.sql.gz .
```

### Weekly routine (20 minutes)
1. `/admin`: any failed alerts or failing sources? Fix or switch off.
2. Add 5 to 10 new company boards.
3. Reply to every support email.
4. `free -m` and `df -h /` on the server.
5. Copy one backup off the server.
6. `sudo apt update && sudo apt upgrade -y` monthly, at a quiet hour.

### Free monitoring
Create a free monitor at uptimerobot.com for `https://yourdomain.in/api/health` so you get an email when the site is down.

---

## 13. Launch checklist (in this order)

1. [ ] Employment contract checked
2. [ ] Name checked, domain bought and pointed, HTTPS working on it
3. [ ] Google sign-in published; email sign-in delivering
4. [ ] Adzuna on; one week of watching `/admin` job counts for your audience's roles and cities
5. [ ] Udyam certificate; Razorpay live; one real ₹99 payment made and its renewal stopped by you
6. [ ] WhatsApp number registered, template approved, a real alert received on your phone, STOP tested
7. [ ] Anthropic key in, or Pro hidden
8. [ ] Policy pages read and corrected; business details filled; `ALLOW_MOCK_PAYMENTS=false`
9. [ ] Server upgraded to 2 GB; static IP reserved; uptime monitor on; one backup restored as a drill
10. [ ] **Ten friends go through the whole journey for real** and tell you what confused them. Fix that first
11. [ ] Then one influencer, one post. Watch for two days. Then the rest

---

## 14. When something goes wrong

| What you see | Look here |
|---|---|
| Site does not load | `sudo systemctl status nginx hirely-api`; `sudo nginx -t`; is the server out of memory (`free -m`)? |
| "Sign-in is not switched on yet" | `GOOGLE_CLIENT_ID` or `SMTP_*` empty in `.env`, or not restarted |
| Google button shows an error popup | The site address is missing from Authorised JavaScript origins, or the consent screen is still in Testing |
| App will not start after an `.env` edit | `sudo journalctl -u hirely-api -n 30 --no-pager` prints "Config error" with the exact line that is wrong |
| Payment made but plan not active | Razorpay dashboard → Webhooks → recent deliveries. A 400 means the webhook secret in `.env` differs from the one in Razorpay. Fix it and press Resend |
| Checkout says the payment service did not respond | Wrong key or plan ID, or test keys mixed with live plan IDs. The log shows Razorpay's message |
| WhatsApp alerts not arriving | `/admin` failed count, then `sudo -u postgres psql hirely -c "select created_at, error from notifications where status='failed' order by created_at desc limit 10;"`. Usual causes: template name or language differs from `.env`, template not approved, no payment method in Meta, the user has not opted in, the 250-a-day limit |
| Meta will not save the webhook | The verify token differs, or the site is not reachable over HTTPS |
| No matches for a user | Their role wording. "Sales Executive" matches titles containing those words; "Sales" alone matches little. Check `/admin` job counts; add sources; turn on Adzuna |
| A job source keeps failing | The company changed hiring system. Switch it off in `/admin` and add the new board |
| Server slow or apps restarting | Memory. Upgrade (section 11) |

For a code problem you cannot solve, the places to read are short: `api/src/billing.ts` (payments), `api/src/notify.ts` (alerts and WhatsApp), `api/src/pipeline.ts` (the minute-by-minute worker), `api/src/match.ts` (scoring), `api/src/sources.ts` (job feeds). Each file starts with a plain explanation of what it does.

---

## 15. Decisions I made for you, and how to reverse them

| Decision | Why | To change it |
|---|---|---|
| "No refund + stop renewal any time" instead of "cannot cancel" | Section 2b | Policy text in `web/src/pages/Legal.tsx`. I advise against tightening it |
| One WhatsApp summary a day at 09:00, and instant alerts capped by a daily limit the user sets (1 to 10, default 5) | WhatsApp cost and Meta's per-user limits on business messages. Each job counts once across channels | `api/src/plans.ts`, `api/src/notify.ts` |
| Each source checked every 20 minutes or so, not every minute | Company boards rarely change within minutes, and hammering them is abusive and gets you blocked. The worker still wakes every minute and rotates through sources | `interval_min` on each row of the `sources` table |
| Only India jobs stored | Your customers are in India; it keeps the small server light | `isInIndia` in `api/src/sources.ts` |
| Rules-based scoring first, AI as an optional second opinion | Works with no AI bill, and every score has reasons you can explain to a customer | `api/src/match.ts` |
| Pro tailored resume written for strong matches (7+), up to 5 a day, sent as a Word file | Each one is a paid AI call, so the daily cap keeps the cost known | `tailorPerDay` in `api/src/plans.ts`, `tailorStrong` in `api/src/pipeline.ts` |
| Upgrade replaces the old plan at once, no credit for unused days | UPI Autopay subscriptions cannot be switched in place; shown clearly before payment | `api/src/billing.ts` |
| Resume file is not kept, only its text | Less personal data to protect | `api/src/resume.ts` |
| PostgreSQL kept (tuned small), cheapest AI model as default | Your existing code and tests already used PostgreSQL; cost | `deploy/setup-server.sh`, `LLM_MODEL` in `.env` |

Background reading in this folder: `BUSINESS_SETUP.md` (longer notes on each registration), `GOOGLE_LOGIN.md`, `DATABASE.md`, `DECISIONS.md`, `DEVLOG.md`.
