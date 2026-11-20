import type {
  Application,
  Compare,
  Deck,
  Doc,
  Launch,
  Pitch,
  PracticeQuestion,
  Profile,
  SectionKey,
  StudioState,
} from "./types";

export const uid = () => crypto.randomUUID();
export const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const now = () => new Date().toISOString();

export const SECTION_KEYS: SectionKey[] = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "awards",
  "volunteering",
  "custom",
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  awards: "Awards",
  volunteering: "Volunteering",
  custom: "Custom sections",
};

export const STAGES = ["Saved", "Applied", "Interviewing", "Offer", "Closed"] as const;

export function emptyProfile(): Profile {
  return {
    name: "",
    headline: "",
    location: "",
    links: "",
    summary: "",
    experience: [],
    education: [],
    projects: [],
    skills: "",
    certifications: [],
    awards: [],
    volunteering: [],
    custom: [],
    achievements: [],
    preferences: { roles: "", location: "", arrangement: "Flexible" },
  };
}

export const SAMPLE_PROFILE: Profile = {
  name: "Alex Morgan",
  headline: "Product Designer",
  location: "Brooklyn, New York",
  links: "alex.example.com",
  summary:
    "Product designer turning complex workflows into clear, useful experiences. I bring together user research, thoughtful interaction design, and close collaboration with engineering.",
  experience: [
    {
      id: "exp1",
      title: "Senior Product Designer",
      org: "Brightline Labs",
      dates: "2021 to Present",
      body: `Led end-to-end design for a B2B SaaS platform.
Built a shared component library with engineering.
Conducted interviews with customers to inform product decisions.
Facilitated design reviews with product and engineering partners.
Documented interaction patterns and component usage guidelines.`,
    },
    {
      id: "exp2",
      title: "Product Designer",
      org: "Northwind",
      dates: "2018 to 2021",
      body: `Designed core workflows across web and mobile.
Created prototypes to explore and test product ideas.
Synthesized research findings into prioritized design opportunities.
Collaborated with product managers to scope new features.`,
    },
  ],
  education: [
    {
      id: "edu1",
      title: "BFA in Design",
      org: "Rhode Island School of Design",
      dates: "2018",
      body: "Focus on interaction design and visual communication.",
    },
  ],
  projects: [
    {
      id: "proj1",
      title: "Community resource directory",
      org: "Independent project",
      dates: "2024",
      body: `Designed a searchable resource directory with local volunteers.
Tested navigation concepts with community members.`,
    },
  ],
  skills: "User research, Prototyping, Design systems, Interaction design, Figma",
  certifications: [],
  awards: [],
  volunteering: [],
  custom: [],
  achievements: [
    {
      id: "ach1",
      title: "A shared design language",
      org: "Brightline Labs",
      dates: "2023",
      body: "Partnered with engineering to build and document a shared component library.",
    },
  ],
  preferences: {
    roles: "Product Designer, Senior Product Designer",
    location: "New York or remote",
    arrangement: "Hybrid",
  },
};

export const SAMPLE_JD =
  "We’re looking for a Product Designer to simplify complex workflows at Northstar. You’ll partner with product and engineering, prototype ideas, and build accessible experiences. Experience with design systems and user research is essential. SQL is a plus.";

export function makeDoc(profile: Profile, overrides: Partial<Doc> = {}): Doc {
  return {
    id: uid(),
    kind: "resume",
    title: "Untitled resume",
    company: "",
    role: profile.headline || "",
    jd: "",
    content: copy(profile),
    template: "Modern",
    size: 10.5,
    spacing: 1.4,
    margin: 46,
    accent: "#000000",
    order: [...SECTION_KEYS],
    hidden: [],
    status: "Draft",
    archived: false,
    versions: [],
    suggestions: [],
    created: now(),
    updated: now(),
    ...overrides,
  };
}

export function initialState(): StudioState {
  return {
    schema: 1,
    onboarded: false,
    sample: false,
    profile: emptyProfile(),
    docs: [],
    applications: [],
    importText: "",
    tailor: { company: "", role: "", jd: "" },
    settings: { theme: "light", motion: false, large: false, reminders: true },
    usage: [],
    plans: [
      { name: "Free", limit: 5 },
      { name: "Pro", limit: 40 },
      { name: "Premium", limit: 100 },
    ],
  };
}

export function seededState(): StudioState {
  const tailored = makeDoc(SAMPLE_PROFILE, {
    title: "Northstar · Product Designer",
    company: "Northstar",
    role: "Product Designer",
    jd: SAMPLE_JD,
    hidden: ["projects"],
  });
  const master = makeDoc(SAMPLE_PROFILE, {
    title: "My master resume",
    status: "Ready",
    template: "Classic",
    hidden: ["projects"],
  });
  master.versions = [
    { id: uid(), name: "Original version", date: now(), snapshot: copy({ ...master, versions: [] }) },
  ];
  return {
    ...initialState(),
    onboarded: true,
    sample: true,
    profile: copy(SAMPLE_PROFILE),
    docs: [tailored, master],
    applications: [
      {
        id: uid(),
        company: "Northstar",
        role: "Product Designer",
        jd: SAMPLE_JD,
        url: "",
        stage: "Saved",
        date: "",
        deadline: "",
        notes: "Explore the product team and tailor my resume before applying.",
        contact: "",
        reminder: "",
        interview: "",
        prep: "",
        docId: tailored.id,
        versionId: "",
        letterId: "",
        events: [{ text: "Opportunity saved", date: now() }],
      },
    ],
  };
}

