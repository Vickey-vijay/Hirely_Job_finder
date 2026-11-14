import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { ago, api, fmtDate, rupees } from "../api";
import { useAuth } from "../auth";
import Transition from "../components/Transition";
import { Brand, Toggle } from "../components/ui";

/** Owner-only page: health of the business and the job sources. Open to emails listed in ADMIN_EMAILS. */
export default function Admin() {
  const { user } = useAuth();
  const [o, setO] = useState<Record<string, any> | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ kind: "greenhouse", token: "", company: "" });
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(() => {
    api.admin.overview().then(setO).catch(() => {});
    api.admin.sources().then((d) => { setSources(d.sources); setKinds(d.kinds); }).catch(() => {});
    api.admin.users().then((d) => setUsers(d.users)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  if (user && !user.isAdmin) return <Navigate to="/dashboard" replace />;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.admin.addSource(form); setMsg(`Added ${form.kind}: ${form.token}. It will be polled within a minute.`); setForm({ ...form, token: "", company: "" }); load(); }
    catch { setMsg("Could not add that source. Check the board name."); }
  };
  const toggle = async (id: string, enabled: boolean) => { setSources((s) => s.map((x) => (x.id === id ? { ...x, enabled } : x))); await api.admin.toggleSource(id, enabled).catch(() => {}); };
  const shown = sources.filter((s) => !filter || `${s.company} ${s.kind} ${s.token}`.toLowerCase().includes(filter.toLowerCase()));
  const on = (v: boolean) => <span className={`badge ${v ? "" : "amber"}`}>{v ? "on" : "not set"}</span>;

  return (
    <Transition>
      <main className="page wide">
        <header className="topbar"><Brand to="/dashboard" /><Link to="/dashboard" className="btn soft sm">Back to app</Link></header>
        <h1 style={{ fontSize: 32 }}>Admin</h1>

        {o && (
          <>
            <div className="stats">
              <div className="card stat"><b>{o.users}</b><span className="muted">users ({o.onboarded} with a profile)</span></div>
              <div className="card stat"><b>{o.activeSubscribers}</b><span className="muted">paying now{o.byPlan?.length ? ` · ${o.byPlan.map((p: any) => `${p.plan} ${p.users}`).join(", ")}` : ""}</span></div>
              <div className="card stat"><b>{rupees(o.revenueThisMonthPaise)}</b><span className="muted">collected this month</span></div>
              <div className="card stat"><b>{o.jobs}</b><span className="muted">open jobs · {o.jobs24} new in 24h</span></div>
              <div className="card stat"><b>{o.matches24}</b><span className="muted">matches made in 24h</span></div>
              <div className="card stat"><b>{o.sent24}</b><span className="muted">alerts sent in 24h · {o.failed24} failed</span></div>
            </div>
            <div className="card flat row-gap" style={{ marginBottom: 16 }}>
              <b>Switches:</b>
              <span>Payments <span className={`badge ${o.config.billingMode === "subscription" ? "" : "amber"}`}>{o.config.billingMode}</span></span>
              <span>Google sign-in {on(o.config.google)}</span><span>Email {on(o.config.emailLogin)}</span><span>WhatsApp {on(o.config.whatsapp)}</span><span>AI {on(o.config.ai)}</span><span>Adzuna {on(o.config.adzuna)}</span>
            </div>
            {o.badSources?.length > 0 && (
              <div className="note" style={{ marginBottom: 16 }}><b>Sources failing:</b> {o.badSources.map((s: any) => `${s.company} (${s.kind}, ${s.failCount}× ${s.lastError ?? ""})`).join("; ")}</div>
            )}
          </>
        )}

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="spread"><h3>Job sources ({sources.filter((s) => s.enabled).length} on, {sources.length} total)</h3><input className="field" style={{ maxWidth: 240 }} placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
          <form onSubmit={add} className="row-gap" style={{ margin: "14px 0" }}>
            <select className="field" style={{ maxWidth: 190 }} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
            <input className="field" style={{ maxWidth: 220 }} placeholder="Board name, e.g. razorpay" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} required />
            <input className="field" style={{ maxWidth: 220 }} placeholder="Company name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <button className="btn sm">Add source</button>
          </form>
          {msg && <p className="note green" style={{ marginBottom: 12 }}>{msg}</p>}
          <div className="scroll-x" style={{ maxHeight: 480, overflowY: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Company</th><th>Type</th><th>Board</th><th>India jobs</th><th>Last OK</th><th>Problem</th><th>On</th></tr></thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td>{s.company}</td><td>{s.kind}</td><td className="muted">{s.token}</td><td>{s.jobs}</td><td className="muted">{s.lastOkAt ? ago(s.lastOkAt) : "never"}</td>
                    <td className="muted">{s.failCount ? `${s.failCount}× ${s.lastError ?? ""}` : ""}</td>
                    <td><Toggle label={`Source ${s.company}`} on={s.enabled} onChange={(v) => toggle(s.id, v)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h3>Users ({users.length})</h3>
          <div className="scroll-x" style={{ marginTop: 10 }}>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Plan</th><th>Roles</th><th>Matches</th><th>WhatsApp</th><th>Got job</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}><td>{u.name}</td><td className="muted">{u.email}</td><td>{fmtDate(u.createdAt)}</td><td>{u.plan ?? ""}</td><td className="muted">{(u.roles ?? []).join(", ")}</td><td>{u.matches}</td><td>{u.whatsapp ? "yes" : ""}</td><td>{u.gotJobAt ? fmtDate(u.gotJobAt) : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </Transition>
  );
}
