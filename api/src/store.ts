import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type User = {
  id: string;
  googleSub: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
  lastLoginAt: string;
};

export type Profile = { sub: string; email: string; name: string; picture?: string };

export interface Store {
  upsertFromGoogle(p: Profile): User;
  get(id: string): User | undefined;
}

/**
 * Temporary user store: JSON file (or memory when no path is given).
 * PRD Section 9.3 replaces this with the PostgreSQL `users` table.
 */
export function createStore(filePath?: string): Store {
  const users = new Map<string, User>(); // keyed by Google "sub", the stable account id

  if (filePath && existsSync(filePath)) {
    try {
      for (const u of JSON.parse(readFileSync(filePath, "utf8")) as User[]) users.set(u.googleSub, u);
    } catch {
      throw new Error(`User store at ${filePath} is corrupt; fix or delete it.`);
    }
  }

  const persist = () => {
    if (!filePath) return;
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = filePath + ".tmp";
    writeFileSync(tmp, JSON.stringify([...users.values()], null, 2));
    renameSync(tmp, filePath); // atomic swap so a crash never leaves a half-written file
  };

  return {
    upsertFromGoogle(p) {
      const now = new Date().toISOString();
      const existing = users.get(p.sub);
      const user: User = existing
        ? { ...existing, email: p.email, name: p.name, picture: p.picture, lastLoginAt: now }
        : { id: randomUUID(), googleSub: p.sub, email: p.email, name: p.name, picture: p.picture, createdAt: now, lastLoginAt: now };
      users.set(p.sub, user);
      persist();
      return user;
    },
    get(id) {
      for (const u of users.values()) if (u.id === id) return u;
      return undefined;
    },
  };
}
