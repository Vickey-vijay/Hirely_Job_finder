import type { PlanId } from "./plans.js";

export type BillingMode = "subscription" | "pass" | "mock" | "off";

export type Config = {
  googleClientId: string; // empty = Google login disabled
  jwtSecret: string;
  databaseUrl: string; // empty = embedded dev database
  allowedOrigins: string[];
  appUrl: string; // public address of the website, used in links we send
  port: number;
  production: boolean;
  smtp?: { host: string; port: number; user: string; pass: string; from: string };
  adminEmails: string[];
  billingMode: BillingMode;
  razorpay?: { keyId: string; keySecret: string; webhookSecret: string; planIds: Partial<Record<PlanId, string>> };
  whatsapp?: { token: string; phoneId: string; appSecret: string; verifyToken: string; template: string; templateLang: string; apiVersion: string };
  telegram?: { token: string; botUsername: string; webhookSecret: string };
  llm?: { apiKey: string; model: string };
  adzuna?: { appId: string; appKey: string };
  ingestEnabled: boolean;
  business: { name: string; contactEmail: string; supportUpi: string; grievanceName: string; address: string };
};

/** Reads and validates environment. Throws with a clear message so misconfiguration fails fast. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];
  const v = (k: string) => (env[k] ?? "").trim();
  const production = env.NODE_ENV === "production";
  const googleClientId = v("GOOGLE_CLIENT_ID");
  const jwtSecret = v("JWT_SECRET");
  const databaseUrl = v("DATABASE_URL");

  if (googleClientId && !googleClientId.endsWith(".apps.googleusercontent.com")) {
    problems.push("GOOGLE_CLIENT_ID must end with .apps.googleusercontent.com (or leave it empty to disable Google login)");
  }
  if (jwtSecret.length < 32) problems.push("JWT_SECRET must be at least 32 characters");
  // Empty is fine in development (an embedded database is used). Production must point at a real server.
  if (databaseUrl ? !/^postgres(ql)?:\/\//.test(databaseUrl) : production) {
    problems.push("DATABASE_URL must be a postgres:// connection string" + (production ? " (required in production)" : ""));
  }

  let smtp: Config["smtp"];
  if (v("SMTP_HOST")) {
    smtp = { host: v("SMTP_HOST"), port: Number(v("SMTP_PORT") || 587), user: v("SMTP_USER"), pass: v("SMTP_PASS"), from: v("MAIL_FROM") };
    if (!smtp.user || !smtp.pass || !smtp.from) problems.push("SMTP_HOST is set, so SMTP_USER, SMTP_PASS and MAIL_FROM are required");
  }
  if (production && !smtp && !googleClientId) {
    console.warn("WARNING: nobody can sign in yet. Set GOOGLE_CLIENT_ID and/or SMTP_HOST (with SMTP_USER, SMTP_PASS, MAIL_FROM) in .env.");
  }

  // ---- Payments ----
  let razorpay: Config["razorpay"];
  if (v("RAZORPAY_KEY_ID")) {
    razorpay = {
      keyId: v("RAZORPAY_KEY_ID"),
      keySecret: v("RAZORPAY_KEY_SECRET"),
      webhookSecret: v("RAZORPAY_WEBHOOK_SECRET"),
      planIds: { starter: v("RAZORPAY_PLAN_STARTER") || undefined, plus: v("RAZORPAY_PLAN_PLUS") || undefined, pro: v("RAZORPAY_PLAN_PRO") || undefined },
    };
    if (!razorpay.keySecret) problems.push("RAZORPAY_KEY_ID is set, so RAZORPAY_KEY_SECRET is required");
    if (production && !razorpay.webhookSecret) problems.push("RAZORPAY_WEBHOOK_SECRET is required in production");
  }
  const wanted = v("BILLING_MODE").toLowerCase(); // optional override: subscription | pass | mock | off
  const allPlans = !!(razorpay?.planIds.starter && razorpay.planIds.plus && razorpay.planIds.pro);
  let billingMode: BillingMode = "off";
  if (razorpay) billingMode = wanted === "pass" ? "pass" : allPlans ? "subscription" : "pass";
  else if (v("ALLOW_MOCK_PAYMENTS") === "true") billingMode = "mock";
  if (wanted === "off") billingMode = "off";
  if (wanted === "subscription" && !allPlans) problems.push("BILLING_MODE=subscription needs RAZORPAY_PLAN_STARTER, RAZORPAY_PLAN_PLUS and RAZORPAY_PLAN_PRO");

  // ---- WhatsApp ----
  let whatsapp: Config["whatsapp"];
  if (v("WHATSAPP_TOKEN")) {
    whatsapp = {
      token: v("WHATSAPP_TOKEN"), phoneId: v("WHATSAPP_PHONE_ID"), appSecret: v("WHATSAPP_APP_SECRET"),
      verifyToken: v("WHATSAPP_VERIFY_TOKEN"), template: v("WHATSAPP_TEMPLATE") || "job_digest",
      templateLang: v("WHATSAPP_TEMPLATE_LANG") || "en", apiVersion: v("WHATSAPP_API_VERSION") || "v27.0",
    };
    if (!whatsapp.phoneId) problems.push("WHATSAPP_TOKEN is set, so WHATSAPP_PHONE_ID is required");
    if (production && (!whatsapp.appSecret || !whatsapp.verifyToken)) problems.push("WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN are required in production");
  }

  // ---- Telegram (free Bot API). Empty token = Telegram is off everywhere. ----
  let telegram: Config["telegram"];
  if (v("TELEGRAM_BOT_TOKEN")) {
    telegram = { token: v("TELEGRAM_BOT_TOKEN"), botUsername: v("TELEGRAM_BOT_USERNAME").replace(/^@/, ""), webhookSecret: v("TELEGRAM_WEBHOOK_SECRET") };
    if (!telegram.botUsername) problems.push("TELEGRAM_BOT_TOKEN is set, so TELEGRAM_BOT_USERNAME is required");
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(telegram.webhookSecret)) problems.push("TELEGRAM_WEBHOOK_SECRET is required when TELEGRAM_BOT_TOKEN is set (16+ letters, digits, _ or -)");
  }

  const allowedOrigins = (v("ALLOWED_ORIGINS") || "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean);
  if (problems.length) throw new Error("Config error:\n - " + problems.join("\n - "));

  return {
    googleClientId, jwtSecret, databaseUrl, allowedOrigins,
    appUrl: (v("APP_URL") || allowedOrigins[0]).replace(/\/$/, ""),
    port: Number(v("PORT") || 4000),
    production, smtp,
    adminEmails: v("ADMIN_EMAILS").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean),
    billingMode, razorpay, whatsapp, telegram,
    llm: v("ANTHROPIC_API_KEY") ? { apiKey: v("ANTHROPIC_API_KEY"), model: v("LLM_MODEL") || "claude-haiku-5-5" } : undefined,
    adzuna: v("ADZUNA_APP_ID") && v("ADZUNA_APP_KEY") ? { appId: v("ADZUNA_APP_ID"), appKey: v("ADZUNA_APP_KEY") } : undefined,
    ingestEnabled: v("INGEST_ENABLED") !== "false",
    business: {
      name: v("BUSINESS_NAME") || "Hirely",
      contactEmail: v("CONTACT_EMAIL"),
      supportUpi: v("SUPPORT_UPI"),
      grievanceName: v("GRIEVANCE_NAME"),
      address: v("BUSINESS_ADDRESS"),
    },
  };
}
