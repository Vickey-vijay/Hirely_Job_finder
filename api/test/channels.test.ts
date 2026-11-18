import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { createBilling } from "../src/billing.js";
import { loadConfig } from "../src/config.js";
import { migrate, type Db } from "../src/db.js";
import type { Llm } from "../src/llm.js";
import { createNotifier, istDay, morningSlot } from "../src/notify.js";
import { ALERTS_PER_DAY_DEFAULT, clampAlertsPerDay, DIGEST_TIME_IST_MIN, PLAN_ORDER, PLANS, WHATSAPP_INSTANT_MAX_PER_DAY } from "../src/plans.js";
import { createPipeline } from "../src/pipeline.js";
import { buildResumeDocx, parseResume, resumeBody } from "../src/resume-docx.js";
import { createStore } from "../src/store.js";

const base = {
  JWT_SECRET: "x".repeat(40), DATABASE_URL: "postgres://u:p@localhost/db", ALLOWED_ORIGINS: "http://localhost:5173",
  INGEST_ENABLED: "false", GOOGLE_CLIENT_ID: "1.apps.googleusercontent.com", ALLOW_MOCK_PAYMENTS: "true",
};
const TG = { TELEGRAM_BOT_TOKEN: "123456:TESTTOKEN", TELEGRAM_BOT_USERNAME: "hirely_test_bot", TELEGRAM_WEBHOOK_SECRET: "tg-secret-0123456789" };
const WA = { WHATSAPP_TOKEN: "wa-token", WHATSAPP_PHONE_ID: "111", WHATSAPP_APP_SECRET: "appsec", WHATSAPP_VERIFY_TOKEN: "vt" };
const PROFILE = { roles: ["Data Analyst"], skills: ["SQL", "Excel"], locations: ["Chennai"], remoteOk: true, experienceYears: 2, phone: "98765 43210", whatsappOptIn: true, headline: "Analyst", domain: "Data & Analytics" };
const TAILORED = [
  "Asha Rao",
  "asha@example.com | +91 98765 43210",
  "",
  "SUMMARY",
  "Data analyst with two years of sales reporting work.",
  "",
  "SKILLS",
  "- SQL",
  "- Excel",
  "",
  "EXPERIENCE",
  "Data Analyst, Acme Retail (2023 - Present)",
  "- Built weekly sales dashboards in Power BI.",
  "",
  "EDUCATION",
  "B.Com, Madras University, 2021",
  "",
  "GAPS TO CHECK",
  "- Ruby on Rails",
  "- None found",
].join("\n");

/** Real time, but the 09:01 India summary slot of today has just passed. */
function morningIst(): Date {
  const ist = new Date(Date.now() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000 + (9 * 60 + 1) * 60_000);
}

type Sent = { url: string; body: Record<string, unknown> | null };
/** A fake network: records every Telegram and WhatsApp call. Chats in blockChat get HTTP 403, like a blocked bot. */
function fakeNet(opts: { blockChat?: string } = {}) {
  const calls: Sent[] = [];
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    let body: Record<string, unknown> | null = null;
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    if (init?.body instanceof FormData) body = Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "<file>"]));
    calls.push({ url: u, body });
    if (u.includes("api.telegram.org") && opts.blockChat !== undefined && body?.chat_id === opts.blockChat) {
      return new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }), { status: 403 });
    }
    if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }) as typeof fetch;
  const calls_of = (part: string) => calls.filter((c) => c.url.includes(part));
  return { calls, fetch, calls_of };
}

