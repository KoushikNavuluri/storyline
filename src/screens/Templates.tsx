import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Btn, Choices, Notice, PageTitle, Paper } from "@/components/ui/app";
import { useStudio } from "@/state/context";
import { TEMPLATES } from "@/state/factories";
import type { Doc } from "@/state/types";

const templateInfo = (name: string) => TEMPLATES.find((template) => template.name === name) ?? TEMPLATES[0];

export function Templates({ doc }: { doc: Doc }) {
  const { go, updateDoc } = useStudio();
  const [template, setTemplate] = useState<string>(doc.template);
  return (
    <>
      <button className="back-link" onClick={() => go(`/editor/${doc.id}/Preview`)}>
        <ArrowLeft size={18} />
        Back to your document
      </button>
      <PageTitle eyebrow="CURATED / NOT COMPLICATED" title="Let your work speak.">
        Your story. A different setting. Every preview uses your content.
      </PageTitle>
      <div className="template-layout">
        <div>
          <Choices<string>
            value={template}
            onChange={setTemplate}
            options={TEMPLATES.map((option) => option.name)}
            label="Resume template"
          />
          <div className={"template-stage " + templateInfo(template).color}>
            <Paper doc={{ ...doc, template }} mini />
          </div>
        </div>
        <aside className="template-details">
          <span className="eyebrow">
            {"THE "}
            {template.toUpperCase()}
            {" EDITION"}
          </span>
          <h2>{template}</h2>
          <p>{templateInfo(template).desc}</p>
          <div className="template-benefits">
            <span>
              <Check />
              Text-based export
            </span>
            <span>
              <Check />
              Single-column reading order
            </span>
            <span>
              <Check />
              Your content stays intact
            </span>
          </div>
          <Notice title="A note on parsing">
            All six templates use a single column. No template can guarantee how an employer’s system
            parses a document.
          </Notice>
          <Btn
            onClick={() => {
              updateDoc(doc.id, { template });
              go(`/editor/${doc.id}/Preview`);
              toast.success(template + " applied. Content preserved.");
            }}
            icon={ArrowRight}
          >
            {"Use "}
            {template}
          </Btn>
        </aside>
      </div>
    </>
  );
}
