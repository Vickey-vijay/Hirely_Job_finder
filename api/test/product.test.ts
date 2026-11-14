import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { createBilling } from "../src/billing.js";
import { loadConfig } from "../src/config.js";
import { migrate, type Db } from "../src/db.js";
import { roleFit, scoreMatch } from "../src/match.js";
import { createNotifier, dueSlot } from "../src/notify.js";
import { createPipeline } from "../src/pipeline.js";
import { guessFromResume } from "../src/resume.js";
import { normalisePhone } from "../src/routes.js";
import { htmlToText, isInIndia } from "../src/sources.js";
import { createStore } from "../src/store.js";

const base = { JWT_SECRET: "x".repeat(40), DATABASE_URL: "postgres://u:p@localhost/db", ALLOWED_ORIGINS: "http://localhost:5173", INGEST_ENABLED: "false", GOOGLE_CLIENT_ID: "1.apps.googleusercontent.com" };

async function start(extraEnv: Record<string, string> = {}, fakeFetch?: typeof fetch) {
  const cfg = loadConfig({ ...base, ...extraEnv });
  const pg = new PGlite();
  const db: Db = {
    async query<T>(sql: string, params?: unknown[]) { return (await pg.query<T>(sql, params)).rows as T[]; },
    async exec(sql) { await pg.exec(sql); },
    close: () => pg.close(),
  };
  await migrate(db);
  const mails: { to: string; subject: string }[] = [];
  const mailer = { enabled: true, async sendLoginCode() {}, async send(to: string, subject: string) { mails.push({ to, subject }); } };
  const billing = createBilling(cfg, db, fakeFetch);
  const notifier = createNotifier(cfg, db, mailer, fakeFetch);
  const pipeline = createPipeline(cfg, db, billing, notifier, null);
  const app = createApp({
    cfg, store: createStore(db), mailer, product: { db, billing, notifier, pipeline, llm: null },
    async verifyGoogle() { return { sub: "g-1", email: "asha@example.com", name: "Asha Rao" }; },
  });
  const server = app.listen(0);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = "";
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(url + path, { method, headers: { "Content-Type": "application/json", Cookie: cookie, ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let parsed: any = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }
    return { status: res.status, body: parsed };
  };
  return { cfg, db, call, mails, pipeline, notifier, billing, close: async () => { server.close(); await pg.close(); } };
}
type T = Awaited<ReturnType<typeof start>>;

const signIn = async (t: T) => {
  const r = await t.call("POST", "/api/auth/google", { credential: "valid-credential-0000000000" });
  assert.equal(r.status, 200);
  return r.body.user as { id: string };
};
const PROFILE = { roles: ["Data Analyst"], skills: ["SQL", "Excel", "Power BI"], locations: ["Chennai"], remoteOk: true, experienceYears: 2, phone: "98765 43210", whatsappOptIn: true, headline: "Analyst", domain: "Data & Analytics" };

async function addJob(db: Db, title: string, location = "Chennai, India", description = "We need SQL, Excel and Power BI. 1-3 years experience.") {
  const s = await db.query<{ id: string }>("insert into sources (kind, token, company) values ('greenhouse', 'acme', 'Acme') on conflict (kind, token) do update set company = 'Acme' returning id");
  const j = await db.query<{ id: string }>("insert into jobs (source_id, external_id, company, title, location, in_india, url, description, posted_at) values ($1,$2,'Acme',$3,$4,true,'https://x.test/j',$5, now()) returning id", [s[0].id, title + location, title, location, description]);
  return j[0].id;
}
const afternoonIst = () => { const d = new Date(); d.setUTCHours(10, 0, 0, 0); return d; }; // 15:30 IST, after the 09:30 slot

// ---------- pure logic ----------

test("role fit: same role high, different role low", () => {
  assert.equal(roleFit("Software Engineer", "Senior Software Engineer, Payments"), 1);
  assert.equal(roleFit("Software Engineer", "Software Development Engineer II"), 1);
  assert.ok(roleFit("Software Engineer", "Backend Developer") >= 0.6);
  assert.ok(roleFit("Data Analyst", "Data Engineer") <= 0.25);
  assert.equal(roleFit("Accountant", "Sales Executive"), 0);
  assert.equal(roleFit("Sales Executive", "Inside Sales Executive - Chennai"), 1);
});

test("score: strong match is high, unrelated job is dropped, wrong city is lower", () => {
  const p = { roles: ["Data Analyst"], skills: ["SQL", "Excel", "Power BI"], locations: ["Chennai"], remoteOk: false, experienceYears: 2 };
  const job = { title: "Data Analyst", company: "Acme", location: "Chennai, Tamil Nadu, India", remote: false, inIndia: true, description: "x".repeat(250) + " SQL Excel Power BI dashboards. 1-3 years experience." };
  const strong = scoreMatch(p, job)!;
  assert.ok(strong.score >= 9, `got ${strong.score}`);
  assert.ok(strong.reasons.some((r) => r.includes("Data Analyst")));
  assert.equal(scoreMatch(p, { ...job, title: "Staff Nurse", description: "Patient care in ICU. " + "y".repeat(250) }), null);
  const other = scoreMatch(p, { ...job, location: "Pune, India" })!;
  assert.ok(other.score < strong.score);
  const senior = scoreMatch({ ...p, experienceYears: 0 }, { ...job, title: "Director, Data Analyst", description: "x".repeat(250) + " 12+ years experience" })!;
  assert.ok(senior.score <= 6, `got ${senior.score}`);
  assert.equal(scoreMatch(p, { ...job, inIndia: false }), null);
});

test("helpers: phone, india detection, html, resume guess, digest slots", () => {
  assert.equal(normalisePhone("+91 98765-43210"), "919876543210");
  assert.equal(normalisePhone("12345"), null);
  assert.equal(isInIndia("Bengaluru, Karnataka", false), true);
  assert.equal(isInIndia("Remote (USA only)", true), false);
  assert.equal(isInIndia("Remote (Worldwide)", true), true);
  assert.equal(htmlToText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;li&gt;SQL&lt;/li&gt;"), "Hello & welcome\n- SQL");
  const g = guessFromResume("Asha Rao\nData Analyst with 3 years of experience in Chennai. Skills: SQL, Power BI, Python, Excel.\n" + "more ".repeat(30));
  assert.deepEqual(g.roles, ["Data Analyst"]);
  assert.ok(g.skills.includes("SQL") && g.skills.includes("Power BI"));
  assert.equal(g.experienceYears, 3);
  assert.deepEqual(g.locations, ["Chennai"]);
  // 10:00 IST = 04:30 UTC. Starter has one slot at 09:30 IST.
  const ten = new Date("2026-11-14T04:30:00Z");
  assert.ok(dueSlot("starter", null, ten));
  assert.equal(dueSlot("starter", new Date("2026-11-14T04:10:00Z"), ten), null); // already sent after 09:30
  assert.equal(dueSlot("starter", null, new Date("2026-11-14T03:00:00Z")), null); // 08:30 IST, too early
  assert.ok(dueSlot("plus", new Date("2026-11-14T04:10:00Z"), new Date("2026-11-14T13:30:00Z"))); // evening slot
});

// ---------- flows ----------

test("profile, preview, mock purchase, matches, alerts, got-a-job, delete", async () => {
  const t = await start({ ALLOW_MOCK_PAYMENTS: "true" });
  try {
    assert.equal((await t.call("GET", "/api/account")).status, 401);
    const user = await signIn(t);
    const cfgRes = await t.call("GET", "/api/public/config");
    assert.equal(cfgRes.body.billingMode, "mock");
    assert.equal(cfgRes.body.plans.length, 3);
    assert.equal(cfgRes.body.plans[0].pricePaise, 9900);

    assert.equal((await t.call("PUT", "/api/profile", { ...PROFILE, roles: [] })).status, 400);
    assert.equal((await t.call("PUT", "/api/profile", { ...PROFILE, phone: "123" })).status, 400);
    const saved = await t.call("PUT", "/api/profile", PROFILE);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.profile.phone, "919876543210");
    assert.equal(saved.body.profile.whatsappOptIn, true);

    await addJob(t.db, "Data Analyst");
    await addJob(t.db, "Staff Nurse", "Chennai, India", "Patient care, ICU nursing. " + "z".repeat(220));
    const preview = await t.call("GET", "/api/matches/preview");
    assert.equal(preview.body.count, 1);
    assert.equal(preview.body.examples[0].title, "Data Analyst");
    assert.equal((await t.call("GET", "/api/matches")).body.matches.length, 0); // preview saves nothing

    // buy Starter
    const co = await t.call("POST", "/api/billing/checkout", { plan: "starter" });
    assert.equal(co.body.mode, "mock");
    const done = await t.call("POST", "/api/billing/confirm", { ref: co.body.ref });
    assert.equal(done.body.subscription.plan, "starter");
    assert.equal(done.body.subscription.status, "active");
    await t.pipeline.backfillUser(user.id);
    const list = await t.call("GET", "/api/matches");
    assert.equal(list.body.matches.length, 1);
    assert.ok(list.body.matches[0].score >= 8);
    assert.equal(list.body.subscribed, true);

    // digest goes out once per slot, and marks matches as notified
    const now = afternoonIst();
    assert.equal(await t.notifier.runDigests(now), 1);
    assert.equal(t.mails.filter((m) => m.subject.includes("new job")).length, 1);
    assert.equal(await t.notifier.runDigests(now), 0);

    // tailoring needs Pro
    const mid = list.body.matches[0].id as string;
    assert.equal((await t.call("POST", `/api/matches/${mid}/tailor`)).status, 402);
    assert.equal((await t.call("PATCH", `/api/matches/${mid}`, { status: "applied", feedback: "good" })).status, 200);

    // upgrade to Pro replaces Starter
    const up = await t.call("POST", "/api/billing/checkout", { plan: "pro" });
    await t.call("POST", "/api/billing/confirm", { ref: up.body.ref });
    const bill = await t.call("GET", "/api/billing");
    assert.equal(bill.body.subscription.plan, "pro");
    assert.equal(bill.body.payments.length, 2);
    assert.equal((await t.call("POST", "/api/billing/checkout", { plan: "starter" })).status, 409); // no mid-period downgrade

    // got a job: renewal off, access stays, alerts stop
    const got = await t.call("POST", "/api/account/got-job");
    assert.equal(got.body.subscription.cancelAtPeriodEnd, true);
    assert.equal(got.body.subscription.status, "active");
    await addJob(t.db, "Senior Data Analyst");
    await t.pipeline.backfillUser(user.id);
    assert.equal(await t.notifier.runDigests(new Date(now.getTime() + 86_400_000)), 0);

    // cross-site write is refused; delete removes everything
    assert.equal((await t.call("DELETE", "/api/account", undefined, { Origin: "https://evil.test" })).status, 403);
    assert.equal((await t.call("DELETE", "/api/account")).status, 204);
    assert.equal((await t.db.query("select 1 from profiles")).length, 0);
    assert.equal((await t.db.query("select 1 from matches")).length, 0);
  } finally { await t.close(); }
});

test("razorpay subscription: signature check, webhook renewal, replay, cancel at cycle end", async () => {
  const calls: { url: string; body: any }[] = [];
  const fake = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : null });
    const json = u.endsWith("/subscriptions") ? { id: "sub_TEST1" } : u.endsWith("/subscriptions/sub_TEST1") ? { current_start: 1_800_000_000, current_end: 1_802_592_000 } : {};
    return new Response(JSON.stringify(json), { status: 200 });
  }) as typeof fetch;
  const t = await start({ RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "secret", RAZORPAY_WEBHOOK_SECRET: "whsec", RAZORPAY_PLAN_STARTER: "plan_a", RAZORPAY_PLAN_PLUS: "plan_b", RAZORPAY_PLAN_PRO: "plan_c" }, fake);
  try {
    await signIn(t);
    const co = await t.call("POST", "/api/billing/checkout", { plan: "plus" });
    assert.equal(co.body.mode, "subscription");
    assert.equal(co.body.subscriptionId, "sub_TEST1");
    assert.equal(calls[0].body.plan_id, "plan_b");

    const bad = await t.call("POST", "/api/billing/confirm", { razorpay_payment_id: "pay_1", razorpay_subscription_id: "sub_TEST1", razorpay_signature: "f".repeat(64) });
    assert.equal(bad.status, 400);
    assert.equal((await t.call("GET", "/api/billing")).body.subscription, null);

    const sig = createHmac("sha256", "secret").update("pay_1|sub_TEST1").digest("hex");
    const ok = await t.call("POST", "/api/billing/confirm", { razorpay_payment_id: "pay_1", razorpay_subscription_id: "sub_TEST1", razorpay_signature: sig });
    assert.equal(ok.body.subscription.status, "active");
    assert.equal(ok.body.subscription.autoRenews, true);

    // renewal webhook moves the period on; a replay does nothing; a bad signature is refused
    const body = JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id: "sub_TEST1", current_start: 1_802_592_000, current_end: 1_805_270_400 } }, payment: { entity: { id: "pay_2", amount: 19900 } } } });
    const wsig = createHmac("sha256", "whsec").update(body).digest("hex");
    const hook = (s: string) => t.call("POST", "/api/webhooks/razorpay", body, { "x-razorpay-signature": s, "x-razorpay-event-id": "evt_1" });
    assert.equal((await hook("0".repeat(64))).status, 400);
    assert.equal((await hook(wsig)).status, 200);
    assert.equal((await hook(wsig)).status, 200);
    const bill = await t.call("GET", "/api/billing");
    assert.equal(bill.body.payments.length, 2);
    assert.equal(new Date(bill.body.subscription.periodEnd).getTime(), 1_805_270_400_000);

    const cancel = await t.call("POST", "/api/billing/cancel", { reason: "testing" });
    assert.equal(cancel.body.subscription.cancelAtPeriodEnd, true);
    assert.equal(cancel.body.subscription.status, "active");
    const last = calls[calls.length - 1];
    assert.ok(last.url.endsWith("/subscriptions/sub_TEST1/cancel"));
    assert.equal(last.body.cancel_at_cycle_end, 1);
  } finally { await t.close(); }
});

