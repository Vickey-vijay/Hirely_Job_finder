import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api, type Guess } from "../api";
import { useAuth } from "../auth";
import { useAccount } from "../account";
import Transition from "../components/Transition";
import { Brand, TagInput } from "../components/ui";

const STEPS = ["Resume", "Roles", "Skills & place", "Alerts"];

type Form = { name: string; headline: string; domain: string; roles: string[]; skills: string[]; locations: string[]; remoteOk: boolean; experienceYears: string; phone: string; whatsappOptIn: boolean };

/** Four short steps that collect what we need to match jobs. Also used later to edit the profile. */
export default function Onboarding({ edit = false }: { edit?: boolean }) {
  const { user } = useAuth();
  const { config, account, refresh } = useAccount();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resumeNote, setResumeNote] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Form>({ name: user?.name ?? "", headline: "", domain: "", roles: [], skills: [], locations: [], remoteOk: true, experienceYears: "", phone: "", whatsappOptIn: false });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  // Load what is already saved (edit mode, or someone returning half-way).
  const loaded = useRef(false);
  useEffect(() => {
    const p = account?.profile;
    if (!p || loaded.current) return;
    loaded.current = true;
    setF((x) => ({
      ...x, headline: p.headline, domain: p.domain, roles: p.roles, skills: p.skills, locations: p.locations, remoteOk: p.remoteOk,
      experienceYears: p.onboardedAt ? String(p.experienceYears) : "", phone: p.phone ? p.phone.slice(2) : "", whatsappOptIn: p.whatsappOptIn,
    }));
    if (p.resumeFilename) setResumeNote(`Using ${p.resumeFilename}`);
  }, [account]);

  const maxRoles = account?.subscription ? config?.plans.find((p) => p.id === account.subscription!.plan)?.maxRoles ?? 5 : 5;
  const domain = useMemo(() => config?.domains.find((d) => d.name === f.domain), [config, f.domain]);
  const roleIdeas = domain?.roles ?? config?.domains.flatMap((d) => d.roles) ?? [];
  const skillIdeas = domain?.skills ?? config?.domains.flatMap((d) => d.skills) ?? [];

  const go = (n: number) => { setError(""); setDir(n > step ? 1 : -1); setStep(n); };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(""); setResumeNote("Reading your resume…");
    try {
      const { guess, usedAi } = await api.uploadResume(file);
      applyGuess(guess);
      setResumeNote(`Read ${file.name}. We filled in what we found${usedAi ? "" : " using keyword matching"}; please check the next steps.`);
      await refresh();
    } catch (e) { setResumeNote(""); setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const applyGuess = (g: Guess) => setF((x) => ({
    ...x,
    headline: x.headline || g.headline,
    roles: x.roles.length ? x.roles : g.roles.slice(0, maxRoles),
    skills: [...new Set([...x.skills, ...g.skills])].slice(0, 40),
    locations: x.locations.length ? x.locations : g.locations,
    experienceYears: x.experienceYears || (g.experienceYears ? String(g.experienceYears) : ""),
    domain: x.domain || config?.domains.find((d) => d.roles.some((r) => g.roles.includes(r)))?.name || "",
  }));
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void onFile(e.dataTransfer.files[0]); };

  const next = () => {
    if (step === 1 && !f.roles.length) { setError("Add at least one job role you want."); return; }
    if (step === 1 && (f.experienceYears === "" || Number(f.experienceYears) < 0)) { setError("Enter your years of experience. Use 0 if you are a fresher."); return; }
    go(step + 1);
  };

  const save = async () => {
    if (f.whatsappOptIn && !f.phone.trim()) { setError("Enter your WhatsApp number, or switch WhatsApp alerts off."); return; }
    setBusy(true); setError("");
    try {
      await api.saveProfile({ ...f, experienceYears: Number(f.experienceYears || 0), phone: f.phone.trim() || null });
      await refresh();
      nav(edit ? "/settings" : account?.subscription ? "/dashboard" : "/plans");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Transition>
      <main className="page" style={{ maxWidth: 640 }}>
        <header className="topbar" style={{ paddingBottom: 16 }}>
          <Brand to={edit ? "/settings" : "/"} />
          <span className="muted small">Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
        </header>
        <div className="progress" aria-hidden><motion.div animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.5 }} /></div>

        <div className="card" style={{ marginTop: 18, overflow: "hidden" }}>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div key={step} initial={{ opacity: 0, x: 40 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 * dir }} transition={{ duration: 0.28 }} className="stack">
              {step === 0 && (
                <>
                  <div><h2>{edit ? "Update your resume" : `Welcome, ${user?.name.split(" ")[0]}.`}</h2><p className="muted" style={{ marginTop: 6 }}>Upload your resume and we will fill in most of the next steps for you. You can also skip this and type things in.</p></div>
                  <label className={`drop ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                    <input ref={fileRef} type="file" className="sr" accept=".pdf,.docx,.txt,application/pdf" onChange={(e) => void onFile(e.target.files?.[0])} />
                    <b>{busy ? "Reading…" : "Choose a file or drop it here"}</b>
                    <p className="muted small" style={{ marginTop: 6 }}>PDF, DOCX or TXT, up to 5 MB</p>
                  </label>
                  {resumeNote && <p className="note green">{resumeNote}</p>}
                  <p className="muted small">We keep only the text of your resume, to match jobs and (on Pro) to write tailored versions. The file itself is not stored. You can delete it at any time in Settings.</p>
                </>
              )}

              {step === 1 && (
                <>
                  <div><h2>What job are you looking for?</h2><p className="muted" style={{ marginTop: 6 }}>Use the title an employer would put on the job post. Starter follows 1 role; Plus and Pro follow up to 5.</p></div>
                  <div>
                    <label className="lbl" htmlFor="domain">Your field</label>
                    <select id="domain" className="field" value={f.domain} onChange={(e) => set("domain", e.target.value)}>
                      <option value="">Choose one (optional)</option>
                      {config?.domains.map((d) => <option key={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lbl" htmlFor="roles">Job roles you want</label>
                    <TagInput id="roles" value={f.roles} onChange={(v) => set("roles", v)} suggestions={roleIdeas} placeholder="Type a role and press Enter, e.g. Data Analyst" max={5} />
                    {f.roles.length > 1 && <p className="muted small" style={{ marginTop: 8 }}>The first role is the one the Starter plan follows.</p>}
                  </div>
                  <div className="grid2">
                    <div><label className="lbl" htmlFor="exp">Years of experience</label><input id="exp" className="field" inputMode="decimal" placeholder="0 if fresher" value={f.experienceYears} onChange={(e) => set("experienceYears", e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} /></div>
                    <div><label className="lbl" htmlFor="headline">Current title (optional)</label><input id="headline" className="field" maxLength={120} placeholder="e.g. Junior Accountant" value={f.headline} onChange={(e) => set("headline", e.target.value)} /></div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div><h2>Your skills and where you want to work</h2><p className="muted" style={{ marginTop: 6 }}>Skills raise the score of jobs that ask for them. Add the tools and abilities you would be comfortable being interviewed on.</p></div>
                  <div><label className="lbl" htmlFor="skills">Skills</label><TagInput id="skills" value={f.skills} onChange={(v) => set("skills", v)} suggestions={skillIdeas} placeholder="Type a skill and press Enter" max={40} /></div>
                  <div><label className="lbl" htmlFor="cities">Preferred cities</label><TagInput id="cities" value={f.locations} onChange={(v) => set("locations", v)} suggestions={config?.cities ?? []} placeholder="Leave empty for anywhere in India" max={8} /></div>
                  <label className="check"><input type="checkbox" checked={f.remoteOk} onChange={(e) => set("remoteOk", e.target.checked)} /> <span>Also show me remote / work-from-home jobs</span></label>
                </>
              )}

              {step === 3 && (
                <>
                  <div><h2>Where should we send your alerts?</h2><p className="muted" style={{ marginTop: 6 }}>You always get your matches on your dashboard and by email at <b>{user?.email}</b>. WhatsApp is optional.{config?.telegram.enabled ? " Telegram is free and you can connect it from Settings once you finish." : ""} You choose how many instant alerts you get a day in Settings.</p></div>
                  <div><label className="lbl" htmlFor="name">Your name</label><input id="name" className="field" maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
                  <div>
                    <label className="lbl" htmlFor="phone">WhatsApp number</label>
                    <div className="row-gap" style={{ flexWrap: "nowrap" }}>
                      <span className="chip" style={{ padding: "13px 14px", borderRadius: 13 }}>+91</span>
                      <input id="phone" className="field" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={f.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d ]/g, "").slice(0, 12))} />
                    </div>
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={f.whatsappOptIn} onChange={(e) => set("whatsappOptIn", e.target.checked)} />
                    <span>Yes, send my job alerts to this number on WhatsApp. I can stop them at any time by replying STOP or in Settings.</span>
                  </label>
                  {config && !config.whatsapp && <p className="note">WhatsApp alerts are being set up and will start as soon as they are approved. Until then your alerts arrive by email and on your dashboard.</p>}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div role="alert" aria-live="polite" className="error" style={{ marginTop: 12 }}>{error}</div>
          <div className="spread" style={{ marginTop: 8 }}>
            {step > 0 ? <button className="btn soft" onClick={() => go(step - 1)} disabled={busy}>Back</button> : <span />}
            {step < STEPS.length - 1
              ? <button className="btn" onClick={next} disabled={busy}>{step === 0 && !resumeNote ? "Skip for now" : "Continue"}</button>
              : <button className="btn green" onClick={save} disabled={busy}>{busy ? "Saving…" : edit ? "Save changes" : "Save and see my matches"}</button>}
          </div>
        </div>
      </main>
    </Transition>
  );
}
