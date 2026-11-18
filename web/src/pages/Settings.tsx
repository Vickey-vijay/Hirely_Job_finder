import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, ALERTS_MAX, ALERTS_MIN, fmtDate, rupees } from "../api";
import { useAuth } from "../auth";
import { useAccount } from "../account";
import Transition from "../components/Transition";
import { Brand, Toggle } from "../components/ui";

type Dialog = null | "got-job" | "stop" | "delete";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { account, config, refresh } = useAccount();
  const nav = useNavigate();
  const { hash } = useLocation();
  const [dialog, setDialog] = useState<Dialog>(hash === "#got-job" ? "got-job" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<{ id: string; amountPaise: number; status: string; at: string }[]>([]);
  const p = account?.profile;
  const sub = account?.subscription ?? null;
  const [limit, setLimit] = useState(p?.maxAlertsPerDay ?? 5);
  const [linking, setLinking] = useState(false);

  useEffect(() => { api.billing().then((b) => setPayments(b.payments)).catch(() => {}); }, [sub?.status, sub?.plan]);
  useEffect(() => { if (p) setLimit(p.maxAlertsPerDay); }, [p?.maxAlertsPerDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // After "Connect Telegram", check every few seconds until the user presses Start in Telegram (stops after 2 minutes).
  useEffect(() => {
    if (!linking) return;
    if (p?.telegramConnected) { setLinking(false); return; }
    const poll = setInterval(() => { void refresh(); }, 3000);
    const stop = setTimeout(() => setLinking(false), 120_000);
    return () => { clearInterval(poll); clearTimeout(stop); };
  }, [linking, p?.telegramConnected, refresh]);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setError("");
    try { await fn(); await refresh(); setDialog(null); after?.(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const alerts = (b: Parameters<typeof api.alerts>[0]) => run(() => api.alerts(b));
  /** Saves the daily limit when the slider is let go (not on every tick). */
  const saveLimit = () => { if (p && limit !== p.maxAlertsPerDay) void alerts({ maxAlertsPerDay: limit }); };
  const connectTelegram = async () => {
    setError("");
    try {
      const link = await api.telegramLink();
      window.open(link.url, "_blank", "noopener,noreferrer");
      setLinking(true);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Transition>
      <main className="page">
        <header className="topbar"><Brand to="/dashboard" /><button className="btn soft sm" onClick={() => signOut().then(() => nav("/"))}>Sign out</button></header>
        <h1 style={{ fontSize: "clamp(26px,5vw,36px)", marginBottom: 16 }}>Settings</h1>
        <div role="alert" aria-live="polite" className="error">{!dialog && error}</div>

        <div className="stack">
          <section className="card">
            <div className="spread"><h3>What you are looking for</h3><Link to="/profile" className="btn soft sm">Edit</Link></div>
            <div className="setting"><span className="muted">Roles</span><span style={{ textAlign: "right" }}>{p?.roles.join(", ") || "Not set"}</span></div>
            <div className="setting"><span className="muted">Skills</span><span style={{ textAlign: "right" }}>{p?.skills.length ? `${p.skills.slice(0, 6).join(", ")}${p.skills.length > 6 ? ` +${p.skills.length - 6}` : ""}` : "Not set"}</span></div>
            <div className="setting"><span className="muted">Cities</span><span style={{ textAlign: "right" }}>{p?.locations.join(", ") || "Anywhere in India"}{p?.remoteOk ? " · remote OK" : ""}</span></div>
            <div className="setting"><span className="muted">Experience</span><span>{p?.experienceYears ?? 0} years</span></div>
            <div className="setting">
              <span className="muted">Resume</span>
              <span className="row-gap">{p?.hasResume ? <>{p.resumeFilename} <button className="linkbtn small" onClick={() => run(() => api.deleteResume())}>Delete</button></> : "Not uploaded"}</span>
            </div>
          </section>

          <section className="card">
            <h3>Alerts</h3>
            <div className="setting"><div><b>Pause all alerts</b><p className="muted small">Going on holiday or busy with interviews? Your plan keeps running.</p></div><Toggle label="Pause all alerts" on={!!p?.alertsPaused} onChange={(v) => alerts({ paused: v })} /></div>
            <div className="setting setting-stack">
              <div><b>Daily limit</b><p className="muted small">The most instant alerts you get in one India day: {ALERTS_MIN} to {ALERTS_MAX}. A job counts once, whichever channel it goes to. The 9 AM summary is separate.</p></div>
              <div className="limit">
                <input type="range" min={ALERTS_MIN} max={ALERTS_MAX} step={1} value={limit} aria-label="Instant alerts per day"
                  aria-valuemin={ALERTS_MIN} aria-valuemax={ALERTS_MAX} aria-valuenow={limit} aria-valuetext={`${limit} a day`}
                  onChange={(e) => setLimit(Number(e.target.value))} onPointerUp={saveLimit} onKeyUp={saveLimit} onBlur={saveLimit} />
                <output className="limit-value">{limit} a day</output>
              </div>
            </div>
            <div className="setting"><div><b>Email: instant alerts</b><p className="muted small">{user?.email}. A message as soon as a strong match appears.</p></div><Toggle label="Email instant alerts" on={!!p?.emailInstant} onChange={(v) => alerts({ emailInstant: v })} /></div>
            <div className="setting"><div><b>Email: morning summary</b><p className="muted small">One email at 9 AM with yesterday's best matches.</p></div><Toggle label="Email morning summary" on={!!p?.emailDigest} onChange={(v) => alerts({ emailDigest: v })} /></div>
            {config?.telegram.enabled && (
              <div className="setting">
                <div>
                  <b>Telegram</b>
                  <p className="muted small">{p?.telegramConnected ? "Connected. Alerts arrive here as Telegram messages." : "Free. Get alerts as Telegram messages."}</p>
                  {linking && !p?.telegramConnected && <p className="live-note">Open Telegram and press Start. This page updates when it is connected.</p>}
                </div>
                <div className="row-gap">
                  {p?.telegramConnected ? (
                    <>
                      <Toggle label="Telegram alerts" on={!!p?.telegramAlerts} onChange={(v) => alerts({ telegramAlerts: v })} />
                      <button className="btn soft sm" disabled={busy} onClick={() => run(() => api.telegramDisconnect())}>Disconnect</button>
                    </>
                  ) : (
                    <button className="btn sm" disabled={busy} onClick={() => void connectTelegram()}>Connect Telegram</button>
                  )}
                </div>
              </div>
            )}
            <div className="setting">
              <div>
                <b>WhatsApp</b>
                <p className="muted small">{p?.phone ? `+${p.phone.slice(0, 2)} ${p.phone.slice(2)}` : "No number saved. Add one in your profile."}{config && !config.whatsapp ? " · starting soon" : ""}</p>
                <p className="muted small">A summary every morning at 9 AM{sub?.plan === "pro" ? ", plus instant alerts on Pro (up to 5 a day)" : ""}.</p>
              </div>
              <Toggle label="WhatsApp alerts" on={!!p?.whatsappOptIn} onChange={(v) => (p?.phone ? alerts({ whatsappOptIn: v }) : nav("/profile"))} />
            </div>
          </section>

          <section className="card" id="billing">
            <div className="spread"><h3>Plan and billing</h3><Link to="/plans" className="btn soft sm">{sub ? "Change plan" : "Choose a plan"}</Link></div>
            {sub ? (
              <>
                <div className="setting"><span className="muted">Plan</span><b>{sub.planName} · {rupees(config?.plans.find((x) => x.id === sub.plan)?.pricePaise ?? 0)} a month</b></div>
                <div className="setting"><span className="muted">{sub.autoRenews ? "Next payment" : "Access until"}</span><span>{fmtDate(sub.periodEnd)}{!sub.autoRenews && " · will not renew"}</span></div>
                {sub.autoRenews && (
                  <div className="setting"><div><b>Automatic renewal is on</b><p className="muted small">Turn it off any time. You keep your alerts until {fmtDate(sub.periodEnd)}. Nothing is refunded and nothing more is charged.</p></div><button className="btn danger sm" onClick={() => setDialog("stop")}>Stop renewal</button></div>
                )}
              </>
            ) : <p className="muted" style={{ marginTop: 8 }}>You are not on a plan.</p>}
            {payments.length > 0 && (
              <div className="scroll-x" style={{ marginTop: 10 }}>
                <table className="tbl"><thead><tr><th>Date</th><th>Amount</th><th>Payment ID</th></tr></thead>
                  <tbody>{payments.map((x) => <tr key={x.id}><td>{fmtDate(x.at)}</td><td>{rupees(x.amountPaise)}</td><td className="muted">{x.id}</td></tr>)}</tbody></table>
              </div>
            )}
          </section>

          <section className="card" id="got-job" style={{ borderColor: "var(--green)" }}>
            {p?.gotJobAt ? (
              <div className="spread"><div><h3>Congratulations on the new job 🎉</h3><p className="muted">Renewal is off and alerts are stopped since {fmtDate(p.gotJobAt)}.</p></div><button className="btn soft sm" disabled={busy} onClick={() => run(() => api.lookingAgain())}>I am looking again</button></div>
            ) : (
              <div className="spread"><div><h3>Got a job?</h3><p className="muted">Tell us. We stop your next payment and your alerts, so you do not pay for a month you do not need.</p></div><button className="btn green" onClick={() => setDialog("got-job")}>I got a job</button></div>
            )}
          </section>

          {config?.business.supportUpi && (
            <p className="small muted">Hirely runs at cost. If it helped you and you would like to support more tools like it, you can send any amount to UPI <b>{config.business.supportUpi}</b>. Thank you.</p>
          )}

          <section className="card flat">
            <h3>Your data</h3>
            <p className="muted" style={{ margin: "6px 0 12px" }}>Deleting your account removes your profile, resume text, matches and history from our systems. Payment records that the law requires us to keep stay with our payment provider.</p>
            <div className="row-gap"><button className="btn danger sm" onClick={() => setDialog("delete")}>Delete my account</button><Link to="/privacy" className="link small">Privacy policy</Link><Link to="/contact" className="link small">Contact us</Link></div>
          </section>
        </div>

        <AnimatePresence>
          {dialog && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && setDialog(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(15,39,66,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
              <motion.div role="dialog" aria-modal="true" className="card" style={{ maxWidth: 440, width: "100%" }} initial={{ y: 30, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
                {dialog === "got-job" && <><h2>That is great news.</h2><p className="muted" style={{ margin: "8px 0 16px" }}>We will turn off your renewal and stop your alerts now. {sub ? `Your plan stays visible until ${fmtDate(sub.periodEnd)}; nothing more will be charged.` : ""} If plans change, you can switch back on with one tap.</p></>}
                {dialog === "stop" && <><h2>Stop automatic renewal?</h2><p className="muted" style={{ margin: "8px 0 16px" }}>You will not be charged again. Your alerts continue until {fmtDate(sub?.periodEnd)}. The current month is not refunded.</p></>}
                {dialog === "delete" && <><h2>Delete your account?</h2><p className="muted" style={{ margin: "8px 0 16px" }}>This removes your profile, resume text and matches for good and stops any renewal. The current month is not refunded. This cannot be undone.</p></>}
                <div role="alert" className="error">{error}</div>
                <div className="row-gap" style={{ justifyContent: "flex-end" }}>
                  <button className="btn soft sm" disabled={busy} onClick={() => setDialog(null)}>Go back</button>
                  {dialog === "got-job" && <button className="btn green sm" disabled={busy} onClick={() => run(() => api.gotJob())}>{busy ? "Saving…" : "Yes, I got a job"}</button>}
                  {dialog === "stop" && <button className="btn danger sm" disabled={busy} onClick={() => run(() => api.cancel("user_stopped"))}>{busy ? "Stopping…" : "Stop renewal"}</button>}
                  {dialog === "delete" && <button className="btn danger sm" disabled={busy} onClick={() => run(() => api.deleteAccount(), () => { void signOut(); nav("/"); })}>{busy ? "Deleting…" : "Delete everything"}</button>}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </Transition>
  );
}
