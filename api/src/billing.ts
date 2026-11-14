import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { PLANS, planRank, type PlanId } from "./plans.js";

/**
 * Payments. Three modes (see config.billingMode):
 *   subscription  Razorpay Subscriptions: the customer approves a mandate once (UPI Autopay / card) and is charged monthly.
 *   pass          Razorpay one-time payment for 30 days. Fallback until Razorpay enables Subscriptions on the account.
 *   mock          No money moves. For local development and demos only (ALLOW_MOCK_PAYMENTS=true).
 *
 * Rules the product promises:
 *   - No refund for a period already paid; access continues to the end of that period.
 *   - "Stop renewal" is always available and takes effect at period end.
 *   - Upgrade = new purchase; the old plan is replaced immediately.
 */

export type SubRow = {
  id: string; user_id: string; plan: PlanId; provider: string; provider_ref: string | null; status: string;
  cancel_at_period_end: boolean; cancel_reason: string | null; current_period_start: Date | null; current_period_end: Date | null; created_at: Date;
};

/** Auto-renewing plans get a short grace after period end while the renewal charge is confirmed by webhook. */
const GRACE_HOURS = 36;
export const LIVE_SQL = `status = 'active' and (current_period_end > now()
  or (provider = 'razorpay_subscription' and not cancel_at_period_end and current_period_end > now() - interval '${GRACE_HOURS} hours'))`;

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addMonth = (d: Date) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; };
const fromUnix = (v: unknown) => (typeof v === "number" && v > 0 ? new Date(v * 1000) : undefined);

export type Billing = ReturnType<typeof createBilling>;