async function start(extraEnv: Record<string, string> = {}, net = fakeNet()) {
  const cfg = loadConfig({ ...base, ...extraEnv });
  const pg = new PGlite();
  const db: Db = {
    async query<T>(sql: string, params?: unknown[]) { return (await pg.query<T>(sql, params)).rows as T[]; },
    async exec(sql) { await pg.exec(sql); },
    close: () => pg.close(),
  };
  await migrate(db);
  const mails: { to: string; subject: string; attachments: { filename: string; size: number }[] }[] = [];
  const mailer = {
    enabled: true,
    async sendLoginCode() {},
    async send(to: string, subject: string, _text: string, _html?: string, attachments?: { filename: string; content: Buffer }[]) {
      mails.push({ to, subject, attachments: (attachments ?? []).map((a) => ({ filename: a.filename, size: a.content.length })) });
    },
  };
  const billing = createBilling(cfg, db, net.fetch);
  const notifier = createNotifier(cfg, db, mailer, net.fetch);
  const llm: Llm = { readResume: async () => null, refineMatch: async () => null, tailorResume: async () => TAILORED };
  const pipeline = createPipeline(cfg, db, billing, notifier, llm);
  const app = createApp({
    cfg, store: createStore(db), mailer, product: { db, billing, notifier, pipeline, llm },
    async verifyGoogle() { return { sub: "g-1", email: "asha@example.com", name: "Asha Rao" }; },
  });
  const server = app.listen(0);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = "";
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(url + path, { method, headers: { "Content-Type": "application/json", Cookie: cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let parsed: any = null;
    if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }
    return { status: res.status, body: parsed };
  };
  const raw = async (path: string) => {
    const res = await fetch(url + path, { headers: { Cookie: cookie } });
    return { status: res.status, type: res.headers.get("content-type") ?? "", disposition: res.headers.get("content-disposition") ?? "", body: Buffer.from(await res.arrayBuffer()) };
  };
  const signIn = async () => (await call("POST", "/api/auth/google", { credential: "valid-credential-0000000000" })).body.user as { id: string };
  const subscribe = async (plan: "starter" | "plus" | "pro") => {
    const co = await call("POST", "/api/billing/checkout", { plan });
    assert.equal(co.status, 200);
    await call("POST", "/api/billing/confirm", { ref: co.body.ref });
  };
  /** Adds jobs and a match for each (not via scoring, so the test is deterministic). Titles do not fit "Data Analyst". */
  const addMatches = async (userId: string, n: number, score = 8, prefix = "Ward Nurse") => {
    const s = await db.query<{ id: string }>("insert into sources (kind, token, company) values ('greenhouse', 'acme', 'Acme') on conflict (kind, token) do update set company = 'Acme' returning id");
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const j = await db.query<{ id: string }>(
        "insert into jobs (source_id, external_id, company, title, location, in_india, url, description, posted_at) values ($1,$2,'Acme',$3,'Chennai, India',true,'https://x.test/j',$4, now()) returning id",
        [s[0].id, `${prefix} ${i} ${Math.random()}`, `${prefix} ${i}`, "Patient care on the ward."]);
      await db.query("insert into matches (user_id, job_id, score, reasons) values ($1,$2,$3,$4)", [userId, j[0].id, score, ["Strong fit"]]);
      ids.push(j[0].id);
    }
    return ids;
  };
  const matchIds = async () => (await db.query<{ id: string }>("select id from matches order by created_at")).map((r) => r.id);
  return { cfg, db, mailer, mails, net, notifier, pipeline, billing, call, raw, signIn, subscribe, addMatches, matchIds, close: async () => { server.close(); await pg.close(); } };
}
type T = Awaited<ReturnType<typeof start>>;

/** Reads word/document.xml out of a .docx (a zip). The file is written by docx, so the entry is always deflated or stored. */
function docxXml(buf: Buffer): string {
  assert.equal(buf.subarray(0, 2).toString("latin1"), "PK");
  const i = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  let at = i;
  while (at >= 0) {
    const method = buf.readUInt16LE(at + 8);
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26), extraLen = buf.readUInt16LE(at + 28);
    const name = buf.subarray(at + 30, at + 30 + nameLen).toString("utf8");
    const start = at + 30 + nameLen + extraLen;
    if (name === "word/document.xml") {
      const data = buf.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    at = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), start + size);
  }
  throw new Error("word/document.xml not found");
}

// ---------- plans and limits ----------

test("plans: prices, limits and features match the spec", () => {
  assert.deepEqual(PLAN_ORDER.map((id) => PLANS[id].pricePaise), [9900, 19900, 29900]);
  assert.deepEqual(PLAN_ORDER.map((id) => PLANS[id].maxRoles), [1, 5, 5]);
  assert.deepEqual(PLAN_ORDER.map((id) => PLANS[id].instantAlerts), [true, true, true]);
  assert.deepEqual(PLAN_ORDER.map((id) => PLANS[id].whatsappInstant), [false, false, true]);
  assert.deepEqual(PLAN_ORDER.map((id) => PLANS[id].tailoredResume), [false, false, true]);
  assert.equal(PLANS.pro.tailorPerDay, 5);
  assert.equal(WHATSAPP_INSTANT_MAX_PER_DAY, 5);
  assert.equal(DIGEST_TIME_IST_MIN, 9 * 60);
  for (const p of Object.values(PLANS)) {
    for (const f of p.features) {
      assert.ok(!/PDF|copy the text|print/i.test(f), `old wording in ${p.id}: ${f}`);
      assert.ok(!/9\/10|digest|alerts a day/i.test(f), `old wording in ${p.id}: ${f}`);
    }
  }
  assert.ok(PLANS.pro.features.includes("A tailored resume for each strong match, sent as a Word file to your email and Telegram (up to 5 a day)"));
});

