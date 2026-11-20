import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { useStudio } from "@/state/context";
import { makeDoc, now, uid } from "@/state/factories";
import { ai, AIError } from "@/lib/ai";
import { Btn, Notice, PageTitle, Pick, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";

type Tone = "Direct" | "Warm";

export function CoverBrief({ applicationId }: { applicationId?: string }) {
  const { state, update, go } = useStudio();
  const application = state.applications.find((item) => item.id === applicationId);
  const [company, setCompany] = useState(application?.company || "");
  const [role, setRole] = useState(application?.role || state.profile.headline);
  const [why, setWhy] = useState("");
  const [experienceId, setExperienceId] = useState(state.profile.experience[0]?.id || "");
  const [tone, setTone] = useState<Tone>("Direct");
  const [drafting, setDrafting] = useState(false);

  const create = async () => {
    const experience = state.profile.experience.find((entry) => entry.id === experienceId);
    let letter: string;
    let assisted = false;
    setDrafting(true);
    try {
      const result = await ai.coverLetter({
        profile: state.profile,
        company,
        role,
        why,
        experience,
        tone,
        jd: application?.jd,
      });
      letter = result.letter;
      assisted = true;
    } catch (error) {
      letter = [
        `I am applying for the ${role} role at ${company}.`,
        why.trim(),
        experience
          ? `In my role as ${experience.title} at ${experience.org}, my work included:
${experience.body}`
          : state.profile.summary,
        tone === "Warm"
          ? "I would welcome the opportunity to discuss how my experience could contribute to your team."
          : "Thank you for considering my application.",
      ].filter(Boolean).join(`

`);
      toast(
        error instanceof AIError && error.status === 429
          ? "Daily assistance limit reached. Used the built-in rules instead."
          : "Assistance is unavailable right now. Used the built-in rules instead.",
      );
    } finally {
      setDrafting(false);
    }
    const doc = makeDoc(state.profile, {
      kind: "letter",
      company,
      role,
      title: company + " · Cover letter",
      letter,
    });
    update((current) => ({
      ...current,
      docs: [doc, ...current.docs],
      applications: current.applications.map((item) =>
        item.id === applicationId
          ? {
              ...item,
              letterId: doc.id,
            }
          : item,
      ),
      usage: assisted ? [...current.usage, { id: uid(), date: now(), action: "Cover letter draft" }] : current.usage,
    }));
    go("/editor/" + doc.id + "/Content");
    toast.success("Editable draft created");
  };

  return (
    <div className="narrow">
      <PageTitle eyebrow="COVER LETTER / YOUR WORDS" title="Make the introduction count.">
        A thoughtful starting point, built from your own evidence.
      </PageTitle>
      <Notice title="Writing assistance (Gemini)">
        Drafts a letter from your approved details and the experience you choose. It never adds experience, metrics, or
        qualifications. You review and edit every word.
      </Notice>
      <FieldGroup>
        <TextField label="Company" value={company} onChange={setCompany} />
        <TextField label="Role" value={role} onChange={setRole} />
        <TextField
          area
          label="Why this opportunity? (optional)"
          value={why}
          onChange={setWhy}
          rows={4}
          hint="Only you know your motivation. We won’t invent it."
        />
        {state.profile.experience.length > 0 && (
          <Pick
            label="Experience to emphasize"
            value={experienceId}
            onChange={setExperienceId}
            options={state.profile.experience.map((entry) => ({
              value: entry.id,
              label: entry.title + " · " + entry.org,
            }))}
          />
        )}
        <Pick
          label="Closing tone"
          value={tone}
          onChange={(value) => setTone(value as Tone)}
          options={["Direct", "Warm"]}
        />
      </FieldGroup>
      <Btn
        disabled={drafting || !company.trim() || !role.trim() || !state.profile.name}
        onClick={create}
        icon={ArrowRight}
      >
        {drafting ? "Drafting…" : "Create editable letter"}
      </Btn>
      {!state.profile.name && (
        <button className="text-link" onClick={() => go("/profile/contact")}>
          Add your name to your profile first
        </button>
      )}
    </div>
  );
}
