import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ago, api, type Match } from "../api";
import { useAccount } from "../account";
import Transition from "../components/Transition";
import { Brand, ScoreRing } from "../components/ui";

const TABS = [["new", "New"], ["applied", "Applied"], ["dismissed", "Hidden"]] as const;
type Tab = (typeof TABS)[number][0];

export default function Matches() {
  const { account, config } = useAccount();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("new");
  const [list, setList] = useState<Match[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null); // "did you apply?" prompt after opening a job
  const sub = account?.subscription ?? null;
  const isPro = !!config?.plans.find((p) => p.id === sub?.plan)?.tailoredResume;

  const load = useCallback(() => { setList(null); api.matches(tab).then((d) => setList(d.matches)).catch((e) => { setError((e as Error).message); setList([]); }); }, [tab]);
  useEffect(load, [load]);

  const move = async (m: Match, status: Tab) => {
    setList((l) => l?.filter((x) => x.id !== m.id) ?? null);
    setAsked(null);
    try { await api.updateMatch(m.id, { status }); } catch (e) { setError((e as Error).message); load(); }
  };
  const rate = async (m: Match, feedback: "good" | "bad") => {
    setList((l) => l?.map((x) => (x.id === m.id ? { ...x, feedback } : x)) ?? null);
    try { await api.updateMatch(m.id, { feedback }); } catch { /* not critical */ }
  };
  const tailor = async (m: Match) => {
    if (m.tailored) { nav(`/matches/${m.id}/resume`); return; }
    setBusyId(m.id); setError("");
    try { await api.tailor(m.id); nav(`/matches/${m.id}/resume`); }
    catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  };

  return (
    <Transition>
      <main className="page">
        <header className="topbar"><Brand to="/dashboard" /><Link to="/profile" className="btn soft sm">Edit what I want</Link></header>
        <div className="spread" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: "clamp(26px,5vw,36px)" }}>Your matches</h1>
          <div className="tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                {tab === id && <motion.span layoutId="tabpill" className="pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {!sub && <div className="note blue" style={{ marginBottom: 14 }}>You are not on a plan, so new matches are not being collected. <Link to="/plans" className="link">Choose a plan</Link></div>}
        <div role="alert" aria-live="polite" className="error">{error}</div>

        <div className="list">
          <AnimatePresence mode="popLayout">
            {list?.map((m, i) => (
              <motion.article layout key={m.id} className="card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.05 } }} exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}>
                <div className="match">
                  <ScoreRing score={m.score} />
                  <div style={{ minWidth: 0 }}>
                    <div className="spread" style={{ alignItems: "flex-start" }}>
                      <div><h3 style={{ fontSize: 18 }}>{m.title}</h3><p className="muted">{m.company} · {m.location || "India"}</p></div>
                      <span className="muted small" style={{ whiteSpace: "nowrap" }}>{ago(m.postedAt ?? m.createdAt)}</span>
                    </div>
                    <div className="row-gap" style={{ marginTop: 8 }}>
                      {m.remote && <span className="badge blue">Remote</span>}
                      {m.salary && <span className="badge">{m.salary}</span>}
                      {!m.active && <span className="badge grey">May have closed</span>}
                    </div>
                    {m.why && <p style={{ marginTop: 10 }}>{m.why}</p>}
                    <ul className="reasons">{m.reasons.map((r) => <li key={r}><span className="tick" /> {r}</li>)}</ul>

                    {asked === m.id ? (
                      <div className="note green row-gap" style={{ marginTop: 14 }}>
                        <span>Did you apply?</span>
                        <button className="btn green sm" onClick={() => move(m, "applied")}>Yes, I applied</button>
                        <button className="btn soft sm" onClick={() => setAsked(null)}>Not yet</button>
                      </div>
                    ) : (
                      <div className="spread noprint" style={{ marginTop: 14 }}>
                        <div className="row-gap">
                          <a className="btn sm" href={m.url} target="_blank" rel="noopener noreferrer" onClick={() => tab === "new" && setAsked(m.id)}>View and apply</a>
                          {isPro
                            ? <button className="btn soft sm" disabled={busyId === m.id} onClick={() => tailor(m)}>{busyId === m.id ? "Writing your resume…" : m.tailored ? "Open tailored resume" : "Tailor my resume"}</button>
                            : sub && <Link className="btn soft sm" to="/plans">Tailored resume (Pro)</Link>}
                          {tab !== "new" && <button className="btn soft sm" onClick={() => move(m, "new")}>Move back to New</button>}
                        </div>
                        <div className="row-gap">
                          <button className={`iconbtn ${m.feedback === "good" ? "on" : ""}`} title="Good match" aria-label="Good match" onClick={() => rate(m, "good")}>👍</button>
                          <button className={`iconbtn ${m.feedback === "bad" ? "on" : ""}`} title="Not a good match" aria-label="Not a good match" onClick={() => rate(m, "bad")}>👎</button>
                          {tab === "new" && <button className="linkbtn small" onClick={() => move(m, "dismissed")}>Hide</button>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
          {list && list.length === 0 && (
            <div className="card flat center">
              <b>{tab === "new" ? "Nothing new right now." : tab === "applied" ? "Jobs you mark as applied appear here." : "Jobs you hide appear here."}</b>
              {tab === "new" && <p className="muted" style={{ marginTop: 6 }}>We only keep openings that fit you. When one is posted you will see it here and get an alert.</p>}
            </div>
          )}
          {!list && <div className="card flat center muted">Loading…</div>}
        </div>
      </main>
    </Transition>
  );
}
