import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Transition from "../components/Transition";
import { Brand } from "../components/ui";

/** A resume rewritten for one job (Pro). Copy the text or print it to PDF. */
export default function Tailored() {
  const { id = "" } = useParams();
  const [doc, setDoc] = useState<{ content: string; title: string; company: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.tailored(id).then(setDoc).catch(() => setError("We couldn't find that resume. Open it again from your matches.")); }, [id]);

  // "GAPS TO CHECK" is advice for the candidate, not part of the resume, so it is shown separately and never printed.
  const [resume, gaps] = (() => {
    const text = doc?.content ?? "";
    const at = text.search(/\n\s*GAPS TO CHECK/i);
    return at < 0 ? [text, ""] : [text.slice(0, at).trim(), text.slice(at).replace(/^\s*GAPS TO CHECK:?\s*/i, "").trim()];
  })();

  const copy = async () => {
    await navigator.clipboard.writeText(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Transition>
      <main className="page">
        <header className="topbar"><Brand to="/dashboard" /><Link to="/matches" className="btn soft sm">Back to matches</Link></header>
        {error && <div className="card flat">{error}</div>}
        {doc && (
          <>
            <div className="noprint stack" style={{ marginBottom: 16 }}>
              <div><span className="eyebrow">Tailored resume</span><h1 style={{ fontSize: "clamp(22px,4.5vw,32px)" }}>{doc.title} at {doc.company}</h1></div>
              <div className="note"><b>Read this before you send it.</b> It was written by AI using only the resume you uploaded. Check every line is true for you, and fix anything that is not. You are the one signing it.</div>
              <div className="row-gap">
                <button className="btn" onClick={copy}>{copied ? "Copied" : "Copy text"}</button>
                <button className="btn soft" onClick={() => window.print()}>Print or save as PDF</button>
                <a className="btn soft" href={doc.url} target="_blank" rel="noopener noreferrer">Open the job</a>
              </div>
            </div>
            <article className="card resume-text">{resume}</article>
            {gaps && <div className="card flat noprint" style={{ marginTop: 14 }}><h3>Things this job asks for that your resume does not show</h3><p className="muted small" style={{ margin: "4px 0 10px" }}>If you do have them, add them to your resume yourself. We never add anything you did not tell us.</p><div className="resume-text">{gaps}</div></div>}
          </>
        )}
      </main>
    </Transition>
  );
}
