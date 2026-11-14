import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createEmbeddedDb, createPgDb, migrate } from "./db.js";
import { createMailer } from "./mailer.js";
import { createStore } from "./store.js";
import { createBilling } from "./billing.js";
import { createLlm } from "./llm.js";
import { createNotifier } from "./notify.js";
import { createPipeline } from "./pipeline.js";
import { seedSources } from "./seed.js";

let cfg;
try {
  cfg = loadConfig();
} catch (e) {
  console.error((e as Error).message);
  console.error("\nCopy api/.env.example to api/.env and fill it in. See docs/GOOGLE_LOGIN.md and docs/VPS_DEPLOY.md.");
  process.exit(1);
}

let db;
try {
  if (cfg.databaseUrl) {
    db = createPgDb(cfg.databaseUrl);
  } else {
    db = await createEmbeddedDb("data/pgdata");
    console.log("No DATABASE_URL set: using the embedded dev database in api/data/pgdata (development only).");
  }
  await migrate(db);
} catch (e) {
  console.error("Database error:", (e as Error).message);
  console.error("Is PostgreSQL running and DATABASE_URL correct? (local: `docker compose up -d db` from the repo root)");
  process.exit(1);
}

const client = cfg.googleClientId ? new OAuth2Client(cfg.googleClientId) : null;

const mailer = createMailer(cfg);
const billing = createBilling(cfg, db);
const notifier = createNotifier(cfg, db, mailer);
const llm = createLlm(cfg);
const pipeline = createPipeline(cfg, db, billing, notifier, llm);
await seedSources(db);

const app = createApp({
  cfg,
  store: createStore(db),
  mailer,
  product: { db, billing, notifier, pipeline, llm },
  async verifyGoogle(credential) {
    if (!client) throw new Error("google disabled");
    // Checks signature, expiry, issuer (accounts.google.com) and that the token was issued for OUR client ID.
    const ticket = await client.verifyIdToken({ idToken: credential, audience: cfg.googleClientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) throw new Error("unverified google account");
    return { sub: p.sub, email: p.email, name: p.name ?? p.email, picture: p.picture };
  },
});

const server = app.listen(cfg.port, "127.0.0.1", () => {
  console.log(`Hirely API listening on http://localhost:${cfg.port}`);
  console.log(`  payments: ${cfg.billingMode} | whatsapp: ${cfg.whatsapp ? "on" : "off"} | ai: ${cfg.llm ? cfg.llm.model : "off"} | adzuna: ${cfg.adzuna ? "on" : "off"} | email: ${mailer.enabled ? "on" : "off"} | google: ${cfg.googleClientId ? "on" : "off"}`);
});
pipeline.start();

const shutdown = () => { pipeline.stop(); server.close(() => db.close().finally(() => process.exit(0))); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
