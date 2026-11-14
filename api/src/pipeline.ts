import type { Config } from "./config.js";
import type { Db } from "./db.js";
import type { Billing } from "./billing.js";
import { LIVE_SQL } from "./billing.js";
import type { Llm } from "./llm.js";
import type { Notifier } from "./notify.js";
import { scoreMatch, type MatchJob, type MatchProfile } from "./match.js";
import { NOTIFY_MIN_SCORE, PLANS, STORE_MIN_SCORE, type PlanId } from "./plans.js";
import { fetchSource, type RawJob, type SourceRow } from "./sources.js";

/**
 * The background worker. One "tick" runs every minute and does, in order:
 *   1. poll a few job sources that are due (each source is polled every 15-30 minutes, not every minute:
 *      polling a company's board every minute would be abusive and finds nothing extra)
 *   2. score the new jobs against every active subscriber
 *   3. optionally refine the best matches with AI
 *   4. send instant alerts and scheduled digests
 *   5. housekeeping (expire plans, retire old jobs)
 */

const SOURCES_PER_TICK = 4;
const MATCH_WINDOW_DAYS = 21; // jobs posted longer ago than this are not worth alerting on
const REFINE_PER_USER_PER_DAY = 15;

type JobRow = { id: string; title: string; company: string; location: string; remote: boolean; in_india: boolean; description: string; posted_at: Date | null };
export type Subscriber = { user_id: string; plan: PlanId; profile: MatchProfile; headline: string };

const toMatchJob = (j: JobRow): MatchJob => ({ title: j.title, company: j.company, location: j.location, remote: j.remote, inIndia: j.in_india, description: j.description });

export type Pipeline = ReturnType<typeof createPipeline>;

