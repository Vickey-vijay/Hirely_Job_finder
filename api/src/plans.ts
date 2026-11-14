/** The three plans. Prices are in paise and include any tax. Change here and in the Razorpay dashboard together. */
export type PlanId = "starter" | "plus" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  pricePaise: number;
  maxRoles: number;
  digestsPerDay: number;
  instantAlerts: boolean;
  tailoredResume: boolean;
  tailorPerDay: number;
  tagline: string;
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter", name: "Starter", pricePaise: 9900, maxRoles: 1, digestsPerDay: 1,
    instantAlerts: false, tailoredResume: false, tailorPerDay: 0,
    tagline: "One role, watched all day.",
    features: ["1 target job role", "1 daily alert with your best matches", "Every match scored 1 to 10 with reasons", "WhatsApp + email + dashboard"],
  },
  plus: {
    id: "plus", name: "Plus", pricePaise: 19900, maxRoles: 5, digestsPerDay: 2,
    instantAlerts: false, tailoredResume: false, tailorPerDay: 0,
    tagline: "Open to more than one path.",
    features: ["Up to 5 target job roles", "2 alerts a day (morning and evening)", "Every match scored 1 to 10 with reasons", "WhatsApp + email + dashboard"],
  },
  pro: {
    id: "pro", name: "Pro", pricePaise: 49900, maxRoles: 5, digestsPerDay: 3,
    instantAlerts: true, tailoredResume: true, tailorPerDay: 5,
    tagline: "Alerts plus a resume written for each job.",
    features: ["Everything in Plus", "3 alerts a day + instant alert for 9/10 matches", "Tailored resume for each job (up to 5 a day)", "Copy the text or print to PDF"],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "plus", "pro"];
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
export const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);

/** Alert times in India (IST), as minutes after midnight. */
export const DIGEST_SLOTS_IST: Record<number, number[]> = {
  1: [9 * 60 + 30],
  2: [9 * 60 + 30, 18 * 60 + 30],
  3: [9 * 60 + 30, 13 * 60 + 30, 18 * 60 + 30],
};

/** Only matches at or above this score are sent as alerts. Lower ones stay on the dashboard. */
export const NOTIFY_MIN_SCORE = 6;
export const STORE_MIN_SCORE = 5;
export const DIGEST_MAX_JOBS = 5;
