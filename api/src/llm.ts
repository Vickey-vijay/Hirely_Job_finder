import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Config } from "./config.js";
import type { ResumeGuess } from "./resume.js";

/**
 * Optional AI features (Claude). Everything here is OFF unless ANTHROPIC_API_KEY is set,
 * and the rest of the product works without it. Three jobs:
 *   1. read a resume into roles / skills / years (sign-up prefill)
 *   2. refine a match score and write one line on why the job fits
 *   3. write a tailored resume for one job (Pro plan)
 */
export type Llm = {
  readResume(text: string): Promise<ResumeGuess | null>;
  refineMatch(input: { profile: string; job: string; ruleScore: number }): Promise<{ score: number; why: string } | null>;
  tailorResume(input: { resume: string; jobTitle: string; company: string; jobDescription: string }): Promise<string>;
};

const ResumeSchema = z.object({
  headline: z.string(),
  roles: z.array(z.string()),
  skills: z.array(z.string()),
  locations: z.array(z.string()),
  experience_years: z.number(),
});
const MatchSchema = z.object({ score: z.number(), why: z.string() });

const TAILOR_SYSTEM = `You rewrite a candidate's resume so it speaks directly to one job posting.

Hard rules, because the candidate will send this to a real employer under their own name:
- Use ONLY facts that are in the candidate's resume. Never add an employer, job title, date, degree, certification, tool, metric or achievement that is not there. If the job asks for something the resume does not show, leave it out.
- You may reorder, regroup, rephrase and shorten. Put the experience and skills most relevant to this job first, and use the job posting's wording where the resume supports it.
- Keep every date, company name and qualification exactly as written in the resume.
- Plain text only, no markdown symbols, no tables. Use these section headings in capitals where the resume has content for them: SUMMARY, SKILLS, EXPERIENCE, PROJECTS, EDUCATION, CERTIFICATIONS. Start with the candidate's name and contact line as given.
- One page worth of text (about 350 to 550 words). Bullets start with "- ".
- After the resume, add a final section "GAPS TO CHECK" listing up to 4 things the job asks for that the resume does not show, so the candidate can add them truthfully if they have them. If none, write "- None found".`;

export function createLlm(cfg: Config): Llm | null {
  if (!cfg.llm) return null;
  const client = new Anthropic({ apiKey: cfg.llm.apiKey, maxRetries: 2, timeout: 120_000 });
  const model = cfg.llm.model;

  return {
    async readResume(text) {
      try {
        const res = await client.messages.parse({
          model, max_tokens: 2000,
          system: "You extract structured facts from resumes for a job-matching service in India. Only report what the resume states. roles: up to 3 job titles this person is most likely applying for next, based on their most recent work. skills: up to 25 concrete skills or tools, short names. locations: Indian cities the resume shows they live or work in, up to 3. experience_years: total professional experience in years, 0 for a fresher. headline: their current title in under 8 words.",
          messages: [{ role: "user", content: `<resume>\n${text.slice(0, 12_000)}\n</resume>` }],
          output_config: { format: zodOutputFormat(ResumeSchema) },
        });
        const p = res.parsed_output;
        if (!p) return null;
        const clean = (a: string[], n: number) => [...new Set(a.map((s) => s.trim()).filter((s) => s && s.length <= 60))].slice(0, n);
        return {
          headline: p.headline.slice(0, 120), roles: clean(p.roles, 3), skills: clean(p.skills, 25), locations: clean(p.locations, 3),
          experienceYears: Math.max(0, Math.min(40, Math.round(p.experience_years * 10) / 10)),
        };
      } catch (e) {
        console.error("llm readResume failed:", (e as Error).message);
        return null;
      }
    },

    async refineMatch({ profile, job, ruleScore }) {
      try {
        const res = await client.messages.parse({
          model, max_tokens: 1000,
          system: "You judge how well one job fits one candidate for a job-alert service. Score 1 to 10 where 10 means the candidate should clearly apply today and 5 or below means it would waste their time. Be strict about a different profession, the wrong seniority, or a location they did not ask for. A rule-based score is given as a starting point; move it by at most 3. why: one plain sentence, under 25 words, addressed to the candidate as \"you\", naming the concrete reason. Do not invent facts about the candidate.",
          messages: [{ role: "user", content: `<candidate>\n${profile}\n</candidate>\n<job>\n${job}\n</job>\nRule-based score: ${ruleScore}` }],
          output_config: { format: zodOutputFormat(MatchSchema) },
        });
        const p = res.parsed_output;
        if (!p) return null;
        const score = Math.max(1, Math.min(10, Math.round(p.score)));
        return { score: Math.max(ruleScore - 3, Math.min(ruleScore + 3, score)), why: p.why.slice(0, 240) };
      } catch (e) {
        console.error("llm refineMatch failed:", (e as Error).message);
        return null;
      }
    },

    async tailorResume({ resume, jobTitle, company, jobDescription }) {
      const res = await client.messages.create({
        model, max_tokens: 4000,
        system: TAILOR_SYSTEM,
        messages: [{
          role: "user",
          content: `<resume>\n${resume}\n</resume>\n<job>\nTitle: ${jobTitle}\nCompany: ${company}\n${jobDescription.slice(0, 6000)}\n</job>\nWrite the tailored resume now.`,
        }],
      });
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
      if (res.stop_reason === "refusal" || text.length < 200) throw new Error("tailor_failed");
      return text;
    },
  };
}