test("daily limit: clamps to 1..10, rounds, defaults to 5", () => {
  assert.equal(ALERTS_PER_DAY_DEFAULT, 5);
  assert.equal(clampAlertsPerDay(0), 1);
  assert.equal(clampAlertsPerDay(50), 10);
  assert.equal(clampAlertsPerDay("7"), 7);
  assert.equal(clampAlertsPerDay(4.6), 5);
  assert.equal(clampAlertsPerDay("abc"), 5);
  assert.equal(clampAlertsPerDay(undefined), 5);
});

test("morning slot: once a day at 09:00 India time, and the day key is the India date", () => {
  assert.equal(morningSlot(null, new Date("2026-11-14T03:29:00Z")), null); // 08:59 IST
  assert.equal(morningSlot(null, new Date("2026-11-14T03:31:00Z"))?.toISOString(), "2026-11-14T03:30:00.000Z"); // 09:01 IST
  assert.equal(morningSlot(new Date("2026-11-14T03:31:00Z"), new Date("2026-11-14T10:00:00Z")), null); // already sent today
  assert.ok(morningSlot(new Date("2026-11-13T03:31:00Z"), new Date("2026-11-14T03:45:00Z")));
  assert.equal(istDay(new Date("2026-11-14T20:00:00Z")), "2026-11-15"); // 01:30 IST the next day
});

test("config: Telegram needs a bot name and a webhook secret, and is off without a token", () => {
  assert.throws(() => loadConfig({ ...base, TELEGRAM_BOT_TOKEN: "123:abc" }), /TELEGRAM_BOT_USERNAME/);
  assert.throws(() => loadConfig({ ...base, TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_BOT_USERNAME: "b" }), /TELEGRAM_WEBHOOK_SECRET/);
  assert.equal(loadConfig(base).telegram, undefined);
  assert.equal(loadConfig({ ...base, ...TG }).telegram?.botUsername, "hirely_test_bot");
});

// ---------- daily limit ----------

test("daily limit: the 11th instant alert is not sent, the limit holds after a restart, and each job counts once", async () => {
  const t = await start();
  try {
    await t.signIn();
    assert.equal((await t.call("PUT", "/api/profile", PROFILE)).status, 200);
    await t.subscribe("plus");
    await t.call("PATCH", "/api/account/alerts", { maxAlertsPerDay: 0 });
    assert.equal((await t.call("GET", "/api/account")).body.profile.maxAlertsPerDay, 1);
    assert.equal((await t.call("PATCH", "/api/account/alerts", { maxAlertsPerDay: 50 })).body.profile.maxAlertsPerDay, 10);

    await t.addMatches((await t.db.query<{ user_id: string }>("select user_id from profiles"))[0].user_id, 11);
    assert.equal(await t.notifier.runInstant(), 10);
    assert.equal(t.mails.filter((m) => m.subject.startsWith("Strong match")).length, 10);
    assert.equal(await t.notifier.runInstant(), 0);
    assert.equal((await t.db.query("select id from matches where notified_at is null")).length, 1, "the 11th match waits for tomorrow");

    // A restarted process reads the same counts from the database.
    const restarted = createNotifier(t.cfg, t.db, t.mailer, t.net.fetch);
    assert.equal(await restarted.runInstant(), 0);
  } finally { await t.close(); }
});

test("each job counts once even when it goes out on two channels", async () => {
  const t = await start({ ...TG });
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.subscribe("plus");
    await t.db.query("update profiles set telegram_chat_id = 555 where user_id = $1", [userId]);
    await t.call("PATCH", "/api/account/alerts", { maxAlertsPerDay: 1 });
    await t.addMatches(userId, 2);
    assert.equal(await t.notifier.runInstant(), 1);
    assert.equal(t.mails.filter((m) => m.subject.startsWith("Strong match")).length, 1);
    assert.equal(t.net.calls_of("/sendMessage").length, 1);
    // Two channels were logged for the one job, but it uses one unit of the daily limit.
    assert.equal((await t.db.query<{ n: number }>("select count(*)::int as n from alert_log where kind = 'instant'"))[0].n, 2);
    assert.equal((await t.db.query<{ n: number }>("select count(distinct match_id)::int as n from alert_log where kind = 'instant'"))[0].n, 1);
  } finally { await t.close(); }
});