export function createBilling(cfg: Config, db: Db, fetchImpl: typeof fetch = fetch) {
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params))[0];

  async function rz<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!cfg.razorpay) throw new Error("razorpay not configured");
    const res = await fetchImpl(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: { Authorization: "Basic " + Buffer.from(`${cfg.razorpay.keyId}:${cfg.razorpay.keySecret}`).toString("base64"), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
    if (!res.ok) throw new Error(`razorpay ${path}: ${res.status} ${data.error?.description ?? ""}`);
    return data as T;
  }

  const live = (userId: string) => one<SubRow>(`select * from subscriptions where user_id = $1 and ${LIVE_SQL} order by current_period_end desc limit 1`, [userId]);

  /** Marks a purchase as paid and live. Safe to call twice for the same payment (webhook + browser callback both arrive). */
  async function activate(ref: string, pay: { id: string; amountPaise: number } | null, period?: { start?: Date; end?: Date }) {
    const sub = await one<SubRow>("select * from subscriptions where provider_ref = $1", [ref]);
    if (!sub) return null;
    if (sub.status === "replaced") return sub; // an upgrade already took over; a late event must not bring this back
    if (pay) {
      const fresh = await one("insert into payments (user_id, subscription_id, provider_payment_id, amount_paise, status) values ($1,$2,$3,$4,'captured') on conflict (provider_payment_id) do nothing returning id", [sub.user_id, sub.id, pay.id, pay.amountPaise]);
      if (!fresh && sub.status === "active" && !period?.end) return sub; // already handled
    }
    const others = await db.query<SubRow>(`select * from subscriptions where user_id = $1 and id <> $2 and ${LIVE_SQL}`, [sub.user_id, sub.id]);
    let start = period?.start ?? sub.current_period_start ?? new Date();
    let end = period?.end;
    if (!end) {
      if (sub.status === "active" && sub.current_period_end) end = sub.current_period_end;
      else if (sub.provider === "razorpay_subscription") end = addMonth(start);
      else {
        // One-time pass: if renewing the same plan early, the new 30 days start when the current ones finish.
        const same = others.find((o) => o.plan === sub.plan && o.current_period_end && o.current_period_end > start);
        if (same?.current_period_end) start = same.current_period_end;
        end = addDays(start, 30);
      }
    }
    for (const o of others) {
      await db.query("update subscriptions set status = 'replaced', updated_at = now() where id = $1", [o.id]);
      if (o.provider === "razorpay_subscription" && o.provider_ref && !o.cancel_at_period_end) {
        try { await rz("POST", `/subscriptions/${o.provider_ref}/cancel`, { cancel_at_cycle_end: 0 }); }
        catch (e) { console.error("could not cancel replaced subscription", o.provider_ref, (e as Error).message); }
      }
    }
    return one<SubRow>("update subscriptions set status = 'active', current_period_start = $2, current_period_end = $3, updated_at = now() where id = $1 returning *", [sub.id, start, end]);
  }

  return {
    live,
    history: (userId: string) => db.query<SubRow>("select * from subscriptions where user_id = $1 and status <> 'created' order by created_at desc limit 12", [userId]),
    payments: (userId: string) => db.query<{ provider_payment_id: string; amount_paise: number; status: string; created_at: Date }>("select provider_payment_id, amount_paise, status, created_at from payments where user_id = $1 order by created_at desc limit 24", [userId]),

    /** Step 1 of buying: creates the Razorpay subscription/order and tells the browser what to open. */
    async startCheckout(user: { id: string; email: string; name: string }, plan: PlanId) {
      if (cfg.billingMode === "off") throw new Error("billing_off");
      const cur = await live(user.id);
      if (cur && !cur.cancel_at_period_end && cur.provider === "razorpay_subscription" && planRank(plan) <= planRank(cur.plan)) throw new Error("already_subscribed");
      if (cur && planRank(plan) < planRank(cur.plan)) throw new Error("downgrade_at_period_end");
      const p = PLANS[plan];
      const notes = { user_id: user.id, plan };

      if (cfg.billingMode === "subscription") {
        const s = await rz<{ id: string }>("POST", "/subscriptions", { plan_id: cfg.razorpay!.planIds[plan], total_count: 120, quantity: 1, customer_notify: 1, notes });
        await db.query("insert into subscriptions (user_id, plan, provider, provider_ref, status) values ($1,$2,'razorpay_subscription',$3,'created')", [user.id, plan, s.id]);
        return { mode: "subscription" as const, keyId: cfg.razorpay!.keyId, subscriptionId: s.id, amountPaise: p.pricePaise, planName: p.name };
      }
      if (cfg.billingMode === "pass") {
        const o = await rz<{ id: string }>("POST", "/orders", { amount: p.pricePaise, currency: "INR", receipt: `h_${Date.now()}`, notes });
        await db.query("insert into subscriptions (user_id, plan, provider, provider_ref, status) values ($1,$2,'razorpay_pass',$3,'created')", [user.id, plan, o.id]);
        return { mode: "pass" as const, keyId: cfg.razorpay!.keyId, orderId: o.id, amountPaise: p.pricePaise, planName: p.name };
      }
      const ref = `mock_${randomUUID()}`;
      await db.query("insert into subscriptions (user_id, plan, provider, provider_ref, status) values ($1,$2,'mock',$3,'created')", [user.id, plan, ref]);
      return { mode: "mock" as const, ref, amountPaise: p.pricePaise, planName: p.name };
    },

    /** Step 2: the browser returns what Razorpay Checkout gave it. We check Razorpay's signature before believing it. */
    async confirmCheckout(userId: string, body: { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_order_id?: string; razorpay_signature?: string; ref?: string }) {
      if (cfg.billingMode === "mock") {
        const sub = await one<SubRow>("select * from subscriptions where provider_ref = $1 and user_id = $2 and provider = 'mock'", [body.ref ?? "", userId]);
        if (!sub) throw new Error("not_found");
        return activate(sub.provider_ref!, { id: `mockpay_${randomUUID()}`, amountPaise: PLANS[sub.plan].pricePaise });
      }
      const { razorpay_payment_id: pid, razorpay_signature: sig } = body;
      const ref = body.razorpay_subscription_id ?? body.razorpay_order_id;
      if (!cfg.razorpay || !pid || !sig || !ref) throw new Error("bad_request");
      const payload = body.razorpay_subscription_id ? `${pid}|${ref}` : `${ref}|${pid}`;
      if (!safeEq(createHmac("sha256", cfg.razorpay.keySecret).update(payload).digest("hex"), sig)) throw new Error("bad_signature");
      const sub = await one<SubRow>("select * from subscriptions where provider_ref = $1 and user_id = $2", [ref, userId]);
      if (!sub) throw new Error("not_found");
      let period: { start?: Date; end?: Date } | undefined;
      if (sub.provider === "razorpay_subscription") {
        try {
          const s = await rz<{ current_start?: number; current_end?: number }>("GET", `/subscriptions/${ref}`);
          period = { start: fromUnix(s.current_start), end: fromUnix(s.current_end) };
        } catch { /* the webhook will correct the dates */ }
      }
      return activate(ref, { id: pid, amountPaise: PLANS[sub.plan].pricePaise }, period);
    },

    /** Stop renewal. Access stays until the end of the paid period. */
    async cancel(userId: string, reason: string) {
      const cur = await live(userId);
      if (!cur) return null;
      if (cur.provider === "razorpay_subscription" && cur.provider_ref && !cur.cancel_at_period_end) {
        try { await rz("POST", `/subscriptions/${cur.provider_ref}/cancel`, { cancel_at_cycle_end: 1 }); }
        catch (e) {
          // Razorpay refuses "at cycle end" in some states (for example before the first charge settles). Cancel now; our own period end still stands.
          console.error("cancel at cycle end failed, cancelling immediately:", (e as Error).message);
          await rz("POST", `/subscriptions/${cur.provider_ref}/cancel`, { cancel_at_cycle_end: 0 });
        }
      }
      return one<SubRow>("update subscriptions set cancel_at_period_end = true, cancel_reason = $2, updated_at = now() where id = $1 returning *", [cur.id, reason.slice(0, 200)]);
    },

    /** Razorpay webhook. Returns false when the signature is wrong. Replays are ignored. */
    async handleWebhook(rawBody: Buffer, signature: string, eventId: string): Promise<boolean> {
      if (!cfg.razorpay?.webhookSecret) return false;
      if (!safeEq(createHmac("sha256", cfg.razorpay.webhookSecret).update(rawBody).digest("hex"), signature)) return false;
      type Ev = { event: string; payload?: { subscription?: { entity: { id: string; current_start?: number; current_end?: number } }; payment?: { entity: { id: string; amount: number; order_id?: string } } } };
      const ev = JSON.parse(rawBody.toString("utf8")) as Ev;
      const id = eventId || createHmac("sha256", "evt").update(rawBody).digest("hex");
      const first = await one("insert into webhook_events (id, source) values ($1, 'razorpay') on conflict do nothing returning id", [id]);
      if (!first) return true;

      const s = ev.payload?.subscription?.entity;
      const p = ev.payload?.payment?.entity;
      const pay = p ? { id: p.id, amountPaise: p.amount } : null;
      switch (ev.event) {
        case "subscription.activated":
        case "subscription.charged":
          if (s) await activate(s.id, pay, { start: fromUnix(s.current_start), end: fromUnix(s.current_end) });
          break;
        case "subscription.halted": // every retry of the renewal charge failed
          if (s) await db.query("update subscriptions set status = 'halted', updated_at = now() where provider_ref = $1 and status = 'active'", [s.id]);
          break;
        case "subscription.cancelled":
        case "subscription.completed":
        case "subscription.expired":
          // The mandate is gone (the customer may have revoked it in their UPI app). Paid time still counts.
          if (s) await db.query("update subscriptions set cancel_at_period_end = true, cancel_reason = coalesce(cancel_reason, $2), status = case when status = 'active' and current_period_end > now() then 'active' when status = 'replaced' then 'replaced' else 'cancelled' end, updated_at = now() where provider_ref = $1", [s.id, ev.event]);
          break;
        case "payment.captured":
        case "order.paid":
          if (p?.order_id) await activate(p.order_id, pay);
          break;
      }
      return true;
    },

    /** Run every few minutes: closes periods that have ended. */
    async expireEnded() {
      await db.query(`update subscriptions set status = 'expired', updated_at = now() where status = 'active' and not (${LIVE_SQL})`);
      await db.query("delete from subscriptions where status = 'created' and created_at < now() - interval '2 days'");
    },
  };
}