export function createPipeline(cfg: Config, db: Db, billing: Billing, notifier: Notifier, llm: Llm | null) {
  let running = false;
  let timer: NodeJS.Timeout | undefined;
  let ticks = 0;

  const subscriberSql = (where: string) => `
    select p.user_id, s.plan, p.roles, p.skills, p.locations, p.remote_ok, p.experience_years::float8 as experience_years, p.headline
    from profiles p
    join lateral (select plan from subscriptions where user_id = p.user_id and ${LIVE_SQL} order by current_period_end desc limit 1) s on true
    where p.onboarded_at is not null and p.got_job_at is null ${where}`;
  type SubRow = { user_id: string; plan: PlanId; roles: string[]; skills: string[]; locations: string[]; remote_ok: boolean; experience_years: number; headline: string };
  const toSubscriber = (r: SubRow): Subscriber => ({
    user_id: r.user_id, plan: r.plan, headline: r.headline,
    profile: { roles: r.roles.slice(0, PLANS[r.plan].maxRoles), skills: r.skills, locations: r.locations, remoteOk: r.remote_ok, experienceYears: Number(r.experience_years) },
  });

  async function saveMatches(userId: string, rows: { jobId: string; score: number; reasons: string[] }[]) {
    if (!rows.length) return 0;
    const res = await db.query(
      `insert into matches (user_id, job_id, score, reasons)
       select $1::uuid, j, s, string_to_array(r, E'\\x1f') from unnest($2::uuid[], $3::int[], $4::text[]) as t(j, s, r)
       on conflict (user_id, job_id) do nothing returning id`,
      [userId, rows.map((r) => r.jobId), rows.map((r) => r.score), rows.map((r) => r.reasons.join("\x1f"))]);
    return res.length;
  }

  /** Stores jobs from one poll. Returns the rows that are new to us. */
  async function upsertJobs(sourceId: string, jobs: RawJob[]): Promise<JobRow[]> {
    const fresh: JobRow[] = [];
    for (let i = 0; i < jobs.length; i += 100) {
      const c = jobs.slice(i, i + 100);
      const rows = await db.query<JobRow & { inserted: boolean }>(
        `insert into jobs (source_id, external_id, company, title, location, remote, in_india, url, description, salary, posted_at)
         select $1::uuid, * from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::bool[], $7::bool[], $8::text[], $9::text[], $10::text[], $11::timestamptz[])
         on conflict (source_id, external_id) do update set last_seen_at = now(), active = true
         returning id, title, company, location, remote, in_india, description, posted_at, (xmax = 0) as inserted`,
        [sourceId, c.map((j) => j.externalId.slice(0, 200)), c.map((j) => j.company.slice(0, 200)), c.map((j) => j.title.slice(0, 300)), c.map((j) => j.location.slice(0, 300)),
          c.map((j) => j.remote), c.map(() => true), c.map((j) => j.url.slice(0, 1000)), c.map((j) => j.description), c.map((j) => j.salary ?? null), c.map((j) => j.postedAt ?? null)]);
      fresh.push(...rows.filter((r) => r.inserted));
    }
    return fresh;
  }

  async function pollSource(s: SourceRow & { interval_min: number }): Promise<JobRow[]> {
    const started = new Date();
    try {
      const { total, jobs } = await fetchSource(s, cfg);
      const fresh = await upsertJobs(s.id, jobs);
      // Board sources list everything that is open, so anything we did not see has closed. Search sources only return recent results.
      if (!["adzuna", "remotive", "jobicy", "himalayas"].includes(s.kind) && total > 0) {
        await db.query("update jobs set active = false where source_id = $1 and active and last_seen_at < $2", [s.id, started]);
      }
      await db.query("update sources set last_polled_at = now(), last_ok_at = now(), fail_count = 0, last_error = null, last_count = $2 where id = $1", [s.id, jobs.length]);
      return fresh;
    } catch (e) {
      // Back off: a failing source is retried less and less often, and switched off after 30 failures in a row.
      await db.query("update sources set last_polled_at = now(), fail_count = fail_count + 1, last_error = $2, enabled = (fail_count + 1 < 30) where id = $1", [s.id, (e as Error).message.slice(0, 300)]);
      return [];
    }
  }

  async function matchNewJobs(jobs: JobRow[]) {
    const cutoff = Date.now() - MATCH_WINDOW_DAYS * 86_400_000;
    const recent = jobs.filter((j) => !j.posted_at || j.posted_at.getTime() > cutoff);
    if (!recent.length) return 0;
    const subs = (await db.query<SubRow>(subscriberSql(""))).map(toSubscriber);
    let made = 0;
    for (const s of subs) {
      const rows = [];
      for (const j of recent) {
        const m = scoreMatch(s.profile, toMatchJob(j));
        if (m && m.score >= STORE_MIN_SCORE) rows.push({ jobId: j.id, score: m.score, reasons: m.reasons });
      }
      made += await saveMatches(s.user_id, rows);
    }
    return made;
  }

  /** Scores recent jobs for one user. Used right after sign-up or a profile change so the dashboard is not empty. */
  async function backfillUser(userId: string, opts: { days?: number; save?: boolean; profile?: MatchProfile } = {}) {
    let profile = opts.profile;
    if (!profile) {
      const r = (await db.query<SubRow>(subscriberSql("and p.user_id = $1"), [userId]))[0];
      if (!r) return [];
      profile = toSubscriber(r).profile;
    }
    const found: { jobId: string; score: number; reasons: string[]; title: string; company: string; location: string }[] = [];
    let after = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    for (;;) {
      const batch: JobRow[] = await db.query<JobRow>(
        `select id, title, company, location, remote, in_india, description, posted_at from jobs
         where active and in_india and first_seen_at > now() - make_interval(days => $1) and coalesce(posted_at, first_seen_at) > now() - make_interval(days => $3) and id < $2
         order by id desc limit 400`, [opts.days ?? 14, after, MATCH_WINDOW_DAYS]);
      if (!batch.length) break;
      after = batch[batch.length - 1].id;
      for (const j of batch) {
        const m = scoreMatch(profile, toMatchJob(j));
        if (m && m.score >= STORE_MIN_SCORE) found.push({ jobId: j.id, score: m.score, reasons: m.reasons, title: j.title, company: j.company, location: j.location });
      }
    }
    found.sort((a, b) => b.score - a.score);
    if (opts.save !== false) await saveMatches(userId, found.slice(0, 60));
    return found;
  }

  /** AI second opinion on the strongest unsent matches. Skipped entirely when no AI key is configured. */
  async function refine() {
    if (!llm) return;
    const rows = await db.query<{ id: string; user_id: string; score: number; title: string; company: string; location: string; description: string; headline: string; roles: string[]; skills: string[]; locations: string[]; experience_years: number }>(
      `select m.id, m.user_id, m.score, j.title, j.company, j.location, j.description, p.headline, p.roles, p.skills, p.locations, p.experience_years::float8 as experience_years
       from matches m join jobs j on j.id = m.job_id join profiles p on p.user_id = m.user_id
       where m.why is null and m.notified_at is null and m.score >= $1 and m.created_at > now() - interval '2 days'
         and (select count(*) from matches x where x.user_id = m.user_id and x.why is not null and x.created_at > now() - interval '20 hours') < $2
       order by m.score desc, m.created_at desc limit 8`, [NOTIFY_MIN_SCORE, REFINE_PER_USER_PER_DAY]);
    for (const r of rows) {
      const out = await llm.refineMatch({
        ruleScore: r.score,
        profile: `Current title: ${r.headline}\nTarget roles: ${r.roles.join(", ")}\nSkills: ${r.skills.join(", ")}\nPreferred locations: ${r.locations.join(", ") || "anywhere in India"}\nExperience: ${r.experience_years} years`,
        job: `Title: ${r.title}\nCompany: ${r.company}\nLocation: ${r.location}\n${r.description.slice(0, 3000)}`,
      });
      // "" marks "tried, no result" so the same match is not sent to the AI again.
      await db.query("update matches set score = $2, why = $3 where id = $1", [r.id, out?.score ?? r.score, out?.why ?? ""]);
    }
  }

  /** One Adzuna search per distinct role our subscribers want, spaced so we stay inside the free daily quota. */
  async function syncAdzunaSources() {
    if (!cfg.adzuna) return;
    const roles = await db.query<{ role: string }>(
      `select distinct lower(trim(r)) as role from profiles p cross join lateral unnest(p.roles) as r
       where p.onboarded_at is not null and length(trim(r)) between 3 and 60 limit 200`);
    if (!roles.length) return;
    const interval = Math.max(180, Math.ceil((roles.length * 1440) / 200)); // about 200 calls a day in total
    for (const { role } of roles) {
      await db.query("insert into sources (kind, token, company, interval_min) values ('adzuna', $1, 'Adzuna India', $2) on conflict (kind, token) do update set interval_min = $2", [role, interval]);
    }
  }

  async function tick() {
    if (running) return;
    running = true;
    ticks++;
    try {
      if (cfg.ingestEnabled) {
        if (ticks % 30 === 1) await syncAdzunaSources();
        const due = await db.query<SourceRow & { interval_min: number }>(
          `select id, kind, token, company, interval_min from sources
           where enabled and (last_polled_at is null or last_polled_at < now() - make_interval(mins => interval_min * power(2, least(fail_count, 5))::int))
           order by last_polled_at asc nulls first limit $1`, [SOURCES_PER_TICK]);
        const fresh: JobRow[] = [];
        for (const s of due) fresh.push(...(await pollSource(s)));
        if (fresh.length) await matchNewJobs(fresh);
      }
      await refine();
      await notifier.runInstant();
      await notifier.runDigests();
      if (ticks % 10 === 0) {
        await billing.expireEnded();
        await db.query("delete from jobs where not active and last_seen_at < now() - interval '30 days'");
        await db.query("update jobs set active = false where active and last_seen_at < now() - interval '10 days'");
        await db.query("delete from webhook_events where received_at < now() - interval '60 days'");
        await db.query("delete from email_challenges where created_at < now() - interval '2 days'");
      }
    } catch (e) {
      console.error("pipeline tick failed:", e);
    } finally {
      running = false;
    }
  }

  return {
    tick,
    backfillUser,
    start() {
      timer = setInterval(() => void tick(), 60_000);
      setTimeout(() => void tick(), 5_000);
    },
    stop() { if (timer) clearInterval(timer); },
  };
}