test("email instant can be switched off on its own", async () => {
  const t = await start();
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.subscribe("starter");
    const r = await t.call("PATCH", "/api/account/alerts", { emailInstant: false, emailDigest: false });
    assert.equal(r.body.profile.emailInstant, false);
    assert.equal(r.body.profile.emailDigest, false);
    await t.addMatches(userId, 2);
    assert.equal(await t.notifier.runInstant(), 0); // nothing else is on, so nothing is sent
    assert.equal(t.mails.filter((m) => m.subject.startsWith("Strong match")).length, 0);
  } finally { await t.close(); }
});

// ---------- Telegram ----------

test("telegram: webhook secret, /start connects once, /stop disconnects, a blocked bot clears the chat", async () => {
  const net = fakeNet({ blockChat: "777" });
  const t = await start({ ...TG }, net);
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.subscribe("plus");
    const pub = await t.call("GET", "/api/public/config");
    assert.deepEqual(pub.body.telegram, { enabled: true, botUsername: "hirely_test_bot" });

    const link = await t.call("POST", "/api/account/telegram/link");
    assert.equal(link.status, 200);
    assert.match(link.body.url, /^https:\/\/t\.me\/hirely_test_bot\?start=[A-Za-z0-9_-]{20,}$/);
    const token = link.body.token as string;
    const hook = (secret: string | undefined, body: unknown) => t.call("POST", "/api/webhooks/telegram", body, secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {});
    const update = (text: string, chatId = 555, type = "private") => ({ update_id: 1, message: { chat: { id: chatId, type }, text } });
    const lastReply = () => net.calls_of("/sendMessage").at(-1)!.body;

    assert.equal((await hook("not-the-secret-value", update(`/start ${token}`))).status, 403);
    assert.equal((await hook(undefined, update(`/start ${token}`))).status, 403);
    assert.equal((await t.call("GET", "/api/account")).body.profile.telegramConnected, false);

    // Groups are ignored, so the token is not used up by them.
    assert.equal((await hook(TG.TELEGRAM_WEBHOOK_SECRET, update(`/start ${token}`, -100, "group"))).status, 200);
    assert.equal(net.calls_of("/sendMessage").length, 0);

    assert.equal((await hook(TG.TELEGRAM_WEBHOOK_SECRET, update(`/start ${token}`))).status, 200);
    assert.equal(lastReply().text, "Connected. Hirely alerts will arrive here.");
    assert.equal(lastReply().chat_id, "555");
    assert.equal((await t.call("GET", "/api/account")).body.profile.telegramConnected, true);

    // The token is one-time.
    await hook(TG.TELEGRAM_WEBHOOK_SECRET, update(`/start ${token}`));
    assert.match(String(lastReply().text), /expired/);

    // An instant alert reaches the chat as HTML.
    await t.addMatches(userId, 1);
    assert.equal(await t.notifier.runInstant(), 1);
    const alert = net.calls_of("/sendMessage").find((c) => String(c.body?.text).includes("Match 8/10"));
    assert.ok(alert, "instant alert sent to Telegram");
    assert.equal(alert!.body!.parse_mode, "HTML");

    // /stop disconnects.
    assert.equal((await hook(TG.TELEGRAM_WEBHOOK_SECRET, update("/stop"))).status, 200);
    assert.match(String(lastReply().text), /Telegram alerts are off/);
    assert.equal((await t.call("GET", "/api/account")).body.profile.telegramConnected, false);

    // Connect a chat the user then blocks: the next send gets 403, the chat is forgotten, email still goes.
    const link2 = await t.call("POST", "/api/account/telegram/link");
    assert.equal((await hook(TG.TELEGRAM_WEBHOOK_SECRET, update(`/start ${link2.body.token}`, 777))).status, 200);
    await t.addMatches(userId, 1);
    await t.notifier.runInstant();
    const chat = await t.db.query<{ telegram_chat_id: string | null }>("select telegram_chat_id from profiles where user_id = $1", [userId]);
    assert.equal(chat[0].telegram_chat_id, null, "the blocked chat is forgotten");
    assert.ok(t.mails.some((m) => m.subject.startsWith("Strong match")));
  } finally { await t.close(); }
});

