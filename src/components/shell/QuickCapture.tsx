import { Check } from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "@/state/context";
import { uid } from "@/state/factories";
import type { Entry } from "@/state/types";
import { Btn, Modal, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";

type CaptureDraft = Omit<Entry, "id">;
type CaptureField = keyof CaptureDraft;

const emptyCapture = (): CaptureDraft => ({ title: "", org: "", dates: "", body: "" });

export interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

/** "Capture a win" dialog. The draft lives in `state.studio.capture`, so closing keeps it. */
export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const { state, update } = useStudio();
  const draft = state.studio?.capture || emptyCapture();

  const patch = (field: CaptureField, value: string) =>
    update((current) => ({
      ...current,
      studio: {
        ...current.studio,
        capture: {
          ...(current.studio?.capture || emptyCapture()),
          [field]: value,
        },
      },
    }));

  const save = () => {
    const entry: Entry = { id: uid(), ...draft };
    update((current) => ({
      ...current,
      profile: {
        ...current.profile,
        achievements: [...(current.profile.achievements || []), entry],
      },
      studio: {
        ...current.studio,
        capture: null,
      },
    }));
    onClose();
    toast.success("A real win, saved for your next chapter.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keep this little win."
      description="A useful detail today could become your strongest story tomorrow. Closing keeps your draft."
      footer={
        <Btn disabled={!draft.title.trim() || !draft.body.trim()} icon={Check} onClick={save}>
          Save to achievement bank
        </Btn>
      }
    >
      <FieldGroup>
        <TextField
          label="What happened?"
          value={draft.title}
          onChange={(value) => patch("title", value)}
          placeholder="A project, a decision, a contribution…"
        />
        <div className="two-fields">
          <TextField label="Where / context" value={draft.org} onChange={(value) => patch("org", value)} />
          <TextField
            label="When (optional)"
            value={draft.dates}
            onChange={(value) => patch("dates", value)}
            placeholder="e.g. September 2026"
          />
        </div>
        <TextField
          area
          rows={5}
          label="Your contribution and the real outcome"
          value={draft.body}
          onChange={(value) => patch("body", value)}
          placeholder="What did you do? What changed?"
          hint="Only include numbers you can support. No outcome yet? Save what you know."
        />
      </FieldGroup>
    </Modal>
  );
}
