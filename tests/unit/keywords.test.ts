import { describe, expect, it } from "vitest";
import { analyse, extractRequirements, suggestionsFor } from "@/lib/keywords";
import { makeDoc, SAMPLE_JD, SAMPLE_PROFILE } from "@/state/factories";

describe("extractRequirements", () => {
  it("finds known terms in the sample job description", () => {
    const terms = extractRequirements(SAMPLE_JD).map((r) => r.term);
    expect(terms).toEqual(
      expect.arrayContaining(["design systems", "user research", "prototyping", "accessibility", "SQL", "engineering"]),
    );
  });

  it("marks terms followed by 'is a plus' as preferred and quotes the source sentence", () => {
    const sql = extractRequirements(SAMPLE_JD).find((r) => r.term === "SQL");
    expect(sql?.preferred).toBe(true);
    expect(sql?.source).toBe("SQL is a plus");
    const research = extractRequirements(SAMPLE_JD).find((r) => r.term === "user research");
    expect(research?.preferred).toBe(false);
  });

  it("returns nothing for unrelated text", () => {
    expect(extractRequirements("We bake bread every morning.")).toEqual([]);
  });
});

describe("analyse", () => {
  it("scores visible coverage and separates hidden evidence", () => {
    const doc = makeDoc(SAMPLE_PROFILE, { jd: SAMPLE_JD });
    const { results, score } = analyse(doc, SAMPLE_PROFILE);
    expect(score).not.toBeNull();
    expect(results.find((r) => r.term === "design systems")?.state).toBe("highlighted");
    expect(results.find((r) => r.term === "SQL")?.state).toBe("missing");

    const hidden = makeDoc(SAMPLE_PROFILE, { jd: SAMPLE_JD, hidden: ["skills", "summary", "experience", "projects"] });
    expect(analyse(hidden, SAMPLE_PROFILE).results.find((r) => r.term === "prototyping")?.state).toBe("available");
  });

  it("returns a null score without requirements", () => {
    expect(analyse(makeDoc(SAMPLE_PROFILE), SAMPLE_PROFILE).score).toBeNull();
  });
});

describe("suggestionsFor", () => {
  it("applies the collaboration rule to the sample profile", () => {
    const suggestions = suggestionsFor(makeDoc(SAMPLE_PROFILE));
    const built = suggestions.find((s) => s.before.startsWith("Built a shared component library"));
    expect(built?.after).toBe("Partnered with engineering to build a shared component library.");
    expect(built?.state).toBe("pending");
    expect(built?.section).toBe("experience");
  });

  it("tightens filler phrases", () => {
    const profile = {
      ...SAMPLE_PROFILE,
      experience: [{ id: "x", title: "T", org: "O", dates: "", body: "Responsible for onboarding in order to help teams." }],
    };
    const [first] = suggestionsFor(makeDoc(profile));
    expect(first.after).toBe("Onboarding in order to help teams.");
  });
});
