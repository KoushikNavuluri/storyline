/**
 * Live smoke test of every AI task against Gemini (no Supabase needed).
 * Usage: GEMINI_API_KEY=... npx tsx scripts/ai-smoke.ts [task ...]
 */
import { generateJson } from "../api/_lib/gemini.js";
import { SYSTEM_BASE, TASKS } from "../api/_lib/tasks.js";

const profile = {
  name: "Alex Morgan",
  headline: "Product Designer",
  summary:
    "Product designer turning complex workflows into clear, useful experiences. I bring together user research, thoughtful interaction design, and close collaboration with engineering.",
  skills: "User research, Prototyping, Design systems, Interaction design, Figma",
  experience: [
    {
      id: "exp1",
      title: "Senior Product Designer",
      org: "Brightline Labs",
      dates: "2021 to Present",
      body: "Led end-to-end design for a B2B SaaS platform.\nBuilt a shared component library with engineering.\nConducted interviews with customers to inform product decisions.\nResponsible for documenting interaction patterns in order to help new designers.",
    },
    {
      id: "exp2",
      title: "Product Designer",
      org: "Northwind",
      dates: "2018 to 2021",
      body: "Designed core workflows across web and mobile.\nCreated prototypes to explore and test product ideas.",
    },
  ],
  education: [{ id: "edu1", title: "BFA in Design", org: "Rhode Island School of Design", dates: "2018", body: "" }],
  projects: [],
  certifications: [],
  awards: [],
  volunteering: [],
  achievements: [],
  preferences: { roles: "Product Designer", location: "New York", arrangement: "Hybrid" },
};
const jd =
  "We're looking for a Product Designer to simplify complex workflows at Northstar. You'll partner with product and engineering, prototype ideas, and build accessible experiences. Experience with design systems and user research is essential. SQL is a plus.";

const payloads: Record<string, Record<string, unknown>> = {
  requirements: { company: "Northstar", role: "Product Designer", jd },
  tailorDraft: { company: "Northstar", role: "Product Designer", jd, requirements: [], profile },
  suggestions: { company: "Northstar", role: "Product Designer", jd, requirements: [], content: profile, hidden: [] },
  insights: {
    jd,
    role: "Product Designer",
    summary: "",
    results: [
      { term: "design systems", state: "highlighted", preferred: false },
      { term: "accessibility", state: "missing", preferred: false },
      { term: "SQL", state: "missing", preferred: true },
    ],
  },
  coverLetter: { company: "Northstar", role: "Product Designer", why: "", tone: "Warm", jd, experience: profile.experience[0], profile },
  followup: { application: { company: "Northstar", role: "Product Designer", stage: "Applied", events: [] }, name: "Alex Morgan" },
  interview: { company: "Northstar", role: "Product Designer", jd, profile },
  rehearsal: { company: "Northstar", role: "Product Designer", jd, profile },
  rehearsalFeedback: {
    question: "Tell me about a project where your work made a difference.",
    answer: { context: "Our platform had inconsistent UI", action: "I built a component library with engineers", outcome: "" },
  },
  pitch: {
    intro: "I design clear workflows for complex B2B tools.",
    evidence: "I partnered with engineering to build a shared component library at Brightline Labs.",
    next: "I want to join a product team that values research.",
    target: "30",
    name: "Alex Morgan",
    headline: "Product Designer",
  },
  importResume: {
    text: "Jordan Lee\nData Analyst\nAustin, TX | jordan@example.com\n\nSUMMARY\nAnalyst who turns messy data into decisions.\n\nEXPERIENCE\nData Analyst, Acme Corp (2020 - Present)\n- Built weekly sales dashboards in Tableau\n- Automated reporting with Python and SQL\n\nEDUCATION\nBS Statistics, UT Austin, 2020\n\nSKILLS\nSQL, Python, Tableau, Excel",
  },
  launchPlan: { title: "Land a senior design role", target: "", application: { company: "Northstar", role: "Product Designer" }, profile },
};

const wanted = process.argv.slice(2);
let failures = 0;
for (const [name, payload] of Object.entries(payloads)) {
  if (wanted.length && !wanted.includes(name)) continue;
  const task = TASKS[name];
  const started = Date.now();
  try {
    const response = await generateJson<Record<string, unknown>>({
      system: SYSTEM_BASE,
      parts: task.build(payload),
      schema: task.schema,
      temperature: task.temperature,
      maxOutputTokens: task.maxOutputTokens,
    });
    const result = task.validate(response.data, payload);
    console.log(`\n=== ${name} OK (${Date.now() - started} ms, ${response.tokensIn}/${response.tokensOut} tokens, ${response.model})`);
    console.log(JSON.stringify(result, null, 1).slice(0, 1400));
  } catch (error) {
    failures++;
    console.log(`\n=== ${name} FAILED: ${(error as Error).message}`);
  }
}
process.exit(failures ? 1 : 0);
