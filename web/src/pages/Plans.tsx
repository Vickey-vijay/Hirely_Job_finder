import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, buyPlan, fmtDate, type Plan, type Preview } from "../api";
import { useAccount } from "../account";
import Transition from "../components/Transition";
import { BillingRules, Brand, PlanCards, ScoreRing } from "../components/ui";

/** Shows how many current jobs fit the person, then lets them pick and pay for a plan. */
export default function Plans() {
  const { config, account, refresh } = useAccount();
  const nav = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [agree, setAgree] = useState(false);
  const sub = account?.subscription ?? null;

  useEffect(() => { api.preview().then(setPreview).catch(() => setPreview({ count: 0, strong: 0, examples: [] })); }, []);

  const pick = async (p: Plan) => {
    if (!agree) { setError("Please tick the box to confirm you have read the billing rules."); return; }
    setBusy(p.id); setError("");
    try {
      const s = await buyPlan(p.id, config?.business.name ?? "Hirely");
      if (s) { await refresh(); nav("/dashboard"); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <Transition>
      <main className="page wide">
        <header className="topbar"><Brand to="/dashboard" /><span className="muted small">{sub ? `${sub.planName} plan` : "Choose a plan"}</span></header>

        {!sub && preview && (
          <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 22 }}>
            {preview.count > 0 ? (
              <>
                <span className="eyebrow">Checked just now</span>
                <h2 style={{ marginTop: 6 }}>{preview.count} open job{preview.count === 1 ? "" : "s"} fit your profile today{preview.strong > 0 ? `, ${preview.strong} of them a strong match` : ""}.</h2>
                <div className="list" style={{ marginTop: 16 }}>
                  {preview.examples.map((e, i) => (
                    <div key={i} className="match">
                      <ScoreRing score={e.score} size={52} />
                      <div><b>{e.title}</b> <span className="muted">· {e.company}</span><p className="muted small">{e.location} · {e.reasons[0]}</p></div>
                    </div>
                  ))}
                </div>
                <p className="muted small" style={{ marginTop: 14 }}>Pick a plan to open these, get the apply links, and receive new ones as they are posted.</p>
              </>
            ) : (
              <>
                <h2>We have not found a good match for you yet.</h2>
                <p className="muted" style={{ marginTop: 8 }}>
                  That is an honest answer, not an error. It usually means employers we track are not hiring for your exact role and city this week. You can
                  <button className="linkbtn" style={{ margin: "0 4px" }} onClick={() => nav("/profile")}>widen your roles or cities</button>
                  and check again. We suggest paying only once you see matches here.
                </p>
              </>
            )}
          </motion.div>
        )}

        {sub && (
          <div className="note green" style={{ marginBottom: 18 }}>
            You are on <b>{sub.planName}</b>. {sub.autoRenews ? `It renews on ${fmtDate(sub.periodEnd)}.` : `It ends on ${fmtDate(sub.periodEnd)} and will not renew.`} Upgrading starts the new plan today and replaces the current one; the unused days of the current month are not refunded.
          </div>
        )}

        {config && <PlanCards plans={config.plans} current={sub && !sub.cancelAtPeriodEnd && sub.provider !== "razorpay_pass" ? sub.plan : null} busy={busy} onPick={pick}
          cta={(p) => (sub ? (sub.plan === p.id ? `Renew ${p.name}` : `Upgrade to ${p.name}`) : `Choose ${p.name}`)} />}

        <div className="stack" style={{ marginTop: 18, maxWidth: 760 }}>
          <BillingRules mode={config?.billingMode} />
          <label className="check"><input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setError(""); }} /> <span>I have read the billing rules above and agree to the <a className="link" href="/terms" target="_blank">Terms</a> and <a className="link" href="/refunds" target="_blank">Refund &amp; cancellation policy</a>.</span></label>
          {config?.billingMode === "off" && <p className="note">Payments are not switched on yet. You can finish your profile now and come back to choose a plan soon.</p>}
          <div role="alert" aria-live="polite" className="error">{error}</div>
        </div>
      </main>
    </Transition>
  );
}
