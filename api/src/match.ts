/**
 * Scores how well a job fits a person, from 1 to 10, using plain rules (no AI needed).
 * The same inputs always give the same score, and every score comes with reasons a user can read.
 *
 * Weights: role/title 50%, skills 27%, location 15%, experience 8%.
 */

export type MatchProfile = {
  roles: string[];
  skills: string[];
  locations: string[];
  remoteOk: boolean;
  experienceYears: number;
};

export type MatchJob = {
  title: string;
  company: string;
  location: string;
  remote: boolean;
  inIndia: boolean;
  description: string;
};

export type MatchResult = { score: number; reasons: string[] };

const STOP = new Set(["of", "and", "the", "for", "in", "a", "an", "to", "with", "at", "on", "or", "i", "ii", "iii", "iv", "v", "1", "2", "3"]);

const SENIORITY = new Set(["senior", "junior", "lead", "principal", "staff", "associate", "intern", "trainee", "fresher", "head", "chief", "entry", "level", "graduate"]);

/** Words that mean the same thing in job titles. Right side is the word we compare on. */
const SYN: Record<string, string> = {
  sr: "senior", jr: "junior", developer: "engineer", programmer: "engineer", sde: "engineer", swe: "engineer", dev: "engineer",
  development: "engineer", engineering: "engineer", mgr: "manager", management: "manager", exec: "executive",
  tester: "qa", testing: "qa", sdet: "qa", quality: "qa", accounts: "accountant", accounting: "accountant",
  recruiter: "hr", recruitment: "hr", talent: "hr", teaching: "teacher", faculty: "teacher", lecturer: "teacher", tutor: "teacher",
  nursing: "nurse", selling: "sales", bde: "sales", bdm: "sales", "front-end": "frontend", "back-end": "backend", "full-stack": "fullstack",
  ui: "design", ux: "design", designer: "design", analytics: "analyst", analysis: "analyst", scientist: "science",
  marketer: "marketing", writer: "content", copywriter: "content", editor: "content", operations: "ops", operation: "ops",
  support: "support", service: "support", care: "support", admin: "administrator", administration: "administrator",
  pharmacist: "pharmacy", technician: "technician", tech: "technician",
};

/** A role word on the left is also satisfied by any title word on the right (weaker match). */
const FAMILY: Record<string, string[]> = {
  software: ["backend", "frontend", "fullstack", "web", "application", "platform", "mobile", "android", "ios", "java", "python", "node", "react"],
  sales: ["business", "account", "inside", "revenue"],
  support: ["success", "helpdesk", "experience"],
  hr: ["people", "acquisition"],
  marketing: ["growth", "brand", "seo", "social", "performance"],
};

const CITY_ALIASES: string[][] = [
  ["bengaluru", "bangalore"], ["gurugram", "gurgaon"], ["delhi", "new delhi", "ncr", "noida", "gurugram", "gurgaon"],
  ["mumbai", "bombay", "navi mumbai", "thane"], ["chennai", "madras"], ["kolkata", "calcutta"], ["kochi", "cochin"],
  ["thiruvananthapuram", "trivandrum"], ["pune", "pimpri"], ["hyderabad", "secunderabad"], ["mysuru", "mysore"],
];

