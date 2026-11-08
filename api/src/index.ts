import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createStore } from "./store.js";

let cfg;
try {
  cfg = loadConfig();
} catch (e) {
  console.error((e as Error).message);
  console.error("\nCopy api/.env.example to api/.env and fill it in. See docs/GOOGLE_LOGIN.md.");
  process.exit(1);
}

const client = new OAuth2Client(cfg.googleClientId);

const app = createApp({
  cfg,
  store: createStore("data/users.json"),
  async verifyGoogle(credential) {
    // Checks signature, expiry, issuer (accounts.google.com) and that the token was issued for OUR client ID.
    const ticket = await client.verifyIdToken({ idToken: credential, audience: cfg.googleClientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) throw new Error("unverified google account");
    return { sub: p.sub, email: p.email, name: p.name ?? p.email, picture: p.picture };
  },
});

app.listen(cfg.port, () => console.log(`Hirely API listening on http://localhost:${cfg.port}`));
