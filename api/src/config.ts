export type Config = {
  googleClientId: string; // empty = Google login disabled
  jwtSecret: string;
  databaseUrl: string; // empty = embedded dev database
  allowedOrigins: string[];
  port: number;
  production: boolean;
  smtp?: { host: string; port: number; user: string; pass: string; from: string };
};

/** Reads and validates environment. Throws with a clear message so misconfiguration fails fast. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];
  const production = env.NODE_ENV === "production";
  const googleClientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const jwtSecret = (env.JWT_SECRET ?? "").trim();
  const databaseUrl = (env.DATABASE_URL ?? "").trim();

  if (googleClientId && !googleClientId.endsWith(".apps.googleusercontent.com")) {
    problems.push("GOOGLE_CLIENT_ID must end with .apps.googleusercontent.com (or leave it empty to disable Google login)");
  }
  if (jwtSecret.length < 32) problems.push("JWT_SECRET must be at least 32 characters");
  // Empty is fine in development (an embedded database is used). Production must point at a real server.
  if (databaseUrl ? !/^postgres(ql)?:\/\//.test(databaseUrl) : production) {
    problems.push("DATABASE_URL must be a postgres:// connection string" + (production ? " (required in production)" : ""));
  }

  let smtp: Config["smtp"];
  if (env.SMTP_HOST) {
    smtp = {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      user: env.SMTP_USER ?? "",
      pass: env.SMTP_PASS ?? "",
      from: env.MAIL_FROM ?? "",
    };
    if (!smtp.user || !smtp.pass || !smtp.from) problems.push("SMTP_HOST is set, so SMTP_USER, SMTP_PASS and MAIL_FROM are required");
  } else if (production) {
    problems.push("SMTP_HOST (and SMTP_USER, SMTP_PASS, MAIL_FROM) are required in production for email login");
  }

  if (problems.length) throw new Error("Config error:\n - " + problems.join("\n - "));

  return {
    googleClientId,
    jwtSecret,
    databaseUrl,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
    port: Number(env.PORT ?? 4000),
    production,
    smtp,
  };
}
