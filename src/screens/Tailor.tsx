import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, FileText, Plus, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { Btn, IconBtn, Notice, PageTitle, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { makeDoc, now, SAMPLE_JD, SECTION_KEYS, uid } from "@/state/factories";
import type { Requirement, Suggestion, Tailor as TailorDraft, UsageEntry } from "@/state/types";
import { extractRequirements, suggestionsFor } from "@/lib/keywords";
import { ai, AIError } from "@/lib/ai";

/** Optional sections the prototype hides on every tailored draft (offline fallback). */
const DEFAULT_HIDDEN = ["projects", "certifications", "awards", "volunteering", "custom"];

function fallbackToast(error: unknown) {
  toast(
    error instanceof AIError && error.status === 429
      ? "Daily assistance limit reached. Used the built-in rules instead."
      : "Assistance is unavailable right now. Used the built-in rules instead.",
  );
}

export function Tailor() {
  const { state, update, go } = useStudio();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [newRequirement, setNewRequirement] = useState("");
  const [reading, setReading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [requirementSource, setRequirementSource] = useState<"ai" | "rules" | null>(null);
  const tailor = state.tailor;
  const requirements: Requirement[] = tailor.requirements || extractRequirements(tailor.jd || "");

  const change = <K extends keyof TailorDraft>(key: K, value: TailorDraft[K]) =>
    update((current) => ({
      ...current,
      tailor: {
        ...current.tailor,
        [key]: value,
        ...(key === "jd" ? { requirements: null } : {}),
      },
    }));

  const reviewRequirements = async () => {
    if (!tailor.company.trim() || !tailor.role.trim() || tailor.jd.trim().length < 30) {
      setError("Add a company, a role, and at least 30 characters of job description.");
      return;
    }
    setError("");
    // Requirements already reviewed for this description (they reset whenever the JD changes): keep the user's list.
    if (tailor.requirements) {
      setStep(1);
      return;
    }
    setReading(true);
    let next: Requirement[];
    let fromAI = false;
    try {
      next = await ai.requirements({ company: tailor.company, role: tailor.role, jd: tailor.jd });
      fromAI = true;
    } catch (e) {
      next = extractRequirements(tailor.jd);
      fallbackToast(e);
    }
    update((current) => ({
      ...current,
      tailor: { ...current.tailor, requirements: next },
      usage: fromAI
        ? [...current.usage, { id: uid(), date: now(), action: "Requirement review" }]
        : current.usage,
    }));
    setRequirementSource(fromAI ? "ai" : "rules");
    setReading(false);
    setStep(1);
  };

  const create = async () => {
    setDrafting(true);
    try {
      const doc = makeDoc(state.profile, {
        title: `${tailor.company} · ${tailor.role}`,
        company: tailor.company,
        role: tailor.role,
        jd: tailor.jd,
        requirements,
        applicationId: tailor.applicationId || "",
        hidden: [...DEFAULT_HIDDEN],
      });
      const usage: UsageEntry[] = [];
      let failure: unknown = null;
      try {
        const result = await ai.tailorDraft({
          profile: state.profile,
          company: tailor.company,
          role: tailor.role,
          jd: tailor.jd,
          requirements,
        });
        doc.hidden = (Array.isArray(result?.hidden) ? result.hidden : []).filter((key) =>
          (SECTION_KEYS as string[]).includes(key),
        );
        usage.push({ id: uid(), date: now(), action: "Tailored draft" });
      } catch (e) {
        failure = e;
      }
      let suggestions: Suggestion[];
      try {
        const result = await ai.suggestions(doc);
        suggestions = result.map((s) => ({ ...s, id: uid(), state: "pending" as const }));
        usage.push({ id: uid(), date: now(), action: "Wording review" });
      } catch (e) {
        suggestions = suggestionsFor(doc);
        failure = failure || e;
      }
      if (failure) fallbackToast(failure);
      doc.suggestions = suggestions;
      update((current) => ({
        ...current,
        docs: [doc, ...current.docs],
        usage: [...current.usage, ...usage],
        tailor: {
          company: "",
          role: "",
          jd: "",
        },
      }));
      go(`/editor/${doc.id}/Content`);
      toast.success("Independent draft created");
    } catch {
      setError("Could not create a draft. Your profile and job description are preserved. Try again.");
    } finally {
      setDrafting(false);
    }
  };

  useEffect(() => {
    document.getElementById("root")?.scrollTo({
      top: 0,
      behavior: "instant",
    });
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, [step]);

  return state.profile.name ? (
    <div className="tailor-layout">
      <div>
        <button className="back-link" onClick={() => (step ? setStep(step - 1) : go("/home"))}>
          <ArrowLeft size={18} />
          {step ? "Previous step" : "Your studio"}
        </button>
        <div className="workflow-steps">
          {["Opportunity", "Requirements", "Review"].map((label, index) => (
            <span className={index <= step ? "current" : ""} key={label}>
              <span>{index < step ? <Check size={14} /> : index + 1}</span>
              {label}
            </span>
          ))}
        </div>
        <PageTitle
          eyebrow={`TAILOR A RESUME / ${step + 1} OF 3`}
          title={["What’s the next role?", "Read between the lines.", "Your experience leads."][step]}
        >
          {
            [
              "Start with the opportunity. Keep your experience at the center.",
              "Review what the description asks for before tailoring.",
              "An independent draft. Every change stays yours to approve.",
            ][step]
          }
        </PageTitle>
        {step === 0 && (
          <>
            <FieldGroup>
              <div className="two-fields">
                <TextField
                  label="Company"
                  value={tailor.company}
                  onChange={(value) => change("company", value)}
                  placeholder="e.g. Northstar"
                />
                <TextField
                  label="Target role"
                  value={tailor.role}
                  onChange={(value) => change("role", value)}
                  placeholder="e.g. Product Designer"
                />
              </div>
              <TextField
                area
                label="Job description"
                value={tailor.jd}
                onChange={(value) => change("jd", value)}
                rows={11}
                placeholder="Paste the responsibilities, skills, and requirements here…"
              />
            </FieldGroup>
            {state.sample && (
              <button
                className="text-link"
                onClick={() =>
                  update({
                    tailor: {
                      company: "Northstar",
                      role: "Product Designer",
                      jd: SAMPLE_JD,
                    },
                  })
                }
              >
                {"Use the sample opportunity "}
                <ArrowUpRight size={16} />
              </button>
            )}
            <div className="actions">
              <Btn onClick={reviewRequirements} icon={ArrowRight} disabled={reading}>
                {reading ? "Reading…" : "Review requirements"}
              </Btn>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <Notice
              title={
                requirementSource === "ai"
                  ? "Read by writing assistance (Gemini)"
                  : requirementSource === "rules"
                    ? "Built-in keyword extraction"
                    : "Requirements to review"
              }
              tone="cream"
            >
              This is a starting list, not a complete interpretation. Add missing requirements or remove irrelevant
              matches.
            </Notice>
            <div className="requirement-list">
              {requirements.map((requirement, index) => (
                <div className="requirement" key={index}>
                  <div>
                    <strong>{requirement.term}</strong>
                    <span>{requirement.preferred ? "Preferred / bonus" : "Mentioned in description"}</span>
                    <p>{requirement.source}</p>
                  </div>
                  <IconBtn
                    icon={X}
                    label={"Remove " + requirement.term}
                    onClick={() =>
                      change(
                        "requirements",
                        requirements.filter((_, other) => index !== other),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            {!requirements.length && (
              <p>No known keyword matches. Add the requirements that matter below; your description is preserved.</p>
            )}
            <div className="add-requirement">
              <TextField
                label="Add a requirement"
                value={newRequirement}
                onChange={setNewRequirement}
                placeholder="A phrase from the job description"
              />
              <IconBtn
                icon={Plus}
                label="Add requirement"
                disabled={!newRequirement.trim()}
                onClick={() => {
                  change("requirements", [
                    ...requirements,
                    {
                      term: newRequirement.trim(),
                      preferred: false,
                      source: "Added by you for review",
                    },
                  ]);
                  setNewRequirement("");
                }}
              />
            </div>
            <Btn
              onClick={() => {
                change("requirements", requirements);
                setStep(2);
              }}
              icon={ArrowRight}
            >
              Continue to review
            </Btn>
          </>
        )}
        {step === 2 && (
          <>
            <div className="evidence-summary mint">
              <FileText size={32} />
              <h2>{state.profile.name}</h2>
              <p>{state.profile.headline}</p>
              <div className="evidence-counts">
                <span>
                  {state.profile.experience.length}
                  {" roles"}
                </span>
                <span>
                  {state.profile.education.length}
                  {" education entries"}
                </span>
                <span>
                  {requirements.length}
                  {" requirements"}
                </span>
              </div>
            </div>
            <Notice title="What happens next">
              We copy your profile into an independent resume, then writing assistance (Gemini) suggests which sections
              to show and sharper wording for lines you already wrote. You can edit, hide, and reorder every section. No
              new experience or metrics are added.
            </Notice>
            <div className="cost-row">
              <span>Writing assistance</span>
              <strong>Daily allowance</strong>
            </div>
            <Btn onClick={create} icon={Sparkles} disabled={drafting}>
              {drafting ? "Drafting…" : "Create and review my draft"}
            </Btn>
          </>
        )}
        {error && (
          <Notice title="One thing to fix" icon={TriangleAlert}>
            {error}
          </Notice>
        )}
      </div>
      <aside className="tailor-aside">
        <div className="margin-art">
          <span className="margin-number">01</span>
          <FileText size={56} strokeWidth={1} />
          <h2>
            Relevant.
            <br />
            Not reinvented.
          </h2>
          <p>The best version of your story is still your story.</p>
        </div>
        <p className="privacy-caption">
          <ShieldCheck size={18} />
          Assistance works only from your profile and this description.
        </p>
      </aside>
    </div>
  ) : (
    <div className="narrow">
      <PageTitle eyebrow="FIRST, YOUR FOUNDATION" title="Start with your experience." />
      <Notice title="Your profile needs a name">
        A tailored resume starts with your own profile, not invented background.
      </Notice>
      <Btn onClick={() => go("/start")} icon={ArrowRight}>
        Create my profile
      </Btn>
    </div>
  );
}
