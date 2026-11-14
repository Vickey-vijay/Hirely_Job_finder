import nodemailer from "nodemailer";
import type { Config } from "./config.js";

export type Mailer = {
  /** false when no SMTP is configured in production: email features are switched off. */
  enabled: boolean;
  sendLoginCode(to: string, code: string): Promise<void>;
  send(to: string, subject: string, text: string, html?: string): Promise<void>;
};

/** SMTP when configured; otherwise (development only) prints to the API console. */
export function createMailer(cfg: Config): Mailer {
  if (!cfg.smtp) {
    return {
      enabled: !cfg.production,
      async sendLoginCode(to, code) {
        if (cfg.production) throw new Error("email not configured");
        console.log(`\n[DEV EMAIL] To: ${to}  |  Hirely login code: ${code}\n`);
      },
      async send(to, subject, text) {
        if (!cfg.production) console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}\n`);
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
  });
  const from = cfg.smtp.from;
  return {
    enabled: true,
    async sendLoginCode(to, code) {
      await transport.sendMail({
        from, to,
        subject: `Your Hirely code: ${code}`,
        text: `Your Hirely sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
        html: `<p>Your Hirely sign-in code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:600">${code}</p><p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
      });
    },
    async send(to, subject, text, html) {
      await transport.sendMail({ from, to, subject, text, html });
    },
  };
}
