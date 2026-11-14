import { createHmac, timingSafeEqual } from "node:crypto";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import type { Mailer } from "./mailer.js";
import { LIVE_SQL } from "./billing.js";
import { DIGEST_MAX_JOBS, DIGEST_SLOTS_IST, NOTIFY_MIN_SCORE, PLANS, type PlanId } from "./plans.js";

/**
 * Alerts. A "digest" is one message listing a user's best new matches (up to 5).
 * Channels: WhatsApp (official Cloud API, only if configured and the user opted in), email, and the dashboard.
 *
 * WhatsApp cost control:
 *   - outside the 24h window we must use an approved template (charged per message), so we send ONE short
 *     template per digest and invite the user to reply MORE;
 *   - any reply opens a 24h window in which we can send the full list as a normal message.
 */

export type AlertItem = { matchId: string; score: number; title: string; company: string; location: string; url: string; why: string | null };
type Target = { user_id: string; name: string; email: string; plan: PlanId; phone: string | null; whatsapp_opt_in: boolean; email_alerts: boolean; wa_last_inbound_at: Date | null; last_digest_at: Date | null };

const IST_OFFSET_MIN = 330;
/** Minutes after midnight in India, and the instant that IST day started. */
function istClock(now: Date) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const dayStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - IST_OFFSET_MIN * 60_000);
  return { minutes, dayStart };
}

