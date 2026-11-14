import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Account, type PublicConfig } from "./api";
import { useAuth } from "./auth";

type Ctx = {
  config: PublicConfig | null;
  account: Account | null;
  /** true until the first account load for a signed-in user has finished */
  loading: boolean;
  refresh: () => Promise<void>;
};
const AccountCtx = createContext<Ctx>(null!);

/** Site settings (plans, switches) for everyone, plus profile and plan for the signed-in user. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.config().then(setConfig).catch(() => {}); }, []);

  const refresh = useCallback(async () => {
    try { setAccount(await api.account()); } catch { setAccount(null); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAccount(null); setLoading(false); return; }
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user, authLoading, refresh]);

  return <AccountCtx.Provider value={{ config, account, loading: loading || authLoading, refresh }}>{children}</AccountCtx.Provider>;
}

export const useAccount = () => useContext(AccountCtx);
