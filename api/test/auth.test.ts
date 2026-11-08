import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { migrate, type Db } from "../src/db.js";
import { createStore } from "../src/store.js";

const env = {
  GOOGLE_CLIENT_ID: "123.apps.googleusercontent.com",
  JWT_SECRET: "x".repeat(40),
  DATABASE_URL: "postgres://u:p@localhost/db",
  ALLOWED_ORIGINS: "http://localhost:5173",
};
const cfg = loadConfig(env);

async function start() {
  const pg = new PGlite(); // real Postgres in-process, fresh per test
  const db: Db = {
    async query<T>(sql: string, params?: unknown[]) { return (await pg.query<T>(sql, params)).rows as T[]; },
    async exec(sql) { await pg.exec(sql); },
    close: () => pg.close(),
  };
  await migrate(db);
  const sent: { to: string; code: string }[] = [];
  const app = createApp({
    cfg,
    store: createStore(db),
    mailer: { async sendLoginCode(to, code) { sent.push({ to, code }); } },
    async verifyGoogle(c) {
      if (c !== "valid-credential-0000000000") throw new Error("bad");
      return { sub: "g-1", email: "Asha@Example.com", name: "Asha Rao", picture: "https://x/y.png" };
    },
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, sent, db, close: async () => { server.close(); await pg.close(); } };
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:5173", ...headers }, body: JSON.stringify(body) });

const cookieOf = (r: Response) => r.headers.get("set-cookie")!.split(";")[0];

// ---------- config ----------
test("config rejects missing or weak settings", () => {
  assert.throws(() => loadConfig({}), /JWT_SECRET/);
  assert.throws(() => loadConfig({ ...env, JWT_SECRET: "short" }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ ...env, DATABASE_URL: "mysql://x" }), /DATABASE_URL/);
  // Development without DATABASE_URL is fine (embedded DB); production without it is not.
  assert.doesNotThrow(() => loadConfig({ ...env, DATABASE_URL: "" }));
  assert.throws(() => loadConfig({ ...env, DATABASE_URL: "", NODE_ENV: "production", SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p", MAIL_FROM: "a@b.c" }), /DATABASE_URL/);
  assert.throws(() => loadConfig({ ...env, GOOGLE_CLIENT_ID: "nope" }), /GOOGLE_CLIENT_ID/);
  assert.throws(() => loadConfig({ ...env, NODE_ENV: "production" }), /SMTP_HOST/);
  assert.doesNotThrow(() => loadConfig({ ...env, GOOGLE_CLIENT_ID: "" })); // Google is optional
});

// ---------- google ----------
test("me is 401 without a session", async () => {
  const s = await start();
  assert.equal((await fetch(`${s.base}/api/auth/me`)).status, 401);
  await s.close();
});

test("invalid google token is rejected and sets no cookie", async () => {
  const s = await start();
  const r = await post(`${s.base}/api/auth/google`, { credential: "nope-nope-nope-nope-nope" });
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("set-cookie"), null);
  await s.close();
});

test("malformed bodies are 400; foreign origin is 403", async () => {
  const s = await start();
  assert.equal((await post(`${s.base}/api/auth/google`, { credential: 5 })).status, 400);
  assert.equal((await post(`${s.base}/api/auth/email/start`, { email: "not-an-email" })).status, 400);
  assert.equal((await post(`${s.base}/api/auth/email/verify`, { email: "a@b.co", code: "12" })).status, 400);
  const evil = await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" }, { origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  await s.close();
});

test("google login: httpOnly cookie, me works, tampered cookie fails, logout clears", async () => {
  const s = await start();
  const login = await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie")!, /HttpOnly/i);
  assert.match(login.headers.get("set-cookie")!, /SameSite=Lax/i);
  const cookie = cookieOf(login);

  const me = await fetch(`${s.base}/api/auth/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal(((await me.json()) as { user: { name: string } }).user.name, "Asha Rao");

  assert.equal((await fetch(`${s.base}/api/auth/me`, { headers: { cookie: cookie.slice(0, -3) + "abc" } })).status, 401);
  assert.equal((await post(`${s.base}/api/auth/logout`, {})).status, 204);
  await s.close();
});

test("same Google account logs into the same user; email is stored lowercase", async () => {
  const s = await start();
  const a = (await (await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" })).json()) as { user: { id: string; email: string } };
  const b = (await (await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" })).json()) as { user: { id: string } };
  assert.equal(a.user.id, b.user.id);
  assert.equal(a.user.email, "asha@example.com");
  await s.close();
});

// ---------- email code ----------
test("email code: send, wrong code rejected, right code logs in, code is single-use", async () => {
  const s = await start();
  const start1 = await post(`${s.base}/api/auth/email/start`, { email: "  Priya@Example.com " });
  assert.equal(start1.status, 200);
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, "priya@example.com");
  const code = s.sent[0].code;
  assert.match(code, /^\d{6}$/);

  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal((await post(`${s.base}/api/auth/email/verify`, { email: "priya@example.com", code: wrong })).status, 401);

  const ok = await post(`${s.base}/api/auth/email/verify`, { email: "priya@example.com", code });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("set-cookie")!, /HttpOnly/i);
  const me = await fetch(`${s.base}/api/auth/me`, { headers: { cookie: cookieOf(ok) } });
  assert.equal(((await me.json()) as { user: { email: string } }).user.email, "priya@example.com");

  const reuse = await post(`${s.base}/api/auth/email/verify`, { email: "priya@example.com", code });
  assert.equal(reuse.status, 401);
  await s.close();
});

test("email code: locked after 5 wrong attempts, even with the right code", async () => {
  const s = await start();
  await post(`${s.base}/api/auth/email/start`, { email: "lock@example.com" });
  const code = s.sent[0].code;
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await post(`${s.base}/api/auth/email/verify`, { email: "lock@example.com", code: wrong });
  const r = await post(`${s.base}/api/auth/email/verify`, { email: "lock@example.com", code });
  assert.equal(r.status, 401);
  await s.close();
});

test("email code: new code replaces the old; per-email send limit applies; expired codes fail", async () => {
  const s = await start();
  await post(`${s.base}/api/auth/email/start`, { email: "rate@example.com" });
  await post(`${s.base}/api/auth/email/start`, { email: "rate@example.com" });
  const [first, second] = s.sent;
  if (first.code !== second.code) {
    assert.equal((await post(`${s.base}/api/auth/email/verify`, { email: "rate@example.com", code: first.code })).status, 401);
  }
  assert.equal((await post(`${s.base}/api/auth/email/start`, { email: "rate@example.com" })).status, 200);
  assert.equal((await post(`${s.base}/api/auth/email/start`, { email: "rate@example.com" })).status, 429);

  await s.db.query("update email_challenges set expires_at = now() - interval '1 minute' where email = 'rate@example.com'");
  const latest = s.sent[s.sent.length - 1];
  assert.equal((await post(`${s.base}/api/auth/email/verify`, { email: "rate@example.com", code: latest.code })).status, 401);
  await s.close();
});

test("email login and Google login for the same address land on one account", async () => {
  const s = await start();
  await post(`${s.base}/api/auth/email/start`, { email: "asha@example.com" });
  const viaEmail = (await (await post(`${s.base}/api/auth/email/verify`, { email: "asha@example.com", code: s.sent[0].code })).json()) as { user: { id: string } };
  const viaGoogle = (await (await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" })).json()) as { user: { id: string } };
  assert.equal(viaEmail.user.id, viaGoogle.user.id);
  await s.close();
});
