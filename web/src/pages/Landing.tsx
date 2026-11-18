import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useAuth } from "../auth";
import { useAccount } from "../account";
import { rupees } from "../api";
import Transition, { rise, stagger } from "../components/Transition";
import { ThemeToggle } from "../components/Nav";
import JobStory from "../components/JobStory";
import { Brand, Counter, Footer, PlanCards, Reveal, ScoreRing } from "../components/ui";

const TICKER = ["Software", "Sales", "Accounting", "Nursing", "Teaching", "Marketing", "HR", "Customer support", "Data", "Design", "Operations", "Civil", "Mechanical", "Pharma", "Logistics", "Content", "Finance", "Retail", "Hospitality", "Legal"];

const FAQS: [string, string][] = [
  ["Where do the jobs come from?", "Only from public sources that companies publish for this purpose: their own career pages (through the hiring systems they use, such as Greenhouse, Lever, Ashby and SmartRecruiters) and licensed job search APIs. We do not copy from LinkedIn, Naukri or any site that forbids it."],
  ["How is the 1 to 10 score worked out?", "We compare the job title with the roles you chose, check how many of your skills the job asks for, and look at location and experience level. You always see the reasons next to the score. We only message you about jobs that score 6 or more."],
  ["Is this only for software jobs?", "No. You can set any role: sales, accounts, nursing, teaching, design, operations and more. How many matches you get depends on how many employers are hiring for your role and city right now. After you fill in your profile we show you how many current jobs fit, before you pay anything."],
  ["How does payment work?", "You pick a plan and approve a monthly automatic payment once (UPI Autopay or card) through Razorpay. You are charged on the same date each month until you turn renewal off."],
  ["Can I cancel? Do I get a refund?", "You can turn off renewal at any time in Settings, in two taps. Your alerts continue until the end of the month you already paid for. We do not refund a month that has started. If you are ever charged twice or charged after cancelling, write to us and we will return it."],
  ["What happens when I get a job?", "Tap “I got a job” in the app. We stop your next payment and stop the alerts. That is the outcome we are working for."],
  ["How many alerts will I get?", "You choose. Set a daily limit from 1 to 10. Hirely only sends jobs that score 6 or more, so on a quiet day you may get fewer than your limit, and never more."],
  ["Will you spam me on WhatsApp?", "No. You choose WhatsApp alerts yourself. Starter sends a WhatsApp summary each morning at 9 AM, and Pro adds instant WhatsApp alerts. You can reply STOP at any time. We use the official WhatsApp Business Platform."],
  ["What is the tailored resume in Pro?", "For each strong match (7/10 or more, up to 5 a day) we rewrite your own resume to highlight what that job asks for and send it as a Word file to your email and Telegram. It uses only facts from the resume you uploaded and never invents experience. Always read it before sending."],
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq ${open ? "open" : ""}`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}>{q}<span className="plus" aria-hidden>+</span></button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { config } = useAccount();
  const nav = useNavigate();
  const { scrollYProgress } = useScroll();
  const phoneY = useTransform(scrollYProgress, [0, 0.4], [0, -50]);
  const start = user ? "/dashboard" : "/login";
  const from = config ? rupees(config.plans[0].pricePaise) : "₹99";
  const stats = config?.stats;
  const b = config?.business;

  return (
    <Transition>
      <main className="page wide">
        <header className="topbar">
          <Brand />
          <nav className="links" aria-label="Sections">
            <a href="#how">How it works</a><a href="#different">Why Hirely</a><a href="#pricing">Pricing</a><a href="#faq">Questions</a>
          </nav>
          <div className="row-gap" style={{ gap: 8 }}>
            <ThemeToggle />
            <Link to={start} className="btn soft sm">{user ? "Open dashboard" : "Sign in"}</Link>
          </div>
        </header>

        <section className="hero">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.span variants={rise} className="badge"><span className="tick" /> Personal job alerts, for every profession</motion.span>
            <motion.h1 variants={rise} style={{ marginTop: 16 }}>Only the jobs you can <em>actually get.</em></motion.h1>
            <motion.p variants={rise} className="muted lead">
              Job sites show you everything and leave the sorting to you. Tell us your role and skills once. We watch company career pages all day and
              message you only the openings that fit, each scored 1 to 10 with the reasons.
            </motion.p>
            <motion.div variants={rise} className="row-gap" style={{ marginTop: 26 }}>
              <Link to={start} className="btn">Start from {from} a month</Link>
              <a href="#how" className="btn soft">See how it works</a>
            </motion.div>
            <motion.div variants={rise} className="row-gap small muted" style={{ marginTop: 22 }}>
              <span className="row-gap" style={{ gap: 6 }}><span className="tick" /> Public job sources only</span>
              <span className="row-gap" style={{ gap: 6 }}><span className="tick" /> Official WhatsApp Business</span>
              <span className="row-gap" style={{ gap: 6 }}><span className="tick" /> Stop renewal in two taps</span>
            </motion.div>
          </motion.div>
          <motion.div style={{ y: phoneY }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, duration: 0.7 }}>
            <JobStory />
          </motion.div>
        </section>

        <div className="marquee" aria-hidden>
          <div className="track">
            {[...TICKER, ...TICKER].map((t, i) => <span key={i} className="chip">{t}</span>)}
          </div>
        </div>

        {stats && stats.jobs > 0 && (
          <Reveal>
            <div className="stats" style={{ marginTop: 34 }}>
              <div className="card stat center"><b><Counter to={stats.jobs} /></b><span className="muted">open India jobs being tracked now</span></div>
              <div className="card stat center"><b><Counter to={stats.companies} /></b><span className="muted">employers</span></div>
              <div className="card stat center"><b><Counter to={stats.sources} /></b><span className="muted">career pages and feeds watched</span></div>
            </div>
          </Reveal>
        )}

        <section className="section" id="how">
          <Reveal className="center"><span className="eyebrow">How it works</span><h2>Set it up once. Then stop searching.</h2></Reveal>
          <div className="grid3" style={{ marginTop: 26 }}>
            {[
              ["Tell us what you want", "Upload your resume and we read your roles and skills from it. Fix anything we got wrong. It takes about two minutes."],
              ["We watch all day", "Hirely checks company career pages and job feeds around the clock and scores each new opening against your profile."],
              ["You get the short list", "The alerts you chose for each day, up to 10, with your best matches first and why they fit. Tap, apply, done."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.1}>
                <motion.div className="card" whileHover={{ y: -5 }} style={{ height: "100%" }}>
                  <span className="stepno">{i + 1}</span>
                  <h3 style={{ margin: "14px 0 8px" }}>{t}</h3>
                  <p className="muted">{d}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section" id="different">
          <Reveal className="center"><span className="eyebrow">Why Hirely</span><h2>A job site gives you a list. We give you a decision.</h2></Reveal>
          <div className="compare" style={{ marginTop: 26 }}>
            <Reveal>
              <div className="card flat compare-card">
                <div className="compare-head">
                  <h3>Typical job portals</h3>
                  <span className="compare-slot" aria-hidden />
                </div>
                <ul>
                  {["Hundreds of results; you sort them yourself", "Alerts for anything that shares a keyword", "The same listing shown again and again", "You only see new jobs when you remember to check"].map((x) => <li key={x}><span className="cross" /> {x}</li>)}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="card compare-card" style={{ borderColor: "var(--green)" }}>
                <div className="compare-head">
                  <h3>Hirely</h3>
                  <ScoreRing score={9} size={52} />
                </div>
                <ul>
                  {["Only jobs that fit your role, skills, city and experience", "A 1 to 10 fit score with the reasons in plain words", "Each job sent once, and only if it scores 6 or more", "Sent to your email, Telegram or WhatsApp, the way you choose", "You set how many alerts a day, up to 10. No spam"].map((x) => <li key={x}><span className="tick" /> {x}</li>)}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section" id="pricing">
          <Reveal className="center">
            <span className="eyebrow">Pricing</span><h2>Three plans. No hidden charges.</h2>
            <p className="muted sub">Prices include everything. You choose how many alerts a day you get, from 1 to 10. See how many current jobs fit you before you pay.</p>
          </Reveal>
          <div style={{ marginTop: 30 }}>
            {config && <PlanCards plans={config.plans} onPick={() => nav(start)} cta={(p) => `Start with ${p.name}`} />}
          </div>
          <Reveal>
            <div className="grid2" style={{ marginTop: 18 }}>
              <div className="note blue"><b>No refunds, and no traps.</b> A month that has started is not refunded. You can turn off renewal at any time and you keep your alerts until the paid month ends.</div>
              <div className="note green"><b>Got a job?</b> Tell us in the app. We stop your next payment straight away, so you never pay for a month you do not need.</div>
            </div>
          </Reveal>
        </section>

        <section className="section" id="faq" style={{ maxWidth: 760, margin: "0 auto" }}>
          <Reveal className="center"><span className="eyebrow">Questions</span><h2>Straight answers</h2></Reveal>
          <div style={{ marginTop: 20 }}>{FAQS.map(([q, a]) => <Faq key={q} q={q} a={a} />)}</div>
        </section>

        <Reveal>
          <div className="card center" style={{ padding: "38px 20px" }}>
            <h2>Your next job should find you.</h2>
            <p className="muted" style={{ margin: "10px auto 22px", maxWidth: 480 }}>Set up your profile in two minutes and see how many open jobs fit you today.</p>
            <Link to={start} className="btn green">Get started</Link>
          </div>
        </Reveal>

        <Reveal>
          <p className="small muted" style={{ maxWidth: 720, margin: "30px auto 0", textAlign: "center" }}>
            A note from the maker: hosting and messages cost almost all of what we charge, so Hirely makes no real profit. I built it to help friends and
            people around me through a hard job market. If it helps you get placed and you want to support more low-cost tools like this,{" "}
            {b?.supportUpi ? <>you can send any amount to UPI <b>{b.supportUpi}</b>.</> : <Link to="/contact" className="link">get in touch</Link>} Thank you.
          </p>
        </Reveal>

        <Footer config={config} />
      </main>
    </Transition>
  );
}
