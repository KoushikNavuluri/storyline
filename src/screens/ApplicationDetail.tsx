import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink, Mail, PenLine, Trash2, TriangleAlert } from "lucide-react";
import { Blank, Btn, Notice, PageTitle, Paper, Pick, Row, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { blankApp, copy, now, STAGES } from "@/state/factories";
import { dateLabel } from "@/lib/download";
import type { Application } from "@/state/types";

export function ApplicationDetail({ id }: { id: string }) {
  const { state, update, go, ask } = useStudio();
  const isNew = id === "new";
  const [draft, setDraft] = useState<Application>(() => state.applicationDraft || blankApp());
  const application = isNew ? draft : state.applications.find((item) => item.id === id);
  const [error, setError] = useState("");
  if (!application)
    return <Blank title="Opportunity not found" action="Open applications" onAction={() => go("/applications")} />;

  const changes = (patch: Partial<Application>) => {
    if (isNew) {
      setDraft((current) => ({ ...current, ...patch }));
      update((current) => ({
        ...current,
        applicationDraft: { ...(current.applicationDraft || draft), ...patch },
      }));
    } else {
      update((current) => ({
        ...current,
        applications: current.applications.map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
                events:
                  patch.stage && patch.stage !== item.stage
                    ? [...item.events, { text: `Stage changed to ${patch.stage}`, date: now() }]
                    : item.events,
              }
            : item,
        ),
      }));
    }
  };
  const change = <K extends keyof Application>(key: K, value: Application[K]) =>
    changes({ [key]: value } as Partial<Application>);
  const linkedDoc = state.docs.find((doc) => doc.id === application.docId);

  const create = () => {
    if (!application.company.trim() || !application.role.trim()) {
      setError("Add a company and role before saving.");
      return;
    }
    update((current) => ({
      ...current,
      applications: [{ ...application, events: [{ text: "Opportunity saved", date: now() }] }, ...current.applications],
      applicationDraft: null,
    }));
    go("/application/" + application.id);
    toast.success("Opportunity saved");
  };

  const linkVersion = (versionId: string) => {
    const version = linkedDoc?.versions.find((item) => item.id === versionId);
    if (version) changes({ versionId, versionSnapshot: copy(version.snapshot) });
  };

  return (
    <div className="application-detail">
      <div className="narrow">
        <button className="back-link" onClick={() => go("/applications")}>
          <ArrowLeft size={18} />
          Applications
        </button>
        <PageTitle
          eyebrow={isNew ? "A NEW POSSIBILITY" : "OPPORTUNITY"}
          title={isNew ? "What caught your eye?" : application.company}
        >
          {isNew ? "You don’t need to be ready to apply." : application.role}
        </PageTitle>
        {error && (
          <Notice title="A couple of details first" icon={TriangleAlert}>
            {error}
          </Notice>
        )}
        <FieldGroup>
          <div className="two-fields">
            <TextField label="Company" value={application.company} onChange={(value) => change("company", value)} />
            <TextField label="Role" value={application.role} onChange={(value) => change("role", value)} />
          </div>
          <TextField
            label="Job link (optional)"
            value={application.url}
            onChange={(value) => change("url", value)}
            placeholder="https://…"
            hint="Saved for reference. Job pages are not fetched automatically."
          />
          {/^https?:\/\//.test(application.url) && (
            <a className="text-link" href={application.url} target="_blank" rel="noopener noreferrer">
              {"Open job posting "}
              <ExternalLink size={16} />
            </a>
          )}
          <Pick
            label="Application stage"
            value={application.stage}
            onChange={(value) => change("stage", value)}
            options={[...STAGES]}
          />
          <div className="two-fields">
            <TextField
              type="date"
              label="Application date"
              value={application.date}
              onChange={(value) => change("date", value)}
            />
            <TextField
              type="date"
              label="Deadline"
              value={application.deadline}
              onChange={(value) => change("deadline", value)}
            />
          </div>
          <TextField
            area
            rows={5}
            label="Job description"
            value={application.jd}
            onChange={(value) => change("jd", value)}
          />
          <TextField
            area
            rows={4}
            label="Notes"
            value={application.notes}
            onChange={(value) => change("notes", value)}
            placeholder="What matters about this opportunity?"
          />
          <div className="two-fields">
            <TextField
              label="Professional contact (optional)"
              value={application.contact}
              onChange={(value) => change("contact", value)}
              placeholder="Contact name or public profile"
            />
            <TextField
              type="date"
              label="Follow-up date"
              value={application.reminder}
              onChange={(value) => change("reminder", value)}
            />
          </div>
          <TextField
            type="datetime-local"
            label="Interview date and time"
            value={application.interview}
            onChange={(value) => change("interview", value)}
          />
        </FieldGroup>
        {isNew ? (
          <Btn onClick={create} icon={Check}>
            Save opportunity
          </Btn>
        ) : (
          <>
            <div className="actions">
              <Btn
                onClick={() => {
                  update({
                    tailor: {
                      company: application.company,
                      role: application.role,
                      jd: application.jd,
                      applicationId: application.id,
                    },
                  });
                  go("/tailor");
                }}
                icon={PenLine}
              >
                Tailor a resume
              </Btn>
              <Btn variant="outline" onClick={() => go("/interview/" + id)} icon={BookOpen}>
                Prepare for interview
              </Btn>
            </div>
            <Row
              icon={Mail}
              title="Write a cover letter"
              sub="Start with your actual experience"
              onClick={() => go("/cover/" + id)}
            />
            <Row
              icon={Trash2}
              title="Delete opportunity"
              sub="Your resume documents will not be deleted"
              onClick={() =>
                ask(
                  "Delete this opportunity?",
                  `Remove ${application.company} and its notes? Your documents remain.`,
                  () => {
                    update((current) => ({
                      ...current,
                      applications: current.applications.filter((item) => item.id !== id),
                    }));
                    go("/applications");
                    toast("Opportunity deleted", {
                      action: {
                        label: "Undo",
                        onClick: () =>
                          update((current) => ({
                            ...current,
                            applications: [application, ...current.applications],
                          })),
                      },
                    });
                  },
                  "Delete opportunity",
                )
              }
            />
          </>
        )}
      </div>
      {!isNew && (
        <aside className="application-aside">
          <h2>The story you’re sending</h2>
          <p>Link a fixed version, not a moving draft.</p>
          <FieldGroup>
            <Pick
              label="Resume"
              value={application.docId || "none"}
              onChange={(value) =>
                changes({ docId: value === "none" ? "" : value, versionId: "", versionSnapshot: null })
              }
              options={[
                { value: "none", label: "No resume linked" },
                ...state.docs
                  .filter((doc) => doc.kind === "resume")
                  .map((doc) => ({ value: doc.id, label: doc.title || "Untitled resume" })),
              ]}
            />
            {linkedDoc && (
              <Pick
                label="Version"
                value={application.versionId || "none"}
                onChange={linkVersion}
                options={[
                  { value: "none", label: "Choose a saved version" },
                  ...linkedDoc.versions.map((version) => ({
                    value: version.id,
                    label: `${version.name} \xB7 ${dateLabel(version.date)}`,
                  })),
                ]}
              />
            )}
            <Pick
              label="Cover letter"
              value={application.letterId || "none"}
              onChange={(value) => change("letterId", value === "none" ? "" : value)}
              options={[
                { value: "none", label: "No letter linked" },
                ...state.docs.filter((doc) => doc.kind === "letter").map((doc) => ({ value: doc.id, label: doc.title })),
              ]}
            />
          </FieldGroup>
          {application.versionSnapshot ? (
            <>
              <div className="linked-preview cream">
                <Paper doc={application.versionSnapshot} mini />
              </div>
              <Notice title="Fixed snapshot linked">
                Future edits to your profile or document won’t change this application’s resume.
              </Notice>
            </>
          ) : linkedDoc ? (
            <Notice title="Save a version to lock it in">
              <button className="text-link" onClick={() => go("/history/" + linkedDoc.id)}>
                {"Open version history "}
                <ArrowRight size={16} />
              </button>
            </Notice>
          ) : null}
          <h3>Activity</h3>
          <div className="timeline">
            {application.events
              .slice()
              .reverse()
              .map((event, index) => (
                <div key={index}>
                  <span className="timeline-dot" />
                  <p>
                    {event.text}
                    <small>{dateLabel(event.date)}</small>
                  </p>
                </div>
              ))}
          </div>
          {application.reminder && (
            <Notice title={`Follow up ${dateLabel(application.reminder)}`}>
              This reminder appears in Storyline. Push notifications and email delivery are not connected.
            </Notice>
          )}
        </aside>
      )}
    </div>
  );
}
