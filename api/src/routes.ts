import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import type { Billing, SubRow } from "./billing.js";
import type { Llm } from "./llm.js";
import type { Notifier } from "./notify.js";
import type { Pipeline } from "./pipeline.js";
import { clampAlertsPerDay, isPlanId, PLAN_ORDER, PLANS, STORE_MIN_SCORE } from "./plans.js";
import { buildResumeDocx, resumeFileName } from "./resume-docx.js";
import { extractResumeText, guessFromResume, MAX_RESUME_BYTES } from "./resume.js";
import { SOURCE_KINDS } from "./sources.js";
import { CITIES, DOMAINS } from "./taxonomy.js";
import type { User } from "./store.js";

export type ProductDeps = { cfg: Config; db: Db; billing: Billing; notifier: Notifier; pipeline: Pipeline; llm: Llm | null; emailLogin: boolean };
type Authed = Request & { user: User & { isAdmin: boolean } };
type Guards = { requireUser: RequestHandler; originGuard: RequestHandler; limiter: RequestHandler };

const strList = (v: unknown, max: number, maxLen = 60): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 0 && s.length <= maxLen))].slice(0, max) : [];

/** Accepts 98765 43210, +91 98765 43210, 0919876543210. Returns 919876543210 or null. */
export function normalisePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let d = v.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 && /^[6-9]/.test(d)) d = "91" + d;
  return /^91[6-9]\d{9}$/.test(d) ? d : null;
}

const subView = (s: SubRow | undefined) => s && {
  plan: s.plan, planName: PLANS[s.plan].name, status: s.status, provider: s.provider,
  autoRenews: s.provider === "razorpay_subscription" && !s.cancel_at_period_end,
  cancelAtPeriodEnd: s.cancel_at_period_end, periodStart: s.current_period_start, periodEnd: s.current_period_end,
};

