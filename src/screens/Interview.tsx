import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { useStudio } from "@/state/context";
import { now, uid } from "@/state/factories";
import { ai, AIError } from "@/lib/ai";
import { Blank, Btn, Notice, PageTitle, Pick, Row, TextField } from "@/components/ui/app";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, FieldGroup } from "@/components/ui/primitives";

const DEFAULT_COACHING =
  "Outline the context, your personal contribution, what happened, and what you learned. Use a specific example you can explain.";

export function Interview({ id }: { id: string }) {
  const { state, update, go } = useStudio();
  const application = state.applications.find((item) => item.id === id);
  const [experienceIndex, setExperienceIndex] = useState(0);
  const [suggesting, setSuggesting] = useState(false);

  if (!application)
    return (
      <Blank
        title="Choose an opportunity first"
        action="Open applications"
        onAction={() => go("/applications")}
      />
    );

  const evidence = [...state.profile.achievements, ...state.profile.experience];
  const selected = evidence[experienceIndex];
  const prompts: { question: string; coaching: string }[] = application.questions?.length
    ? application.questions
    : [
        `What draws you to the ${application.role} role?`,
        "Walk me through a project and the decisions you made.",
        "Tell me about a time you worked with a different discipline.",
        "What would you want to learn before starting here?",
      ].map((question) => ({ question, coaching: DEFAULT_COACHING }));

  const suggestQuestions = async () => {
    setSuggesting(true);
    try {
      const questions = await ai.interview({ application, profile: state.profile });
      update((current) => ({
        ...current,
        applications: current.applications.map((item) => (item.id === id ? { ...item, questions } : item)),
        usage: [...current.usage, { id: uid(), date: now(), action: "Interview prompts" }],
      }));
    } catch (error) {
      toast(
        error instanceof AIError && error.status === 429
          ? "Daily assistance limit reached. Used the built-in rules instead."
          : "Assistance is unavailable right now. Used the built-in rules instead.",
      );
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="narrow">
      <button className="back-link" onClick={() => go("/application/" + id)}>
        <ArrowLeft size={18} />
        {application.company}
      </button>
      <PageTitle eyebrow="INTERVIEW / PREPARE WITH YOUR STORY" title="Go in with something real.">
        Practice prompts, not predictions of an employer’s questions.
      </PageTitle>
      <Notice title="Writing assistance, grounded in your story" tone="lilac">
        Suggested prompts come from the role and your own profile (Gemini). Use them to shape your own answers. No
        invented outcomes.
      </Notice>
      <Btn variant="outline" onClick={suggestQuestions} disabled={suggesting} icon={Sparkles}>
        {suggesting ? "Suggesting…" : "Suggest questions for this role"}
      </Btn>
      <Accordion
        type="single"
        collapsible
        defaultValue="q0"
        key={application.questions?.length ? "suggested" : "default"}
      >
        {prompts.map((prompt, index) => (
          <AccordionItem value={"q" + index} key={index + prompt.question}>
            <AccordionTrigger>{prompt.question}</AccordionTrigger>
            <AccordionContent>{prompt.coaching || DEFAULT_COACHING}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <h2>Choose an experience to draw on</h2>
      {evidence.length ? (
        <>
          <Pick
            label="Experience"
            value={String(experienceIndex)}
            onChange={(value) => setExperienceIndex(Number(value))}
            options={evidence.map((entry, index) => ({
              value: String(index),
              label: entry.title || "Untitled experience",
            }))}
          />
          <blockquote>{selected?.body}</blockquote>
        </>
      ) : (
        <Row
          title="Build your evidence bank"
          sub="Save an experience or achievement first"
          onClick={() => go("/achievements")}
        />
      )}
      <FieldGroup>
        <TextField
          area
          label="My preparation notes"
          value={application.prep}
          rows={10}
          onChange={(value) =>
            update((current) => ({
              ...current,
              applications: current.applications.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      prep: value,
                    }
                  : item,
              ),
            }))
          }
          placeholder={`Context:
My contribution:
Outcome I can support:
What I learned:
Questions for the team:`}
        />
      </FieldGroup>
      <Btn onClick={() => go("/application/" + id)} icon={Check}>
        Done preparing
      </Btn>
    </div>
  );
}
