import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { googleLogout } from "@react-oauth/google";

export type User = { id: string; name: string; email: string; picture: string | null };

type Ctx = {
  user: User | null;
  /** true until the first /me check finishes, so we don't flash the login page at signed-in users */
  loading: boolean;
  /** Exchanges a Google ID token for our own session cookie. Throws a friendly Error on failure. */
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/auth/me", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user: User } | null) => setUser(d?.user ?? null))
      .catch(() => { /* API offline or aborted: treat as signed out */ })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, []);

  const signInWithGoogle = useCallback(async (credential: string) => {
    let res: Response;
    try {
      res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
    } catch {
      throw new Error("Can't reach the server. Is the API running?");
    }
    if (res.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
    if (!res.ok) throw new Error("Google sign-in didn't go through. Please try again.");
    const d = (await res.json()) as { user: User };
    setUser(d.user);
  }, []);

  const signOut = useCallback(async () => {
    googleLogout(); // stops Google from silently re-selecting this account
    setUser(null);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* cookie expires anyway */ }
  }, []);

  return <AuthCtx.Provider value={{ user, loading, signInWithGoogle, signOut }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