export function blankApp(): Application {
  return {
    id: uid(),
    company: "",
    role: "",
    url: "",
    jd: "",
    stage: "Saved",
    date: "",
    deadline: "",
    notes: "",
    contact: "",
    reminder: "",
    interview: "",
    prep: "",
    docId: "",
    versionId: "",
    letterId: "",
    events: [],
  };
}

export const TEMPLATES = [
  { name: "Classic", desc: "Centered name. Traditional hierarchy. Single column.", color: "cream" },
  { name: "Modern", desc: "Confident headings with a clean reading order.", color: "lilac" },
  { name: "Minimal", desc: "Less ornament. More room for your experience.", color: "mint" },
  { name: "Executive", desc: "A formal header and a strong leadership summary.", color: "cream" },
  { name: "Graduate", desc: "Education and projects before employment.", color: "lime" },
  { name: "Technical", desc: "Skills first. Precise, compact section labels.", color: "lilac" },
] as const;

/* ----------------------------- Studio defaults ----------------------------- */

export function initialPlan(): Launch {
  return { title: "My next career move", target: "", applicationId: "none", steps: [], note: "" };
}

export const LAUNCH_ROUTES = [
  { value: "none", label: "A personal action" },
  { value: "/profile", label: "Review my profile" },
  { value: "/tailor", label: "Tailor a resume" },
  { value: "/studio/pitch", label: "Work on my introduction" },
  { value: "/studio/rehearse", label: "Practice for a conversation" },
  { value: "/studio/deck", label: "Prepare my story deck" },
  { value: "/applications", label: "Review my applications" },
];

export function blankPitch(): Pitch {
  return { intro: "", evidence: "", next: "", text: "", target: "60", versions: [] };
}

export function emptyDeck(): Deck {
  return {
    title: "Selected chapters",
    subtitle: "A few things I made happen.",
    cards: [],
    style: "Editorial",
    updated: null,
  };
}

export function emptyCompare(): Compare {
  return { selected: [], weights: {}, ratings: {}, notes: {} };
}

export const PRIORITIES = [
  { id: "growth", name: "Room to grow", hint: "Learning, mentorship, and the next step." },
  { id: "work", name: "The work itself", hint: "Interesting problems and meaningful contribution." },
  { id: "balance", name: "Life outside work", hint: "Flexibility, location, and sustainable hours." },
  { id: "reward", name: "Compensation", hint: "Your own assessment of the full package." },
  { id: "team", name: "People & culture", hint: "What you have actually learned about the team." },
];

/** Weighted fit score from the user's own ratings (prototype `getFit`). */
export function getFit(ratings: Record<string, number>, weights: Record<string, number>) {
  let weightTotal = 0;
  let weighted = 0;
  let count = 0;
  for (const priority of PRIORITIES) {
    const weight = weights[priority.id] ?? 3;
    const rating = ratings[priority.id];
    if (weight > 0 && rating > 0) {
      weightTotal += weight;
      weighted += rating * weight;
      count++;
    }
  }
  return {
    score: weightTotal ? Math.round((weighted / weightTotal / 5) * 100) : null,
    count,
    complete: PRIORITIES.filter((p) => (weights[p.id] ?? 3) > 0).every((p) => ratings[p.id] > 0),
  };
}

/** Default rehearsal prompts (prototype `practiceQuestions`); used when AI is unavailable. */
export function practiceQuestions(role: string, company: string): PracticeQuestion[] {
  return [
    {
      id: "intro",
      label: "THE INTRODUCTION",
      title: `What draws you to ${company ? `the ${role || "role"} opportunity at ${company}` : "your next role"}?`,
      hint: "Connect what you enjoy doing with what you know about this opportunity. It’s fine to still have questions.",
    },
    {
      id: "contribution",
      label: "YOUR CONTRIBUTION",
      title: "Tell me about a project where your work made a difference.",
      hint: "Set the scene. Explain your responsibility, the decisions you made, and the outcome you can support.",
    },
    {
      id: "collaboration",
      label: "WORKING TOGETHER",
      title: "Walk me through a time you worked with someone who saw things differently.",
      hint: "Focus on how you listened, what you did, and what you learned. You don’t need a perfect ending.",
    },
    {
      id: "questions",
      label: "YOUR TURN",
      title: "What would you want to understand before joining this team?",
      hint: "Ask about the work, expectations, growth, or how decisions get made. An interview is a conversation, not a performance.",
    },
  ];
}

export const ANSWER_FIELDS: [key: "context" | "action" | "outcome", label: string, placeholder: string][] = [
  ["context", "Set the scene", "What was happening?"],
  ["action", "Your contribution", "What did you personally do?"],
  ["outcome", "What happened next", "A real outcome, or what you learned."],
];
