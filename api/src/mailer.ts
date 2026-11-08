import nodemailer from "nodemailer";
import type { Config } from "./config.js";

export type Mailer = { sendLoginCode(to: string, code: string): Promise<void> };

/** SMTP when configured; otherwise (development only) prints the code to the API console. */
export function createMailer(cfg: Config): Mailer {
  if (!cfg.smtp) {
    return {
      async sendLoginCode(to, code) {
        console.log(`\n[DEV EMAIL] To: ${to}  |  Hirely login code: ${code}\n`);
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
  });
  return {
    async sendLoginCode(to, code) {
      await transport.sendMail({
        from: cfg.smtp!.from,
        to,
        subject: `Your Hirely code: ${code}`,
        text: `Your Hirely sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
        html: `<p>Your Hirely sign-in code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:600">${code}</p><p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
      });
    },
  };
}
