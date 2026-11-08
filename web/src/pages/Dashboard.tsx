import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import Transition, { rise, stagger } from "../components/Transition";
import Orb from "../components/Orb";
import { matches } from "../data";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  return (
    <Transition>
      <main className="page">
        <header className="topbar">
          <div className="brand"><i /> Hirely</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user?.picture && (
              <img src={user.picture} alt="" width={36} height={36} referrerPolicy="no-referrer"
                style={{ borderRadius: "50%", border: "2px solid var(--paper)" }} />
            )}
            <button className="btn soft" onClick={() => signOut()}>Sign out</button>
          </div>
        </header>
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Orb />
            <div>
              <p className="eyebrow">Radar on</p>
              <h1 style={{ fontSize: "clamp(28px,6vw,44px)" }}>{greeting()}, {user?.name.split(" ")[0]}.</h1>
              <p className="muted">We're watching so you don't have to.</p>
            </div>
          </motion.div>

          <motion.div className="stats" variants={rise}>
            <div className="card stat"><b>4</b><span className="muted">new matches today</span></div>
            <div className="card stat"><b>23</b><span className="muted">days left on your plan</span></div>
            <div className="card stat"><b style={{ color: "var(--dusk-deep)" }}>On</b><span className="muted">WhatsApp alerts</span></div>
          </motion.div>

          <motion.h3 variants={rise} style={{ margin: "8px 0 12px" }}>Fresh for you</motion.h3>
          <div className="list">
            {matches.slice(0, 3).map((m) => (
              <motion.div key={m.id} className="card" variants={rise} whileHover={{ y: -3 }}>
                <strong>{m.title}</strong> <span className="muted">· {m.company}</span>
                <p className="muted" style={{ fontSize: 14 }}>{m.location} · {m.posted}</p>
              </motion.div>
            ))}
          </div>
          <motion.p variants={rise} style={{ marginTop: 16 }}>
            <Link to="/matches" className="btn">See all matches</Link>
          </motion.p>
        </motion.div>
      </main>
    </Transition>
  );
}
