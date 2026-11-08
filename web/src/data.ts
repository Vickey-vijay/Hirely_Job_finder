// Demo data only. Replaced by API calls once the backend exists (see docs/PRD sections 6.4-6.5).
export type Match = {
  id: number;
  title: string;
  company: string;
  location: string;
  score: number;
  why: string;
  source: string;
  posted: string;
};

export const matches: Match[] = [
  { id: 1, title: "Frontend Engineer", company: "Lumen Labs", location: "Bengaluru · Hybrid", score: 92, why: "React, TypeScript, 2+ yrs", source: "Greenhouse", posted: "12 min ago" },
  { id: 2, title: "React Developer", company: "Fernwood", location: "Remote · India", score: 87, why: "React, Remote fit", source: "Lever", posted: "1 hr ago" },
  { id: 3, title: "UI Engineer", company: "Kite & Co", location: "Pune", score: 79, why: "CSS, Animations", source: "Adzuna", posted: "3 hrs ago" },
  { id: 4, title: "Full-stack Developer", company: "Orchard AI", location: "Hyderabad · Hybrid", score: 74, why: "Node.js, React", source: "Greenhouse", posted: "Yesterday" },
];

export const messages = [
  "Warming up your radar…",
  "Reading the job boards for you…",
  "Matching people to possibilities…",
  "Almost there — good things take a moment.",
];
