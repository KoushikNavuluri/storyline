import { BookOpen, FileText, PenLine, Type, Upload } from "lucide-react";
import { PageTitle, Row } from "@/components/ui/app";
import { useStudio } from "@/state/context";

export function Start() {
  const { go, update, seed } = useStudio();
  return (
    <div className="narrow">
      <PageTitle eyebrow="LET’S BEGIN" title="Every story starts somewhere.">
        Bring what you have. We’ll help you shape the rest.
      </PageTitle>
      <div className="start-illustration lilac">
        <FileText size={68} strokeWidth={1} />
        <span>
          Your experience,
          <br />
          all in one place.
        </span>
      </div>
      <Row
        icon={Upload}
        title="Import a resume"
        sub="Upload TXT, Markdown, PDF or Word and review the extraction"
        onClick={() => go("/import")}
      />
      <Row icon={Type} title="Paste resume text" sub="Copy from any existing document" onClick={() => go("/import")} />
      <Row
        icon={PenLine}
        title="Start with a blank page"
        sub="Add the essentials at your own pace"
        onClick={() => {
          update({
            onboarded: true,
          });
          go("/profile/contact");
        }}
      />
      <Row icon={BookOpen} title="Explore a sample" sub="Try the full workflow with Alex’s profile" onClick={seed} />
      <p className="fine-print">
        Your work is saved to your account. Avoid entering highly sensitive information on a shared device.
      </p>
    </div>
  );
}