export function norm(s: string): string {
  return s.toLowerCase().replace(/full[\s-]?stack/g, "fullstack").replace(/front[\s-]?end/g, "frontend").replace(/back[\s-]?end/g, "backend")
    .replace(/[^a-z0-9+#.]+/g, " ").replace(/\.(?=\s|$)/g, " ").trim();
}

function tokens(s: string, dropSeniority: boolean): string[] {
  return norm(s).split(" ").map((t) => SYN[t] ?? t).filter((t) => t && !STOP.has(t) && !(dropSeniority && SENIORITY.has(t)));
}

/** 0..1: how much of the wanted role appears in the job title. Squared so half-matches ("data analyst" vs "data engineer") stay low. */
export function roleFit(role: string, title: string): number {
  const want = [...new Set(tokens(role, true))];
  if (!want.length) return 0;
  const have = new Set(tokens(title, true));
  let got = 0;
  for (const w of want) {
    if (have.has(w)) got += 1;
    else if (FAMILY[w]?.some((f) => have.has(f))) got += 0.7;
  }
  const overlap = got / want.length;
  // The last word of a role is its core ("analyst" in "data analyst"). Missing it means a different job.
  const head = want[want.length - 1];
  const headHit = have.has(head) || !!FAMILY[head]?.some((f) => have.has(f));
  return headHit ? overlap * overlap : overlap * overlap * 0.5;
}

function hasTerm(haystack: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9+#])`).test(haystack);
}

function cityForms(city: string): string[] {
  const c = norm(city);
  const group = CITY_ALIASES.find((g) => g.includes(c));
  return group ? group : [c];
}

/** Seniority level implied by the title: 0 intern/fresher, 1 junior, 2 mid, 3 senior, 4 leadership. */
function titleLevel(title: string): number {
  const t = ` ${norm(title)} `;
  if (/ (intern|internship|trainee|fresher|apprentice|graduate) /.test(t)) return 0;
  if (/ (director|vp|vice president|head|chief|cxo|president|gm|general manager) /.test(t)) return 4;
  if (/ (senior|sr|lead|principal|staff|architect|manager) /.test(t)) return 3;
  if (/ (junior|jr|associate|entry|assistant) /.test(t)) return 1;
  return 2;
}
const LEVEL_YEARS: [number, number][] = [[0, 1.5], [0, 3.5], [1, 9], [3.5, 60], [7, 60]];

/** First "N years" or "N-M years" mentioned in the description, if any. */
function yearsAsked(desc: string): number | null {
  const m = /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years|yrs)/i.exec(desc.slice(0, 4000));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 30 ? n : null;
}

export function scoreMatch(p: MatchProfile, j: MatchJob): MatchResult | null {
  if (!j.inIndia) return null; // v1 serves job seekers in India (remote roles open to India count as India)
  const reasons: string[] = [];

  // ---- Role ----
  let role = 0, bestRole = "";
  for (const r of p.roles) {
    const f = roleFit(r, j.title);
    if (f > role) { role = f; bestRole = r; }
  }

  // ---- Skills ----
  const hay = norm(`${j.title} ${j.description}`);
  const hits = p.skills.filter((s) => hasTerm(hay, s));
  const need = Math.min(Math.max(p.skills.length, 1), 6);
  let skill = Math.min(1, hits.length / need);
  if (j.description.length < 200 && p.skills.length) skill = Math.max(skill, 0.4); // no description to check against: stay neutral

  if (role < 0.25 && hits.length < 3) return null; // nothing ties this job to the person

  // ---- Location ----
  const loc = norm(j.location);
  const wanted = p.locations.flatMap(cityForms);
  const cityHit = p.locations.find((c) => cityForms(c).some((f) => f && hasTerm(loc, f)));
  let place = 0.25;
  if (cityHit) { place = 1; reasons.push(`Location: ${cityHit}`); }
  else if (j.remote && p.remoteOk) { place = 1; reasons.push("Remote role"); }
  else if (!wanted.length) place = 0.6;
  else reasons.push(`Location is ${j.location || "not stated"}, outside your preferred cities`);

  // ---- Experience ----
  const level = titleLevel(j.title);
  const [lo, hi] = LEVEL_YEARS[level];
  const asked = yearsAsked(j.description);
  const y = p.experienceYears;
  let exp = y >= lo && y <= hi ? 1 : y >= lo - 1.5 && y <= hi + 2 ? 0.5 : 0;
  if (asked !== null) {
    if (y >= asked) exp = Math.max(exp, 0.8);
    else if (y < asked - 1) exp = Math.min(exp, 0.2);
  }

  if (role >= 0.99) reasons.unshift(`Title matches your role "${bestRole}"`);
  else if (role >= 0.25) reasons.unshift(`Title is close to your role "${bestRole}"`);
  if (hits.length) reasons.push(`${hits.length} of your skills found: ${hits.slice(0, 6).join(", ")}`);
  if (exp >= 0.8) reasons.push(asked !== null ? `Asks for about ${asked}+ years; you have ${y}` : "Seniority fits your experience");
  else if (exp <= 0.2) reasons.push(asked !== null ? `Asks for about ${asked}+ years; you have ${y}` : "Seniority level may not fit your experience");

  let total = 10 * (0.5 * role + 0.27 * skill + 0.15 * place + 0.08 * exp);
  const gap = asked !== null ? asked - y : 0;
  if (gap >= 4) total *= 0.55; // asks for far more experience than the person has: not worth an alert
  else if (gap >= 2 || exp === 0) total *= 0.75; // clearly wrong seniority
  const score = Math.max(1, Math.min(10, Math.round(total)));
  return { score, reasons };
}