export function mountProduct(app: Express, deps: ProductDeps, g: Guards) {
  const { cfg, db, billing, notifier, pipeline, llm } = deps;
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params))[0];
  const U = (req: Request) => (req as Authed).user;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RESUME_BYTES, files: 1 } });
  const requireAdmin: RequestHandler = (req, res, next) => { if (U(req).isAdmin) next(); else res.status(403).json({ error: "forbidden" }); };
  const write = [g.originGuard, g.requireUser];

  const PROFILE_COLS = `phone, whatsapp_opt_in as "whatsappOptIn", email_instant as "emailInstant", email_digest as "emailDigest", max_alerts_per_day as "maxAlertsPerDay",
    telegram_chat_id is not null as "telegramConnected", telegram_alerts as "telegramAlerts", headline, domain, roles, skills, locations, remote_ok as "remoteOk",
    experience_years::float8 as "experienceYears", resume_filename as "resumeFilename", resume_uploaded_at as "resumeUploadedAt", (length(resume_text) > 0) as "hasResume",
    alerts_paused as "alertsPaused", got_job_at as "gotJobAt", onboarded_at as "onboardedAt"`;
  const ensureProfile = (userId: string) => db.query("insert into profiles (user_id) values ($1) on conflict do nothing", [userId]);

  // ---------- Public ----------
  let statsCache: { at: number; jobs: number; companies: number; sources: number } | undefined;
  app.get("/api/public/config", async (_req, res) => {
    if (!statsCache || Date.now() - statsCache.at > 300_000) {
      const s = await one<{ jobs: string; companies: string; sources: string }>(
        "select (select count(*) from jobs where active)::text as jobs, (select count(distinct company) from jobs where active)::text as companies, (select count(*) from sources where enabled)::text as sources");
      statsCache = { at: Date.now(), jobs: Number(s?.jobs ?? 0), companies: Number(s?.companies ?? 0), sources: Number(s?.sources ?? 0) };
    }
    res.json({
      plans: PLAN_ORDER.map((id) => PLANS[id]),
      billingMode: cfg.billingMode,
      googleClientId: cfg.googleClientId,
      emailLogin: deps.emailLogin,
      whatsapp: notifier.whatsappEnabled,
      telegram: { enabled: notifier.telegram.enabled, botUsername: notifier.telegram.botUsername },
      ai: !!llm,
      business: cfg.business,
      domains: DOMAINS, cities: CITIES,
      stats: { jobs: statsCache.jobs, companies: statsCache.companies, sources: statsCache.sources },
    });
  });

  // ---------- Account state ----------
  app.get("/api/account", g.requireUser, async (req, res) => {
    const u = U(req);
    await ensureProfile(u.id);
    const [profile, sub, counts] = await Promise.all([
      one(`select ${PROFILE_COLS} from profiles where user_id = $1`, [u.id]),
      billing.live(u.id),
      one<{ total: string; today: string; best: number | null }>("select count(*)::text as total, count(*) filter (where created_at > now() - interval '24 hours')::text as today, max(score) as best from matches where user_id = $1 and status = 'new'", [u.id]),
    ]);
    res.json({ user: u, profile, subscription: subView(sub) ?? null, matches: { total: Number(counts?.total ?? 0), today: Number(counts?.today ?? 0), best: counts?.best ?? null } });
  });

  app.put("/api/profile", ...write, async (req, res) => {
    const u = U(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const roles = strList(b.roles, 5), skills = strList(b.skills, 40), locations = strList(b.locations, 8);
    const years = Number(b.experienceYears);
    const phone = b.phone ? normalisePhone(b.phone) : null;
    if (b.phone && !phone) { res.status(400).json({ error: "invalid_phone" }); return; }
    if (!roles.length) { res.status(400).json({ error: "roles_required" }); return; }
    if (!Number.isFinite(years) || years < 0 || years > 50) { res.status(400).json({ error: "invalid_experience" }); return; }
    const optIn = b.whatsappOptIn === true && !!phone;
    await ensureProfile(u.id);
    await db.query(
      `update profiles set phone = $2, whatsapp_opt_in = $3, opt_in_at = case when $3 and not whatsapp_opt_in then now() when $3 then opt_in_at else null end,
         headline = $4, domain = $5, roles = $6, skills = $7, locations = $8, remote_ok = $9, experience_years = $10,
         onboarded_at = coalesce(onboarded_at, now()), updated_at = now() where user_id = $1`,
      [u.id, phone, optIn, String(b.headline ?? "").slice(0, 120), String(b.domain ?? "").slice(0, 60), roles, skills, locations, b.remoteOk !== false, years]);
    if (typeof b.name === "string" && b.name.trim().length >= 2) await db.query("update users set name = $2 where id = $1", [u.id, b.name.trim().slice(0, 80)]);
    if (b.maxAlertsPerDay !== undefined) await db.query("update profiles set max_alerts_per_day = $2 where user_id = $1", [u.id, clampAlertsPerDay(b.maxAlertsPerDay)]);
    // A changed profile makes old unsent matches stale: drop them and score again.
    await db.query("delete from matches where user_id = $1 and notified_at is null and status = 'new'", [u.id]);
    void pipeline.backfillUser(u.id).catch((e) => console.error("backfill failed:", e));
    res.json({ profile: await one(`select ${PROFILE_COLS} from profiles where user_id = $1`, [u.id]) });
  });

  app.post("/api/profile/resume", ...write, g.limiter, upload.single("file"), async (req, res) => {
    const u = U(req);
    const f = (req as Request & { file?: Express.Multer.File }).file;
    if (!f) { res.status(400).json({ error: "no_file" }); return; }
    let text: string;
    try { text = await extractResumeText(f.buffer, f.originalname); }
    catch (e) { res.status(400).json({ error: ["unsupported_file", "empty_resume"].includes((e as Error).message) ? (e as Error).message : "unreadable_file" }); return; }
    await ensureProfile(u.id);
    await db.query("update profiles set resume_text = $2, resume_filename = $3, resume_uploaded_at = now(), updated_at = now() where user_id = $1", [u.id, text, f.originalname.slice(0, 120)]);
    const guess = (llm && (await llm.readResume(text))) || guessFromResume(text);
    res.json({ guess, usedAi: !!llm, chars: text.length });
  });

  app.delete("/api/profile/resume", ...write, async (req, res) => {
    await db.query("update profiles set resume_text = '', resume_filename = null, resume_uploaded_at = null where user_id = $1", [U(req).id]);
    await db.query("delete from tailored_resumes where user_id = $1", [U(req).id]);
    res.status(204).end();
  });

  /** Settings switches and the daily limit. The limit is clamped to 1..10 on the server. */
  app.patch("/api/account/alerts", ...write, async (req, res) => {
    const b = (req.body ?? {}) as { paused?: unknown; whatsappOptIn?: unknown; emailInstant?: unknown; emailDigest?: unknown; telegramAlerts?: unknown; maxAlertsPerDay?: unknown };
    const u = U(req);
    await ensureProfile(u.id);
    if (typeof b.paused === "boolean") await db.query("update profiles set alerts_paused = $2 where user_id = $1", [u.id, b.paused]);
    if (typeof b.emailInstant === "boolean") await db.query("update profiles set email_instant = $2 where user_id = $1", [u.id, b.emailInstant]);
    if (typeof b.emailDigest === "boolean") await db.query("update profiles set email_digest = $2 where user_id = $1", [u.id, b.emailDigest]);
    if (typeof b.telegramAlerts === "boolean") await db.query("update profiles set telegram_alerts = $2 where user_id = $1", [u.id, b.telegramAlerts]);
    if (b.maxAlertsPerDay !== undefined) await db.query("update profiles set max_alerts_per_day = $2 where user_id = $1", [u.id, clampAlertsPerDay(b.maxAlertsPerDay)]);
    if (typeof b.whatsappOptIn === "boolean") await db.query("update profiles set whatsapp_opt_in = ($2 and phone is not null), opt_in_at = case when $2 and phone is not null then coalesce(opt_in_at, now()) else null end where user_id = $1", [u.id, b.whatsappOptIn]);
    res.json({ profile: await one(`select ${PROFILE_COLS} from profiles where user_id = $1`, [u.id]) });
  });

  /** "I got a job": stops renewal and alerts. Nothing is refunded and nothing more is charged. */
  app.post("/api/account/got-job", ...write, async (req, res) => {
    const u = U(req);
    await ensureProfile(u.id);
    await db.query("update profiles set got_job_at = now(), alerts_paused = true where user_id = $1", [u.id]);
    let sub: SubRow | null | undefined;
    try { sub = await billing.cancel(u.id, "got_job"); }
    catch (e) { console.error("cancel on got-job failed:", e); res.status(502).json({ error: "cancel_failed" }); return; }
    res.json({ subscription: subView(sub ?? undefined) ?? null });
  });
  app.post("/api/account/looking-again", ...write, async (req, res) => {
    await db.query("update profiles set got_job_at = null, alerts_paused = false where user_id = $1", [U(req).id]);
    res.status(204).end();
  });

  /** Telegram: a one-time link (30 minutes). The user opens it, presses Start, and the webhook stores their chat. */
  app.post("/api/account/telegram/link", ...write, g.limiter, async (req, res) => {
    if (!notifier.telegram.enabled) { res.status(503).json({ error: "telegram_disabled" }); return; }
    await ensureProfile(U(req).id);
    res.json(await notifier.telegram.createLink(U(req).id));
  });
  app.post("/api/account/telegram/disconnect", ...write, async (req, res) => {
    await ensureProfile(U(req).id);
    await notifier.telegram.disconnect(U(req).id);
    res.json({ profile: await one(`select ${PROFILE_COLS} from profiles where user_id = $1`, [U(req).id]) });
  });

  /** Deletes the account and everything stored about the person (DPDP: right to erasure). */
  app.delete("/api/account", ...write, async (req, res) => {
    const u = U(req);
    try { await billing.cancel(u.id, "account_deleted"); } catch (e) { console.error("cancel on delete failed:", e); res.status(502).json({ error: "cancel_failed" }); return; }
    await db.query("delete from users where id = $1", [u.id]); // cascades to profile, matches, payments, notifications
    res.clearCookie("hirely_session", { path: "/" });
    res.status(204).end();
  });

  // ---------- Matches ----------
  const MATCH_SELECT = `select m.id, m.score, m.reasons, nullif(m.why, '') as why, m.status, m.feedback, m.created_at as "createdAt",
      j.title, j.company, j.location, j.remote, j.url, j.salary, j.posted_at as "postedAt", j.active,
      exists (select 1 from tailored_resumes t where t.match_id = m.id) as tailored
    from matches m join jobs j on j.id = m.job_id`;

  app.get("/api/matches", g.requireUser, async (req, res) => {
    const u = U(req);
    const status = ["new", "applied", "dismissed"].includes(String(req.query.status)) ? String(req.query.status) : "new";
    const rows = await db.query(`${MATCH_SELECT} where m.user_id = $1 and m.status = $2 order by date_trunc('day', m.created_at) desc, m.score desc, m.created_at desc limit 100`, [u.id, status]);
    res.json({ matches: rows, subscribed: !!(await billing.live(u.id)) });
  });

  /** Before paying: how many current jobs fit this profile, with a few examples. Nothing is saved. */
  app.get("/api/matches/preview", g.requireUser, async (req, res) => {
    const p = await one<{ roles: string[]; skills: string[]; locations: string[]; remote_ok: boolean; experience_years: number }>(
      "select roles, skills, locations, remote_ok, experience_years::float8 as experience_years from profiles where user_id = $1 and onboarded_at is not null", [U(req).id]);
    if (!p) { res.json({ count: 0, strong: 0, examples: [] }); return; }
    const found = await pipeline.backfillUser(U(req).id, { save: false, profile: { roles: p.roles, skills: p.skills, locations: p.locations, remoteOk: p.remote_ok, experienceYears: Number(p.experience_years) } });
    res.json({ count: found.length, strong: found.filter((f) => f.score >= 7).length, examples: found.slice(0, 4).map((f) => ({ title: f.title, company: f.company, location: f.location, score: f.score, reasons: f.reasons })) });
  });

  app.patch("/api/matches/:id", ...write, async (req, res) => {
    const b = (req.body ?? {}) as { status?: unknown; feedback?: unknown };
    const status = ["new", "applied", "dismissed"].includes(String(b.status)) ? String(b.status) : null;
    const feedback = ["good", "bad"].includes(String(b.feedback)) ? String(b.feedback) : null;
    const row = await one("update matches set status = coalesce($3, status), feedback = coalesce($4, feedback) where id = $1 and user_id = $2 returning id", [req.params.id, U(req).id, status, feedback]);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }
    res.json({ ok: true });
  });

  app.get("/api/matches/:id/tailor", g.requireUser, async (req, res) => {
    const row = await one<{ content: string; created_at: Date; title: string; company: string; url: string }>(
      `select t.content, t.created_at, j.title, j.company, j.url from tailored_resumes t join matches m on m.id = t.match_id join jobs j on j.id = m.job_id where t.match_id = $1 and t.user_id = $2`, [req.params.id, U(req).id]);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }
    res.json({ content: row.content, createdAt: row.created_at, title: row.title, company: row.company, url: row.url });
  });

  /** The tailored resume as a Word file. Only the owner of the match can download it. */
  app.get("/api/matches/:id/tailor.docx", g.requireUser, async (req, res) => {
    const matchId = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/i.test(matchId)) { res.status(404).json({ error: "not_found" }); return; }
    const row = await one<{ content: string; title: string; company: string }>(
      "select t.content, j.title, j.company from tailored_resumes t join matches m on m.id = t.match_id join jobs j on j.id = m.job_id where t.match_id = $1 and t.user_id = $2",
      [matchId, U(req).id]);
    if (!row) { res.status(404).json({ error: "not_found" }); return; }
    const file = await buildResumeDocx(row.content);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${resumeFileName(row.company, row.title)}"`);
    res.send(file);
  });

  /** Pro plan: writes a resume aimed at this one job, from the user's own resume only. */
  app.post("/api/matches/:id/tailor", ...write, async (req, res) => {
    const u = U(req);
    const sub = await billing.live(u.id);
    if (!sub || !PLANS[sub.plan].tailoredResume) { res.status(402).json({ error: "pro_required" }); return; }
    if (!llm) { res.status(503).json({ error: "ai_not_configured" }); return; }
    const existing = await one<{ content: string }>("select content from tailored_resumes where match_id = $1 and user_id = $2", [req.params.id, u.id]);
    if (existing) { res.json({ content: existing.content }); return; }
    const m = await one<{ title: string; company: string; description: string; resume_text: string }>(
      "select j.title, j.company, j.description, p.resume_text from matches m join jobs j on j.id = m.job_id join profiles p on p.user_id = m.user_id where m.id = $1 and m.user_id = $2", [req.params.id, u.id]);
    if (!m) { res.status(404).json({ error: "not_found" }); return; }
    if (m.resume_text.length < 80) { res.status(400).json({ error: "resume_required" }); return; }
    const used = await one<{ n: string }>("select count(*)::text as n from tailored_resumes where user_id = $1 and created_at > now() - interval '24 hours'", [u.id]);
    if (Number(used?.n ?? 0) >= PLANS[sub.plan].tailorPerDay) { res.status(429).json({ error: "daily_limit", limit: PLANS[sub.plan].tailorPerDay }); return; }
    let content: string;
    try { content = await llm.tailorResume({ resume: m.resume_text, jobTitle: m.title, company: m.company, jobDescription: m.description }); }
    catch (e) { console.error("tailor failed:", (e as Error).message); res.status(502).json({ error: "tailor_failed" }); return; }
    await db.query("insert into tailored_resumes (user_id, match_id, content) values ($1,$2,$3) on conflict (match_id) do nothing", [u.id, req.params.id, content]);
    res.json({ content });
  });

  // ---------- Billing ----------
  app.get("/api/billing", g.requireUser, async (req, res) => {
    const u = U(req);
    const [sub, history, payments] = await Promise.all([billing.live(u.id), billing.history(u.id), billing.payments(u.id)]);
    res.json({
      mode: cfg.billingMode, subscription: subView(sub) ?? null,
      history: history.map((h) => subView(h)),
      payments: payments.map((p) => ({ id: p.provider_payment_id, amountPaise: p.amount_paise, status: p.status, at: p.created_at })),
    });
  });

  app.post("/api/billing/checkout", ...write, g.limiter, async (req, res) => {
    const plan = (req.body as { plan?: unknown })?.plan;
    if (!isPlanId(plan)) { res.status(400).json({ error: "invalid_plan" }); return; }
    try {
      res.json({ ...(await billing.startCheckout(U(req), plan)), prefill: { name: U(req).name, email: U(req).email } });
    } catch (e) {
      const msg = (e as Error).message;
      if (["billing_off", "already_subscribed", "downgrade_at_period_end"].includes(msg)) { res.status(409).json({ error: msg }); return; }
      console.error("checkout failed:", msg);
      res.status(502).json({ error: "payment_provider_error" });
    }
  });

  app.post("/api/billing/confirm", ...write, async (req, res) => {
    try {
      const sub = await billing.confirmCheckout(U(req).id, (req.body ?? {}) as Record<string, string>);
      if (!sub) { res.status(404).json({ error: "not_found" }); return; }
      void pipeline.backfillUser(U(req).id).catch((e) => console.error("backfill failed:", e));
      void notifier.welcome(U(req).id).catch(() => {});
      res.json({ subscription: subView(sub) });
    } catch (e) {
      const msg = (e as Error).message;
      res.status(msg === "not_found" ? 404 : 400).json({ error: ["bad_signature", "bad_request", "not_found"].includes(msg) ? msg : "confirm_failed" });
    }
  });

  app.post("/api/billing/cancel", ...write, async (req, res) => {
    try {
      const sub = await billing.cancel(U(req).id, String((req.body as { reason?: unknown })?.reason ?? "user"));
      res.json({ subscription: subView(sub ?? undefined) ?? null });
    } catch (e) { console.error("cancel failed:", e); res.status(502).json({ error: "cancel_failed" }); }
  });

  // ---------- Webhooks (raw body: signatures are computed over the exact bytes) ----------
  app.post("/api/webhooks/razorpay", async (req, res) => {
    const ok = Buffer.isBuffer(req.body) && (await billing.handleWebhook(req.body, req.get("x-razorpay-signature") ?? "", req.get("x-razorpay-event-id") ?? ""));
    res.status(ok ? 200 : 400).json({ ok });
  });
  // Telegram checks this secret header itself; the handler compares it in constant time and answers 200 when done.
  app.post("/api/webhooks/telegram", async (req, res) => {
    const status = await notifier.telegram.handleWebhook(req.get("x-telegram-bot-api-secret-token"), Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
    res.status(status).end();
  });
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const c = notifier.verifyWebhook(req.query["hub.mode"], req.query["hub.verify_token"], req.query["hub.challenge"]);
    if (c === null) res.status(403).end(); else res.type("text/plain").send(c);
  });
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    const ok = Buffer.isBuffer(req.body) && (await notifier.handleWebhook(req.body, req.get("x-hub-signature-256") ?? ""));
    res.status(ok ? 200 : 403).end();
  });

  // ---------- Admin ----------
  app.get("/api/admin/overview", g.requireUser, requireAdmin, async (_req, res) => {
    const n = async (sql: string) => Number((await one<{ n: string }>(sql))?.n ?? 0);
    const [users, onboarded, active, revenue, jobs, jobs24, matches24, sent24, failed24, byPlan, badSources] = await Promise.all([
      n("select count(*)::text as n from users"),
      n("select count(*)::text as n from profiles where onboarded_at is not null"),
      n("select count(distinct user_id)::text as n from subscriptions where status = 'active' and current_period_end > now()"),
      n("select coalesce(sum(amount_paise),0)::text as n from payments where status = 'captured' and created_at > date_trunc('month', now())"),
      n("select count(*)::text as n from jobs where active"),
      n("select count(*)::text as n from jobs where first_seen_at > now() - interval '24 hours'"),
      n("select count(*)::text as n from matches where created_at > now() - interval '24 hours'"),
      n("select count(*)::text as n from notifications where status = 'sent' and created_at > now() - interval '24 hours'"),
      n("select count(*)::text as n from notifications where status = 'failed' and created_at > now() - interval '24 hours'"),
      db.query("select plan, count(distinct user_id)::int as users from subscriptions where status = 'active' and current_period_end > now() group by plan"),
      db.query("select kind, token, company, fail_count as \"failCount\", last_error as \"lastError\", enabled from sources where fail_count > 0 order by fail_count desc limit 15"),
    ]);
    res.json({ users, onboarded, activeSubscribers: active, revenueThisMonthPaise: revenue, jobs, jobs24, matches24, sent24, failed24, byPlan, badSources,
      config: { billingMode: cfg.billingMode, whatsapp: notifier.whatsappEnabled, ai: !!llm, adzuna: !!cfg.adzuna, google: !!cfg.googleClientId, emailLogin: deps.emailLogin } });
  });

  app.get("/api/admin/sources", g.requireUser, requireAdmin, async (_req, res) => {
    res.json({ kinds: SOURCE_KINDS, sources: await db.query(
      `select s.id, s.kind, s.token, s.company, s.enabled, s.interval_min as "intervalMin", s.last_ok_at as "lastOkAt", s.fail_count as "failCount", s.last_error as "lastError", s.last_count as "lastCount",
         (select count(*)::int from jobs j where j.source_id = s.id and j.active) as jobs from sources s order by s.enabled desc, jobs desc, s.company limit 600`) });
  });
  app.post("/api/admin/sources", ...write, requireAdmin, async (req, res) => {
    const b = (req.body ?? {}) as { kind?: unknown; token?: unknown; company?: unknown };
    const token = String(b.token ?? "").trim();
    if (!SOURCE_KINDS.includes(String(b.kind)) || !/^[\w .&+-]{1,80}$/.test(token)) { res.status(400).json({ error: "bad_request" }); return; }
    const row = await one("insert into sources (kind, token, company) values ($1,$2,$3) on conflict (kind, token) do update set enabled = true, fail_count = 0 returning id", [b.kind, token, String(b.company ?? token).trim().slice(0, 120)]);
    res.json(row);
  });
  app.patch("/api/admin/sources/:id", ...write, requireAdmin, async (req, res) => {
    const enabled = (req.body as { enabled?: unknown })?.enabled === true;
    await db.query("update sources set enabled = $2, fail_count = 0, last_error = null where id = $1", [req.params.id, enabled]);
    res.json({ ok: true });
  });
  app.get("/api/admin/users", g.requireUser, requireAdmin, async (_req, res) => {
    res.json({ users: await db.query(
      `select u.id, u.name, u.email, u.created_at as "createdAt", p.roles, p.got_job_at as "gotJobAt", p.whatsapp_opt_in as "whatsapp",
         (select plan from subscriptions s where s.user_id = u.id and s.status = 'active' and s.current_period_end > now() order by current_period_end desc limit 1) as plan,
         (select count(*)::int from matches m where m.user_id = u.id) as matches
       from users u left join profiles p on p.user_id = u.id order by u.created_at desc limit 300`) });
  });

  // Upload errors (file too large, etc.) arrive here.
  app.use((err: Error & { code?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (err?.code === "LIMIT_FILE_SIZE") { res.status(413).json({ error: "file_too_large" }); return; }
    next(err);
  });
}

export { STORE_MIN_SCORE };
