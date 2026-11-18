/** The three plans. Prices are in paise and include tax. Change here and in the Razorpay dashboard together. */
export type PlanId = "starter" | "plus" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  pricePaise: number;
  maxRoles: number;
  /** Instant alerts by email and Telegram for new matches (capped by the user's daily limit). */
  instantAlerts: boolean;
  /** Instant WhatsApp alerts. Each WhatsApp message costs money, so this is Pro only and capped (see WHATSAPP_INSTANT_MAX_PER_DAY). */
  whatsappInstant: boolean;
  /** Tailored resume for each strong match, sent as a Word file. */
  tailoredResume: boolean;
  /** Maximum tailored resumes per IST day. */
  tailorPerDay: number;
  tagline: string;
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter", name: "Starter", pricePaise: 9900, maxRoles: 1,
    instantAlerts: true, whatsappInstant: false, tailoredResume: false, tailorPerDay: 0,
    tagline: "One role, watched all day.",
    features: [
      "1 target job role",
      "Instant alerts by email and Telegram (you set the daily limit, up to 10)",
      "WhatsApp summary every morning at 9 AM",
      "Every match scored 1 to 10 with reasons",
    ],
  },
  plus: {
    id: "plus", name: "Plus", pricePaise: 19900, maxRoles: 5,
    instantAlerts: true, whatsappInstant: false, tailoredResume: false, tailorPerDay: 0,
    tagline: "Open to more than one path.",
    features: [
      "Up to 5 target job roles, switch any time",
      "Instant alerts by email and Telegram (you set the daily limit, up to 10)",
      "WhatsApp summary every morning at 9 AM",
      "Every match scored 1 to 10 with reasons",
    ],
  },
  pro: {
    id: "pro", name: "Pro", pricePaise: 29900, maxRoles: 5,
    instantAlerts: true, whatsappInstant: true, tailoredResume: true, tailorPerDay: 5,
    tagline: "Alerts plus a resume written for each job.",
    features: [
      "Everything in Plus",
      "Instant WhatsApp alerts too (up to 5 a day)",
      "A tailored resume for each strong match, sent as a Word file to your email and Telegram (up to 5 a day)",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "plus", "pro"];
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
export const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);

/** The one morning summary time for every plan, in India (IST), as minutes after midnight. */
export const DIGEST_TIME_IST_MIN = 9 * 60;

/** Instant alerts per user per IST day can be set from 1 to this many. The default is 5. */
export const ALERTS_PER_DAY_MIN = 1;
export const ALERTS_PER_DAY_MAX = 10;
export const ALERTS_PER_DAY_DEFAULT = 5;

/** Only matches at or above this score are sent as alerts. Lower ones stay on the dashboard. */
export const NOTIFY_MIN_SCORE = 6;
/** Pro: a tailored resume is written for matches at or above this score. */
export const TAILOR_MIN_SCORE = 7;
export const STORE_MIN_SCORE = 5;
/** The morning summary lists at most this many jobs. */
export const DIGEST_MAX_JOBS = 5;

/**
 * WhatsApp instant alerts (Pro only) are capped at this many a day per user.
 * Each WhatsApp message costs money (Meta charges per conversation), so keep this low.
 * The daily alert limit of the user also applies on top of this.
 */
export const WHATSAPP_INSTANT_MAX_PER_DAY = 5;

/** Clamps a user-supplied daily limit into 1..10. Anything that is not a number falls back to the default. */
export function clampAlertsPerDay(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return ALERTS_PER_DAY_DEFAULT;
  return Math.min(ALERTS_PER_DAY_MAX, Math.max(ALERTS_PER_DAY_MIN, Math.round(n)));
}
