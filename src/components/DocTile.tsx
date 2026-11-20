import { ArrowUpRight } from "lucide-react";
import { Paper } from "@/components/ui/app";
import { Badge } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { dateLabel } from "@/lib/download";
import type { Doc } from "@/state/types";

export function DocTile({ doc, index = 0 }: { doc: Doc; index?: number }) {
  const { go } = useStudio();
  return (
    <button className="doc-tile" onClick={() => go(`/editor/${doc.id}/Preview`)}>
      <div className={`doc-thumbnail surface-${index % 3}`}>
        <Paper doc={doc} mini />
        <span className="doc-open">
          <ArrowUpRight />
        </span>
      </div>
      <div className="doc-meta">
        <h3>{doc.title}</h3>
        <Badge variant="outline">{doc.status}</Badge>
      </div>
      <p>
        {doc.kind === "letter" ? "Cover letter" : doc.template}
        {" · Edited "}
        {dateLabel(doc.updated)}
      </p>
    </button>
  );
}
