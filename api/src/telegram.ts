import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Config } from "./config.js";
import type { Db } from "./db.js";

/**
 * Telegram via the free Bot API. Off unless TELEGRAM_BOT_TOKEN is set.
 *
 * Connecting: the signed-in user asks for a link, which holds a one-time token (30 minutes). They open it,
 * press Start, and Telegram posts "/start <token>" to our webhook. We then store their chat id on the profile.
 * Sending: plain HTML messages, and Word files as documents. If the user blocks the bot (HTTP 403) we forget the chat.
 */

export const TELEGRAM_LINK_TTL_MIN = 30;

export class TelegramBlocked extends Error {}

export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type Telegram = ReturnType<typeof createTelegram>;

export function createTelegram(cfg: Config, db: Db, fetchImpl: typeof fetch = fetch) {
  const tg = cfg.telegram;
  const enabled = !!tg;

  async function call(method: string, body: FormData | Record<string, unknown>): Promise<void> {
    const isForm = body instanceof FormData;
    const res = await fetchImpl(`https://api.telegram.org/bot${tg!.token}/${method}`, {
      method: "POST",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (res.status === 403) throw new TelegramBlocked(data.description ?? "forbidden");
    if (!res.ok || !data.ok) throw new Error(`telegram ${method} ${res.status}: ${(data.description ?? "failed").slice(0, 200)}`);
  }

  /** A send to one chat. If the user has blocked the bot, the chat is forgotten so we stop trying. */
  async function toChat(chatId: string, fn: () => Promise<void>) {
    try { await fn(); }
    catch (e) {
      if (e instanceof TelegramBlocked) {
        await db.query("update profiles set telegram_chat_id = null, telegram_connected_at = null where telegram_chat_id = $1", [chatId]);
      }
      throw e;
    }
  }

  const reply = (chatId: string, html: string) =>
    call("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } })
      .catch((e) => console.error("telegram reply failed:", (e as Error).message));

  return {
    enabled,
    botUsername: tg?.botUsername ?? "",

    sendMessage(chatId: string, html: string): Promise<void> {
      return toChat(chatId, () => call("sendMessage", { chat_id: chatId, text: html.slice(0, 4000), parse_mode: "HTML", link_preview_options: { is_disabled: true } }));
    },

    sendDocument(chatId: string, file: Buffer, filename: string, caption: string): Promise<void> {
      return toChat(chatId, async () => {
        const form = new FormData();
        form.append("chat_id", chatId);
        form.append("caption", caption.slice(0, 1000));
        form.append("parse_mode", "HTML");
        form.append("document", new Blob([new Uint8Array(file)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), filename);
        await call("sendDocument", form);
      });
    },

    /** Creates a one-time link for this user. Older unused links are removed. */
    async createLink(userId: string): Promise<{ token: string; url: string; expiresAt: string }> {
      const token = randomBytes(24).toString("base64url");
      await db.query("delete from telegram_links where user_id = $1 or expires_at < now()", [userId]);
      const row = await db.query<{ expires_at: Date }>(
        "insert into telegram_links (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(mins => $3)) returning expires_at",
        [hashToken(token), userId, TELEGRAM_LINK_TTL_MIN]);
      return { token, url: `https://t.me/${tg?.botUsername ?? ""}?start=${token}`, expiresAt: new Date(row[0].expires_at).toISOString() };
    },

    /** Forgets the chat for this user. Telegram alerts stop; other channels are unchanged. */
    async disconnect(userId: string) {
      await db.query("update profiles set telegram_chat_id = null, telegram_connected_at = null where user_id = $1", [userId]);
    },

    /** Tells Telegram where our webhook is. Called on start-up; a failure is logged by the caller and never stops the API. */
    async setWebhook(appUrl: string): Promise<void> {
      if (!tg) return;
      await call("setWebhook", { url: `${appUrl}/api/webhooks/telegram`, secret_token: tg.webhookSecret, allowed_updates: ["message"], drop_pending_updates: false });
    },

    /** Handles one update from Telegram. Returns the HTTP status to answer with. */
    async handleWebhook(secretHeader: string | undefined, rawBody: Buffer): Promise<number> {
      if (!tg) return 404;
      if (!secretHeader || !safeEq(secretHeader, tg.webhookSecret)) return 403;
      type Update = { message?: { chat?: { id?: number; type?: string }; text?: string } };
      let update: Update;
      try { update = JSON.parse(rawBody.toString("utf8")) as Update; } catch { return 400; }
      const msg = update.message;
      const chatId = msg?.chat?.id;
      if (!msg || chatId === undefined || msg.chat?.type !== "private") return 200; // groups and channels are ignored
      const chat = String(chatId);
      const m = /^\/(start|stop)(?:@\w+)?(?:\s+(\S+))?$/.exec((msg.text ?? "").trim());
      if (!m) return 200; // anything else is ignored

      if (m[1] === "start") {
        const token = m[2];
        const link = token
          ? (await db.query<{ user_id: string }>("delete from telegram_links where token_hash = $1 and expires_at > now() returning user_id", [hashToken(token)]))[0]
          : undefined;
        if (link) {
          await db.query("update profiles set telegram_chat_id = $2, telegram_connected_at = now(), telegram_alerts = true where user_id = $1", [link.user_id, chat]);
          await reply(chat, "Connected. Hirely alerts will arrive here.");
        } else {
          await reply(chat, token
            ? "That link has expired. Open Hirely Settings and tap Connect Telegram again."
            : "To get Hirely alerts here, open Hirely Settings and tap Connect Telegram.");
        }
      } else {
        await db.query("update profiles set telegram_chat_id = null, telegram_connected_at = null where telegram_chat_id = $1", [chat]);
        await reply(chat, "Telegram alerts are off. You can connect again any time from Hirely Settings.");
      }
      return 200;
    },
  };
}
