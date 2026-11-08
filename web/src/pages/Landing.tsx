import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Transition, { rise, stagger } from "../components/Transition";
import Orb from "../components/Orb";

const steps = [
  ["Tell us who you are", "Upload your resume or pick what you want. Two minutes."],
  ["We keep watching", "Hirely reads public job sources all day, so you don't have to."],
  ["A quiet nudge on WhatsApp", "Only the jobs that fit you. Pause or stop any time."],
];

export default function Landing() {
  return (
    <Transition>
      <main className="page">
        <header className="topbar">
          <div className="brand"><i /> Hirely</div>
          <Link to="/login" className="btn soft">Sign in</Link>
        </header>
        <motion.section className="hero" variants={stagger} initial="hidden" animate="show">
          <motion.div variants={rise}><Orb /></motion.div>
          <motion.h1 variants={rise}>
            Your next job should <em>find you.</em>
          </motion.h1>
          <motion.p variants={rise} className="muted">
            Stop refreshing ten tabs. Tell us what you're looking for once, and we'll tap you on the
            shoulder on WhatsApp when something real shows up.
          </motion.p>
          <motion.span variants={rise} className="price-pill">₹199 · one simple plan</motion.span>
          <motion.div variants={rise}>
            <Link to="/login" className="btn">Get started</Link>
          </motion.div>
        </motion.section>
        <motion.div className="steps" variants={stagger} initial="hidden" animate="show">
          {steps.map(([t, d], i) => (
            <motion.div key={t} className="card" variants={rise} whileHover={{ y: -4 }}>
              <span className="eyebrow">Step {i + 1}</span>
              <h3 style={{ margin: "8px 0" }}>{t}</h3>
              <p className="muted">{d}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </Transition>
  );
}
