/**
 * Job source connectors. Every connector calls a PUBLIC, documented JSON endpoint that the
 * company or job board publishes for exactly this purpose. No HTML scraping, no logins,
 * nothing from sites whose terms forbid it (LinkedIn, Naukri, Indeed).
 *
 * To add a source type: write a function that returns RawJob[] and add it to CONNECTORS.
 */
import type { Config } from "./config.js";

export type RawJob = {
  externalId: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  description: string; // plain text
  salary?: string;
  postedAt?: Date;
};

export type SourceRow = { id: string; kind: string; token: string; company: string };

const UA = "HirelyJobAlerts/1.0 (job alert service; public job APIs only)";

async function getJson<T>(url: string, timeoutMs = 25_000): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "-", mdash: "-", bull: "-", hellip: "..." };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " "; }
  return ENT[e.toLowerCase()] ?? m;
});
/** HTML (possibly entity-escaped HTML, as Greenhouse sends) to trimmed plain text. */
export function htmlToText(html: string | null | undefined, max = 6000): string {
  if (!html) return "";
  let s = html.includes("&lt;") ? decode(html) : html;
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|li|h[1-6]|tr)>|<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "- ").replace(/<[^>]+>/g, " ");
  s = decode(s).replace(/[ \t\r]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return s.slice(0, max);
}

const INDIA_RE = /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|gurgaon|gurugram|noida|kolkata|ahmedabad|kochi|cochin|jaipur|coimbatore|chandigarh|indore|trivandrum|thiruvananthapuram|visakhapatnam|vizag|nagpur|lucknow|bhubaneswar|mysuru|mysore|madurai|vadodara|surat|navi mumbai|thane|mohali|bhopal|patna|guwahati|mangalore|mangaluru|nashik|vijayawada|karnataka|maharashtra|tamil nadu|telangana|kerala|gujarat|haryana|uttar pradesh|west bengal|rajasthan)\b/i;
const OPEN_REMOTE_RE = /\b(worldwide|anywhere|global|apac|asia)\b/i;

/** True when someone living in India can take this job: an Indian location, or a remote job open to India/worldwide. */
export function isInIndia(location: string, remote: boolean): boolean {
  if (INDIA_RE.test(location)) return true;
  return remote && OPEN_REMOTE_RE.test(location);
}

const date = (v: unknown): Date | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? undefined : d;
};
const REMOTE_RE = /\bremote\b|work from home|\bwfh\b/i;

type Connector = (s: SourceRow, cfg: Config) => Promise<RawJob[]>;

const greenhouse: Connector = async (s) => {
  type J = { id: number; title: string; absolute_url: string; location?: { name?: string }; content?: string; updated_at?: string; first_published?: string };
  const d = await getJson<{ jobs: J[] }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(s.token)}/jobs?content=true`, 40_000);
  return d.jobs.map((j) => {
    const location = j.location?.name ?? "";
    return { externalId: String(j.id), company: s.company, title: j.title, location, remote: REMOTE_RE.test(location), url: j.absolute_url, description: htmlToText(j.content), postedAt: date(j.first_published ?? j.updated_at) };
  });
};

const lever: Connector = async (s) => {
  type J = { id: string; text: string; hostedUrl: string; categories?: { location?: string; allLocations?: string[] }; descriptionPlain?: string; additionalPlain?: string; createdAt?: number; workplaceType?: string; lists?: { text: string; content: string }[] };
  const d = await getJson<J[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(s.token)}?mode=json`, 40_000);
  return d.map((j) => {
    const location = (j.categories?.allLocations?.length ? j.categories.allLocations.join(" / ") : j.categories?.location) ?? "";
    const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content, 2000)}`).join("\n");
    return { externalId: j.id, company: s.company, title: j.text, location, remote: j.workplaceType === "remote" || REMOTE_RE.test(location), url: j.hostedUrl, description: `${j.descriptionPlain ?? ""}\n${lists}`.trim().slice(0, 6000), postedAt: date(j.createdAt) };
  });
};

const ashby: Connector = async (s) => {
  type J = { id: string; title: string; location?: string; secondaryLocations?: { location: string }[]; isRemote?: boolean; isListed?: boolean; jobUrl: string; descriptionPlain?: string; publishedAt?: string };
  const d = await getJson<{ jobs: J[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(s.token)}`, 40_000);
  return d.jobs.filter((j) => j.isListed !== false).map((j) => {
    const location = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join(" / ");
    return { externalId: j.id, company: s.company, title: j.title, location, remote: !!j.isRemote, url: j.jobUrl, description: (j.descriptionPlain ?? "").slice(0, 6000), postedAt: date(j.publishedAt) };
  });
};

const smartrecruiters: Connector = async (s) => {
  type J = { id: string; name: string; releasedDate?: string; location?: { city?: string; region?: string; country?: string; remote?: boolean }; department?: { label?: string }; function?: { label?: string }; experienceLevel?: { label?: string } };
  const d = await getJson<{ content: J[] }>(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(s.token)}/postings?country=in&limit=100`);
  return d.content.map((j) => {
    const location = [j.location?.city, j.location?.region, j.location?.country === "in" ? "India" : j.location?.country].filter(Boolean).join(", ");
    return { externalId: j.id, company: s.company, title: j.name, location, remote: !!j.location?.remote, url: `https://jobs.smartrecruiters.com/${encodeURIComponent(s.token)}/${j.id}`, description: [j.department?.label, j.function?.label, j.experienceLevel?.label].filter(Boolean).join(". "), postedAt: date(j.releasedDate) };
  });
};

