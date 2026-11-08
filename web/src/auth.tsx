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
  /** Emails a 6-digit code. Throws a friendly Error on failure. */
  requestEmailCode: (email: string) => Promise<void>;
  /** Exchanges the emailed code for a session. Throws a friendly Error on failure. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
};

async function postJson(url: string, body: unknown): Promise<Response> {
  try {
    return await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Can't reach the server. Please try again in a moment.");
  }
}

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

  const requestEmailCode = useCallback(async (email: string) => {
    const res = await postJson("/api/auth/email/start", { email });
    if (res.status === 400) throw new Error("That email doesn't look right. Please check it.");
    if (res.status === 429) throw new Error("Too many codes requested. Please wait a few minutes.");
    if (!res.ok) throw new Error("We couldn't send the email. Please try again.");
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const res = await postJson("/api/auth/email/verify", { email, code });
    if (res.status === 429) throw new Error("Too many attempts. Please wait a minute.");
    if (!res.ok) throw new Error("That code is wrong or expired. Check it, or request a new one.");
    setUser(((await res.json()) as { user: User }).user);
  }, []);

  const signOut = useCallback(async () => {
    googleLogout(); // stops Google from silently re-selecting this account
    setUser(null);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* cookie expires anyway */ }
  }, []);

  return <AuthCtx.Provider value={{ user, loading, signInWithGoogle, signOut, requestEmailCode, verifyEmailCode }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
