import { BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";

/**
 * Turns a tailored resume (plain text from the AI, see llm.ts) into a Word file.
 * "GAPS TO CHECK" is advice for the candidate, not part of the resume, so it is cut off before the file is built.
 */

export const RESUME_SECTIONS = ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS"] as const;
const HEADING_RE = new RegExp(`^(${RESUME_SECTIONS.join("|")}|GAPS TO CHECK)\s*:?\s*$`, "i");
/** Sections whose entries are "Role, Company, dates" style lines: those lines are shown in bold. */
const BOLD_LINES = new Set<string>(["EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS"]);

/** The part of the AI output that goes into the file: everything before the GAPS TO CHECK heading. */
export function resumeBody(text: string): string {
  const at = text.search(/^\s*GAPS TO CHECK\b/im);
  return (at < 0 ? text : text.slice(0, at)).trim();
}

type Block = { heading?: string; lines: { text: string; bullet: boolean }[] };

/** Splits the body into a name, a contact line and sections. Tolerant of extra blank lines and markdown bullets. */
export function parseResume(text: string): { name: string; contact: string; blocks: Block[] } {
  const lines = resumeBody(text).split(/\r?\n/).map((l) => l.replace(/\*\*/g, "").trim());
  const nonEmpty = lines.filter((l) => l.length > 0);
  const name = nonEmpty[0] ?? "Resume";
  let contact = "";
  let i = lines.indexOf(name) + 1;
  while (i < lines.length && !lines[i]) i++;
  if (i < lines.length && !HEADING_RE.test(lines[i]) && !/^[-•]\s/.test(lines[i])) { contact = lines[i]; i++; }

  const blocks: Block[] = [{ lines: [] }];
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const h = HEADING_RE.exec(l);
    if (h) { blocks.push({ heading: h[1].toUpperCase(), lines: [] }); continue; }
    const bullet = /^[-•*]\s+/.test(l);
    blocks[blocks.length - 1].lines.push({ text: bullet ? l.replace(/^[-•*]\s+/, "") : l, bullet });
  }
  return { name, contact, blocks: blocks.filter((b) => b.heading || b.lines.length) };
}

const GREY = "51647C";
const BLUE = "1F5FD1";
const FONT = "Calibri";

/** Builds the .docx for one tailored resume. Returns the file bytes (never empty: at least the name is written). */
export async function buildResumeDocx(text: string): Promise<Buffer> {
  const { name, contact, blocks } = parseResume(text);
  const children: Paragraph[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: name, bold: true, size: 36, font: FONT, color: "12263F" })] }),
  ];
  if (contact) children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: contact, size: 20, font: FONT, color: GREY })] }));

  for (const b of blocks) {
    if (b.heading) {
      children.push(new Paragraph({
        spacing: { before: 260, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C8D3E2", space: 2 } },
        children: [new TextRun({ text: b.heading, bold: true, size: 22, font: FONT, color: BLUE, characterSpacing: 20 })],
      }));
    }
    const boldLines = !!b.heading && BOLD_LINES.has(b.heading);
    for (const l of b.lines) {
      if (l.bullet) {
        children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: l.text, size: 21, font: FONT })] }));
      } else {
        children.push(new Paragraph({ spacing: { before: boldLines ? 120 : 0, after: 60 }, children: [new TextRun({ text: l.text, bold: boldLines, size: 21, font: FONT })] }));
      }
    }
  }

  const doc = new Document({
    creator: "Hirely",
    title: `Resume - ${name}`,
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

/** A safe, readable file name such as "Resume-Acme-Data-Analyst.docx". */
export function resumeFileName(company: string, title: string): string {
  const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `Resume-${slug(company) || "job"}-${slug(title) || "role"}.docx`;
}
