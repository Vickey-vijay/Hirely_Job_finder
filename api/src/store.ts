import type { Db } from "./db.js";

export type User = { id: string; email: string; name: string; picture: string | null };
export type Profile = { sub: string; email: string; name: string; picture?: string };
export type Challenge = { id: string; codeHash: string; attempts: number };

type UserRow = { id: string; email: string; name: string; picture: string | null };
const COLS = "id, email, name, picture";

export type Store = ReturnType<typeof createStore>;

export function createStore(db: Db) {
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params))[0];

  return {
    /** Google sign-in: match by Google id, else link to an existing user with the same (Google-verified) email, else create. */
    async upsertFromGoogle(p: Profile): Promise<User> {
      const email = p.email.toLowerCase();
      const bySub = await one<UserRow>(
        `update users set name = $2, picture = $3, last_login_at = now() where google_sub = $1 returning ${COLS}`,
        [p.sub, p.name, p.picture ?? null],
      );
      if (bySub) return bySub;
      return (await one<UserRow>(
        `insert into users (email, name, picture, google_sub, email_verified_at)
         values ($1, $2, $3, $4, now())
         on conflict (email) do update set
           google_sub = coalesce(users.google_sub, excluded.google_sub),
           picture = coalesce(users.picture, excluded.picture),
           email_verified_at = coalesce(users.email_verified_at, now()),
           last_login_at = now()
         returning ${COLS}`,
        [email, p.name, p.picture ?? null, p.sub],
      ))!;
    },

    /** Email-code sign-in: the code proved ownership of the address, so mark it verified. */
    async upsertFromEmail(emailRaw: string): Promise<User> {
      const email = emailRaw.toLowerCase();
      return (await one<UserRow>(
        `insert into users (email, name, email_verified_at) values ($1, $2, now())
         on conflict (email) do update set
           email_verified_at = coalesce(users.email_verified_at, now()),
           last_login_at = now()
         returning ${COLS}`,
        [email, email.split("@")[0]],
      ))!;
    },

    async get(id: string): Promise<User | undefined> {
      return one<UserRow>(`select ${COLS} from users where id = $1`, [id]);
    },

    /** Replaces any open challenge for this address with a new one. */
    async createChallenge(email: string, codeHash: string, ttlMinutes: number) {
      await db.query("update email_challenges set consumed_at = now() where email = $1 and consumed_at is null", [email]);
      await db.query(
        "insert into email_challenges (email, code_hash, expires_at) values ($1, $2, now() + make_interval(mins => $3))",
        [email, codeHash, ttlMinutes],
      );
    },

    async recentChallengeCount(email: string, minutes: number): Promise<number> {
      const r = await one<{ n: string }>(
        "select count(*)::text as n from email_challenges where email = $1 and created_at > now() - make_interval(mins => $2)",
        [email, minutes],
      );
      return Number(r?.n ?? 0);
    },

    async openChallenge(email: string): Promise<Challenge | undefined> {
      return one<Challenge>(
        `select id, code_hash as "codeHash", attempts from email_challenges
         where email = $1 and consumed_at is null and expires_at > now()
         order by created_at desc limit 1`,
        [email],
      );
    },

    async bumpAttempts(id: string) { await db.query("update email_challenges set attempts = attempts + 1 where id = $1", [id]); },
    async consumeChallenge(id: string) { await db.query("update email_challenges set consumed_at = now() where id = $1", [id]); },
  };
}
