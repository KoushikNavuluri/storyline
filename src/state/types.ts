/** Storyline workspace data model. Shape mirrors the prototype's `storyline.studio.v1` state. */

export type SectionKey =
  | "summary"
  | "experience"
  | "education"
  | "projects"
  | "skills"
  | "certifications"
  | "awards"
  | "volunteering"
  | "custom";

export type ListSectionKey = Exclude<SectionKey, "summary" | "skills"> | "achievements";

export interface Entry {
  id: string;
  title: string;
  org: string;
  /** Free text, for example "2021 to Present". */
  dates: string;
  /** One bullet per line. */
  body: string;
}

export type Arrangement = "Flexible" | "Remote" | "Hybrid" | "On-site";

export interface Profile {
  name: string;
  headline: string;
  location: string;
  links: string;
  summary: string;
  experience: Entry[];
  education: Entry[];
  projects: Entry[];
  /** Comma-separated. */
  skills: string;
  certifications: Entry[];
  awards: Entry[];
  volunteering: Entry[];
  custom: Entry[];
  achievements: Entry[];
  preferences: { roles: string; location: string; arrangement: Arrangement | string };
}

export type TemplateName = "Classic" | "Modern" | "Minimal" | "Executive" | "Graduate" | "Technical";

export interface Requirement {
  term: string;
  preferred: boolean;
  source: string;
}

export type SuggestionState = "pending" | "accepted" | "rejected";

export interface Suggestion {
  id: string;
  section: SectionKey;
  entry: string;
  index: number;
  before: string;
  after: string;
  reason: string;
  explanation: string;
  state: SuggestionState;
}

export interface Version {
  id: string;
  name: string;
  date: string;
  snapshot: Doc;
}

/** AI-written advice cached per document for the Insights tab. */
export interface DocAnalysis {
  hash: string;
  date: string;
  advice: { term: string; advice: string }[];
  summaryTip?: string;
}

export interface Doc {
  id: string;
  kind: "resume" | "letter";
  title: string;
  company: string;
  role: string;
  jd: string;
  content: Profile;
  template: TemplateName | string;
  size: number;
  spacing: number;
  margin: number;
  accent: string;
  order: SectionKey[];
  hidden: string[];
  status: "Draft" | "Ready" | string;
  archived: boolean;
  versions: Version[];
  suggestions: Suggestion[];
  created: string;
  updated: string;
  requirements?: Requirement[] | null;
  applicationId?: string;
  letter?: string;
  analysis?: DocAnalysis | null;
}

export type Stage = "Saved" | "Applied" | "Interviewing" | "Offer" | "Closed";

export interface AppEvent {
  text: string;
  date: string;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  url: string;
  jd: string;
  stage: Stage | string;
  date: string;
  deadline: string;
  notes: string;
  contact: string;
  reminder: string;
  interview: string;
  prep: string;
  docId: string;
  versionId: string;
  letterId: string;
  events: AppEvent[];
  versionSnapshot?: Doc | null;
  letterVersionId?: string;
  letterVersionSnapshot?: Doc | null;
  followup?: string;
  /** AI-generated interview prompts, cached per application. */
  questions?: { question: string; coaching: string }[];
}

export interface Settings {
  theme: "light" | "dark" | "system";
  motion: boolean;
  large: boolean;
  reminders: boolean;
}

export interface UsageEntry {
  id: string;
  date: string;
  action: string;
}

export interface Plan {
  name: string;
  limit: number;
}

export interface Tailor {
  company: string;
  role: string;
  jd: string;
  applicationId?: string;
  requirements?: Requirement[] | null;
}

export interface PracticeQuestion {
  id: string;
  label: string;
  title: string;
  hint: string;
}

export interface Practice {
  id: string;
  started: string;
  appId: string;
  company: string;
  role: string;
  index: number;
  seconds: number;
  questions: PracticeQuestion[];
  answers: Record<string, { context?: string; action?: string; outcome?: string }>;
  checks: Record<string, boolean>;
  finished?: string;
  feedback?: Record<string, string>;
}

export interface LaunchStep {
  id: string;
  title: string;
  due: string;
  route: string;
  done: boolean;
  completedAt?: string | null;
}

export interface Launch {
  title: string;
  target: string;
  applicationId: string;
  steps: LaunchStep[];
  note: string;
}

export interface Pitch {
  intro: string;
  evidence: string;
  next: string;
  text: string;
  target: "30" | "60" | "90" | string;
  versions: { id: string; name: string; text: string; date: string }[];
}

export interface DeckCard {
  id: string;
  source: string;
  title: string;
  context: string;
  body: string;
  notes: string;
  kind: string;
}

export interface Deck {
  title: string;
  subtitle: string;
  cards: DeckCard[];
  style: "Editorial" | "After hours" | string;
  updated: string | null;
}

export interface Compare {
  selected: string[];
  weights: Record<string, number>;
  ratings: Record<string, Record<string, number>>;
  notes: Record<string, string>;
}

export interface Studio {
  capture?: { title: string; org: string; dates: string; body: string } | null;
  compare?: Compare;
  practice?: Practice | null;
  sessions?: Practice[];
  launch?: Launch;
  pitch?: Pitch;
  deck?: Deck;
}

export interface StudioState {
  schema: 1;
  onboarded: boolean;
  sample: boolean;
  profile: Profile;
  docs: Doc[];
  applications: Application[];
  importText: string;
  importDraft?: Profile | null;
  applicationDraft?: Application | null;
  tailor: Tailor;
  settings: Settings;
  usage: UsageEntry[];
  plans: Plan[];
  studio?: Studio;
}
