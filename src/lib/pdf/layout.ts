/** A4 document layout engine shared by the on-screen preview and the PDF writer (ported from the prototype). */
import { SECTION_LABELS } from "@/state/factories";
import type { Doc, Entry, SectionKey } from "@/state/types";
import { GLYPH_WIDTHS, type FontKind } from "./glyphs";

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

export type DrawOp =
  | { type: "text"; text: string; x: number; y: number; size: number; font: FontKind; color: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; color: string }
  | { type: "rect"; x: number; y: number; w: number; h: number; color: string };

export interface Layout {
  pages: DrawOp[][];
  W: number;
  H: number;
  unsupported: boolean;
}

/** Normalise typographic characters to their ASCII equivalents. */
export const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/ /g, " ");

export const textWidth = (text: string, size: number, font: FontKind = "regular") =>
  ([...clean(text)].reduce((sum, ch) => sum + (GLYPH_WIDTHS[font][ch] || 556), 0) * size) / 1000;

export function wrap(text: string, maxWidth: number, size: number, font: FontKind = "regular"): string[] {
  const lines: string[] = [];
  for (const paragraph of clean(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (textWidth(word, size, font) > maxWidth) {
        if (line) {
          lines.push(line);
          line = "";
        }
        let chunk = "";
        for (const ch of word) {
          if (textWidth(chunk + ch, size, font) > maxWidth) {
            lines.push(chunk);
            chunk = "";
          }
          chunk += ch;
        }
        line = chunk;
        continue;
      }
      const candidate = line ? line + " " + word : word;
      if (textWidth(candidate, size, font) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function layoutDocument(doc: Doc): Layout {
  const margin = Number(doc.margin) || 46;
  const size = Number(doc.size) || 10.5;
  const lineHeight = size * (Number(doc.spacing) || 1.4);
  const width = PAGE_W - 2 * margin;
  const accent = doc.accent || "#000000";
  const pages: DrawOp[][] = [[]];
  let y = margin;
  let page = pages[0];

  const ensure = (needed: number) => {
    if (y + needed > PAGE_H - margin - 18) {
      page = [];
      pages.push(page);
      y = margin;
    }
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color = "#cccccc") =>
    page.push({ type: "line", x1, y1, x2, y2, color });
  const add = (
    text: string,
    fontSize = size,
    font: FontKind = "regular",
    color = "#000000",
    indent = 0,
    center = false,
  ) => {
    for (const row of wrap(text, width - indent, fontSize, font)) {
      ensure(Math.max(lineHeight, fontSize * 1.15));
      page.push({
        type: "text",
        text: row,
        x: center ? (PAGE_W - textWidth(row, fontSize, font)) / 2 : margin + indent,
        y: y + fontSize,
        size: fontSize,
        font,
        color,
      });
      y += Math.max(lineHeight, fontSize * 1.18);
    }
  };
  const gap = (amount: number) => {
    y += amount;
  };

  const content = doc.content;
  const centered = doc.template === "Classic";

  if (doc.template === "Executive") {
    page.push({ type: "rect", x: 0, y: 0, w: PAGE_W, h: 9, color: accent });
    gap(8);
  }
  add(content.name || "Your name", doc.template === "Minimal" ? 24 : 29, "bold", accent, 0, centered);
  gap(6);
  if (content.headline) add(content.headline.toUpperCase(), 11, "regular", "#000000", 0, centered);
  const contact = [content.location, content.links].filter(Boolean).join("  |  ");
  if (contact) {
    gap(3);
    add(contact, 9, "regular", "#000000", 0, centered);
  }
  gap(15);
  if (doc.template !== "Minimal") {
    line(margin, y, PAGE_W - margin, y, accent);
    gap(15);
  }

  if (doc.kind === "letter") {
    add(doc.company ? `To the hiring team at ${doc.company},` : "Dear hiring team,", size);
    gap(12);
    for (const paragraph of (doc.letter || "").split("\n\n")) {
      add(paragraph);
      gap(12);
    }
    gap(5);
    add("Sincerely,");
    add(content.name || "Your name");
  } else {
    let order: string[] = doc.order || Object.keys(SECTION_LABELS);
    if (doc.template === "Graduate")
      order = ["summary", "education", "projects", ...order.filter((k) => !["summary", "education", "projects"].includes(k))];
    if (doc.template === "Technical")
      order = ["summary", "skills", ...order.filter((k) => !["summary", "skills"].includes(k))];

    for (const key of order) {
      if (doc.hidden?.includes(key)) continue;
      const value = (content as unknown as Record<string, unknown>)[key] as string | Entry[] | undefined;
      if (!value || (Array.isArray(value) && !value.length)) continue;
      ensure(55);
      add(
        SECTION_LABELS[key as SectionKey]?.toUpperCase() || key.toUpperCase(),
        doc.template === "Minimal" ? 9 : 10,
        doc.template === "Technical" ? "mono" : "bold",
        accent,
      );
      gap(8);
      if (typeof value === "string") {
        add(value);
        gap(16);
      } else {
        for (const entry of value) {
          ensure(45);
          add(entry.title || "Untitled entry", size, "bold");
          if (entry.org || entry.dates) add([entry.org, entry.dates].filter(Boolean).join("  |  "), size - 0.5);
          gap(5);
          const bulleted = key === "experience" || key === "projects";
          for (const bullet of (entry.body || "").split("\n").filter(Boolean))
            add((bulleted ? "- " : "") + bullet, size, "regular", "#000000", bulleted ? 5 : 0);
          gap(13);
        }
      }
    }
  }

  pages.forEach((ops, index) => {
    if (pages.length > 1)
      ops.push({
        type: "text",
        text: `${index + 1} / ${pages.length}`,
        x: PAGE_W - margin - 25,
        y: PAGE_H - 25,
        size: 8,
        font: "regular",
        color: "#444444",
      });
  });

  return {
    pages,
    W: PAGE_W,
    H: PAGE_H,
    unsupported: pages.some((ops) => ops.some((op) => op.type === "text" && /[^\u0000-ÿ]/.test(op.text))),
  };
}
