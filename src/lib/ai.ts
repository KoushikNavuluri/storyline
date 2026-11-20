/**
 * Client for Storyline's server-side AI endpoint (`/api/ai`, Google Gemini).
 * The Gemini key never reaches the browser; requests carry the user's Supabase access token.
 * Every helper throws `AIError` on failure so screens can fall back to the deterministic helpers.
 */
import { supabase } from "@/lib/supabase";
import type {
  Application,
  Doc,
  Entry,
  LaunchStep,
  PracticeQuestion,
  Profile,
  Requirement,
  Suggestion,
} from "@/state/types";

export class AIError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export type AITask =
  | "requirements"
  | "tailorDraft"
  | "suggestions"
  | "insights"
  | "coverLetter"
  | "followup"
  | "interview"
  | "rehearsal"
  | "rehearsalFeedback"
  | "pitch"
  | "importResume"
  | "launchPlan";

async function callAI<T>(task: AITask, payload: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AIError("Sign in to use writing assistance.", 401);
  let response: Response;
  try {
    response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task, payload }),
    });
  } catch {
    throw new AIError("Assistance is unavailable offline.", 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new AIError(body.error || "Assistance is unavailable right now.", response.status);
  return body.result as T;
}

/** Strip a profile down to what the model needs (no ids beyond entry ids). */
const slimProfile = (profile: Profile) => ({
  name: profile.name,
  headline: profile.headline,
  summary: profile.summary,
  skills: profile.skills,
  experience: profile.experience,
  education: profile.education,
  projects: profile.projects,
  certifications: profile.certifications,
  awards: profile.awards,
  volunteering: profile.volunteering,
  achievements: profile.achievements,
  preferences: profile.preferences,
});

export const ai = {
  requirements: (input: { company: string; role: string; jd: string }) =>
    callAI<Requirement[]>("requirements", input),

  /** Which optional sections to hide for this opportunity. */
  tailorDraft: (input: { profile: Profile; company: string; role: string; jd: string; requirements: Requirement[] }) =>
    callAI<{ hidden: string[] }>("tailorDraft", { ...input, profile: slimProfile(input.profile) }),

  /** Wording suggestions for existing bullet lines. Server guarantees `before` matches a real line. */
  suggestions: (doc: Doc) =>
    callAI<Omit<Suggestion, "id" | "state">[]>("suggestions", {
      jd: doc.jd,
      role: doc.role,
      company: doc.company,
      requirements: doc.requirements || [],
      content: slimProfile(doc.content),
      hidden: doc.hidden,
    }),

  insights: (input: {
    jd: string;
    role: string;
    results: { term: string; state: string; preferred: boolean }[];
    summary: string;
  }) => callAI<{ advice: { term: string; advice: string }[]; summaryTip?: string }>("insights", input),

  coverLetter: (input: {
    profile: Profile;
    company: string;
    role: string;
    why: string;
    experience?: Entry;
    tone: string;
    jd?: string;
  }) => callAI<{ letter: string }>("coverLetter", { ...input, profile: slimProfile(input.profile) }),

  followup: (input: { application: Application; profile: Profile }) =>
    callAI<{ message: string }>("followup", {
      application: {
        company: input.application.company,
        role: input.application.role,
        stage: input.application.stage,
        date: input.application.date,
        interview: input.application.interview,
        contact: input.application.contact,
        notes: input.application.notes,
        events: input.application.events,
      },
      name: input.profile.name,
    }),

  interview: (input: { application: Application; profile: Profile }) =>
    callAI<{ question: string; coaching: string }[]>("interview", {
      company: input.application.company,
      role: input.application.role,
      jd: input.application.jd,
      profile: slimProfile(input.profile),
    }),

  rehearsal: (input: { role: string; company: string; jd: string; profile: Profile }) =>
    callAI<PracticeQuestion[]>("rehearsal", { ...input, profile: slimProfile(input.profile) }),

  rehearsalFeedback: (input: {
    question: string;
    answer: { context?: string; action?: string; outcome?: string };
  }) => callAI<{ feedback: string }>("rehearsalFeedback", input),

  pitch: (input: { intro: string; evidence: string; next: string; target: string; name: string; headline: string }) =>
    callAI<{ text: string }>("pitch", input),

  importResume: (input: { text?: string; file?: { name: string; mimeType: string; data: string } }) =>
    callAI<Profile>("importResume", input),

  launchPlan: (input: { title: string; target: string; application?: { company: string; role: string } | null; profile: Profile }) =>
    callAI<Pick<LaunchStep, "title" | "route" | "due">[]>("launchPlan", {
      ...input,
      profile: slimProfile(input.profile),
    }),
};

/** Read a File as base64 (no data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
