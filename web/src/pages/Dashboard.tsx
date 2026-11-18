import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, daysLeft, fmtDate, type Match } from "../api";
import { useAuth } from "../auth";
import { useAccount } from "../account";
import Transition, { rise, stagger } from "../components/Transition";
import Orb from "../components/Orb";
import { Brand, ScoreRing } from "../components/ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { account, config, refresh } = useAccount();
  const [top, setTop] = useState<Match[] | null>(null);
  const sub = account?.subscription ?? null;
  const p = account?.profile;
  const paused = !!p?.alertsPaused || !!p?.gotJobAt;
  const watching = !!sub && !paused;

  useEffect(() => { void refresh(); api.matches("new").then((d) => setTop(d.matches.slice(0, 3))).catch(() => setTop([])); }, [refresh]);

  return (
    <Transition>
      <main className="page">
        <header className="topbar">
          <Brand to="/dashboard" />
          <div className="row-gap">
            {user?.isAdmin && <Link to="/admin" className="btn soft sm">Admin</Link>}
            {user?.picture && <img src={user.picture} alt="" width={36} height={36} referrerPolicy="no-referrer" style={{ borderRadius: "50%", border: "2px solid var(--paper)" }} />}
          </div>
        </header>

        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise} className="row-gap" style={{ flexWrap: "nowrap" }}>
            <Orb off={!watching} />
            <div>
              <p className="eyebrow">{p?.gotJobAt ? "Congratulations" : watching ? "Radar on" : sub ? "Alerts paused" : "Radar off"}</p>
              <h1 style={{ fontSize: "clamp(26px,5.5vw,40px)" }}>{greeting()}, {user?.name.split(" ")[0]}.</h1>
              <p className="muted">
                {p?.gotJobAt ? "You told us you got a job. Your renewal is off and alerts are stopped."
                  : watching ? `Watching for ${p?.roles.slice(0, 2).join(" and ")}${(p?.roles.length ?? 0) > 2 ? " and more" : ""}.`
                  : sub ? "Your alerts are paused. Switch them back on in Settings." : "Choose a plan to start receiving your matches."}
              </p>
            </div>
          </motion.div>

          {!sub && (
            <motion.div variants={rise} className="card" style={{ marginTop: 18, borderColor: "var(--blue)" }}>
              <div className="spread">
                <div><h3>You are not on a plan yet</h3><p className="muted">See how many open jobs fit you, then pick a plan from {config ? `₹${config.plans[0].pricePaise / 100}` : "₹99"} a month.</p></div>
                <Link to="/plans" className="btn">See my matches and plans</Link>
              </div>
            </motion.div>
          )}

          <motion.div className="stats" variants={rise}>
            <div className="card stat"><b>{account?.matches.today ?? 0}</b><span className="muted">new matches in the last 24 hours</span></div>
            <div className="card stat"><b>{account?.matches.total ?? 0}</b><span className="muted">matches waiting for you</span></div>
            <div className="card stat">
              {sub ? <><b>{daysLeft(sub.periodEnd)}</b><span className="muted">days left · {sub.autoRenews ? `renews ${fmtDate(sub.periodEnd)}` : `ends ${fmtDate(sub.periodEnd)}`}</span></> : <><b>–</b><span className="muted">no active plan</span></>}
            </div>
          </motion.div>

          {sub && (
            <motion.div variants={rise} className="row-gap small" style={{ marginBottom: 18 }}>
              <span className="badge blue">{sub.planName} plan</span>
              <span className={`badge ${p?.whatsappOptIn && config?.whatsapp ? "" : "grey"}`}>WhatsApp {p?.whatsappOptIn ? (config?.whatsapp ? "on" : "starting soon") : "off"}</span>
              <span className={`badge ${p?.emailInstant ? "" : "grey"}`}>Email {p?.emailInstant ? "on" : "off"}</span>
              {config?.telegram.enabled && <span className={`badge ${p?.telegramConnected && p.telegramAlerts ? "" : "grey"}`}>Telegram {p?.telegramConnected ? (p.telegramAlerts ? "on" : "paused") : "not connected"}</span>}
              <span className="badge grey">Up to {p?.maxAlertsPerDay ?? 5} a day</span>
              {sub.cancelAtPeriodEnd && <span className="badge amber">Renewal off</span>}
            </motion.div>
          )}

          {sub && (
            <>
              <motion.div variants={rise} className="spread" style={{ marginBottom: 12 }}><h3>Best for you right now</h3><Link to="/matches" className="link small">See all</Link></motion.div>
              <div className="list">
                {top?.map((m) => (
                  <motion.a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="card match" variants={rise} whileHover={{ y: -3 }}>
                    <ScoreRing score={m.score} />
                    <div><strong>{m.title}</strong> <span className="muted">· {m.company}</span><p className="muted small">{m.location}</p><p className="small" style={{ marginTop: 4 }}>{m.why ?? m.reasons[0]}</p></div>
                  </motion.a>
                ))}
                {top && top.length === 0 && (
                  <motion.div variants={rise} className="card flat">
                    <b>No matches yet.</b>
                    <p className="muted" style={{ marginTop: 6 }}>We check new openings all day and only keep the ones that fit. If nothing appears in a day or two, <Link to="/profile" className="link">add another role or city</Link> to widen the search.</p>
                  </motion.div>
                )}
              </div>
            </>
          )}

          {sub && !p?.gotJobAt && (
            <motion.div variants={rise} className="card flat" style={{ marginTop: 22 }}>
              <div className="spread">
                <div><h3>Got a job?</h3><p className="muted">Tell us and we stop your next payment right away.</p></div>
                <Link to="/settings#got-job" className="btn green sm">I got a job</Link>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
    </Transition>
  );
}
