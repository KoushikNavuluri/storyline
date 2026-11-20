import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Mail, PenLine } from "lucide-react";
import { useStudio } from "@/state/context";
import { now, uid } from "@/state/factories";
import { ai, AIError } from "@/lib/ai";
import { Blank, Btn, Notice, PageTitle, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";

export function Followup({ id }: { id: string }) {
  const { state, update, go, ask } = useStudio();
  const [clipboardError, setClipboardError] = useState("");
  const [drafting, setDrafting] = useState(false);
  const application = state.applications.find((item) => item.id === id);

  if (!application)
    return (
      <Blank
        title="Choose an opportunity first"
        action="Open applications"
        onAction={() => go("/applications")}
      />
    );

  const change = (value: string) =>
    update((current) => ({
      ...current,
      applications: current.applications.map((item) =>
        item.id === id
          ? {
              ...item,
              followup: value,
            }
          : item,
      ),
    }));

  const draft = async () => {
    setDrafting(true);
    try {
      const { message } = await ai.followup({ application, profile: state.profile });
      update((current) => ({
        ...current,
        applications: current.applications.map((item) => (item.id === id ? { ...item, followup: message } : item)),
        usage: [...current.usage, { id: uid(), date: now(), action: "Follow-up draft" }],
      }));
    } catch (error) {
      const name = state.profile.name || "[Your name]";
      change(`Hello,

${application.stage === "Saved" ? `I'm interested in the ${application.role} opportunity at ${application.company} and would appreciate any information about the next steps.` : `I'm following up on my application for the ${application.role} role at ${application.company}. I'd appreciate any updates you can share about next steps.`}

Thank you for your time.
${name}`);
      toast(
        error instanceof AIError && error.status === 429
          ? "Daily assistance limit reached. Used the built-in rules instead."
          : "Assistance is unavailable right now. Used the built-in rules instead.",
      );
    } finally {
      setDrafting(false);
    }
  };

  // Confirm before replacing (asked up front so a cancelled replace never spends an assistance request).
  const compose = () => {
    if (application.followup?.trim())
      ask(
        "Replace this follow-up draft?",
        "Your application notes and documents will stay unchanged.",
        () => void draft(),
        "Replace draft",
      );
    else void draft();
  };

  return (
    <div className="narrow">
      <button className="back-link" onClick={() => go("/application/" + id)}>
        <ArrowLeft size={18} />
        {application.company}
      </button>
      <PageTitle eyebrow="FOLLOW-UP / A THOUGHTFUL NOTE" title="A little follow-through.">
        Keep it clear, personal, and easy to answer.
      </PageTitle>
      <Notice title="Draft only. Nothing is sent." icon={Mail}>
        Writing assistance (Gemini) drafts a note from your saved role, company, and stage. Review it before copying it
        into your preferred email app. No email service is connected.
      </Notice>
      <Btn variant="outline" onClick={compose} disabled={drafting} icon={PenLine}>
        {drafting ? "Drafting…" : "Create draft"}
      </Btn>
      <FieldGroup>
        <TextField
          area
          label="My follow-up message"
          value={application.followup || ""}
          onChange={change}
          rows={12}
          placeholder="Write a short note in your own voice…"
          hint="Saved to your account as you type. You decide when and where to send it."
        />
      </FieldGroup>
      {clipboardError && <Notice title="Copy it manually">{clipboardError}</Notice>}
      <div className="actions">
        <Btn
          disabled={!application.followup?.trim()}
          icon={Copy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(application.followup || "");
              toast.success("Draft copied. Nothing has been sent.");
              setClipboardError("");
            } catch {
              setClipboardError("Your browser blocked clipboard access. Select the text above and copy it manually.");
            }
          }}
        >
          Copy message
        </Btn>
        <Btn variant="outline" onClick={() => go("/application/" + id)} icon={Check}>
          Done
        </Btn>
      </div>
    </div>
  );
}
