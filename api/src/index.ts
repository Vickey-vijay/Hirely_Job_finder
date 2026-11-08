import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPgDb, migrate } from "./db.js";
import { createMailer } from "./mailer.js";
import { createStore } from "./store.js";

let cfg;
try {
  cfg = loadConfig();
} catch (e) {
  console.error((e as Error).message);
  console.error("\nCopy api/.env.example to api/.env and fill it in. See docs/GOOGLE_LOGIN.md and docs/VPS_DEPLOY.md.");
  process.exit(1);
}

const db = createPgDb(cfg.databaseUrl);
try {
  await migrate(db);
} catch (e) {
  console.error("Database error:", (e as Error).message);
  console.error("Is PostgreSQL running and DATABASE_URL correct? (local: `docker compose up -d db` from the repo root)");
  process.exit(1);
}

const client = cfg.googleClientId ? new OAuth2Client(cfg.googleClientId) : null;

const app = createApp({
  cfg,
  store: createStore(db),
  mailer: createMailer(cfg),
  async verifyGoogle(credential) {
    if (!client) throw new Error("google disabled");
    // Checks signature, expiry, issuer (accounts.google.com) and that the token was issued for OUR client ID.
    const ticket = await client.verifyIdToken({ idToken: credential, audience: cfg.googleClientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) throw new Error("unverified google account");
    return { sub: p.sub, email: p.email, name: p.name ?? p.email, picture: p.picture };
  },
});

const server = app.listen(cfg.port, () => console.log(`Hirely API listening on http://localhost:${cfg.port}`));

const shutdown = () => { server.close(() => db.close().finally(() => process.exit(0))); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
