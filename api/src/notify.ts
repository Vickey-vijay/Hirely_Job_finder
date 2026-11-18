import { createHmac, timingSafeEqual } from "node:crypto";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import type { Attachment, Mailer } from "./mailer.js";
import { LIVE_SQL } from "./billing.js";
import { buildResumeDocx, resumeFileName } from "./resume-docx.js";
import { createTelegram, escHtml, type Telegram } from "./telegram.js";
import { DIGEST_MAX_JOBS, DIGEST_TIME_IST_MIN, NOTIFY_MIN_SCORE, PLANS, WHATSAPP_INSTANT_MAX_PER_DAY, type PlanId } from "./plans.js";

/**
 * Alerts. Three kinds of message:
 *   instant  a new match scoring 6+ goes out at once by email and Telegram (and WhatsApp on Pro).
 *            Each user gets at most their daily limit per India day. A job counts once, whatever the channel.
 *   summary  one message at 09:00 India time with yesterday's best matches (max 5), by WhatsApp and email.
 *   resume   Pro: a tailored Word file for a strong match (score 7+), by email and Telegram.
 *
 * WhatsApp cost control:
 *   - outside the 24h window we must use an approved template (charged per message), so the summary uses ONE
 *     short template and invites the user to reply MORE;
 *   - any reply opens a 24h window in which we can send the full text as a normal message;
 *   - Pro instant WhatsApp is capped at WHATSAPP_INSTANT_MAX_PER_DAY a day (each message costs money).
 */

export type AlertItem = { matchId: string; score: number; title: string; company: string; location: string; url: string; why: string | null };
type Target = {
  user_id: string; name: string; email: string; plan: PlanId; phone: string | null; whatsapp_opt_in: boolean;
  email_instant: boolean; email_digest: boolean; max_alerts_per_day: number;
  telegram_chat_id: string | null; telegram_alerts: boolean;
  wa_last_inbound_at: Date | null; last_digest_at: Date | null;
};

const IST_OFFSET_MIN = 330;
/** Minutes after midnight in India, and the instant that IST day started. */
export function istClock(now: Date) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const dayStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_OFFSET_MIN * 60_000);
  return { minutes, dayStart };
}

