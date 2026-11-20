/**
 * Deterministic keyword helpers (ported from the prototype).
 * They power the literal match score and act as the offline fallback when Gemini is unavailable.
 */
import { SECTION_KEYS, uid } from "@/state/factories";
import type { Doc, Profile, Requirement, Suggestion } from "@/state/types";

export const KNOWN_TERMS = [
  "design systems",
  "user research",
  "prototyping",
  "accessibility",
  "SQL",
  "Python",
  "JavaScript",
  "React",
  "project management",
  "leadership",
  "collaboration",
  "engineering",
  "data analysis",
  "communication",
  "customer support",
  "sales",
  "marketing",
  "Figma",
  "testing",
  "stakeholder management",
  "B2B",
  "SaaS",
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function extractRequirements(jd: string): Requirement[] {
  const lower = jd.toLowerCase();
  return KNOWN_TERMS.filter(
    (term) =>
      lower.includes(term.toLowerCase()) ||
      (term === "prototyping" && lower.includes("prototype")) ||
      (term === "accessibility" && lower.includes("accessible")),
  ).map((term) => ({
    term,
    preferred: new RegExp(`${escapeRegex(term)}[^.!?\\n]{0,50}(plus|preferred|bonus)`, "i").test(jd),
    source:
      jd
        .split(/[.!?\n]/)
        .find((sentence) => sentence.toLowerCase().includes(term.toLowerCase().slice(0, 8)))
        ?.trim() || "Matched in the job description",
  }));
}

export function profileText(profile: Partial<Profile> & Record<string, unknown>): string {
  return [
    profile.summary,
    profile.skills,
    ...SECTION_KEYS.filter((key) => Array.isArray(profile[key])).flatMap((key) =>
      (profile[key] as { title: string; org: string; body: string }[]).map(
        (entry) => `${entry.title} ${entry.org} ${entry.body}`,
      ),
    ),
  ]
    .join(" ")
    .toLowerCase();
}

export type MatchState = "highlighted" | "available" | "missing";

export function matchStem(term: string) {
  return term === "prototyping" ? "prototyp" : term === "accessibility" ? "accessib" : term.toLowerCase();
}

/** Literal keyword coverage of a document against its requirements. */
export function analyse(doc: Doc, profile: Profile) {
  const requirements = doc.requirements || extractRequirements(doc.jd);
  const profileCorpus = profileText(profile as Profile & Record<string, unknown>);
  const visibleCorpus = profileText({
    ...doc.content,
    ...Object.fromEntries(
      doc.hidden.map((key) => [key, Array.isArray((doc.content as unknown as Record<string, unknown>)[key]) ? [] : ""]),
    ),
  } as Profile & Record<string, unknown>);
  const results = requirements.map((req) => ({
    ...req,
    state: (visibleCorpus.includes(matchStem(req.term))
      ? "highlighted"
      : profileCorpus.includes(matchStem(req.term))
        ? "available"
        : "missing") as MatchState,
  }));
  return {
    results,
    score: results.length
      ? Math.round((results.filter((r) => r.state === "highlighted").length / results.length) * 100)
      : null,
  };
}

type Rule = [RegExp, string | ((match: string, group: string) => string), string];

const RULES: Rule[] = [
  [
    /^Built (.+) with engineering\.?$/i,
    (_m, group) => `Partnered with engineering to build ${group.replace(/\.$/, "")}.`,
    "Emphasize collaboration",
  ],
  [/^Responsible for (.+)/i, (_m, group) => group.charAt(0).toUpperCase() + group.slice(1), "Use a direct opening"],
  [/in order to/gi, "to", "Make this more concise"],
  [/was able to /gi, "", "Use a direct opening"],
];

export const RULE_EXPLANATION =
  "A wording rule rearranges your existing evidence. No new qualifications or results are added.";

/** Rule-based wording suggestions (offline fallback for AI suggestions). */
export function suggestionsFor(doc: Doc): Suggestion[] {
  const out: Suggestion[] = [];
  const content = doc.content as unknown as Record<string, unknown>;
  for (const section of SECTION_KEYS) {
    if (!Array.isArray(content[section])) continue;
    for (const entry of content[section] as { id: string; body: string }[]) {
      entry.body.split("\n").forEach((line, index) => {
        for (const [pattern, replacement, reason] of RULES) {
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            pattern.lastIndex = 0;
            out.push({
              id: uid(),
              section,
              entry: entry.id,
              index,
              before: line,
              after: line.replace(pattern, replacement as string),
              reason,
              explanation: RULE_EXPLANATION,
              state: "pending",
            });
            break;
          }
        }
      });
    }
  }
  return out;
}