const recruitee: Connector = async (s) => {
  type J = { id: number; title: string; location?: string; city?: string; country?: string; remote?: boolean; careers_url: string; description?: string; requirements?: string; published_at?: string };
  const d = await getJson<{ offers: J[] }>(`https://${encodeURIComponent(s.token)}.recruitee.com/api/offers/`);
  return d.offers.map((j) => {
    const location = j.location || [j.city, j.country].filter(Boolean).join(", ");
    return { externalId: String(j.id), company: s.company, title: j.title, location, remote: !!j.remote, url: j.careers_url, description: htmlToText(`${j.description ?? ""}\n${j.requirements ?? ""}`), postedAt: date(j.published_at) };
  });
};

const workable: Connector = async (s) => {
  type J = { shortcode: string; title: string; city?: string; state?: string; country?: string; telecommuting?: boolean; url: string; description?: string; published_on?: string };
  const d = await getJson<{ jobs: J[] }>(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(s.token)}?details=true`);
  return d.jobs.map((j) => {
    const location = [j.city, j.state, j.country].filter(Boolean).join(", ");
    return { externalId: j.shortcode, company: s.company, title: j.title, location, remote: !!j.telecommuting, url: j.url, description: htmlToText(j.description), postedAt: date(j.published_on) };
  });
};

/** Adzuna India: the main source for non-tech roles. token = the search phrase (a job role). Needs free API keys. */
const adzuna: Connector = async (s, cfg) => {
  if (!cfg.adzuna) throw new Error("ADZUNA_APP_ID / ADZUNA_APP_KEY not set");
  type J = { id: string; title: string; company?: { display_name?: string }; location?: { display_name?: string }; redirect_url: string; description?: string; created?: string; salary_min?: number; salary_max?: number };
  const q = new URLSearchParams({ app_id: cfg.adzuna.appId, app_key: cfg.adzuna.appKey, results_per_page: "50", what: s.token, max_days_old: "3", sort_by: "date" });
  const d = await getJson<{ results: J[] }>(`https://api.adzuna.com/v1/api/jobs/in/search/1?${q}`);
  return d.results.map((j) => {
    const location = `${j.location?.display_name ?? ""}, India`;
    const salary = j.salary_min ? `₹${Math.round(j.salary_min).toLocaleString("en-IN")}${j.salary_max && j.salary_max !== j.salary_min ? ` - ₹${Math.round(j.salary_max).toLocaleString("en-IN")}` : ""} a year` : undefined;
    return { externalId: String(j.id), company: j.company?.display_name || "Company not shown", title: htmlToText(j.title, 200), location, remote: REMOTE_RE.test(`${j.title} ${j.description ?? ""}`), url: j.redirect_url, description: htmlToText(j.description), salary, postedAt: date(j.created) };
  });
};

const remotive: Connector = async () => {
  type J = { id: number; url: string; title: string; company_name: string; candidate_required_location?: string; publication_date?: string; description?: string; salary?: string };
  const d = await getJson<{ jobs: J[] }>("https://remotive.com/api/remote-jobs?limit=300", 40_000);
  return d.jobs.map((j) => ({ externalId: String(j.id), company: j.company_name, title: j.title, location: `Remote (${j.candidate_required_location || "Worldwide"})`, remote: true, url: j.url, description: htmlToText(j.description), salary: j.salary || undefined, postedAt: date(j.publication_date) }));
};

const jobicy: Connector = async () => {
  type J = { id: number; url: string; jobTitle: string; companyName: string; jobGeo?: string; jobDescription?: string; jobExcerpt?: string; pubDate?: string };
  const d = await getJson<{ jobs: J[] }>("https://jobicy.com/api/v2/remote-jobs?count=50&geo=india");
  return (d.jobs ?? []).map((j) => ({ externalId: String(j.id), company: htmlToText(j.companyName, 120), title: htmlToText(j.jobTitle, 200), location: `Remote (${j.jobGeo || "India"})`, remote: true, url: j.url, description: htmlToText(j.jobDescription ?? j.jobExcerpt), postedAt: date(j.pubDate) }));
};

const himalayas: Connector = async () => {
  type J = { guid?: string; title: string; companyName: string; locationRestrictions?: string[]; applicationLink: string; description?: string; excerpt?: string; pubDate?: number | string };
  const d = await getJson<{ jobs: J[] }>("https://himalayas.app/jobs/api?limit=20");
  return (d.jobs ?? []).map((j) => {
    const where = j.locationRestrictions?.length ? j.locationRestrictions.join(", ") : "Worldwide";
    const ts = typeof j.pubDate === "number" && j.pubDate < 1e12 ? j.pubDate * 1000 : j.pubDate;
    return { externalId: j.guid ?? j.applicationLink, company: j.companyName, title: j.title, location: `Remote (${where})`, remote: true, url: j.applicationLink, description: htmlToText(j.description ?? j.excerpt), postedAt: date(ts) };
  });
};

export const CONNECTORS: Record<string, Connector> = { greenhouse, lever, ashby, smartrecruiters, recruitee, workable, adzuna, remotive, jobicy, himalayas };
export const SOURCE_KINDS = Object.keys(CONNECTORS);

/** Fetches one source and returns only the jobs someone in India can take, de-duplicated. */
export async function fetchSource(s: SourceRow, cfg: Config): Promise<{ total: number; jobs: RawJob[] }> {
  const fn = CONNECTORS[s.kind];
  if (!fn) throw new Error(`unknown source kind: ${s.kind}`);
  const all = await fn(s, cfg);
  const seen = new Set<string>();
  const jobs = all.filter((j) => {
    if (!j.externalId || !j.title || !/^https?:\/\//.test(j.url) || seen.has(j.externalId)) return false;
    seen.add(j.externalId);
    return isInIndia(j.location, j.remote);
  });
  return { total: all.length, jobs };
}
