import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, tailorWordUrl } from "../api";
import Transition from "../components/Transition";
import { Brand } from "../components/ui";

/** A resume written for one job (Pro). Download it as a Word file, read it, then send it yourself. */
export default function Tailored() {
  const { id = "" } = useParams();
  const [doc, setDoc] = useState<{ content: string; title: string; company: string; url: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { api.tailored(id).then(setDoc).catch(() => setError("We couldn't find that resume. Open it again from your matches.")); }, [id]);

  // "GAPS TO CHECK" is advice for the candidate, not part of the resume, so it is shown separately. The Word file leaves it out too.
  const [resume, gaps] = (() => {
    const text = doc?.content ?? "";
    const at = text.search(/\n\s*GAPS TO CHECK/i);
    return at < 0 ? [text, ""] : [text.slice(0, at).trim(), text.slice(at).replace(/^\s*GAPS TO CHECK:?\s*/i, "").trim()];
  })();

  return (
    <Transition>
      <main className="page">
        <header className="topbar"><Brand to="/dashboard" /><Link to="/matches" className="btn soft sm">Back to matches</Link></header>
        {error && <div className="card flat">{error}</div>}
        {doc && (
          <>
            <div className="stack" style={{ marginBottom: 16 }}>
              <div><span className="eyebrow">Tailored resume</span><h1 style={{ fontSize: "clamp(22px,4.5vw,32px)" }}>{doc.title} at {doc.company}</h1></div>
              <div className="note"><b>Read this before you send it.</b> It was written by AI using only the resume you uploaded. Check every line is true for you, and fix anything that is not. You are the one signing it.</div>
              <div className="row-gap">
                <a className="btn word-btn" href={tailorWordUrl(id)} download>Download Word file</a>
                <a className="btn soft" href={doc.url} target="_blank" rel="noopener noreferrer">Open the job</a>
              </div>
              <p className="muted small">The Word file has your resume only. The notes on what the job asks for that you do not show are below and are not in the file.</p>
            </div>
            <article className="card resume-text">{resume}</article>
            {gaps && <div className="card flat" style={{ marginTop: 14 }}><h3>Things this job asks for that your resume does not show</h3><p className="muted small" style={{ margin: "4px 0 10px" }}>If you do have them, add them to your resume yourself. We never add anything you did not tell us.</p><div className="resume-text">{gaps}</div></div>}
          </>
        )}
      </main>
    </Transition>
  );
}
