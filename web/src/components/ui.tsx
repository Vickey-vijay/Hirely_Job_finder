import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { rupees, type Plan, type PublicConfig } from "../api";

export function Brand({ to = "/" }: { to?: string }) {
  return <Link to={to} className="brand" aria-label="Hirely home"><i /> Hirely</Link>;
}

/** Circular 1-10 fit score that draws itself in. Green from 8, blue from 6, grey below. */
export function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const color = score >= 8 ? "var(--green)" : score >= 6 ? "var(--blue)" : "#93a3b8";
  return (
    <div className="score" style={{ width: size, height: size }} role="img" aria-label={`Fit score ${score} out of 10`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e3e9f2" strokeWidth="5" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - score / 10) }}
          viewport={{ once: true }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <span>{score}<small>/10</small></span>
    </div>
  );
}

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** Counts up to a number the first time it is seen. */
export function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const c = animate(0, to, { duration: 1.4, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [seen, to]);
  return <span ref={ref}>{n.toLocaleString("en-IN")}</span>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <motion.span layout className="knob" transition={{ type: "spring", stiffness: 520, damping: 34 }} />
    </button>
  );
}

/** Chips you can add by typing (Enter or comma) or by tapping a suggestion. */
export function TagInput({ value, onChange, suggestions, placeholder, max, id }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string; max: number; id: string }) {
  const [text, setText] = useState("");
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const add = (raw: string) => {
    const s = raw.replace(/\s+/g, " ").trim();
    if (s && !has(s) && value.length < max) onChange([...value, s]);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(text); }
    else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
  };
  const typed = text.trim().toLowerCase();
  const shown = suggestions.filter((s) => !has(s) && (!typed || s.toLowerCase().includes(typed))).slice(0, 12);
  const full = value.length >= max;
  return (
    <div>
      {value.length > 0 && (
        <div className="row-gap" style={{ marginBottom: 8 }}>
          {value.map((v) => (
            <motion.button layout type="button" key={v} className="chip on" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {v} <span className="x" aria-hidden>×</span>
            </motion.button>
          ))}
        </div>
      )}
      <input id={id} className="field" value={text} placeholder={full ? `Maximum ${max} reached` : placeholder} disabled={full}
        onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={() => text.trim() && add(text)} />
      {!full && shown.length > 0 && (
        <div className="row-gap" style={{ marginTop: 8 }}>
          {shown.map((s) => <button type="button" key={s} className="chip ghost" onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

export function PlanCards({ plans, current, busy, onPick, cta }: { plans: Plan[]; current?: Plan["id"] | null; busy?: string | null; onPick: (p: Plan) => void; cta?: (p: Plan) => string }) {
  const rank = (id: string) => plans.findIndex((p) => p.id === id);
  return (
    <div className="plans">
      {plans.map((p, i) => {
        const isCurrent = current === p.id;
        const lower = current ? rank(p.id) < rank(current) : false;
        return (
          <Reveal key={p.id} delay={i * 0.08}>
            <motion.div className={`card plan ${p.id === "plus" ? "best" : ""}`} whileHover={{ y: -6 }} style={{ height: "100%" }}>
              {p.id === "plus" && <span className="badge blue ribbon">Most chosen</span>}
              <div>
                <h3>{p.name}</h3>
                <p className="muted small">{p.tagline}</p>
              </div>
              <div className="price">{rupees(p.pricePaise)} <small>/ month</small></div>
              <ul>{p.features.map((f) => <li key={f}><span className="tick" /> {f}</li>)}</ul>
              <button className={`btn block ${p.id === "plus" ? "" : "soft"}`} disabled={isCurrent || lower || !!busy} onClick={() => onPick(p)}>
                {busy === p.id ? "Opening payment…" : isCurrent ? "Your current plan" : lower ? "Included in your plan" : cta ? cta(p) : `Choose ${p.name}`}
              </button>
            </motion.div>
          </Reveal>
        );
      })}
    </div>
  );
}

export function Footer({ config }: { config: PublicConfig | null }) {
  const b = config?.business;
  return (
    <footer className="footer noprint">
      <div>
        <Brand />
        <p className="small" style={{ marginTop: 8, maxWidth: 380 }}>Personal job alerts for people in India. We only read public job sources, and we only message people who asked us to.</p>
        <p className="small" style={{ marginTop: 8 }}>© {new Date().getFullYear()} {b?.name ?? "Hirely"}</p>
      </div>
      <nav aria-label="Footer">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/refunds">Refunds &amp; cancellation</Link>
        <Link to="/contact">Contact</Link>
      </nav>
    </footer>
  );
}

/** The plain-language billing rules, shown wherever money is involved. */
export function BillingRules({ mode }: { mode: PublicConfig["billingMode"] | undefined }) {
  return (
    <div className="note blue">
      <b>Before you pay:</b> {mode === "pass" ? "this is a one-time payment for 30 days. It does not renew by itself." : "your plan renews every month with an automatic payment you approve once (UPI Autopay or card)."}{" "}
      We do not give refunds for a month that has started. You can turn off renewal at any time in Settings and keep your alerts until the paid month ends.
      Got a job? Tap <b>“I got a job”</b> and we stop the next payment for you.
    </div>
  );
}
