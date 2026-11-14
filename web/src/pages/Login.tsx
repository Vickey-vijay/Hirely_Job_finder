import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useAuth } from "../auth";
import { useAccount } from "../account";
import { Brand } from "../components/ui";
import Transition, { rise, stagger } from "../components/Transition";

const COOLDOWN = 30; // seconds before "send again" unlocks

export default function Login() {
  const { user, signInWithGoogle, requestEmailCode, verifyEmailCode } = useAuth();
  const nav = useNavigate();
  const { config } = useAccount();
  const GOOGLE_CLIENT_ID = config?.googleClientId ?? "";
  const emailLogin = config?.emailLogin ?? true;
  const [step, setStep] = useState<"choose" | "code">("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (user) return <Navigate to="/dashboard" replace />;

  // Runs an async action with shared busy/error handling.
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const onGoogle = (credential?: string) =>
    run(async () => {
      if (!credential) throw new Error("Google didn't return a sign-in. Please try again.");
      await signInWithGoogle(credential);
      nav("/dashboard");
    });

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      await requestEmailCode(email.trim());
      setStep("code");
      setCode("");
      setCooldown(COOLDOWN);
    });
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await verifyEmailCode(email.trim(), code);
      nav("/dashboard");
    });
  };

  return (
    <Transition>
      <main className="page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <motion.div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
          variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise} style={{ display: "flex", justifyContent: "center" }}><Brand /></motion.div>
          <motion.h2 variants={rise} style={{ margin: "18px 0 6px" }}>Welcome in.</motion.h2>

          <AnimatePresence mode="wait" initial={false}>
            {step === "choose" ? (
              <motion.div key="choose" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                <p className="muted">Pick whichever is easiest. No passwords to remember.</p>

                {GOOGLE_CLIENT_ID && (
                  <div style={{ marginTop: 20, display: "flex", justifyContent: "center", minHeight: 44, opacity: busy ? 0.5 : 1, pointerEvents: busy ? "none" : "auto" }}>
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <GoogleLogin
                        onSuccess={(r) => onGoogle(r.credential)}
                        onError={() => setError("Google sign-in was cancelled or blocked. Please try again.")}
                        theme="outline" shape="pill" size="large" text="continue_with" logo_alignment="left" width="280"
                      />
                    </GoogleOAuthProvider>
                  </div>
                )}



                {GOOGLE_CLIENT_ID && emailLogin && <div className="divider"><span>or</span></div>}

                {emailLogin && <form onSubmit={sendCode} style={{ marginTop: GOOGLE_CLIENT_ID ? 0 : 20 }}>
                  <label className="sr" htmlFor="email">Email address</label>
                  <input id="email" className="field" type="email" inputMode="email" autoComplete="email"
                    placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <button className="btn" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} disabled={busy || !email}>
                    {busy ? "Sending…" : "Email me a code"}
                  </button>
                </form>}
                {config && !GOOGLE_CLIENT_ID && !emailLogin && <p className="note" style={{ marginTop: 16, textAlign: "left" }}>Sign-in is not switched on yet. The site owner needs to add a Google client ID or an email service (see the setup guide).</p>}
              </motion.div>
            ) : (
              <motion.form key="code" onSubmit={submitCode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
                <p className="muted">We sent a 6-digit code to <strong style={{ color: "var(--ink)" }}>{email}</strong>.</p>
                <label className="sr" htmlFor="code">6-digit code</label>
                <input id="code" className="field code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
                  placeholder="······" value={code} autoFocus
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
                <button className="btn" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} disabled={busy || code.length !== 6}>
                  {busy ? "Checking…" : "Sign in"}
                </button>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 14 }}>
                  <button type="button" className="linkbtn" onClick={() => { setStep("choose"); setError(""); }}>Use a different email</button>
                  <button type="button" className="linkbtn" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
                    {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div role="alert" aria-live="polite" className="error" style={{ marginTop: 14 }}>{error}</div>
          <motion.p variants={rise} className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            By continuing you agree to our <Link to="/terms" className="link">Terms</Link> and <Link to="/privacy" className="link">Privacy Policy</Link>.
          </motion.p>
        </motion.div>
      </main>
    </Transition>
  );
}