test("telegram: an expired link does not connect, and setWebhook sends the URL and secret", async () => {
  const net = fakeNet();
  const t = await start({ ...TG }, net);
  try {
    await t.signIn();
    const link = await t.call("POST", "/api/account/telegram/link");
    await t.db.query("update telegram_links set expires_at = now() - interval '1 minute'");
    await t.call("POST", "/api/webhooks/telegram", { message: { chat: { id: 9, type: "private" }, text: `/start ${link.body.token}` } }, { "X-Telegram-Bot-Api-Secret-Token": TG.TELEGRAM_WEBHOOK_SECRET });
    assert.match(String(net.calls_of("/sendMessage").at(-1)!.body!.text), /expired/);
    assert.equal((await t.call("GET", "/api/account")).body.profile.telegramConnected, false);

    await t.notifier.telegram.setWebhook("https://hirely.test");
    const hookCall = net.calls_of("/setWebhook").at(-1)!;
    assert.equal(hookCall.body!.url, "https://hirely.test/api/webhooks/telegram");
    assert.equal(hookCall.body!.secret_token, TG.TELEGRAM_WEBHOOK_SECRET);
  } finally { await t.close(); }
});

test("telegram off: no link, hidden in config, webhook answers 404", async () => {
  const t = await start();
  try {
    await t.signIn();
    assert.equal((await t.call("GET", "/api/public/config")).body.telegram.enabled, false);
    assert.equal((await t.call("POST", "/api/account/telegram/link")).status, 503);
    assert.equal((await t.call("POST", "/api/webhooks/telegram", { message: {} }, { "X-Telegram-Bot-Api-Secret-Token": "anything" })).status, 404);
  } finally { await t.close(); }
});

// ---------- WhatsApp caps ----------

test("pro: instant WhatsApp stops at 5 a day, and never more than the daily limit", async () => {
  const t = await start({ ...WA });
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.subscribe("pro");
    await t.call("PATCH", "/api/account/alerts", { maxAlertsPerDay: 10 });
    await t.addMatches(userId, 7);
    assert.equal(await t.notifier.runInstant(), 7);
    assert.equal(t.net.calls_of("graph.facebook.com").length, WHATSAPP_INSTANT_MAX_PER_DAY);
    assert.equal(t.mails.filter((m) => m.subject.startsWith("Strong match")).length, 7, "email still goes to all 7");
    assert.equal(await t.notifier.runInstant(), 0);
    assert.equal(t.net.calls_of("graph.facebook.com").length, WHATSAPP_INSTANT_MAX_PER_DAY);
  } finally { await t.close(); }
});

test("pro WhatsApp cap also respects a lower daily limit", async () => {
  const t = await start({ ...WA });
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.subscribe("pro");
    await t.call("PATCH", "/api/account/alerts", { maxAlertsPerDay: 2 });
    await t.addMatches(userId, 4);
    assert.equal(await t.notifier.runInstant(), 2);
    assert.equal(t.net.calls_of("graph.facebook.com").length, 2);
  } finally { await t.close(); }
});

test("starter and plus never get instant WhatsApp", async () => {
  const t = await start({ ...WA });
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.subscribe("plus");
    await t.addMatches(userId, 3);
    assert.equal(await t.notifier.runInstant(), 3);
    assert.equal(t.net.calls_of("graph.facebook.com").length, 0);
  } finally { await t.close(); }
});

test("morning summary: yesterday's matches once a day by WhatsApp and email, nothing when there are none", async () => {
  const t = await start({ ...WA });
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.subscribe("starter");
    await t.addMatches(userId, 7);
    // Matches from yesterday (India time) are the ones in the summary; today's are not, and only 5 are listed.
    await t.db.query("update matches set created_at = $1", [new Date(morningIst().getTime() - 12 * 3_600_000)]);
    assert.equal(await t.notifier.runDigests(morningIst()), 1);
    assert.equal(t.mails.filter((m) => m.subject.includes("from yesterday"))[0].subject, "5 best matches from yesterday, best fit 8/10");
    const wa = t.net.calls_of("graph.facebook.com");
    assert.equal(wa.length, 1);
    assert.equal((wa[0].body as any).type, "template");
    assert.equal(t.mails.filter((m) => m.subject.includes("from yesterday")).length, 1);
    assert.equal(await t.notifier.runDigests(morningIst()), 0, "one summary a day");
  } finally { await t.close(); }
});

