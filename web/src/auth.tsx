import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * PLACEHOLDER AUTH — no real Google sign-in yet.
 * Phase 1 of the PRD replaces this with Google OAuth verified on the backend.
 * Here we only store a demo user in localStorage so the UI flow can be built.
 */
export type User = { name: string; email: string };

type Ctx = { user: User | null; signIn: (name: string) => void; signOut: () => void };
const AuthCtx = createContext<Ctx>(null!);
const KEY = "hirely.demoUser";

function load(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(load);
  const signIn = (name: string) => {
    const u = { name, email: "demo@hirely.app" };
    setUser(u);
    try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* ignore */ }
  };
  const signOut = () => {
    setUser(null);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  };
  return <AuthCtx.Provider value={{ user, signIn, signOut }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
