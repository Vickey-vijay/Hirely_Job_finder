import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createStore } from "../src/store.js";

const cfg = loadConfig({
  GOOGLE_CLIENT_ID: "123.apps.googleusercontent.com",
  JWT_SECRET: "x".repeat(40),
  ALLOWED_ORIGINS: "http://localhost:5173",
});

async function start() {
  const app = createApp({
    cfg,
    store: createStore(),
    async verifyGoogle(c) {
      if (c !== "valid-credential-0000000000") throw new Error("bad");
      return { sub: "g-1", email: "a@b.com", name: "Asha Rao", picture: "https://x/y.png" };
    },
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => server.close() };
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:5173", ...headers }, body: JSON.stringify(body) });

test("config rejects missing or weak settings", () => {
  assert.throws(() => loadConfig({}), /GOOGLE_CLIENT_ID/);
  assert.throws(() => loadConfig({ GOOGLE_CLIENT_ID: "1.apps.googleusercontent.com", JWT_SECRET: "short" }), /JWT_SECRET/);
});

test("me is 401 without a session", async () => {
  const s = await start();
  assert.equal((await fetch(`${s.base}/api/auth/me`)).status, 401);
  s.close();
});

test("invalid google token is rejected and sets no cookie", async () => {
  const s = await start();
  const r = await post(`${s.base}/api/auth/google`, { credential: "nope-nope-nope-nope-nope" });
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("set-cookie"), null);
  s.close();
});

test("malformed body is 400", async () => {
  const s = await start();
  assert.equal((await post(`${s.base}/api/auth/google`, { credential: 5 })).status, 400);
  assert.equal((await post(`${s.base}/api/auth/google`, {})).status, 400);
  s.close();
});

test("foreign origin is blocked", async () => {
  const s = await start();
  const r = await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" }, { origin: "https://evil.example" });
  assert.equal(r.status, 403);
  s.close();
});

test("login sets httpOnly cookie; me works; logout clears; tampered cookie fails", async () => {
  const s = await start();
  const login = await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie")!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(";")[0];

  const me = await fetch(`${s.base}/api/auth/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  const body = (await me.json()) as { user: { name: string; email: string } };
  assert.equal(body.user.name, "Asha Rao");

  const tampered = await fetch(`${s.base}/api/auth/me`, { headers: { cookie: cookie.slice(0, -3) + "abc" } });
  assert.equal(tampered.status, 401);

  const out = await post(`${s.base}/api/auth/logout`, {});
  assert.equal(out.status, 204);
  s.close();
});

test("same Google account logs into the same user", async () => {
  const s = await start();
  const a = await (await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" })).json() as { user: { id: string } };
  const b = await (await post(`${s.base}/api/auth/google`, { credential: "valid-credential-0000000000" })).json() as { user: { id: string } };
  assert.equal(a.user.id, b.user.id);
  s.close();
});
