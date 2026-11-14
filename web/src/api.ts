/** Typed calls to the Hirely API. Every function throws ApiError with a message that is safe to show the user. */

export type Plan = { id: "starter" | "plus" | "pro"; name: string; pricePaise: number; maxRoles: number; digestsPerDay: number; instantAlerts: boolean; tailoredResume: boolean; tailorPerDay: number; tagline: string; features: string[] };
export type Domain = { name: string; roles: string[]; skills: string[] };
export type PublicConfig = {
  plans: Plan[]; billingMode: "subscription" | "pass" | "mock" | "off"; googleClientId: string; emailLogin: boolean; whatsapp: boolean; ai: boolean;
  business: { name: string; contactEmail: string; supportUpi: string; grievanceName: string; address: string };
  domains: Domain[]; cities: string[]; stats: { jobs: number; companies: number; sources: number };
};
export type Profile = {
  phone: string | null; whatsappOptIn: boolean; emailAlerts: boolean; headline: string; domain: string; roles: string[]; skills: string[]; locations: string[];
  remoteOk: boolean; experienceYears: number; resumeFilename: string | null; resumeUploadedAt: string | null; hasResume: boolean; alertsPaused: boolean; gotJobAt: string | null; onboardedAt: string | null;
};
export type Subscription = { plan: Plan["id"]; planName: string; status: string; provider: string; autoRenews: boolean; cancelAtPeriodEnd: boolean; periodStart: string | null; periodEnd: string | null };
export type Account = { profile: Profile; subscription: Subscription | null; matches: { total: number; today: number; best: number | null } };
export type Match = {
  id: string; score: number; reasons: string[]; why: string | null; status: "new" | "applied" | "dismissed"; feedback: "good" | "bad" | null; createdAt: string;
  title: string; company: string; location: string; remote: boolean; url: string; salary: string | null; postedAt: string | null; active: boolean; tailored: boolean;
};
export type Guess = { roles: string[]; skills: string[]; locations: string[]; experienceYears: number; headline: string };
export type Preview = { count: number; strong: number; examples: { title: string; company: string; location: string; score: number; reasons: string[] }[] };

const MESSAGES: Record<string, string> = {
  unauthenticated: "Please sign in again.",
  invalid_phone: "That doesn't look like an Indian mobile number. Use 10 digits, for example 98765 43210.",
  roles_required: "Add at least one job role you want.",
  invalid_experience: "Enter your years of experience as a number.",
  unsupported_file: "Please upload a PDF, DOCX or TXT file.",
  empty_resume: "We couldn't read any text in that file. If it is a scanned image, upload a typed PDF or DOCX instead.",
  unreadable_file: "We couldn't open that file. Try saving it again as PDF.",
  file_too_large: "That file is over 5 MB. Please upload a smaller one.",
  billing_off: "Payments are not switched on yet. Please check back soon.",
  already_subscribed: "You already have this plan (or a higher one).",
  downgrade_at_period_end: "To move to a smaller plan, stop renewal and pick the new plan when the current month ends.",
  payment_provider_error: "The payment service didn't respond. Nothing was charged. Please try again.",
  bad_signature: "We couldn't verify that payment. If money was taken, it will be matched automatically within a few minutes; otherwise contact us.",
  pro_required: "Tailored resumes are part of the Pro plan.",
  ai_not_configured: "Tailored resumes are not switched on yet.",
  resume_required: "Upload your resume first so we have something to tailor.",
  daily_limit: "You've used today's tailored resumes. More are available tomorrow.",
  tailor_failed: "We couldn't write that resume just now. Please try again.",
  cancel_failed: "We couldn't reach the payment service to stop your renewal. Please try again in a minute.",
  origin_not_allowed: "This page is not allowed to do that.",
};

export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(MESSAGES[code] ?? "Something went wrong. Please try again."); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status === 429 && !data.error ? "rate" : data.error ?? "server_error", res.status);
  return data as T;
}
MESSAGES.network = "Can't reach the server. Check your connection and try again.";
MESSAGES.rate = "Too many tries. Please wait a minute.";

