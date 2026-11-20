import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CircleQuestionMark, Eye, FileText, PenLine } from "lucide-react";
import { Notice, PageTitle, Row } from "@/components/ui/app";
import { useStudio } from "@/state/context";
import { now, uid } from "@/state/factories";
import type { Doc, SectionKey } from "@/state/types";
import { analyse, extractRequirements } from "@/lib/keywords";
import { layoutDocument } from "@/lib/pdf/layout";
import { ai } from "@/lib/ai";

export interface InsightsProps {
  doc: Doc;
  /** Highlight a term in the preview ("" just opens the preview). */
  onHighlight: (term: string) => void;
  /** Jump to a section in the editor. */
  onSection: (section: SectionKey) => void;
}

/** 32-bit FNV-1a hash, hex encoded. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Hash of what the advice depends on: job description, requirements and visible content. */
function analysisHash(doc: Doc): string {
  const visible: Record<string, unknown> = { ...doc.content };
  for (const key of doc.hidden) {
    if (key in visible) visible[key] = Array.isArray(visible[key]) ? [] : "";
  }
  return fnv1a(
    JSON.stringify([doc.jd, doc.requirements || extractRequirements(doc.jd), visible, doc.kind === "letter" ? doc.letter : ""]),
  );
}

export function Insights({ doc, onHighlight, onSection }: InsightsProps) {
  const { state, update, updateDoc } = useStudio();
  const { results, score } = analyse(doc, state.profile);
  const layout = useMemo(() => layoutDocument(doc), [doc]);
  const hash = useMemo(() => analysisHash(doc), [doc]);
  const [loading, setLoading] = useState(false);
  const requested = useRef("");

  const current = doc.analysis && doc.analysis.hash === hash ? doc.analysis : null;
  const adviceFor = (term: string) =>
    current?.advice.find((item) => item.term.trim().toLowerCase() === term.trim().toLowerCase())?.advice;

  useEffect(() => {
    if (!doc.jd.trim() || !results.length) return;
    if (doc.analysis?.hash === hash || requested.current === hash) return;
    requested.current = hash;
    setLoading(true);
    ai.insights({
      jd: doc.jd,
      role: doc.role,
      results: results.map(({ term, state: match, preferred }) => ({ term, state: match, preferred })),
      summary: doc.content.summary,
    })
      .then((result) => {
        updateDoc(doc.id, {
          analysis: {
            hash,
            date: now(),
            advice: Array.isArray(result?.advice) ? result.advice : [],
            summaryTip: result?.summaryTip,
          },
        });
        update((s) => ({
          ...s,
          usage: [...s.usage, { id: uid(), date: now(), action: "Keyword insights" }],
        }));
      })
      .catch(() => {
        // Background request: fall back to the built-in advice quietly.
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, doc.id]);

  return (
    <>
      <PageTitle eyebrow="ANALYSIS / NOT AN ATS RESULT" title="A clearer picture." />
      <div className="match-block lime">
        <div className="match-number">
          {score ?? "—"}
          <span>{score !== null ? "/ 100" : ""}</span>
        </div>
        <h2>Estimated keyword match</h2>
        <p>
          {score !== null
            ? `${results.filter((r) => r.state === "highlighted").length} of ${results.length} reviewed phrases found in visible resume content.`
            : "Add a job description and review its requirements to see an estimate."}
        </p>
        <small>Literal keyword coverage, not an employer score or a prediction of interviews.</small>
      </div>
      <h3>Already in your story</h3>
      <div className="keyword-chips">
        {results
          .filter((r) => r.state === "highlighted")
          .map((r) => (
            <button onClick={() => onHighlight(r.term)} key={r.term}>
              <Check size={15} />
              {r.term}
            </button>
          ))}
      </div>
      <h3>Focus here next</h3>
      {loading && <p className="fine-print">Writing assistance is reviewing these phrases…</p>}
      {results
        .filter((r) => r.state !== "highlighted")
        .map((r) => (
          <div className="insight-row" key={r.term}>
            {r.state === "available" ? <Eye /> : <CircleQuestionMark />}
            <div>
              <span className="eyebrow">
                {r.state === "available" ? "PRESENT, NOT HIGHLIGHTED" : "NOT FOUND IN PROFILE"}
              </span>
              <h3>{r.term}</h3>
              <p>
                {adviceFor(r.term) ||
                  (r.state === "available"
                    ? "Your profile contains evidence worth bringing forward."
                    : "Only add this if you actually have this qualification.")}
              </p>
              <button className="text-link" onClick={() => onSection("skills")}>
                {"Review skills "}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      <div className="insight-row">
        <FileText />
        <div>
          <span className="eyebrow">FORMATTING</span>
          <h3>
            {layout.pages.length} {layout.pages.length === 1 ? "page" : "pages"}, flowing without clipping
          </h3>
          <p>
            {doc.size < 10
              ? "Small text: consider 10 pt or larger for comfortable reading."
              : "Readable type size. Inspect every page before exporting."}
          </p>
          <button className="text-link" onClick={() => onHighlight("")}>
            {"Inspect the document "}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      {!doc.content.summary && (
        <Row
          icon={PenLine}
          title="A summary could give useful context"
          sub={current?.summaryTip || "Write it only if it adds to your story"}
          onClick={() => onSection("summary")}
        />
      )}
      <Notice title="No keyword stuffing">
        Coverage is a rough signal. Evidence and clear writing matter more than repeating a phrase.
      </Notice>
    </>
  );
}