/** The India calendar day as YYYY-MM-DD. Used as the key for daily limits. */
export function istDay(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** The 09:00 India summary for today, if it has passed and was not sent yet. */
export function morningSlot(lastDigestAt: Date | null, now = new Date()): Date | null {
  const { minutes, dayStart } = istClock(now);
  if (minutes < DIGEST_TIME_IST_MIN) return null;
  const slot = new Date(dayStart.getTime() + DIGEST_TIME_IST_MIN * 60_000);
  return !lastDigestAt || lastDigestAt < slot ? slot : null;
}

/** Yesterday in India time, as the half-open range [from, to). */
export function previousIstDay(now = new Date()) {
  const { dayStart } = istClock(now);
  return { from: new Date(dayStart.getTime() - 86_400_000), to: dayStart };
}

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const line = (i: AlertItem, n: number) => `${n}. ${i.title} at ${i.company} (${i.location || "India"}) - fit ${i.score}/10\n${i.url}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Template parameters may not contain new lines, tabs or runs of spaces. */
const param = (s: string, max = 120) => s.replace(/\s+/g, " ").trim().slice(0, max) || "-";

export type Notifier = ReturnType<typeof createNotifier>;

export function createNotifier(cfg: Config, db: Db, mailer: Mailer, fetchImpl: typeof fetch = fetch) {
  const wa = cfg.whatsapp;
  const telegram: Telegram = createTelegram(cfg, db, fetchImpl);

  async function waPost(payload: Record<string, unknown>): Promise<string> {
    const res = await fetchImpl(`https://graph.facebook.com/${wa!.apiVersion}/${wa!.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wa!.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(`whatsapp ${res.status}: ${data.error?.message ?? "send failed"}`);
    return data.messages?.[0]?.id ?? "";
  }
  const waText = (to: string, body: string) => waPost({ to, type: "text", text: { preview_url: false, body: body.slice(0, 4000) } });

  const record = (userId: string, channel: string, kind: string, ok: boolean, count: number, info: string) =>
    db.query("insert into notifications (user_id, channel, kind, status, error, provider_id, job_count) values ($1,$2,$3,$4,$5,$6,$7)", [userId, channel, kind, ok ? "sent" : "failed", ok ? null : info.slice(0, 500), ok ? info : null, count]);

  /** Records a successful send so it counts against the daily limit (instant) and shows in the log. */
  const logSent = (userId: string, matchId: string, channel: string, kind: "instant" | "resume", day: string) =>
    db.query("insert into alert_log (user_id, match_id, channel, kind, ist_day) values ($1,$2,$3,$4,$5) on conflict do nothing", [userId, matchId, channel, kind, day]);

  /** Jobs sent instantly today (each job counts once). Pass a channel to count only that channel. */
  async function instantToday(userId: string, day: string, channel?: string): Promise<number> {
    const r = await db.query<{ n: string }>(
      "select count(distinct match_id)::text as n from alert_log where user_id = $1 and kind = 'instant' and ist_day = $2 and ($3::text is null or channel = $3)",
      [userId, day, channel ?? null]);
    return Number(r[0]?.n ?? 0);
  }

  const pending = (userId: string, minScore: number, limit: number) =>
    db.query<AlertItem>(
      `select m.id as "matchId", m.score, j.title, j.company, j.location, j.url, m.why
       from matches m join jobs j on j.id = m.job_id
       where m.user_id = $1 and m.notified_at is null and m.status = 'new' and m.score >= $2 and j.active and m.created_at > now() - interval '4 days'
       order by m.score desc, m.created_at desc limit $3`, [userId, minScore, limit]);

  /** The text version of a list. WhatsApp gets the reply hint, email does not. */
  function listText(t: Target, items: AlertItem[], intro: string, forWhatsApp: boolean) {
    const tail = forWhatsApp
      ? `All matches: ${cfg.appUrl}/matches\nReply PAUSE to pause alerts, STOP to stop WhatsApp alerts.`
      : `All matches: ${cfg.appUrl}/matches`;
    return `Hi ${firstName(t.name)}, ${intro}\n\n${items.map((i, n) => line(i, n + 1)).join("\n\n")}\n\n${tail}`;
  }

  function emailHtml(t: Target, items: AlertItem[], intro: string) {
    return `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;color:#12263f"><p>Hi ${esc(firstName(t.name))},</p><p>${esc(intro)}</p>${items.map((i) => `<div style="border:1px solid #dbe3ee;border-radius:12px;padding:14px;margin:10px 0"><b>${esc(i.title)}</b><br><span style="color:#51647c">${esc(i.company)} · ${esc(i.location || "India")}</span><br><span style="color:#0b7a55;font-weight:600">Fit ${i.score}/10</span>${i.why ? `<br><span style="color:#51647c">${esc(i.why)}</span>` : ""}<br><a href="${esc(i.url)}" style="color:#1d4ed8">View and apply</a></div>`).join("")}<p><a href="${cfg.appUrl}/matches" style="color:#1d4ed8">Open all your matches</a></p><p style="color:#8494a8;font-size:12px">You get this because you subscribed to ${esc(cfg.business.name)} alerts. Turn email alerts off in Settings. Got a job? Tell us in Settings and we stop your renewal.</p></div>`;
  }

  /** WhatsApp: the full text inside the 24h window, otherwise the approved template. */
  async function waSend(t: Target, items: AlertItem[], intro: string): Promise<string> {
    const inWindow = t.wa_last_inbound_at && Date.now() - t.wa_last_inbound_at.getTime() < 23.5 * 3_600_000;
    if (inWindow) return waText(t.phone!, listText(t, items, intro, true));
    const top = items[0];
    return waPost({
      to: t.phone, type: "template",
      template: {
        name: wa!.template, language: { code: wa!.templateLang },
        components: [{ type: "body", parameters: [firstName(t.name), String(items.length), `${top.title} at ${top.company}`, String(top.score)].map((text) => ({ type: "text", text: param(text) })) }],
      },
    });
  }

  /** One job, sent instantly on every channel that is on for this user. The job is marked as sent. */
  async function deliverInstant(t: Target, i: AlertItem, day: string) {
    const one = [i];
    const intro = "a new job matched your profile:";
    if (mailer.enabled && t.email_instant) {
      try {
        await mailer.send(t.email, `Strong match (${i.score}/10): ${i.title} at ${i.company}`, listText(t, one, intro, false), emailHtml(t, one, intro));
        await logSent(t.user_id, i.matchId, "email", "instant", day);
        await record(t.user_id, "email", "instant", true, 1, "");
      } catch (e) { await record(t.user_id, "email", "instant", false, 1, (e as Error).message); }
    }
    if (telegram.enabled && t.telegram_chat_id && t.telegram_alerts) {
      try {
        const why = i.why ? `\n${escHtml(i.why)}` : "";
        await telegram.sendMessage(t.telegram_chat_id, `<b>Match ${i.score}/10</b>\n<b>${escHtml(i.title)}</b> at ${escHtml(i.company)}\n${escHtml(i.location || "India")}${why}\n<a href="${escHtml(i.url)}">View and apply</a>`);
        await logSent(t.user_id, i.matchId, "telegram", "instant", day);
        await record(t.user_id, "telegram", "instant", true, 1, "");
      } catch (e) { await record(t.user_id, "telegram", "instant", false, 1, (e as Error).message); }
    }
    if (wa && PLANS[t.plan].whatsappInstant && t.whatsapp_opt_in && t.phone) {
      const cap = Math.min(WHATSAPP_INSTANT_MAX_PER_DAY, t.max_alerts_per_day);
      if ((await instantToday(t.user_id, day, "whatsapp")) < cap) {
        try {
          const id = await waSend(t, one, intro);
          await logSent(t.user_id, i.matchId, "whatsapp", "instant", day);
          await record(t.user_id, "whatsapp", "instant", true, 1, id);
        } catch (e) { await record(t.user_id, "whatsapp", "instant", false, 1, (e as Error).message); }
      }
    }
    await db.query("update matches set notified_at = now() where id = $1", [i.matchId]);
  }

  /** The 09:00 summary: yesterday's best matches by WhatsApp and email. */
  async function deliverSummary(t: Target, items: AlertItem[]) {
    const n = items.length;
    const intro = `${n === 1 ? "here is your best match from yesterday" : `here are your ${n} best matches from yesterday`}:`;
    if (wa && t.whatsapp_opt_in && t.phone) {
      try { const id = await waSend(t, items, intro); await record(t.user_id, "whatsapp", "digest", true, n, id); }
      catch (e) { await record(t.user_id, "whatsapp", "digest", false, n, (e as Error).message); }
    }
    if (mailer.enabled && t.email_digest) {
      try {
        await mailer.send(t.email, `${n} best match${n === 1 ? "" : "es"} from yesterday, best fit ${items[0].score}/10`, listText(t, items, intro, false), emailHtml(t, items, intro));
        await record(t.user_id, "email", "digest", true, n, "");
      } catch (e) { await record(t.user_id, "email", "digest", false, n, (e as Error).message); }
    }
  }

  const TARGET_SQL = `select u.id as user_id, u.name, u.email, s.plan, p.phone, p.whatsapp_opt_in, p.email_instant, p.email_digest, p.max_alerts_per_day,
      p.telegram_chat_id::text as telegram_chat_id, p.telegram_alerts, p.wa_last_inbound_at, p.last_digest_at
    from users u join profiles p on p.user_id = u.id
    join lateral (select plan from subscriptions where user_id = u.id and ${LIVE_SQL} order by current_period_end desc limit 1) s on true
    where p.onboarded_at is not null and not p.alerts_paused and p.got_job_at is null`;

  return {
    whatsappEnabled: !!wa,
    telegram,

    /** Called every minute. Sends each subscriber the 09:00 summary once a day. */
    async runDigests(now = new Date()): Promise<number> {
      const { from, to } = previousIstDay(now);
      let sent = 0;
      for (const t of await db.query<Target>(TARGET_SQL)) {
        if (!morningSlot(t.last_digest_at, now)) continue;
        await db.query("update profiles set last_digest_at = $2 where user_id = $1", [t.user_id, now]);
        const items = await db.query<AlertItem>(
          `select m.id as "matchId", m.score, j.title, j.company, j.location, j.url, m.why
           from matches m join jobs j on j.id = m.job_id
           where m.user_id = $1 and m.status = 'new' and m.score >= $2 and j.active and m.created_at >= $3 and m.created_at < $4
           order by m.score desc, m.created_at desc limit $5`, [t.user_id, NOTIFY_MIN_SCORE, from, to, DIGEST_MAX_JOBS]);
        if (!items.length) continue; // nothing good yesterday: stay quiet rather than send filler
        await deliverSummary(t, items);
        sent++;
      }
      return sent;
    },

    /** Instant alerts for new strong matches, up to each user's daily limit. Returns the number of jobs sent. */
    async runInstant(now = new Date()): Promise<number> {
      const day = istDay(now);
      let sent = 0;
      for (const t of await db.query<Target>(TARGET_SQL)) {
        const waOn = !!wa && PLANS[t.plan].whatsappInstant && t.whatsapp_opt_in && !!t.phone;
        const anyChannel = (mailer.enabled && t.email_instant) || (telegram.enabled && !!t.telegram_chat_id && t.telegram_alerts) || waOn;
        if (!anyChannel) continue;
        const room = t.max_alerts_per_day - (await instantToday(t.user_id, day));
        if (room <= 0) continue;
        for (const i of await pending(t.user_id, NOTIFY_MIN_SCORE, room)) {
          await deliverInstant(t, i, day);
          sent++;
        }
      }
      return sent;
    },

    /** Pro: sends a tailored resume (already stored in tailored_resumes) as a Word file by email and Telegram. */
    async deliverTailored(userId: string, matchId: string, now = new Date()): Promise<void> {
      const t = (await db.query<Target>(`${TARGET_SQL} and u.id = $1`, [userId]))[0];
      if (!t) return;
      const row = (await db.query<{ content: string; title: string; company: string; url: string }>(
        `select tr.content, j.title, j.company, j.url from tailored_resumes tr join matches m on m.id = tr.match_id join jobs j on j.id = m.job_id
         where tr.match_id = $1 and tr.user_id = $2`, [matchId, userId]))[0];
      if (!row) return;
      const file = await buildResumeDocx(row.content);
      const filename = resumeFileName(row.company, row.title);
      const day = istDay(now);
      if (mailer.enabled && t.email_instant) {
        try {
          const att: Attachment = { filename, content: file, contentType: WORD_MIME };
          await mailer.send(t.email, `Your tailored resume for ${row.title} at ${row.company}`,
            `Hi ${firstName(t.name)},\n\nYour tailored resume for ${row.title} at ${row.company} is attached as a Word file.\n\nCheck every line is true for you before you send it. You are the one signing it.\n\nJob: ${row.url}\nAll matches: ${cfg.appUrl}/matches`,
            undefined, [att]);
          await logSent(t.user_id, matchId, "email", "resume", day);
          await record(t.user_id, "email", "resume", true, 1, "");
        } catch (e) { await record(t.user_id, "email", "resume", false, 1, (e as Error).message); }
      }
      if (telegram.enabled && t.telegram_chat_id && t.telegram_alerts) {
        try {
          await telegram.sendDocument(t.telegram_chat_id, file, filename,
            `<b>Tailored resume</b> for ${escHtml(row.title)} at ${escHtml(row.company)}.\nCheck every line is true for you before you send it.`);
          await logSent(t.user_id, matchId, "telegram", "resume", day);
          await record(t.user_id, "telegram", "resume", true, 1, "");
        } catch (e) { await record(t.user_id, "telegram", "resume", false, 1, (e as Error).message); }
      }
      await db.query("update tailored_resumes set delivered_at = now() where match_id = $1", [matchId]);
    },

    /** Confirmation right after a plan starts, so the user sees the channel works. */
    async welcome(userId: string) {
      const t = (await db.query<Target>(`${TARGET_SQL.replace("where p.onboarded_at is not null and not p.alerts_paused and p.got_job_at is null", "where true")} and u.id = $1`, [userId]))[0];
      if (!t) return;
      const text = `Your ${PLANS[t.plan].name} plan is active. We are now watching for jobs that fit your profile and will only send the ones worth applying to.\n\nDashboard: ${cfg.appUrl}/dashboard`;
      if (mailer.enabled) { try { await mailer.send(t.email, `${cfg.business.name}: your ${PLANS[t.plan].name} plan is active`, `Hi ${firstName(t.name)},\n\n${text}`); } catch { /* not critical */ } }
    },

    // ---------- WhatsApp webhook ----------

    /** Meta calls this once when you save the webhook URL. */
    verifyWebhook(mode: unknown, token: unknown, challenge: unknown): string | null {
      return wa && mode === "subscribe" && typeof token === "string" && token === wa.verifyToken && typeof challenge === "string" ? challenge : null;
    },

    /** Incoming WhatsApp messages: STOP, PAUSE, RESUME, anything else returns the latest matches. */
    async handleWebhook(rawBody: Buffer, signature: string): Promise<boolean> {
      if (!wa) return false;
      if (wa.appSecret) {
        const want = Buffer.from("sha256=" + createHmac("sha256", wa.appSecret).update(rawBody).digest("hex"));
        const got = Buffer.from(signature);
        if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
      }
      type Body = { entry?: { changes?: { value?: { messages?: { id: string; from: string; type: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }[] } }[] }[] };
      const body = JSON.parse(rawBody.toString("utf8")) as Body;
      for (const m of body.entry?.flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []) ?? []) {
        const first = await db.query("insert into webhook_events (id, source) values ($1, 'whatsapp') on conflict do nothing returning id", [m.id]);
        if (!first.length) continue;
        const phone = m.from.replace(/\D/g, "");
        const user = (await db.query<{ user_id: string; name: string }>("update profiles p set wa_last_inbound_at = now() from users u where u.id = p.user_id and p.phone = $1 returning p.user_id, u.name", [phone]))[0];
        if (!user) continue;
        const word = (m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "").trim().toUpperCase();
        let reply: string;
        if (word === "STOP" || word === "UNSUBSCRIBE") {
          await db.query("update profiles set whatsapp_opt_in = false where user_id = $1", [user.user_id]);
          reply = `Done. You will not get WhatsApp alerts from ${cfg.business.name} any more. Your plan and email alerts are unchanged. Turn WhatsApp back on any time in Settings: ${cfg.appUrl}/settings`;
        } else if (word === "PAUSE") {
          await db.query("update profiles set alerts_paused = true where user_id = $1", [user.user_id]);
          reply = "Alerts paused. Reply RESUME when you want them back.";
        } else if (word === "RESUME" || word === "START") {
          await db.query("update profiles set alerts_paused = false where user_id = $1", [user.user_id]);
          reply = "Alerts are back on.";
        } else {
          const items = await db.query<AlertItem>(
            `select m.id as "matchId", m.score, j.title, j.company, j.location, j.url, m.why from matches m join jobs j on j.id = m.job_id
             where m.user_id = $1 and m.status = 'new' and j.active and m.score >= $2 order by m.created_at desc, m.score desc limit $3`, [user.user_id, NOTIFY_MIN_SCORE, DIGEST_MAX_JOBS]);
          reply = items.length
            ? `Your latest matches:\n\n${items.map((i, n) => line(i, n + 1)).join("\n\n")}\n\nAll matches: ${cfg.appUrl}/matches`
            : `No new matches right now. We keep watching and will message you when something fits. Dashboard: ${cfg.appUrl}/dashboard`;
        }
        try { await waText(phone, reply); } catch (e) { console.error("whatsapp reply failed:", (e as Error).message); }
      }
      return true;
    },
  };
}
