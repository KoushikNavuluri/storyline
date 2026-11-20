import { toast } from "sonner";
import { Archive, Clock, Copy, Download, PenLine, Trash2 } from "lucide-react";
import { Btn, PageTitle, Paper, Pick, Row, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { copy, now, uid } from "@/state/factories";
import type { Doc } from "@/state/types";

export function DocumentDetail({ doc }: { doc: Doc }) {
  const { go, updateDoc, update, ask } = useStudio();
  const duplicate = () => {
    const duplicateDoc: Doc = {
      ...copy(doc),
      id: uid(),
      title: doc.title + " (copy)",
      versions: [],
      archived: false,
      created: now(),
      updated: now(),
    };
    update((state) => ({
      ...state,
      docs: [duplicateDoc, ...state.docs],
    }));
    go("/editor/" + duplicateDoc.id + "/Content");
    toast.success("Independent copy created");
  };
  return (
    <div className="detail-split">
      <div>
        <PageTitle eyebrow={doc.kind === "letter" ? "COVER LETTER" : "RESUME"} title="A story worth keeping." />
        <FieldGroup>
          <TextField
            label="Document title"
            value={doc.title}
            onChange={(value) =>
              updateDoc(doc.id, {
                title: value,
              })
            }
          />
          <TextField
            label="Target company"
            value={doc.company}
            onChange={(value) =>
              updateDoc(doc.id, {
                company: value,
              })
            }
          />
          <TextField
            label="Target role"
            value={doc.role}
            onChange={(value) =>
              updateDoc(doc.id, {
                role: value,
              })
            }
          />
          <Pick
            label="Status"
            value={doc.status}
            onChange={(value) =>
              updateDoc(doc.id, {
                status: value,
              })
            }
            options={["Draft", "Ready"]}
          />
        </FieldGroup>
        <div className="actions">
          <Btn onClick={() => go("/editor/" + doc.id + "/Content")} icon={PenLine}>
            Open editor
          </Btn>
          <Btn variant="outline" onClick={() => go("/export/" + doc.id)} icon={Download}>
            Export
          </Btn>
        </div>
        <Row
          icon={Clock}
          title="Version history"
          sub={`${doc.versions.length} saved snapshots`}
          onClick={() => go("/history/" + doc.id)}
        />
        <Row icon={Copy} title="Duplicate document" sub="Start with an independent copy" onClick={duplicate} />
        <Row
          icon={Archive}
          title={doc.archived ? "Restore document" : "Archive document"}
          sub="Keep it, outside your active library"
          onClick={() =>
            ask(
              doc.archived ? "Restore this document?" : "Archive this document?",
              doc.title,
              () => {
                updateDoc(doc.id, {
                  archived: !doc.archived,
                });
                go("/docs");
              },
              doc.archived ? "Restore" : "Archive",
            )
          }
        />
        <Row
          icon={Trash2}
          title="Delete document"
          sub="Application snapshots already linked will be preserved"
          onClick={() =>
            ask(
              "Delete this document?",
              `Delete “${doc.title}” and its ${doc.versions.length} saved versions? Existing application snapshots remain intact.`,
              () => {
                update((state) => ({
                  ...state,
                  docs: state.docs.filter((item) => item.id !== doc.id),
                }));
                go("/docs");
                toast("Document deleted", {
                  action: {
                    label: "Undo",
                    onClick: () =>
                      update((state) => ({
                        ...state,
                        docs: [doc, ...state.docs],
                      })),
                  },
                });
              },
              "Delete document",
            )
          }
        />
      </div>
      <div className="detail-paper cream">
        <Paper doc={doc} />
      </div>
    </div>
  );
}