// ---------- Pro tailored resume ----------

test("pro: a strong match gets a Word resume by email and Telegram; the file has no gaps section", async () => {
  const t = await start({ ...TG, ...WA });
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.db.query("update profiles set resume_text = $2, telegram_chat_id = 555 where user_id = $1", [userId, "Asha Rao\nSales reporting and SQL work for two years at a retail chain in Chennai. " + "x".repeat(40)]);
    await t.subscribe("pro");
    const [matchA] = await t.addMatches(userId, 1, 8);
    assert.equal(await t.pipeline.tailorStrong(), undefined);

    const tailored = await t.db.query<{ n: string }>("select count(*)::text as n from tailored_resumes");
    assert.equal(tailored[0].n, "1");
    const docMail = t.mails.find((m) => m.subject.startsWith("Your tailored resume"));
    assert.ok(docMail, "email with the resume");
    assert.match(docMail!.attachments[0].filename, /^Resume-Acme-Ward-Nurse-\d+\.docx$/);
    assert.ok(docMail!.attachments[0].size > 2000);
    assert.equal(t.net.calls_of("/sendDocument").length, 1, "Telegram document");

    const id = (await t.matchIds())[0];
    assert.ok(id && matchA, "match exists");
    const file = await t.raw(`/api/matches/${id}/tailor.docx`);
    assert.equal(file.status, 200);
    assert.match(file.type, /wordprocessingml/);
    assert.match(file.disposition, /attachment; filename="Resume-Acme-Ward-Nurse-\d+\.docx"/);
    const xml = docxXml(file.body);
    assert.ok(xml.includes("Asha Rao") && xml.includes("SUMMARY") && xml.includes("Acme Retail"));
    assert.ok(!xml.includes("GAPS TO CHECK") && !xml.includes("Ruby on Rails"));

    assert.equal((await t.raw("/api/matches/00000000-0000-0000-0000-000000000000/tailor.docx")).status, 404);
    assert.equal((await t.raw("/api/matches/not-a-uuid/tailor.docx")).status, 404);
  } finally { await t.close(); }
});

test("pro: at most 5 tailored resumes a day, and only for Pro", async () => {
  const t = await start();
  try {
    const userId = (await t.signIn()).id;
    await t.call("PUT", "/api/profile", PROFILE);
    await t.db.query("update profiles set resume_text = $2 where user_id = $1", [userId, "x".repeat(120)]);
    await t.subscribe("starter");
    await t.addMatches(userId, 6, 9);
    await t.pipeline.tailorStrong();
    assert.equal((await t.db.query("select id from tailored_resumes")).length, 0, "Starter gets no tailored resumes");

    await t.subscribe("pro");
    await t.pipeline.tailorStrong(); // up to 3 per run
    await t.pipeline.tailorStrong();
    await t.pipeline.tailorStrong();
    assert.equal((await t.db.query("select id from tailored_resumes")).length, 5);
  } finally { await t.close(); }
});

// ---------- Word builder ----------

test("docx builder: non-empty Word file, and the gaps part is never written", async () => {
  const buf = await buildResumeDocx(TAILORED);
  assert.ok(buf.length > 2000);
  const xml = docxXml(buf);
  assert.ok(xml.includes("Asha Rao") && xml.includes("asha@example.com") && xml.includes("Acme Retail") && xml.includes("SUMMARY"));
  assert.ok(!xml.includes("GAPS TO CHECK") && !xml.includes("Ruby on Rails") && !xml.includes("None found"));
  const blank = await buildResumeDocx("");
  assert.ok(blank.length > 0);
});

test("resume text: gaps are cut, and name, contact and sections are read", () => {
  assert.equal(resumeBody(TAILORED).includes("GAPS"), false);
  const p = parseResume(TAILORED);
  assert.equal(p.name, "Asha Rao");
  assert.equal(p.contact, "asha@example.com | +91 98765 43210");
  assert.deepEqual(p.blocks.map((b) => b.heading), ["SUMMARY", "SKILLS", "EXPERIENCE", "EDUCATION"]);
});
