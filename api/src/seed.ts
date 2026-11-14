import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Db } from "./db.js";
import { SOURCE_KINDS } from "./sources.js";

type Seed = { ats: string; token: string; company: string };

/** Sources that are not tied to one company. */
const AGGREGATORS: (Seed & { interval: number })[] = [
  { ats: "remotive", token: "all", company: "Remotive", interval: 360 }, // their terms ask for at most a few calls a day
  { ats: "jobicy", token: "india", company: "Jobicy", interval: 360 },
  { ats: "himalayas", token: "latest", company: "Himalayas", interval: 120 },
];

/**
 * Adds the starting list of job sources (api/seed/sources.json: company boards checked to have India jobs).
 * Runs at every start and only ever adds missing rows, so sources you switch off in the admin page stay off.
 */
export async function seedSources(db: Db, file = fileURLToPath(new URL("../seed/sources.json", import.meta.url))) {
  const list: Seed[] = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Seed[]) : [];
  let added = 0;
  for (const s of list) {
    if (!SOURCE_KINDS.includes(s.ats) || !s.token) continue;
    const r = await db.query("insert into sources (kind, token, company, interval_min) values ($1,$2,$3,20) on conflict (kind, token) do nothing returning id", [s.ats, s.token, s.company || s.token]);
    added += r.length;
  }
  for (const s of AGGREGATORS) {
    const r = await db.query("insert into sources (kind, token, company, interval_min) values ($1,$2,$3,$4) on conflict (kind, token) do nothing returning id", [s.ats, s.token, s.company, s.interval]);
    added += r.length;
  }
  if (added) console.log(`job sources added: ${added}`);
}
