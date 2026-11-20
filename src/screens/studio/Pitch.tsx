import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  FileText,
  Layers,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Blank, Btn, IconBtn, Modal, Notice, PageTitle, Pick, TextField, useQuietMotion } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { blankPitch, now, uid } from "@/state/factories";
import { ai, AIError } from "@/lib/ai";
import { dateLabel, downloadBlob } from "@/lib/download";
import type { Entry, Pitch } from "@/state/types";

/** Where the reading guide started from, so elapsed time maps to a word index. */
interface GuideAnchor {
  index: number;
  time: number;
}

export function PitchStudio() {
  const { state, update, go, ask } = useStudio();
  const pitch: Pitch = state.studio?.pitch || blankPitch();
  const quiet = useQuietMotion();
  const [buildOpen, setBuildOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pace, setPace] = useState("130");
  const [wordIndex, setWordIndex] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [versionName, setVersionName] = useState("");
  const [shaping, setShaping] = useState(false);
  const anchor = useRef<GuideAnchor | null>(null);

  const patch = (changes: Partial<Pitch>) =>
    update((current) => ({
      ...current,
      studio: {
        ...current.studio,
        pitch: {
          ...blankPitch(),
          ...current.studio?.pitch,
          ...changes,
        },
      },
    }));

  const words = pitch.text.trim().split(/\s+/).filter(Boolean);
  const seconds = words.length ? Math.ceil((words.length / Number(pace)) * 60) : 0;
  const targetWords = Math.round((Number(pitch.target) * Number(pace)) / 60);
  const entries: Entry[] = [...state.profile.achievements, ...state.profile.projects, ...state.profile.experience];
  const [entryId, setEntryId] = useState("none");

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const start = anchor.current;
      if (!start) return;
      const next = Math.floor(start.index + ((Date.now() - start.time) / 60000) * Number(pace));
      if (next >= words.length) {
        setWordIndex(Math.max(0, words.length - 1));
        setPlaying(false);
      } else setWordIndex(next);
    }, 100);
    return () => clearInterval(timer);
  }, [playing, pace, words.length]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (practiceOpen)
      document.querySelector(".pitch-read-word.current")?.scrollIntoView({
        block: "nearest",
        behavior: quiet ? "instant" : "smooth",
      });
  }, [wordIndex, practiceOpen]);

  const build = () => {
    const joined = [pitch.intro, pitch.evidence, pitch.next]
      .map((block) => block.trim())
      .filter(Boolean)
      .join("\n\n");
    const apply = async () => {
      setShaping(true);
      let text: string;
      try {
        const result = await ai.pitch({
          intro: pitch.intro,
          evidence: pitch.evidence,
          next: pitch.next,
          target: pitch.target,
          name: state.profile.name,
          headline: state.profile.headline,
        });
        text = result.text?.trim() || joined;
        update((current) => ({
          ...current,
          usage: [...current.usage, { id: uid(), date: now(), action: "Pitch draft" }],
        }));
      } catch (error) {
        text = joined;
        toast(
          error instanceof AIError && error.status === 429
            ? "Daily assistance limit reached. Used the built-in rules instead."
            : "Assistance is unavailable right now. Used the built-in rules instead.",
        );
      } finally {
        setShaping(false);
      }
      patch({ text });
      setBuildOpen(false);
      toast.success("Your words, arranged into an introduction.");
    };
    if (pitch.text.trim())
      ask(
        "Replace the current pitch?",
        "This uses the three blocks you entered. Save a version first if you want to keep the current wording.",
        () => void apply(),
        "Use these words",
      );
    else void apply();
  };

  const copyPitch = async () => {
    try {
      await navigator.clipboard.writeText(pitch.text);
      toast.success("Pitch copied. Nothing has been shared.");
    } catch {
      setCopyError("Clipboard access is unavailable. Select and copy the text in the editor, or download it below.");
    }
  };

  const download = () =>
    downloadBlob(new Blob([pitch.text], { type: "text/plain;charset=utf-8" }), "Storyline-my-introduction.txt");

  return (
    <div className="pitch-studio">
      <button className="back-link" onClick={() => go("/studio")}>
        <ArrowLeft size={18} />
        The studio
      </button>
      <PageTitle
        eyebrow="THE PITCH STUDIO"
        title="You, in a few good sentences."
        action={
          <Btn variant="outline" icon={Layers} onClick={() => setBuildOpen(true)}>
            Build from my words
          </Btn>
        }
      >
        Not a script to memorize. An introduction you can make your own.
      </PageTitle>
      <div className="pitch-layout">
        <section className="pitch-paper lilac">
          <div className="pitch-paper-label">
            <span className="eyebrow">A LITTLE INTRODUCTION</span>
            <FileText size={24} strokeWidth={1.3} />
          </div>
          <h2>
            Hello.
            <br />
            Here’s my story.
          </h2>
          <div className="pitch-preview-text">
            {pitch.text ? (
              pitch.text.split(/\n\n/).map((paragraph, index) => (
                <motion.p
                  initial={quiet ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: quiet ? 0 : 0.2 }}
                  key={index}
                >
                  {paragraph}
                </motion.p>
              ))
            ) : (
              <>
                <p className="pitch-guide-line">What you do.</p>
                <p className="pitch-guide-line">The work you can speak to.</p>
                <p className="pitch-guide-line">Where you want to go next.</p>
              </>
            )}
          </div>
          <div className="pitch-paper-footer">
            <span>
              {state.profile.name || "Your name"}
              <small>{state.profile.headline || "Your next chapter"}</small>
            </span>
            <ArrowUpRight size={26} />
          </div>
        </section>
        <section className="pitch-workbench">
          <div className="section-head">
            <div>
              <span className="eyebrow">CLARITY, NOT A CATCHPHRASE</span>
              <h2>The introduction.</h2>
            </div>
            <NotebookPen size={23} />
          </div>
          <TextField
            area
            label="My pitch"
            rows={11}
            value={pitch.text}
            onChange={(text) => patch({ text })}
            placeholder="Write a few sentences about your work and where you’d like to go…"
            hint="Your draft saves as you type. Writing assistance only shapes it from your own three blocks when you ask, and every word stays yours to edit."
          />
          <div className="pitch-length">
            <Pick
              label="Aim for roughly"
              value={pitch.target}
              onChange={(target) => patch({ target })}
              options={[
                { value: "30", label: "30 seconds" },
                { value: "60", label: "60 seconds" },
                { value: "90", label: "90 seconds" },
              ]}
            />
            <div>
              <strong>
                {words.length}
                <span>{" words"}</span>
              </strong>
              <small>
                {"About "}
                {seconds}
                {" seconds at "}
                {pace}
                {" words/minute"}
              </small>
            </div>
          </div>
          <div className="pitch-length-track" aria-hidden="true">
            <span style={{ width: Math.min(100, (words.length / targetWords) * 100) + "%" }} />
          </div>
          <p className="pitch-length-note">
            {words.length
              ? seconds > Number(pitch.target)
                ? `About ${seconds - Number(pitch.target)} seconds over your aim. Try cutting a detail, not your personality.`
                : "Room to breathe. Pauses are part of your introduction."
              : "A starting point, not a word quota."}
            {" Timing is an estimate."}
          </p>
          <div className="actions">
            <Btn
              disabled={!words.length}
              icon={Play}
              onClick={() => {
                setWordIndex(0);
                setPlaying(false);
                setPracticeOpen(true);
              }}
            >
              Practice my pitch
            </Btn>
            <Btn variant="outline" disabled={!words.length} icon={Check} onClick={() => setSaveOpen(true)}>
              Save a version
            </Btn>
          </div>
          <div className="pitch-utilities">
            <button className="text-link" disabled={!words.length} onClick={copyPitch}>
              <Copy size={16} />
              Copy text
            </button>
            <button className="text-link" disabled={!words.length} onClick={download}>
              <Download size={16} />
              Download
            </button>
          </div>
          {copyError && <Notice title="Copy it another way">{copyError}</Notice>}
        </section>
      </div>
      <section className="pitch-versions">
        <div className="section-head">
          <h2>Different moments. Still you.</h2>
          <span className="eyebrow">
            {pitch.versions.length}
            {" SAVED VERSIONS"}
          </span>
        </div>
        {pitch.versions.length ? (
          <div className="pitch-version-grid">
            {pitch.versions
              .slice()
              .reverse()
              .map((version) => (
                <article className="pitch-version" key={version.id}>
                  <span className="eyebrow">{dateLabel(version.date)}</span>
                  <h3>{version.name}</h3>
                  <p>{version.text}</p>
                  <button
                    className="text-link"
                    onClick={() =>
                      ask(
                        "Use this introduction?",
                        "Your current pitch will be saved as a version before this wording is restored.",
                        () =>
                          patch({
                            text: version.text,
                            versions: pitch.text.trim()
                              ? [
                                  ...pitch.versions,
                                  { id: uid(), name: "Before restoration", text: pitch.text, date: now() },
                                ]
                              : pitch.versions,
                          }),
                        "Use this version",
                      )
                    }
                  >
                    {"Use this version "}
                    <ArrowRight size={16} />
                  </button>
                </article>
              ))}
          </div>
        ) : (
          <Blank title="Keep a version for the right moment.">
            Save an introduction for networking, interviews, or a career change. Each keeps its own wording.
          </Blank>
        )}
      </section>
      <Modal
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        title="Three blocks. Your words."
        description="Writing assistance shapes only the three blocks you provide into an introduction, with no invented experience. Every word stays editable."
        footer={
          <Btn
            disabled={shaping || (!pitch.intro.trim() && !pitch.evidence.trim() && !pitch.next.trim())}
            onClick={build}
            icon={ArrowRight}
          >
            {shaping ? "Shaping…" : "Shape my introduction"}
          </Btn>
        }
      >
        <FieldGroup>
          <TextField
            area
            rows={3}
            label="1. What I do"
            value={pitch.intro}
            onChange={(intro) => patch({ intro })}
            placeholder="Start with the work, not a list of adjectives."
          />
          <TextField
            area
            rows={4}
            label="2. A contribution I can speak to"
            value={pitch.evidence}
            onChange={(evidence) => patch({ evidence })}
            placeholder="A real project, contribution, or lesson."
          />
          {entries.length > 0 && (
            <>
              <Pick
                label="Draw from saved experience"
                value={entryId}
                onChange={setEntryId}
                options={[
                  { value: "none", label: "Choose an entry" },
                  ...entries.map((entry) => ({ value: entry.id, label: entry.title || "Untitled entry" })),
                ]}
              />
              <Btn
                variant="outline"
                disabled={entryId === "none"}
                onClick={() => {
                  const entry = entries.find((item) => item.id === entryId);
                  patch({ evidence: [pitch.evidence, entry?.body].filter(Boolean).join("\n") });
                  setEntryId("none");
                }}
              >
                {"Add this evidence "}
                <Plus />
              </Btn>
            </>
          )}
          <TextField
            area
            rows={3}
            label="3. What I’m looking for next"
            value={pitch.next}
            onChange={(next) => patch({ next })}
            placeholder="A direction, a kind of problem, or something you want to learn."
          />
        </FieldGroup>
      </Modal>
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Give this version a moment."
        description="A fixed copy for an interview, a networking conversation, or a different direction."
        footer={
          <Btn
            onClick={() => {
              patch({
                versions: [
                  ...pitch.versions,
                  {
                    id: uid(),
                    name: versionName.trim() || "My introduction " + (pitch.versions.length + 1),
                    text: pitch.text,
                    date: now(),
                  },
                ],
              });
              setVersionName("");
              setSaveOpen(false);
              toast.success("Introduction saved. Still yours to change.");
            }}
            icon={Check}
          >
            Save introduction
          </Btn>
        }
      >
        <TextField
          label="Version name"
          value={versionName}
          onChange={setVersionName}
          placeholder="e.g. A first conversation"
        />
      </Modal>
      <Modal
        open={practiceOpen}
        onClose={() => {
          setPlaying(false);
          setPracticeOpen(false);
        }}
        title="Say it like you mean it."
        description="A word guide, not a recording. Read aloud at your own pace. The highlight is an estimated reading cue."
        footer={
          <div className="pitch-player">
            <IconBtn
              icon={RotateCcw}
              label="Restart reading guide"
              onClick={() => {
                setPlaying(false);
                setWordIndex(0);
              }}
            />
            <Btn
              icon={playing ? Pause : Play}
              onClick={() => {
                if (playing) setPlaying(false);
                else {
                  const start = wordIndex >= words.length - 1 ? 0 : wordIndex;
                  setWordIndex(start);
                  anchor.current = { index: start, time: Date.now() };
                  setPlaying(true);
                }
              }}
            >
              {playing ? "Pause guide" : "Start guide"}
            </Btn>
            <span>
              {Math.min(wordIndex + 1, words.length)}
              {" / "}
              {words.length}
            </span>
          </div>
        }
      >
        <div className="pitch-reader">
          <span className="eyebrow">YOUR VOICE. YOUR OWN WORDS.</span>
          <div className="pitch-read-text">
            {words.map((word, index) => (
              <span
                className={"pitch-read-word " + (index === wordIndex ? "current" : index < wordIndex ? "read" : "")}
                key={index}
              >
                {word}{" "}
              </span>
            ))}
          </div>
        </div>
        <Pick
          label="Reading guide pace"
          value={pace}
          onChange={(next) => {
            setPlaying(false);
            setPace(next);
          }}
          options={[
            { value: "100", label: "Unhurried · 100 words/minute" },
            { value: "130", label: "Conversational · 130 words/minute" },
            { value: "160", label: "Brisk · 160 words/minute" },
          ]}
        />
      </Modal>
    </div>
  );
}
