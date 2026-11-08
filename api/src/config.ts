export type Config = {
  googleClientId: string;
  jwtSecret: string;
  allowedOrigins: string[];
  port: number;
  production: boolean;
};

/** Reads and validates environment. Throws with a clear message so misconfiguration fails fast. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];
  const googleClientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const jwtSecret = (env.JWT_SECRET ?? "").trim();

  if (!googleClientId.endsWith(".apps.googleusercontent.com")) {
    problems.push("GOOGLE_CLIENT_ID is missing or not a Google OAuth client ID (ends with .apps.googleusercontent.com)");
  }
  if (jwtSecret.length < 32) problems.push("JWT_SECRET must be at least 32 characters");
  if (problems.length) throw new Error("Config error:\n - " + problems.join("\n - "));

  return {
    googleClientId,
    jwtSecret,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "http://localhost:5173")
      .split(",").map((s) => s.trim()).filter(Boolean),
    port: Number(env.PORT ?? 4000),
    production: env.NODE_ENV === "production",
  };
}
