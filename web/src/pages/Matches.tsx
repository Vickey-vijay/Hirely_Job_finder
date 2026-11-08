import { useState } from "react";
import { motion } from "framer-motion";
import Transition, { rise, stagger } from "../components/Transition";
import { matches } from "../data";

function Score({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="score">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <motion.circle
          cx="28" cy="28" r={r} fill="none" stroke="var(--dusk)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
        />
      </svg>
      <span>{value}</span>
    </div>
  );
}

const filters = ["All", "Remote", "Hybrid"] as const;

export default function Matches() {
  const [f, setF] = useState<(typeof filters)[number]>("All");
  const shown = matches.filter((m) => f === "All" || m.location.includes(f));

  return (
    <Transition>
      <main className="page">
        <header className="topbar"><div className="brand"><i /> Matches</div></header>
        <p className="muted" style={{ marginBottom: 14 }}>Picked for you, with the reason right there.</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {filters.map((x) => (
            <button key={x} className={`chip ${f === x ? "active" : ""}`} onClick={() => setF(x)}>
              {f === x && <motion.span layoutId="chipbg" className="pill" style={{ position: "absolute", inset: 0, background: "var(--dusk-deep)", borderRadius: 999, zIndex: -1 }} />}
              <span style={{ position: "relative" }}>{x}</span>
            </button>
          ))}
        </div>
        <motion.div className="list" variants={stagger} initial="hidden" animate="show" key={f}>
          {shown.map((m) => (
            <motion.div key={m.id} className="card row" variants={rise} whileHover={{ y: -3 }}>
              <Score value={m.score} />
              <div>
                <strong>{m.title}</strong> <span className="muted">· {m.company}</span>
                <p className="muted" style={{ fontSize: 14 }}>{m.location}</p>
                <div style={{ marginTop: 6 }}>
                  <span className="tag">{m.why}</span>
                  <span className="tag">{m.source}</span>
                </div>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>{m.posted}</span>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </Transition>
  );
}
