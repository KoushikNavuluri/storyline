import { describe, expect, it } from "vitest";
import { suggestionLines, TASKS, TaskError } from "../../api/_lib/tasks";

const content = {
  experience: [
    {
      id: "exp1",
      title: "Designer",
      org: "Brightline",
      dates: "2021",
      body: "Built a shared component library with engineering.\nResponsible for documenting patterns for the team.",
    },
  ],
  projects: [{ id: "p1", title: "Side", org: "", dates: "", body: "Designed a resource directory with volunteers." }],
};

describe("suggestions validation", () => {
  const payload = { content, hidden: ["projects"], jd: "Design systems role" };

  it("references only visible lines", () => {
    expect(suggestionLines(payload).map((l) => l.ref)).toEqual(["experience:exp1:0", "experience:exp1:1"]);
  });

  it("fills `before` verbatim and drops unknown refs, duplicates, and invented numbers", () => {
    const result = TASKS.suggestions.validate(
      {
        suggestions: [
          { ref: "experience:exp1:0", after: "Partnered with engineering to build a shared component library.", reason: "Collaboration", explanation: "Shows partnership." },
          { ref: "experience:exp1:0", after: "Duplicate", reason: "x", explanation: "x" },
          { ref: "experience:exp1:1", after: "Documented 40 patterns for 3 teams.", reason: "x", explanation: "x" },
          { ref: "projects:p1:0", after: "Hidden section", reason: "x", explanation: "x" },
          { ref: "nope:1:0", after: "Unknown", reason: "x", explanation: "x" },
        ],
      },
      payload,
    ) as { before: string; after: string; section: string; entry: string; index: number }[];
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      section: "experience",
      entry: "exp1",
      index: 0,
      before: "Built a shared component library with engineering.",
    });
  });
});

describe("other validators", () => {
  it("dedupes requirements and keeps only real source sentences", () => {
    const jd = "We need design systems experience. SQL is a plus.";
    const out = TASKS.requirements.validate(
      {
        requirements: [
          { term: "Design systems", preferred: false, source: "We need design systems experience" },
          { term: "design systems", preferred: false, source: "dup" },
          { term: "SQL", preferred: true, source: "Invented sentence that is not there" },
        ],
      },
      { jd },
    ) as { term: string; source: string; preferred: boolean }[];
    expect(out.map((r) => r.term)).toEqual(["Design systems", "SQL"]);
    expect(out[1].source).toBe("Mentioned in the job description");
    expect(out[1].preferred).toBe(true);
  });

  it("forces rehearsal ids and labels", () => {
    const slot = { title: "Why this role?", hint: "Be honest." };
    const out = TASKS.rehearsal.validate(
      { intro: slot, contribution: slot, collaboration: slot, questions: slot },
      {},
    ) as { id: string; label: string }[];
    expect(out.map((q) => q.id)).toEqual(["intro", "contribution", "collaboration", "questions"]);
    expect(out[0].label).toBe("THE INTRODUCTION");
  });

  it("keeps launch routes inside the allowed list", () => {
    const out = TASKS.launchPlan.validate(
      { steps: [{ title: "Update my profile", route: "/profile", due: "" }, { title: "Do it", route: "/evil", due: "1999-01-01" }] },
      { target: "" },
    ) as { route: string; due: string }[];
    expect(out[0].route).toBe("/profile");
    expect(out[1].route).toBe("none");
    expect(out[1].due).toBe("");
  });

  it("strips greetings and sign-offs from letters", () => {
    const out = TASKS.coverLetter.validate(
      { letter: "Dear hiring team,\n\nI am applying for the role.\n\nSincerely" },
      { profile: {}, why: "", jd: "" },
    ) as { letter: string };
    expect(out.letter).toBe("I am applying for the role.");
  });

  it("rejects pitches that add numbers the user never wrote", () => {
    expect(() =>
      TASKS.pitch.validate({ text: "I grew revenue 300%." }, { intro: "I design tools.", evidence: "", next: "" }),
    ).toThrow(TaskError);
  });

  it("normalises imported resumes into the profile shape", () => {
    const out = TASKS.importResume.validate(
      {
        name: "Jordan Lee",
        headline: "Data Analyst",
        skills: ["SQL", "Python"],
        experience: [{ title: "Data Analyst", org: "Acme", dates: "2020 to Present", bullets: ["- Built dashboards", "Automated reports"] }],
      },
      {},
    ) as { skills: string; experience: { id: string; body: string }[]; achievements: unknown[] };
    expect(out.skills).toBe("SQL, Python");
    expect(out.experience[0].body).toBe("Built dashboards\nAutomated reports");
    expect(out.experience[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.achievements).toEqual([]);
  });

  it("refuses to build prompts from empty input", () => {
    expect(() => TASKS.requirements.build({ jd: "short" })).toThrow(TaskError);
    expect(() => TASKS.rehearsalFeedback.build({ question: "Q", answer: {} })).toThrow(TaskError);
  });
});
