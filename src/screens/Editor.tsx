import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CircleQuestionMark,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  Minus,
  PenLine,
  Plus,
  Redo2,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Blank, Btn, Choices, IconBtn, Modal, Notice, PageTitle, Paper, Pick, Row, TextField } from "@/components/ui/app";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  FieldGroup,
  Input,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { copy, now, SECTION_LABELS, uid } from "@/state/factories";
import type { Doc, Entry, Profile, SectionKey, Suggestion } from "@/state/types";
import { suggestionsFor } from "@/lib/keywords";
import { layoutDocument } from "@/lib/pdf/layout";
import { ai, AIError } from "@/lib/ai";
import { Insights } from "./Insights";

type EditorTab = "Content" | "Preview" | "Insights";
type Workspace = "Edit" | "Changes" | "Job";
type EntryField = "title" | "org" | "dates" | "body";

const EDITOR_TABS: EditorTab[] = ["Content", "Preview", "Insights"];
/** Edits closer together than this are merged into one undo step. */
const UNDO_MERGE_MS = 650;
const UNDO_LIMIT = 50;

export function Editor({ doc, tab }: { doc: Doc; tab: string }) {
  const { state, go, updateDoc, snap, update, ask } = useStudio();
  const [workspace, setWorkspace] = useState<Workspace>(
    doc.suggestions?.some((s) => s.state === "pending") ? "Changes" : "Edit",
  );
  const [stylingOpen, setStylingOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [highlight, setHighlight] = useState("");
  const [versionName, setVersionName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const undoStack = useRef<Doc[]>([]);
  const redoStack = useRef<Doc[]>([]);
  const lastCommit = useRef(0);
  const [, setTick] = useState(0);
  const layout = useMemo(() => layoutDocument(doc), [doc]);
  const activeTab: EditorTab = (EDITOR_TABS as string[]).includes(tab) ? (tab as EditorTab) : "Content";

  /** Apply a patch to this document, recording an undo step (rapid edits are merged). */
  const commit = (patch: Partial<Doc>) => {
    if (Date.now() - lastCommit.current > UNDO_MERGE_MS) {
      undoStack.current.push(copy(doc));
      if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    }
    lastCommit.current = Date.now();
    redoStack.current = [];
    updateDoc(doc.id, patch);
    setTick((t) => t + 1);
  };

  const historyAction = (direction: "undo" | "redo") => {
    const from = direction === "undo" ? undoStack : redoStack;
    const to = direction === "undo" ? redoStack : undoStack;
    if (!from.current.length) return;
    to.current.push(copy(doc));
    const previous = from.current.pop() as Doc;
    updateDoc(doc.id, {
      ...previous,
      versions: doc.versions,
    });
    lastCommit.current = 0;
    setTick((t) => t + 1);
  };

  const setContent = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    commit({
      content: {
        ...doc.content,
        [key]: value,
      },
    });

  const generate = () => {
    if (!doc.jd.trim()) {
      go(`/editor/${doc.id}/Content`);
      setWorkspace("Job");
      toast.error("Add a job description before reviewing suggestions.");
      return;
    }
    const action = async () => {
      setReviewing(true);
      let suggestions: Suggestion[];
      let fromAI = false;
      try {
        const result = await ai.suggestions(doc);
        suggestions = result.map((s) => ({ ...s, id: uid(), state: "pending" as const }));
        fromAI = true;
      } catch (e) {
        suggestions = suggestionsFor(doc);
        toast(
          e instanceof AIError && e.status === 429
            ? "Daily assistance limit reached. Used the built-in rules instead."
            : "Assistance is unavailable right now. Used the built-in rules instead.",
        );
      }
      setReviewing(false);
      commit({
        suggestions,
      });
      if (fromAI)
        update((s) => ({
          ...s,
          usage: [
            ...s.usage,
            {
              id: uid(),
              date: now(),
              action: "Wording review",
            },
          ],
        }));
      setWorkspace("Changes");
      go(`/editor/${doc.id}/Content`);
      toast(
        suggestions.length
          ? `${suggestions.length} suggestions ready`
          : "No automatic wording changes found. You can still edit every section.",
      );
    };
    if (doc.suggestions.some((s) => s.state === "pending"))
      ask(
        "Replace pending suggestions?",
        "Accepted edits stay in your document. Pending suggestions will be recomputed from the current text.",
        action,
        "Refresh suggestions",
      );
    else action();
  };

  const accept = (suggestion: Suggestion, accepted: boolean) => {
    const content = copy(doc.content);
    if (accepted) {
      const section = content[suggestion.section];
      const entry = Array.isArray(section) ? section.find((x) => x.id === suggestion.entry) : undefined;
      if (!entry || entry.body.split("\n")[suggestion.index] !== suggestion.before) {
        toast.error("This text has changed. Refresh the suggestions before applying this one.");
        return;
      }
      const lines = entry.body.split("\n");
      lines[suggestion.index] = suggestion.after;
      entry.body = lines.join("\n");
    }
    lastCommit.current = 0;
    commit({
      content,
      suggestions: doc.suggestions.map((s) =>
        s.id === suggestion.id
          ? {
              ...s,
              state: accepted ? "accepted" : "rejected",
            }
          : s,
      ),
    });
    toast(accepted ? "Your wording has been updated." : "Original wording kept.");
  };

  const move = (index: number, offset: number) => {
    const order = [...doc.order];
    [order[index], order[index + offset]] = [order[index + offset], order[index]];
    lastCommit.current = 0;
    commit({
      order,
    });
  };

  const preview = (
    <div className="preview-region">
      <div className="preview-toolbar">
        <button className="text-link" onClick={() => go("/templates/" + doc.id)}>
          {doc.template}
          <ChevronDown size={16} />
        </button>
        <span className="eyebrow">
          {layout.pages.length} {layout.pages.length === 1 ? "PAGE" : "PAGES"}
          {" / A4"}
        </span>
        <IconBtn icon={Settings2} label="Document styling" onClick={() => setStylingOpen(true)} />
      </div>
      <div className="preview-scroll">
        <div
          className="zoom-canvas"
          style={{
            width: `${zoom}%`,
          }}
        >
          <Paper doc={doc} highlight={highlight} />
        </div>
      </div>
      <div className="zoom-toolbar">
        <IconBtn
          icon={Minus}
          label="Zoom out"
          disabled={zoom <= 65}
          onClick={() => setZoom((z) => Math.max(65, z - 15))}
        />
        <span>{zoom}%</span>
        <IconBtn
          icon={Plus}
          label="Zoom in"
          disabled={zoom >= 175}
          onClick={() => setZoom((z) => Math.min(175, z + 15))}
        />
        <button className="text-link" onClick={() => setZoom(100)}>
          Fit
        </button>
      </div>
    </div>
  );

  const contentPanel = (
    <div className="content-panel">
      {activeTab === "Insights" ? (
        <Insights
          doc={doc}
          onHighlight={(term) => {
            setHighlight(term);
            go(`/editor/${doc.id}/Preview`);
          }}
          onSection={(section) => {
            setWorkspace("Edit");
            go(`/editor/${doc.id}/Content`);
            setTimeout(
              () =>
                document.getElementById("section-" + section)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                }),
              50,
            );
          }}
        />
      ) : activeTab === "Preview" ? (
        <>
          <PageTitle eyebrow="YOUR DOCUMENT" title="Let your work speak.">
            A faithful view of your next resume.
          </PageTitle>
          <Row
            icon={Settings2}
            title="Typography & spacing"
            sub="Make room without making it tiny"
            onClick={() => setStylingOpen(true)}
          />
          <Row
            icon={FileText}
            title="Choose a template"
            sub={doc.template + " · content stays intact"}
            onClick={() => go("/templates/" + doc.id)}
          />
          <Row
            icon={PenLine}
            title="Back to the words"
            sub="Edit any section of your resume"
            onClick={() => {
              setWorkspace("Edit");
              go(`/editor/${doc.id}/Content`);
            }}
          />
          {layout.pages.length > 1 && (
            <Notice title={`${layout.pages.length} pages, no hidden overflow`}>
              Inspect each page before exporting. You can adjust spacing or remove less relevant content.
            </Notice>
          )}
          <Btn onClick={() => go("/export/" + doc.id)} icon={Download}>
            Review and export
          </Btn>
        </>
      ) : (
        <>
          <Choices value={workspace} onChange={setWorkspace} options={["Edit", "Changes", "Job"]} label="Content workspace" />
          {workspace === "Job" ? (
            <>
              <PageTitle eyebrow="THE OPPORTUNITY" title="Keep the role in focus." />
              <FieldGroup>
                <TextField
                  label="Company"
                  value={doc.company}
                  onChange={(value) =>
                    commit({
                      company: value,
                    })
                  }
                />
                <TextField
                  label="Role"
                  value={doc.role}
                  onChange={(value) =>
                    commit({
                      role: value,
                    })
                  }
                />
                <TextField
                  area
                  label="Job description"
                  value={doc.jd}
                  onChange={(value) =>
                    commit({
                      jd: value,
                      requirements: null,
                    })
                  }
                  rows={12}
                />
              </FieldGroup>
              <Btn onClick={generate} icon={Sparkles} disabled={reviewing}>
                {reviewing ? "Reviewing…" : "Review suggestions"}
              </Btn>
            </>
          ) : workspace === "Changes" ? (
            <>
              <PageTitle eyebrow="WRITING ASSISTANCE" title="Sharper words. Same story.">
                You decide what makes the final cut.
              </PageTitle>
              <p className="fine-print">
                Writing assistance (Gemini). It works only from your own profile and never adds experience, metrics, or
                qualifications. You review every change.
              </p>
              {doc.suggestions.length ? (
                doc.suggestions.map((suggestion) => (
                  <div className={"suggestion " + suggestion.state} key={suggestion.id}>
                    <div className="section-head">
                      <span className="eyebrow">
                        {SECTION_LABELS[suggestion.section]}
                        {" / "}
                        {suggestion.reason}
                      </span>
                      {suggestion.state !== "pending" && <Badge variant="outline">{suggestion.state}</Badge>}
                    </div>
                    <span className="eyebrow">BEFORE</span>
                    <p className="before-text">{suggestion.before}</p>
                    <div className="suggested mint">
                      <span className="eyebrow">SUGGESTED</span>
                      {suggestion.state === "pending" ? (
                        <TextField
                          area
                          label="Proposed wording"
                          value={suggestion.after}
                          onChange={(value) =>
                            commit({
                              suggestions: doc.suggestions.map((s) =>
                                s.id === suggestion.id
                                  ? {
                                      ...s,
                                      after: value,
                                    }
                                  : s,
                              ),
                            })
                          }
                          rows={3}
                        />
                      ) : (
                        <p>{suggestion.after}</p>
                      )}
                      <p className="fine-print">{suggestion.explanation}</p>
                    </div>
                    {suggestion.state === "pending" && (
                      <div className="actions">
                        <Btn variant="outline" onClick={() => accept(suggestion, false)}>
                          Keep original
                        </Btn>
                        <Btn disabled={!suggestion.after.trim()} onClick={() => accept(suggestion, true)} icon={Check}>
                          Accept change
                        </Btn>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <Blank title="No automatic wording changes found.">
                  Your text is preserved. Use the editor to refine it directly.
                </Blank>
              )}
              <div className="metric-prompt">
                <CircleQuestionMark />
                <div>
                  <h3>Could a real outcome help?</h3>
                  <p>If you know the result, add it to the relevant experience. We won’t invent a number.</p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setWorkspace("Edit");
                    }}
                  >
                    {"Edit my experience "}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              <div className="actions">
                <Btn variant="outline" onClick={generate} icon={Sparkles} disabled={reviewing}>
                  {reviewing ? "Reviewing…" : "Refresh review"}
                </Btn>
                <Btn onClick={() => go(`/editor/${doc.id}/Preview`)} icon={ArrowRight}>
                  Continue to preview
                </Btn>
              </div>
            </>
          ) : (
            <>
              <div className="section-head">
                <div>
                  <span className="eyebrow">YOUR WORDS, YOUR WAY</span>
                  <h2>The story itself.</h2>
                </div>
                <IconBtn icon={Sparkles} label="Review wording suggestions" onClick={generate} disabled={reviewing} />
              </div>
              <Accordion type="multiple" defaultValue={["header", "summary", "experience", "letter"]}>
                <AccordionItem value="header">
                  <AccordionTrigger>Contact & headline</AccordionTrigger>
                  <AccordionContent>
                    <FieldGroup>
                      <TextField label="Name" value={doc.content.name} onChange={(value) => setContent("name", value)} />
                      <TextField
                        label="Headline"
                        value={doc.content.headline}
                        onChange={(value) => setContent("headline", value)}
                      />
                      <TextField
                        label="Location"
                        value={doc.content.location}
                        onChange={(value) => setContent("location", value)}
                      />
                      <TextField
                        label="Professional links"
                        value={doc.content.links}
                        onChange={(value) => setContent("links", value)}
                      />
                    </FieldGroup>
                  </AccordionContent>
                </AccordionItem>
                {doc.kind === "letter" ? (
                  <AccordionItem value="letter">
                    <AccordionTrigger>Cover letter</AccordionTrigger>
                    <AccordionContent>
                      <TextField
                        area
                        label="Letter body"
                        value={doc.letter}
                        onChange={(value) =>
                          commit({
                            letter: value,
                          })
                        }
                        rows={18}
                        hint="Review and edit every paragraph. The greeting and signature are added in the preview."
                      />
                    </AccordionContent>
                  </AccordionItem>
                ) : (
                  doc.order.map((key, index) => (
                    <SectionItem
                      key={key}
                      sectionKey={key}
                      index={index}
                      doc={doc}
                      onToggleHidden={() =>
                        commit({
                          hidden: doc.hidden.includes(key)
                            ? doc.hidden.filter((h) => h !== key)
                            : [...doc.hidden, key],
                        })
                      }
                      onMove={move}
                      onChange={(value) => setContent(key, value)}
                      onRemoveEntry={(entry, entries) =>
                        ask(
                          "Remove this entry from the resume?",
                          "Your master profile is not affected.",
                          () =>
                            setContent(
                              key,
                              entries.filter((e) => e.id !== entry.id),
                            ),
                          "Remove entry",
                        )
                      }
                    />
                  ))
                )}
              </Accordion>
              <Notice title="Independent from your profile">
                These edits change this document only. Your master profile and other resumes stay untouched.
              </Notice>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="workspace">
      <div className="editor-header">
        <IconBtn icon={ArrowLeft} label="Back to documents" onClick={() => go("/docs")} />
        <div className="editor-name">
          <Input
            aria-label="Resume title"
            value={doc.title}
            onChange={(event) =>
              commit({
                title: event.target.value,
              })
            }
          />
          <span>
            {doc.company || "General resume"}
            {" · "}
            {doc.role || doc.content.headline}
          </span>
        </div>
        <div className="editor-header-actions">
          <IconBtn
            icon={Undo2}
            label="Undo edit"
            disabled={!undoStack.current.length}
            onClick={() => historyAction("undo")}
          />
          <IconBtn
            icon={Redo2}
            label="Redo edit"
            disabled={!redoStack.current.length}
            onClick={() => historyAction("redo")}
          />
          <IconBtn icon={History} label="Version history" onClick={() => go("/history/" + doc.id)} />
          <Btn variant="outline" onClick={() => setSaveOpen(true)}>
            Save version
          </Btn>
          <Btn onClick={() => go("/export/" + doc.id)} icon={Download}>
            Export
          </Btn>
        </div>
      </div>
      <div className="editor-tabs">
        <Choices
          value={activeTab}
          onChange={(next) => go(`/editor/${doc.id}/${next}`)}
          options={["Content", "Preview", "Insights"]}
          label="Resume workspace"
        />
        <span className="desktop-only privacy-caption">
          <Check size={15} />
          Changes save automatically
        </span>
      </div>
      <div className={"editor-split tab-" + activeTab.toLowerCase()}>
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={45} minSize={30}>
            {contentPanel}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={55} minSize={35}>
            {preview}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="mobile-editor">{activeTab === "Preview" ? preview : contentPanel}</div>
      <Modal
        title="Document styling"
        description="Sensible limits keep your resume readable. The paper preview updates immediately."
        open={stylingOpen}
        onClose={() => setStylingOpen(false)}
        footer={
          <Btn onClick={() => setStylingOpen(false)} icon={Check}>
            Done
          </Btn>
        }
      >
        <FieldGroup>
          <Pick
            label="Body type size"
            value={String(doc.size)}
            onChange={(value) =>
              commit({
                size: Number(value),
              })
            }
            options={["9", "10", "10.5", "11", "12"]}
          />
          <Pick
            label="Line spacing"
            value={String(doc.spacing)}
            onChange={(value) =>
              commit({
                spacing: Number(value),
              })
            }
            options={["1.2", "1.3", "1.4", "1.5", "1.6"]}
          />
          <Pick
            label="Page margins"
            value={String(doc.margin)}
            onChange={(value) =>
              commit({
                margin: Number(value),
              })
            }
            options={[
              {
                value: "34",
                label: "Compact · 12 mm",
              },
              {
                value: "46",
                label: "Balanced · 16 mm",
              },
              {
                value: "58",
                label: "Generous · 20 mm",
              },
            ]}
          />
          <Pick
            label="Heading accent"
            value={doc.accent}
            onChange={(value) =>
              commit({
                accent: value,
              })
            }
            options={[
              {
                value: "#000000",
                label: "Ink black",
              },
              {
                value: "#24243f",
                label: "Deep navy",
              },
            ]}
          />
        </FieldGroup>
        <Btn
          variant="outline"
          onClick={() =>
            commit({
              size: 10.5,
              spacing: 1.4,
              margin: 46,
              accent: "#000000",
            })
          }
        >
          Reset styling
        </Btn>
      </Modal>
      <Modal
        title="Save a version"
        description="Create a fixed snapshot. Future edits won’t change it."
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        footer={
          <Btn
            onClick={() => {
              snap(doc.id, versionName.trim() || `Version ${doc.versions.length + 1}`);
              setSaveOpen(false);
              setVersionName("");
              toast.success("Version saved");
            }}
            icon={Check}
          >
            Save version
          </Btn>
        }
      >
        <TextField
          label="Version name"
          value={versionName}
          onChange={setVersionName}
          placeholder={`Version ${doc.versions.length + 1}`}
        />
      </Modal>
    </div>
  );
}

const ENTRY_FIELDS = (key: SectionKey): [EntryField, string][] => [
  ["title", key === "experience" ? "Role" : "Title"],
  ["org", key === "education" ? "Institution" : "Organization"],
  ["dates", "Dates"],
  ["body", "Highlights · one per line"],
];

/** One reorderable, hideable resume section inside the editor accordion (same markup as the prototype's inline map). */
function SectionItem({
  sectionKey: key,
  index,
  doc,
  onToggleHidden,
  onMove,
  onChange,
  onRemoveEntry,
}: {
  sectionKey: SectionKey;
  index: number;
  doc: Doc;
  onToggleHidden: () => void;
  onMove: (index: number, offset: number) => void;
  onChange: (value: string | Entry[]) => void;
  onRemoveEntry: (entry: Entry, entries: Entry[]) => void;
}) {
  const hidden = doc.hidden.includes(key);
  const value: string | Entry[] = doc.content[key];
  return (
    <AccordionItem value={key} id={"section-" + key}>
      <div className="section-heading">
        <AccordionTrigger>
          {SECTION_LABELS[key]}
          {hidden && <EyeOff size={15} />}
        </AccordionTrigger>
        <div className="section-actions">
          <IconBtn icon={hidden ? EyeOff : Eye} label={(hidden ? "Show " : "Hide ") + SECTION_LABELS[key]} onClick={onToggleHidden} />
          <IconBtn icon={ArrowUp} label={"Move " + key + " up"} disabled={index === 0} onClick={() => onMove(index, -1)} />
          <IconBtn
            icon={ArrowDown}
            label={"Move " + key + " down"}
            disabled={index === doc.order.length - 1}
            onClick={() => onMove(index, 1)}
          />
        </div>
      </div>
      <AccordionContent>
        {hidden && <p className="fine-print">Hidden from this resume. Your content is preserved.</p>}
        {typeof value == "string" ? (
          <TextField
            area
            label={SECTION_LABELS[key]}
            value={value}
            onChange={(next) => onChange(next)}
            rows={key === "summary" ? 5 : 3}
          />
        ) : (
          <>
            {value.map((entry, entryIndex) => (
              <div className="resume-entry" key={entry.id}>
                <div className="section-head">
                  <span className="eyebrow">
                    {"ENTRY "}
                    {entryIndex + 1}
                  </span>
                  <div className="entry-controls">
                    <IconBtn
                      icon={ArrowUp}
                      label={"Move entry " + (entryIndex + 1) + " up"}
                      disabled={entryIndex === 0}
                      onClick={() => {
                        const entries = copy(value);
                        [entries[entryIndex], entries[entryIndex - 1]] = [entries[entryIndex - 1], entries[entryIndex]];
                        onChange(entries);
                      }}
                    />
                    <IconBtn
                      icon={Trash2}
                      label={"Remove " + (entry.title || "entry")}
                      onClick={() => onRemoveEntry(entry, value)}
                    />
                  </div>
                </div>
                <FieldGroup>
                  {ENTRY_FIELDS(key).map(([field, label]) => (
                    <TextField
                      label={label}
                      area={field === "body"}
                      rows={field === "body" ? 5 : undefined}
                      value={entry[field]}
                      onChange={(next) =>
                        onChange(
                          value.map((other) =>
                            other.id === entry.id
                              ? {
                                  ...other,
                                  [field]: next,
                                }
                              : other,
                          ),
                        )
                      }
                      key={field}
                    />
                  ))}
                </FieldGroup>
              </div>
            ))}
            <Btn
              variant="outline"
              onClick={() =>
                onChange([
                  ...value,
                  {
                    id: uid(),
                    title: "",
                    org: "",
                    dates: "",
                    body: "",
                  },
                ])
              }
              icon={Plus}
            >
              Add entry
            </Btn>
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
