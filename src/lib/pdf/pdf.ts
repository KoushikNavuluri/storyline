/** Dependency-free PDF 1.4 writer using the built-in Type1 fonts (ported from the prototype). */
import type { Doc } from "@/state/types";
import { downloadBlob } from "@/lib/download";
import { clean, layoutDocument } from "./layout";

const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(3)).join(" ");
};

const escapePdf = (text: string) => clean(text).replace(/([\\()])/g, "\\$1");

export const LATIN_ONLY_MESSAGE =
  "This PDF engine supports Latin-script text. Export your data to preserve other scripts; use Latin text for this PDF.";

export function createPdf(doc: Doc): Blob {
  const { pages, W, H, unsupported } = layoutDocument(doc);
  if (unsupported) throw new Error(LATIN_ONLY_MESSAGE);

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    ...["Helvetica", "Helvetica-Bold", "Courier"].map(
      (font) => `<< /Type /Font /Subtype /Type1 /BaseFont /${font} /Encoding /WinAnsiEncoding >>`,
    ),
  ];
  const kids: string[] = [];

  for (const ops of pages) {
    const stream = ops
      .map((op) =>
        op.type === "line"
          ? `${rgb(op.color)} RG 0.65 w ${op.x1} ${H - op.y1} m ${op.x2} ${H - op.y2} l S`
          : op.type === "rect"
            ? `${rgb(op.color)} rg ${op.x} ${H - op.y - op.h} ${op.w} ${op.h} re f`
            : `BT /${op.font === "bold" ? "F2" : op.font === "mono" ? "F3" : "F1"} ${op.size} Tf ${rgb(op.color)} rg 1 0 0 1 ${op.x.toFixed(2)} ${(H - op.y).toFixed(2)} Tm (${escapePdf(op.text)}) Tj ET`,
      )
      .join("\n");
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = out.length;
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 255)], { type: "application/pdf" });
}

export function exportPdf(doc: Doc, fileName: string) {
  downloadBlob(createPdf(doc), fileName.replace(/[\\/:*?"<>|]/g, "-").replace(/\.pdf$/i, "") + ".pdf");
}
