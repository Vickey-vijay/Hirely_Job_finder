import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../auth";
import { GOOGLE_CLIENT_ID } from "../config";
import Transition, { rise, stagger } from "../components/Transition";

export default function Login() {
  const { user, signInWithGoogle } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const onSuccess = async (credential?: string) => {
    if (!credential) { setError("Google didn't return a sign-in. Please try again."); return; }
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle(credential);
      nav("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Transition>
      <main className="page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <motion.div className="card" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
          variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise} className="brand" style={{ justifyContent: "center" }}><i /> Hirely</motion.div>
          <motion.h2 variants={rise} style={{ margin: "18px 0 6px" }}>Welcome in.</motion.h2>
          <motion.p variants={rise} className="muted">One tap and we're set. No passwords to remember.</motion.p>

          <motion.div variants={rise} style={{ marginTop: 22, display: "flex", justifyContent: "center", minHeight: 44, opacity: busy ? 0.5 : 1, pointerEvents: busy ? "none" : "auto" }}>
            {GOOGLE_CLIENT_ID ? (
              <GoogleLogin
                onSuccess={(r) => onSuccess(r.credential)}
                onError={() => setError("Google sign-in was cancelled or blocked. Please try again.")}
                theme="outline" shape="pill" size="large" text="continue_with" logo_alignment="left" width="280"
              />
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>
                Google sign-in isn't set up yet. Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>web/.env</code>
                {" "}(see docs/GOOGLE_LOGIN.md).
              </p>
            )}
          </motion.div>

          <div role="alert" aria-live="polite" style={{ minHeight: 22, marginTop: 14, color: "#b4546f", fontSize: 14 }}>
            {busy ? <span className="muted">Signing you in…</span> : error}
          </div>
          <motion.p variants={rise} className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            We only read your name, email and photo.
          </motion.p>
        </motion.div>
      </main>
    </Transition>
  );
}
