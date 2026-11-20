import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Download, TriangleAlert } from "lucide-react";
import { Btn, Modal, Notice, PageTitle, Paper, Pick, TextField } from "@/components/ui/app";
import { FieldGroup, Switch } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { copy, now, uid } from "@/state/factories";
import { layoutDocument } from "@/lib/pdf/layout";
import { exportPdf } from "@/lib/pdf/pdf";
import type { Application, Doc, Version } from "@/state/types";

export function ExportView({ doc }: { doc: Doc }) {
  const { state, go, update } = useStudio();
  const [fileName, setFileName] = useState(
    (doc.content.name || "Resume").replaceAll(" ", "-") + "-" + (doc.company || "Storyline") + ".pdf",
  );
  const [linkApplication, setLinkApplication] = useState(!!doc.company);
  const [applicationId, setApplicationId] = useState(
    doc.applicationId ||
      state.applications.find((application) => application.docId === doc.id || application.letterId === doc.id)
        ?.id ||
      "new",
  );
  const [company, setCompany] = useState(doc.company);
  const [role, setRole] = useState(doc.role);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [linkedId, setLinkedId] = useState("");
  const layout = layoutDocument(doc);

  const run = () => {
    setError("");
    if (!fileName.trim()) {
      setError("Give your PDF a filename before downloading.");
      return;
    }
    if (linkApplication && applicationId === "new" && (!company.trim() || !role.trim())) {
      setError("Add a company and role, or turn off application linking.");
      return;
    }
    try {
      exportPdf(doc, fileName);
      const version: Version = {
        id: uid(),
        name: `Export ${doc.versions.length + 1}`,
        date: now(),
        snapshot: copy({ ...doc, status: "Ready", versions: [] }),
      };
      const targetId = applicationId === "new" ? uid() : applicationId;
      const link: Partial<Application> =
        doc.kind === "letter"
          ? { letterId: doc.id, letterVersionId: version.id, letterVersionSnapshot: copy(version.snapshot) }
          : { docId: doc.id, versionId: version.id, versionSnapshot: copy(version.snapshot) };
      update((current) => ({
        ...current,
        docs: current.docs.map((item) =>
          item.id === doc.id
            ? { ...item, status: "Ready", versions: [...item.versions, version], updated: now() }
            : item,
        ),
        applications: linkApplication
          ? applicationId === "new"
            ? [
                {
                  id: targetId,
                  company,
                  role,
                  jd: doc.jd,
                  url: "",
                  stage: "Saved",
                  date: "",
                  deadline: "",
                  notes: "",
                  contact: "",
                  reminder: "",
                  interview: "",
                  prep: "",
                  docId: "",
                  versionId: "",
                  letterId: "",
                  ...link,
                  events: [{ text: "Opportunity saved with document snapshot", date: now() }],
                },
                ...current.applications,
              ]
            : current.applications.map((application) =>
                application.id === targetId
                  ? {
                      ...application,
                      ...link,
                      events: [
                        ...application.events,
                        {
                          text: `${doc.kind === "letter" ? "Cover letter" : "Resume"} export snapshot linked`,
                          date: now(),
                        },
                      ],
                    }
                  : application,
              )
          : current.applications,
      }));
      setLinkedId(linkApplication ? targetId : "");
      setDone(true);
    } catch (caught) {
      setError(
        (caught instanceof Error && caught.message) ||
          "Could not generate this PDF. Your document is safe. Try simplifying the content or export a data backup.",
      );
    }
  };

  return (
    <>
      <button className="back-link" onClick={() => go(`/editor/${doc.id}/Preview`)}>
        <ArrowLeft size={18} />
        Back to your document
      </button>
      <PageTitle eyebrow="EXPORT / THE FINAL LOOK" title="Ready for what’s next.">
        Inspect the pages. Keep the version. Make your move.
      </PageTitle>
      <div className="export-layout">
        <div className="export-paper cream">
          <Paper doc={doc} />
        </div>
        <div className="export-controls">
          <div className="export-checks">
            <span>
              <Check />
              Selectable PDF text
            </span>
            <span>
              <Check />
              {layout.pages.length} {layout.pages.length === 1 ? "page" : "pages"}
              {" \xB7 no clipped content"}
            </span>
            <span>
              <Check />
              Private by default
            </span>
          </div>
          {layout.unsupported && (
            <Notice title="Some characters need another export engine" icon={TriangleAlert}>
              Storyline’s PDF fonts support Latin-script text. Unsupported characters are not silently replaced.
              Export a data backup to preserve the original content.
            </Notice>
          )}
          <FieldGroup>
            <TextField label="File name" value={fileName} onChange={setFileName} />
          </FieldGroup>
          {layout.pages.length > 1 && (
            <Notice title="Inspect every page">
              {"Your document uses "}
              {layout.pages.length}
              {" pages. Scroll through the complete preview before downloading."}
            </Notice>
          )}
          <div className="setting-row">
            <div>
              <strong>Keep the opportunity in view</strong>
              <p>Link this exact version to an application.</p>
            </div>
            <Switch
              checked={linkApplication}
              onCheckedChange={setLinkApplication}
              aria-label="Link to application"
            />
          </div>
          {linkApplication && (
            <FieldGroup>
              <Pick
                label="Application"
                value={applicationId}
                onChange={setApplicationId}
                options={[
                  { value: "new", label: "Save a new opportunity" },
                  ...state.applications.map((application) => ({
                    value: application.id,
                    label: application.company + " \xB7 " + application.role,
                  })),
                ]}
              />
              {applicationId === "new" && (
                <>
                  <TextField label="Company" value={company} onChange={setCompany} />
                  <TextField label="Role" value={role} onChange={setRole} />
                </>
              )}
            </FieldGroup>
          )}
          <p className="fine-print">
            Downloading never marks an application as submitted. A fixed snapshot is saved with this export.
          </p>
          {error && (
            <Notice title="Export needs attention" icon={TriangleAlert}>
              {error}
            </Notice>
          )}
          <Btn disabled={layout.unsupported} onClick={run} icon={Download}>
            Download PDF
          </Btn>
          <button className="text-link" onClick={() => go(`/editor/${doc.id}/Content`)}>
            {"Keep editing "}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <Modal
        open={done}
        onClose={() => setDone(false)}
        title="Your PDF is prepared."
        description="The download was requested from your browser. Check your downloads for the file."
        footer={
          <Btn onClick={() => go(linkedId ? "/application/" + linkedId : "/docs")} icon={ArrowRight}>
            {linkedId ? "Open application" : "Open documents"}
          </Btn>
        }
      >
        <div className="export-celebration mint">
          <CheckCheck size={48} />
          <h3>{fileName}</h3>
          <p>A fixed version is saved.{linkedId ? " Your application is linked." : ""}</p>
        </div>
      </Modal>
    </>
  );
}
