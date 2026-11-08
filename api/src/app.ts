import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import type { Config } from "./config.js";
import type { Profile, Store, User } from "./store.js";

export const COOKIE = "hirely_session";
const SESSION_DAYS = 7;

export type Deps = {
  cfg: Config;
  store: Store;
  /** Verifies a Google ID token and returns the verified profile, or throws. Injected so tests need no network. */
  verifyGoogle: (credential: string) => Promise<Profile>;
};

const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, picture: u.picture ?? null });

export function createApp({ cfg, store, verifyGoogle }: Deps) {
  const app = express();
  app.disable("x-powered-by");
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
    httpOnly: true,                       // JavaScript can't read it, so XSS can't steal it
    secure: cfg.production,               // HTTPS only in production
    sameSite: "lax" as const,             // not sent on cross-site POSTs
    path: "/",
  };

  app.get("/api/health", (_req, res) => { res.json({ ok: true }); });

  app.post("/api/auth/google", limiter, originGuard, async (req, res) => {
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
    const user = store.upsertFromGoogle(profile);
    const token = jwt.sign({ sub: user.id }, cfg.jwtSecret, { expiresIn: `${SESSION_DAYS}d`, issuer: "hirely" });
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400_000 });
    res.json({ user: publicUser(user) });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (token) {
      try {
        const { sub } = jwt.verify(token, cfg.jwtSecret, { issuer: "hirely" }) as { sub: string };
        const user = store.get(sub);
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

  return app;
}
