import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

/** Minimal database surface. Production uses `pg`; tests use PGlite (real Postgres in WASM). */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10 });
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async exec(sql) { await pool.query(sql); },
    close: () => pool.end(),
  };
}

/** Applies any new `migrations/*.sql` files in name order, each in a transaction, and records them. */
export async function migrate(db: Db, dir = fileURLToPath(new URL("../migrations/", import.meta.url))) {
  await db.exec("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await db.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(dir + f, "utf8");
    await db.exec(`begin;\n${sql}\ninsert into schema_migrations (name) values ('${f.replace(/'/g, "''")}');\ncommit;`);
    console.log(`migration applied: ${f}`);
  }
}