/** The most recent alert slot that has passed today for this plan, or null if none yet. */
export function dueSlot(plan: PlanId, lastDigestAt: Date | null, now = new Date()): Date | null {
  const { minutes, dayStart } = istClock(now);
  const passed = DIGEST_SLOTS_IST[PLANS[plan].digestsPerDay].filter((m) => m <= minutes);
  if (!passed.length) return null;
  const slot = new Date(dayStart.getTime() + passed[passed.length - 1] * 60_000);
  return !lastDigestAt || lastDigestAt < slot ? slot : null;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const line = (i: AlertItem, n: number) => `${n}. ${i.title} at ${i.company} (${i.location || "India"}) - fit ${i.score}/10\n${i.url}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Template parameters may not contain new lines, tabs or runs of spaces. */
const param = (s: string, max = 120) => s.replace(/\s+/g, " ").trim().slice(0, max) || "-";

export type Notifier = ReturnType<typeof createNotifier>;

export function createNotifier(cfg: Config, db: Db, mailer: Mailer, fetchImpl: typeof fetch = fetch) {
  const wa = cfg.whatsapp;

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

  const pending = (userId: string, minScore: number, limit: number) =>
    db.query<AlertItem>(
      `select m.id as "matchId", m.score, j.title, j.company, j.location, j.url, m.why
       from matches m join jobs j on j.id = m.job_id
       where m.user_id = $1 and m.notified_at is null and m.status = 'new' and m.score >= $2 and j.active and m.created_at > now() - interval '4 days'
       order by m.score desc, m.created_at desc limit $3`, [userId, minScore, limit]);

  function listText(t: Target, items: AlertItem[]) {
    return `Hi ${firstName(t.name)}, ${items.length} new job${items.length === 1 ? "" : "s"} for you:\n\n${items.map((i, n) => line(i, n + 1)).join("\n\n")}\n\nAll matches: ${cfg.appUrl}/matches\nReply PAUSE to pause alerts, STOP to stop WhatsApp alerts.`;
  }

  async function deliver(t: Target, items: AlertItem[], kind: "digest" | "instant") {
    const top = items[0];
    // WhatsApp
    if (wa && t.whatsapp_opt_in && t.phone) {
      try {
        const inWindow = t.wa_last_inbound_at && Date.now() - t.wa_last_inbound_at.getTime() < 23.5 * 3_600_000;
        const id = inWindow
          ? await waText(t.phone, listText(t, items))
          : await waPost({
              to: t.phone, type: "template",
              template: {
                name: wa.template, language: { code: wa.templateLang },
                components: [{ type: "body", parameters: [firstName(t.name), String(items.length), `${top.title} at ${top.company}`, String(top.score)].map((text) => ({ type: "text", text: param(text) })) }],
              },
            });
        await record(t.user_id, "whatsapp", kind, true, items.length, id);
      } catch (e) {
        await record(t.user_id, "whatsapp", kind, false, items.length, (e as Error).message);
      }
    }
    // Email
    if (mailer.enabled && t.email_alerts) {
      try {
        const subject = kind === "instant" ? `Strong match (${top.score}/10): ${top.title} at ${top.company}` : `${items.length} new job${items.length === 1 ? "" : "s"} for you, best fit ${top.score}/10`;
        const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;color:#12263f"><p>Hi ${esc(firstName(t.name))},</p><p>${items.length} new job${items.length === 1 ? "" : "s"} matched your profile.</p>${items.map((i) => `<div style="border:1px solid #dbe3ee;border-radius:12px;padding:14px;margin:10px 0"><b>${esc(i.title)}</b><br><span style="color:#51647c">${esc(i.company)} · ${esc(i.location || "India")}</span><br><span style="color:#0b7a55;font-weight:600">Fit ${i.score}/10</span>${i.why ? `<br><span style="color:#51647c">${esc(i.why)}</span>` : ""}<br><a href="${esc(i.url)}" style="color:#1d4ed8">View and apply</a></div>`).join("")}<p><a href="${cfg.appUrl}/matches" style="color:#1d4ed8">Open all your matches</a></p><p style="color:#8494a8;font-size:12px">You get this because you subscribed to ${esc(cfg.business.name)} alerts. Turn email alerts off in Settings. Got a job? Tell us in Settings and we stop your renewal.</p></div>`;
        await mailer.send(t.email, subject, listText(t, items).replace(/\nReply PAUSE.*$/, ""), html);
        await record(t.user_id, "email", kind, true, items.length, "");
      } catch (e) {
        await record(t.user_id, "email", kind, false, items.length, (e as Error).message);
      }
    }
    await db.query("update matches set notified_at = now() where id = any($1::uuid[])", [items.map((i) => i.matchId)]);
  }

  const TARGET_SQL = `select u.id as user_id, u.name, u.email, s.plan, p.phone, p.whatsapp_opt_in, p.email_alerts, p.wa_last_inbound_at, p.last_digest_at
    from users u join profiles p on p.user_id = u.id
    join lateral (select plan from subscriptions where user_id = u.id and ${LIVE_SQL} order by current_period_end desc limit 1) s on true
    where p.onboarded_at is not null and not p.alerts_paused and p.got_job_at is null`;

  return {
    whatsappEnabled: !!wa,

    /** Called every minute. Sends each subscriber their digest when one of their plan's time slots has passed. */
    async runDigests(now = new Date()): Promise<number> {
      const targets = await db.query<Target>(TARGET_SQL);
      let sent = 0;
      for (const t of targets) {
        const slot = dueSlot(t.plan, t.last_digest_at, now);
        if (!slot) continue;
        await db.query("update profiles set last_digest_at = $2 where user_id = $1", [t.user_id, now]);
        const items = await pending(t.user_id, NOTIFY_MIN_SCORE, DIGEST_MAX_JOBS);
        if (!items.length) continue; // nothing good enough: we stay quiet rather than send filler
        await deliver(t, items, "digest");
        sent++;
      }
      return sent;
    },

    /** Pro plan: a 9/10 or 10/10 match goes out straight away (at most 2 a day). */
    async runInstant(): Promise<number> {
      const targets = (await db.query<Target>(TARGET_SQL)).filter((t) => PLANS[t.plan].instantAlerts);
      let sent = 0;
      for (const t of targets) {
        const today = await db.query<{ n: string }>("select count(distinct date_trunc('minute', created_at))::text as n from notifications where user_id = $1 and kind = 'instant' and created_at > now() - interval '20 hours'", [t.user_id]);
        if (Number(today[0]?.n ?? 0) >= 2) continue;
        const items = await pending(t.user_id, 9, 1);
        if (!items.length) continue;
        await deliver(t, items, "instant");
        sent++;
      }
      return sent;
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
