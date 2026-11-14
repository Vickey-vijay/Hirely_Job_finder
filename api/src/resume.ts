import { ALL_ROLES, ALL_SKILLS, CITIES } from "./taxonomy.js";
import { norm } from "./match.js";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_CHARS = 20_000;

/** Turns an uploaded PDF, DOCX or TXT into plain text. The file itself is never written to disk. */
export async function extractResumeText(buf: Buffer, filename: string): Promise<string> {
  const name = filename.toLowerCase();
  let text = "";
  if (name.endsWith(".pdf") || buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (name.endsWith(".txt")) {
    text = buf.toString("utf8");
  } else {
    throw new Error("unsupported_file");
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 80) throw new Error("empty_resume"); // scanned image PDFs have no text layer
  return text.slice(0, MAX_RESUME_CHARS);
}

export type ResumeGuess = { roles: string[]; skills: string[]; locations: string[]; experienceYears: number; headline: string };

/** Reads likely skills, roles, cities and years of experience out of resume text with simple rules (no AI). */
export function guessFromResume(text: string): ResumeGuess {
  const hay = norm(text);
  const has = (term: string) => {
    const t = norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${t}(?![a-z0-9+#])`).test(hay);
  };
  const skills = ALL_SKILLS.filter(has).slice(0, 25);
  const roles = ALL_ROLES.filter(has).slice(0, 3);
  const locations = CITIES.filter(has).slice(0, 3);

  let years = 0;
  const stated = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years|yrs)(?:\s+of)?\s+(?:total\s+|overall\s+|relevant\s+|professional\s+|work\s+)?(?:experience|exp)/i.exec(text);
  if (stated) years = Number(stated[1]);
  else {
    // Fall back to the span of years mentioned, e.g. "2019 - 2023" or "2021 - Present".
    const now = new Date().getFullYear();
    const found = [...text.matchAll(/\b(20[0-3]\d|19[89]\d)\b/g)].map((m) => Number(m[1])).filter((y) => y <= now);
    if (found.length >= 2 && /experience|employment|work history/i.test(text)) {
      years = Math.max(0, Math.min(40, (/(present|current|till date|now)/i.test(text) ? now : Math.max(...found)) - Math.min(...found) - 3));
    }
  }
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 80) ?? "";
  return { roles, skills, locations, experienceYears: Math.min(40, Math.round(years * 10) / 10), headline: roles[0] ?? firstLine };
}
