import { describe, expect, it } from "vitest";
import { layoutDocument, wrap } from "@/lib/pdf/layout";
import { createPdf } from "@/lib/pdf/pdf";
import { makeDoc, SAMPLE_PROFILE } from "@/state/factories";

describe("layoutDocument", () => {
  it("lays out the sample resume on A4", () => {
    const layout = layoutDocument(makeDoc(SAMPLE_PROFILE));
    expect(layout.W).toBeCloseTo(595.28);
    expect(layout.pages.length).toBeGreaterThanOrEqual(1);
    const texts = layout.pages.flat().filter((op) => op.type === "text").map((op) => (op as { text: string }).text);
    expect(texts).toContain("Alex Morgan");
    expect(texts).toContain("EXPERIENCE");
    expect(layout.unsupported).toBe(false);
  });

  it("paginates long documents and numbers pages", () => {
    const long = {
      ...SAMPLE_PROFILE,
      experience: Array.from({ length: 12 }, (_, i) => ({
        id: `e${i}`,
        title: `Role ${i}`,
        org: "Org",
        dates: "2020",
        body: Array.from({ length: 6 }, () => "Designed and shipped a thoughtful workflow for a complex product.").join("\n"),
      })),
    };
    const layout = layoutDocument(makeDoc(long));
    expect(layout.pages.length).toBeGreaterThan(1);
    const last = layout.pages[layout.pages.length - 1];
    expect(last.some((op) => op.type === "text" && op.text === `${layout.pages.length} / ${layout.pages.length}`)).toBe(true);
  });

  it("puts the letter greeting and sign-off around the body", () => {
    const letter = makeDoc(SAMPLE_PROFILE, { kind: "letter", company: "Northstar", letter: "First paragraph.\n\nSecond paragraph." });
    const texts = layoutDocument(letter).pages.flat().filter((op) => op.type === "text").map((op) => (op as { text: string }).text);
    expect(texts).toContain("To the hiring team at Northstar,");
    expect(texts).toContain("Sincerely,");
  });

  it("wraps long words", () => {
    expect(wrap("a".repeat(400), 100, 10).length).toBeGreaterThan(1);
  });
});

describe("createPdf", () => {
  it("writes a valid single-file PDF", async () => {
    const blob = createPdf(makeDoc(SAMPLE_PROFILE));
    expect(blob.type).toBe("application/pdf");
    const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("(Alex Morgan) Tj");
    const xref = Number(text.match(/startxref\n(\d+)/)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
  });

  it("refuses non-Latin text instead of corrupting it", () => {
    expect(() => createPdf(makeDoc({ ...SAMPLE_PROFILE, name: "李雷" }))).toThrow(/Latin-script/);
  });
});
