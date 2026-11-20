import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { unzipSync, strFromU8 } from "fflate";
import { ArrowRight, Check, TriangleAlert, Upload } from "lucide-react";
import { Btn, Notice, PageTitle, TextField } from "@/components/ui/app";
import { FieldGroup, Input } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { emptyProfile, now, uid } from "@/state/factories";
import { ai, AIError, fileToBase64 } from "@/lib/ai";
import type { Entry, Profile } from "@/state/types";

const MAX_FILE_BYTES = 3 * 1024 * 1024;

const LIST_KEYS = [
  "experience",
  "education",
  "projects",
  "certifications",
  "awards",
  "volunteering",
  "custom",
  "achievements",
] as const;

type ImportInput = { text?: string; file?: { name: string; mimeType: string; data: string } };

/** The prototype's built-in extraction: first line as name, second as headline, full text as summary. */
function basicExtraction(text: string): Profile {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const profile = emptyProfile();
  profile.name = lines[0] || "";
  profile.headline = lines[1] || "";
  profile.summary = text;
  return profile;
}

const decodeEntities = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Pull plain text out of a .docx (word/document.xml), one paragraph per line. */
async function docxText(file: File): Promise<string> {
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => entry.name === "word/document.xml",
  });
  const xml = archive["word/document.xml"];
  if (!xml) throw new Error("Missing document.xml");
  return decodeEntities(
    strFromU8(xml)
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const asText = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

/** Make an AI result safe to use as a Profile: every field present, entries with ids. */
function normalizeProfile(result: Partial<Profile> | null | undefined): Profile {
  const base = emptyProfile();
  const source = (result || {}) as Partial<Record<keyof Profile, unknown>>;
  const profile: Profile = {
    ...base,
    name: asText(source.name),
    headline: asText(source.headline),
    location: asText(source.location),
    links: asText(source.links),
    summary: asText(source.summary),
    skills: Array.isArray(source.skills) ? source.skills.map(asText).join(", ") : asText(source.skills),
    preferences: {
      ...base.preferences,
      ...((source.preferences as Partial<Profile["preferences"]> | undefined) || {}),
    },
  };
  for (const key of LIST_KEYS) {
    const list = source[key];
    profile[key] = Array.isArray(list)
      ? list.map(
          (entry: Partial<Entry>): Entry => ({
            id: entry?.id || uid(),
            title: asText(entry?.title),
            org: asText(entry?.org),
            dates: asText(entry?.dates),
            body: asText(entry?.body),
          }),
        )
      : [];
  }
  return profile;
}

const fallbackMessage = (error: unknown) =>
  error instanceof AIError && error.status === 429
    ? "Daily assistance limit reached. Used the built-in rules instead."
    : "Assistance is unavailable right now. Used the built-in rules instead.";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function ImportFlow({ review }: { review?: boolean }) {
  const { state, update, go, ask } = useStudio();
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  /** Send text or a PDF to writing assistance; fall back to the built-in extraction for text. */
  const runImport = async (input: ImportInput, fallbackText?: string) => {
    setReading(true);
    try {
      let draft: Profile;
      let assisted = false;
      try {
        draft = normalizeProfile(await ai.importResume(input));
        assisted = true;
      } catch (e) {
        if (fallbackText === undefined) {
          setError(
            e instanceof AIError && e.status === 429
              ? "Daily assistance limit reached. Copy the text from your PDF and paste it below."
              : "We could not read this PDF right now. Copy its text and paste it below.",
          );
          return;
        }
        draft = basicExtraction(fallbackText);
        toast(fallbackMessage(e));
      }
      update((current) => ({
        ...current,
        importDraft: draft,
        usage: assisted ? [...current.usage, { id: uid(), date: now(), action: "Resume import" }] : current.usage,
      }));
      setError("");
      go("/review-import");
    } finally {
      setReading(false);
    }
  };

  const extract = () => {
    const text = state.importText.trim();
    if (text.length < 20) {
      setError("Paste at least a few lines of resume text, then try again.");
      return;
    }
    void runImport({ text }, text);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = file.name.match(/\.(txt|md|pdf|docx)$/i)?.[1]?.toLowerCase();
    if (!extension) {
      setError("Choose a TXT, Markdown, PDF or Word (.docx) file, or paste your resume text below.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Choose a file smaller than 3 MB.");
      return;
    }
    if (extension === "pdf") {
      setReading(true);
      let data: string;
      try {
        data = await fileToBase64(file);
      } catch {
        setReading(false);
        setError("We could not read this file. Paste its text instead.");
        return;
      }
      await runImport({ file: { name: file.name, mimeType: "application/pdf", data } });
      return;
    }
    setReading(true);
    let text: string;
    try {
      text = extension === "docx" ? await docxText(file) : await file.text();
      if (text.includes("\0") || !text.trim()) throw Error();
    } catch {
      setReading(false);
      setError("We could not read this file. Paste its text instead.");
      return;
    }
    update({
      importText: text,
    });
    setError("");
    await runImport({ text: text.trim() }, text.trim());
  };

  if (review && state.importDraft) {
    const draft = state.importDraft;
    const change = (key: keyof Profile, value: string) =>
      update((current) => ({
        ...current,
        importDraft: {
          ...(current.importDraft as Profile),
          [key]: value,
        },
      }));
    const roles = draft.experience.length;
    const education = draft.education.length;
    const skills = draft.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean).length;
    const basic = !roles && !education && !skills;
    return (
      <div className="narrow">
        <PageTitle eyebrow="IMPORT / REVIEW" title="A starting point, not a guess.">
          Check every field before it becomes part of your profile.
        </PageTitle>
        <Notice title="Review required" tone="cream">
          {basic
            ? "The built-in extraction only proposes the first two lines as your name and headline. The original text is preserved below; dates and roles need manual review."
            : "Writing assistance read your resume to fill these fields. It only uses what your resume says and never invents experience, dates, or qualifications. Nothing is saved until you confirm."}
        </Notice>
        <p className="fine-print">
          {"Detected "}
          {plural(roles, "role", "roles")}
          {" · "}
          {plural(education, "education entry", "education entries")}
          {" · "}
          {plural(skills, "skill", "skills")}
          {". You can edit each one in your profile after confirming."}
        </p>
        <FieldGroup>
          <TextField label="Name · please verify" value={draft.name} onChange={(value) => change("name", value)} />
          <TextField
            label="Headline · please verify"
            value={draft.headline}
            onChange={(value) => change("headline", value)}
          />
          <TextField
            area
            label="Imported text / summary"
            value={draft.summary}
            onChange={(value) => change("summary", value)}
            rows={9}
          />
        </FieldGroup>
        <div className="actions">
          <Btn variant="outline" onClick={() => go("/import")}>
            Back to import
          </Btn>
          <Btn
            disabled={!draft.name.trim()}
            onClick={() => {
              const action = () => {
                update({
                  profile: draft,
                  onboarded: true,
                  sample: false,
                  importDraft: null,
                });
                go("/profile");
                toast.success("Profile created. Add roles and dates next.");
              };
              if (state.profile.name)
                ask(
                  "Replace your master profile?",
                  "Existing resume documents will not change. This replaces only your current profile.",
                  action,
                  "Replace profile",
                );
              else action();
            }}
          >
            {"Confirm profile "}
            <Check />
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow">
      <PageTitle eyebrow="IMPORT / TEXT" title="Bring your story with you.">
        Import text, then review it before anything is added.
      </PageTitle>
      <label className="upload-target">
        <Upload size={30} />
        <strong>{reading ? "Reading your file…" : "Choose a resume file"}</strong>
        <span>TXT, Markdown, PDF or Word · up to 3 MB</span>
        <Input
          type="file"
          accept=".txt,.md,.pdf,.docx"
          onChange={onFile}
          disabled={reading}
          aria-label="Upload resume file"
        />
      </label>
      <FieldGroup>
        <TextField
          area
          label="Or paste your resume"
          value={state.importText}
          onChange={(value) =>
            update({
              importText: value,
            })
          }
          rows={12}
          placeholder={`Your name
Your professional headline
Your experience…`}
        />
      </FieldGroup>
      {error && (
        <Notice title="Import needs attention" icon={TriangleAlert}>
          {error}
        </Notice>
      )}
      <Notice title="Read by writing assistance">
        Your resume is read by writing assistance (Gemini) to fill your profile. It uses only what your resume says and
        never invents experience, dates, or qualifications. You review everything before it is saved.
      </Notice>
      <Btn disabled={reading} onClick={extract} icon={ArrowRight}>
        {reading ? "Reading…" : "Review imported text"}
      </Btn>
    </div>
  );
}
