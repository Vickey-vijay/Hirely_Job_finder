import { useState } from "react";
import { motion } from "framer-motion";
import Transition, { rise, stagger } from "../components/Transition";

const levels = ["Relaxed", "Balanced", "Picky"] as const;

export default function Settings() {
  const [wa, setWa] = useState(true);
  const [quiet, setQuiet] = useState(true);
  const [level, setLevel] = useState<(typeof levels)[number]>("Balanced");

  const Toggle = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
    <button className={`toggle ${on ? "on" : ""}`} onClick={() => set(!on)} aria-label={label} aria-pressed={on}>
      <motion.span className="knob" layout transition={{ type: "spring", stiffness: 500, damping: 30 }} />
    </button>
  );

  return (
    <Transition>
      <main className="page">
        <header className="topbar"><div className="brand"><i /> Settings</div></header>
        <motion.div className="card" variants={stagger} initial="hidden" animate="show">
          <motion.div className="setting" variants={rise}>
            <div><strong>WhatsApp alerts</strong><p className="muted">A gentle nudge when a good job appears.</p></div>
            <Toggle on={wa} set={setWa} label="WhatsApp alerts" />
          </motion.div>
          <motion.div className="setting" variants={rise}>
            <div><strong>Quiet hours</strong><p className="muted">No messages between 10 pm and 8 am.</p></div>
            <Toggle on={quiet} set={setQuiet} label="Quiet hours" />
          </motion.div>
          <motion.div className="setting" variants={rise}>
            <div><strong>How picky?</strong><p className="muted">Higher means fewer, closer matches.</p></div>
            <div className="seg">
              {levels.map((l) => (
                <button key={l} className={level === l ? "on" : ""} onClick={() => setLevel(l)}>
                  {level === l && <motion.span layoutId="segpill" className="pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                  {l}
                </button>
              ))}
            </div>
          </motion.div>
          <motion.div className="setting" variants={rise}>
            <div><strong>Stop everything</strong><p className="muted">Pause alerts any time. You can also reply STOP on WhatsApp.</p></div>
            <button className="btn soft">Pause alerts</button>
          </motion.div>
        </motion.div>
      </main>
    </Transition>
  );
}
