import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import type { Config } from "./config.js";
import type { Mailer } from "./mailer.js";
import type { Profile, Store, User } from "./store.js";

export const COOKIE = "hirely_session";
const SESSION_DAYS = 7;
const CODE_TTL_MIN = 10;
const MAX_CODES_PER_WINDOW = 3; // per email per 10 minutes
const MAX_ATTEMPTS = 5;

export type Deps = {
  cfg: Config;
  store: Store;
  mailer: Mailer;
  /** Verifies a Google ID token and returns the verified profile, or throws. Injected so tests need no network. */
  verifyGoogle: (credential: string) => Promise<Profile>;
};

const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, picture: u.picture });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function createApp({ cfg, store, mailer, verifyGoogle }: Deps) {
  const app = express();
  app.disable("x-powered-by");
  if (cfg.production) app.set("trust proxy", 1); // behind nginx: use the real client IP for rate limits
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  // Browsers always send Origin on cross-site POSTs. Reject anything not from our own web app.
  const originGuard = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("origin");
    if (origin && !cfg.allowedOrigins.includes(origin)) {
      res.status(403).json({ error: "origin_not_allowed" });
      return;
    }
    next();
  };

  const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

  const cookieOptions = {
    httpOnly: true,         // JavaScript can't read it, so XSS can't steal it
    secure: cfg.production, // HTTPS only in production
    sameSite: "lax" as const,
    path: "/",
  };

  const startSession = (res: Response, user: User) => {
    const token = jwt.sign({ sub: user.id }, cfg.jwtSecret, { expiresIn: `${SESSION_DAYS}d`, issuer: "hirely" });
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400_000 });
  };

  const hashCode = (email: string, code: string) =>
    createHmac("sha256", cfg.jwtSecret).update(`${email}:${code}`).digest("hex");

  app.get("/api/health", (_req, res) => { res.json({ ok: true }); });

  // ---- Google ----
  app.post("/api/auth/google", limiter, originGuard, async (req, res) => {
    if (!cfg.googleClientId) { res.status(503).json({ error: "google_login_disabled" }); return; }
    const credential = (req.body as { credential?: unknown })?.credential;
    if (typeof credential !== "string" || credential.length < 20 || credential.length > 4096) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    let profile: Profile;
    try {
      profile = await verifyGoogle(credential);
    } catch {
      res.status(401).json({ error: "invalid_google_token" });
      return;
    }
    const user = await store.upsertFromGoogle(profile);
    startSession(res, user);
    res.json({ user: publicUser(user) });
  });

  // ---- Email code: step 1, send ----
  app.post("/api/auth/email/start", limiter, originGuard, async (req, res) => {
    const raw = (req.body as { email?: unknown })?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email) || email.length > 254) { res.status(400).json({ error: "invalid_email" }); return; }

    if ((await store.recentChallengeCount(email, CODE_TTL_MIN)) >= MAX_CODES_PER_WINDOW) {
      res.status(429).json({ error: "too_many_codes" });
      return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await store.createChallenge(email, hashCode(email, code), CODE_TTL_MIN);
    try {
      await mailer.sendLoginCode(email, code);
    } catch (e) {
      console.error("email send failed:", (e as Error).message);
      res.status(502).json({ error: "email_failed" });
      return;
    }
    res.json({ ok: true }); // identical response whether or not the account exists
  });

  // ---- Email code: step 2, verify ----
  app.post("/api/auth/email/verify", limiter, originGuard, async (req, res) => {
    const { email: rawEmail, code } = (req.body ?? {}) as { email?: unknown; code?: unknown };
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    const ch = await store.openChallenge(email);
    if (!ch || ch.attempts >= MAX_ATTEMPTS) { res.status(401).json({ error: "invalid_code" }); return; }

    const given = Buffer.from(hashCode(email, code), "hex");
    const stored = Buffer.from(ch.codeHash, "hex");
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
      await store.bumpAttempts(ch.id);
      res.status(401).json({ error: "invalid_code" });
      return;
    }
    await store.consumeChallenge(ch.id); // single use
    const user = await store.upsertFromEmail(email);
    startSession(res, user);
    res.json({ user: publicUser(user) });
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (token) {
      try {
        const { sub } = jwt.verify(token, cfg.jwtSecret, { issuer: "hirely" }) as { sub: string };
        const user = await store.get(sub);
        if (user) {
          res.json({ user: publicUser(user) });
          return;
        }
      } catch { /* expired or tampered: fall through */ }
      res.clearCookie(COOKIE, cookieOptions);
    }
    res.status(401).json({ error: "unauthenticated" });
  });

  app.post("/api/auth/logout", originGuard, (_req, res) => {
    res.clearCookie(COOKIE, cookieOptions);
    res.status(204).end();
  });

  // Express 5 forwards async errors here, so a DB hiccup returns 500 instead of hanging.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  });

  return app;
}