export const api = {
  config: () => call<PublicConfig>("GET", "/api/public/config"),
  account: () => call<Account>("GET", "/api/account"),
  saveProfile: (p: Record<string, unknown>) => call<{ profile: Profile }>("PUT", "/api/profile", p),
  uploadResume: (file: File) => { const f = new FormData(); f.append("file", file); return call<{ guess: Guess; usedAi: boolean }>("POST", "/api/profile/resume", f); },
  deleteResume: () => call<void>("DELETE", "/api/profile/resume"),
  alerts: (b: { paused?: boolean; whatsappOptIn?: boolean; emailAlerts?: boolean }) => call<{ profile: Profile }>("PATCH", "/api/account/alerts", b),
  gotJob: () => call<{ subscription: Subscription | null }>("POST", "/api/account/got-job", {}),
  lookingAgain: () => call<void>("POST", "/api/account/looking-again", {}),
  deleteAccount: () => call<void>("DELETE", "/api/account"),
  matches: (status: string) => call<{ matches: Match[]; subscribed: boolean }>("GET", `/api/matches?status=${status}`),
  preview: () => call<Preview>("GET", "/api/matches/preview"),
  updateMatch: (id: string, b: { status?: string; feedback?: string }) => call<{ ok: true }>("PATCH", `/api/matches/${id}`, b),
  tailor: (id: string) => call<{ content: string }>("POST", `/api/matches/${id}/tailor`, {}),
  tailored: (id: string) => call<{ content: string; title: string; company: string; url: string }>("GET", `/api/matches/${id}/tailor`),
  billing: () => call<{ mode: string; subscription: Subscription | null; payments: { id: string; amountPaise: number; status: string; at: string }[] }>("GET", "/api/billing"),
  checkout: (plan: string) => call<{ mode: "subscription" | "pass" | "mock"; keyId?: string; subscriptionId?: string; orderId?: string; ref?: string; amountPaise: number; planName: string; prefill: { name: string; email: string } }>("POST", "/api/billing/checkout", { plan }),
  confirm: (b: Record<string, string>) => call<{ subscription: Subscription }>("POST", "/api/billing/confirm", b),
  cancel: (reason: string) => call<{ subscription: Subscription | null }>("POST", "/api/billing/cancel", { reason }),
  admin: {
    overview: () => call<Record<string, any>>("GET", "/api/admin/overview"),
    sources: () => call<{ kinds: string[]; sources: any[] }>("GET", "/api/admin/sources"),
    addSource: (b: { kind: string; token: string; company: string }) => call("POST", "/api/admin/sources", b),
    toggleSource: (id: string, enabled: boolean) => call("PATCH", `/api/admin/sources/${id}`, { enabled }),
    users: () => call<{ users: any[] }>("GET", "/api/admin/users"),
  },
};

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const daysLeft = (iso: string | null | undefined) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0);
export function ago(iso: string | null): string {
  if (!iso) return "";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open(): void; on(ev: string, cb: (r: unknown) => void): void } } }

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new ApiError("payment_provider_error", 0));
    document.body.appendChild(s);
  });
}

/** Runs the whole purchase: creates the order, opens Razorpay, confirms the result. Resolves null if the user closes the window. */
export async function buyPlan(plan: Plan["id"], businessName: string): Promise<Subscription | null> {
  const co = await api.checkout(plan);
  if (co.mode === "mock") return (await api.confirm({ ref: co.ref! })).subscription;
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: co.keyId,
      ...(co.mode === "subscription" ? { subscription_id: co.subscriptionId } : { order_id: co.orderId, amount: co.amountPaise, currency: "INR" }),
      name: businessName,
      description: `${co.planName} plan, ${rupees(co.amountPaise)} a month`,
      prefill: co.prefill,
      theme: { color: "#1f5fd1" },
      modal: { ondismiss: () => resolve(null) },
      handler: (r: Record<string, string>) => { api.confirm(r).then((d) => resolve(d.subscription)).catch(reject); },
    });
    rz.open();
  });
}