test("whatsapp: template outside the window, STOP switches it off, admin is gated", async () => {
  const sent: { to: string; type: string }[] = [];
  const fake = (async (_u: string | URL, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
  }) as typeof fetch;
  const t = await start({ ALLOW_MOCK_PAYMENTS: "true", WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_ID: "111", WHATSAPP_APP_SECRET: "appsec", WHATSAPP_VERIFY_TOKEN: "vt", ADMIN_EMAILS: "boss@example.com" }, fake);
  try {
    const user = await signIn(t);
    await t.call("PUT", "/api/profile", PROFILE);
    await addJob(t.db, "Data Analyst");
    const co = await t.call("POST", "/api/billing/checkout", { plan: "starter" });
    await t.call("POST", "/api/billing/confirm", { ref: co.body.ref });
    await t.pipeline.backfillUser(user.id);
    await t.notifier.runDigests(afternoonIst());
    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, "template");
    assert.equal(sent[0].to, "919876543210");

    assert.equal((await t.call("GET", "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=abc123")).body, "abc123");
    assert.equal((await t.call("GET", "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc")).status, 403);
    const inbound = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.in1", from: "919876543210", type: "text", text: { body: "stop" } }] } }] }] });
    const sig = "sha256=" + createHmac("sha256", "appsec").update(inbound).digest("hex");
    assert.equal((await t.call("POST", "/api/webhooks/whatsapp", inbound, { "x-hub-signature-256": "sha256=bad" })).status, 403);
    assert.equal((await t.call("POST", "/api/webhooks/whatsapp", inbound, { "x-hub-signature-256": sig })).status, 200);
    assert.equal((await t.call("GET", "/api/account")).body.profile.whatsappOptIn, false);
    assert.equal(sent[sent.length - 1].type, "text");

    assert.equal((await t.call("GET", "/api/admin/overview")).status, 403);
  } finally { await t.close(); }
});
