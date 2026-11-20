import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, History as HistoryIcon, Plus, Undo2 } from "lucide-react";
import { Blank, Btn, PageTitle, Paper, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { copy, now, SECTION_KEYS, SECTION_LABELS, uid } from "@/state/factories";
import type { Doc, Entry, Version } from "@/state/types";

const HEADER_FIELDS = ["name", "headline", "location", "links"] as const;
const LAYOUT_FIELDS = ["template", "size", "spacing", "margin", "accent"] as const;

/** Plain-text rendering of a profile section for the side-by-side diff. */
function sectionText(value: string | Entry[]) {
  return typeof value == "string"
    ? value
    : value.map((entry) => [entry.title, entry.org, entry.dates, entry.body].join(`
`)).join(`

`);
}

export function History({ doc }: { doc: Doc }) {
  const { go, snap, updateDoc, ask } = useStudio();
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState(doc.versions.at(-1)?.id || "");
  const selected: Version | undefined = doc.versions.find((version) => version.id === selectedId);

  const restore = () =>
    ask(
      "Restore this version?",
      "Your current document will be saved as a new snapshot before the selected version is restored.",
      () => {
        if (!selected) return;
        const backup: Version = {
          id: uid(),
          name: "Before restoration",
          date: now(),
          snapshot: copy({ ...doc, versions: [] }),
        };
        updateDoc(doc.id, {
          ...copy(selected.snapshot),
          id: doc.id,
          versions: [...doc.versions, backup],
        });
        go(`/editor/${doc.id}/Preview`);
        toast.success("Version restored. Previous draft preserved.");
      },
      "Restore version",
    );

  return (
    <>
      <button className="back-link" onClick={() => go(`/editor/${doc.id}/Preview`)}>
        <ArrowLeft size={18} />
        Your document
      </button>
      <PageTitle eyebrow="VERSION HISTORY" title="Nothing good gets lost.">
        Save a chapter. Compare the changes. Return when you need to.
      </PageTitle>
      <div className="history-layout">
        <aside>
          <FieldGroup>
            <TextField
              label="New version name"
              value={name}
              onChange={setName}
              placeholder={`Version ${doc.versions.length + 1}`}
            />
          </FieldGroup>
          <Btn
            onClick={() => {
              const version = snap(doc.id, name.trim() || `Version ${doc.versions.length + 1}`);
              if (version) setSelectedId(version.id);
              setName("");
              toast.success("Version saved");
            }}
            icon={Plus}
          >
            Save current version
          </Btn>
          <div className="version-list">
            {doc.versions
              .slice()
              .reverse()
              .map((version) => (
                <button
                  className={selectedId === version.id ? "version selected" : "version"}
                  onClick={() => setSelectedId(version.id)}
                  key={version.id}
                >
                  <HistoryIcon size={18} />
                  <span>
                    <strong>{version.name}</strong>
                    <small>{new Date(version.date).toLocaleString("en-US")}</small>
                  </span>
                  {selectedId === version.id && <Check size={16} />}
                </button>
              ))}
          </div>
        </aside>
        <div>
          {selected ? (
            <>
              <div className="section-head">
                <h2>Compare with current</h2>
                <Btn variant="outline" onClick={restore} icon={Undo2}>
                  Restore version
                </Btn>
              </div>
              <div className="comparison">
                <div>
                  <span className="eyebrow">{selected.name}</span>
                  <Paper doc={selected.snapshot} mini />
                </div>
                <div>
                  <span className="eyebrow">CURRENT DRAFT</span>
                  <Paper doc={doc} mini />
                </div>
              </div>
              <div className="comparison-summary">
                <h3>What changed</h3>
                {JSON.stringify(selected.snapshot.content) === JSON.stringify(doc.content) &&
                selected.snapshot.letter === doc.letter ? (
                  <p>No content changes since this snapshot.</p>
                ) : (
                  <>
                    {SECTION_KEYS.filter(
                      (key) => JSON.stringify(selected.snapshot.content[key]) !== JSON.stringify(doc.content[key]),
                    ).map((key) => (
                      <div className="diff-section" key={key}>
                        <h3>{SECTION_LABELS[key]}</h3>
                        <div className="diff-columns">
                          <pre>{sectionText(selected.snapshot.content[key])}</pre>
                          <pre>{sectionText(doc.content[key])}</pre>
                        </div>
                      </div>
                    ))}
                    {selected.snapshot.letter !== doc.letter && (
                      <p>Cover-letter text changed. Compare the document previews above.</p>
                    )}
                    {HEADER_FIELDS.filter((field) => selected.snapshot.content[field] !== doc.content[field]).map(
                      (field) => (
                        <p key={field}>
                          {field}
                          {": "}
                          {selected.snapshot.content[field] || "(empty)"}
                          {" → "}
                          {doc.content[field] || "(empty)"}
                        </p>
                      ),
                    )}
                  </>
                )}
                {LAYOUT_FIELDS.filter((field) => selected.snapshot[field] !== doc[field]).map((field) => (
                  <p key={field}>
                    {field}
                    {": "}
                    {selected.snapshot[field]}
                    {" → "}
                    {doc[field]}
                  </p>
                ))}
                {JSON.stringify(selected.snapshot.hidden) !== JSON.stringify(doc.hidden) && (
                  <p>Section visibility changed.</p>
                )}
                {JSON.stringify(selected.snapshot.order) !== JSON.stringify(doc.order) && (
                  <p>Section order changed.</p>
                )}
              </div>
            </>
          ) : (
            <Blank title="Your first snapshot belongs here.">Name a version before your next round of edits.</Blank>
          )}
        </div>
      </div>
    </>
  );
}
