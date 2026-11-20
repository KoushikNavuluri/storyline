import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useStudio } from "@/state/context";
import type { Entry, Practice, PracticeQuestion } from "@/state/types";
import { ANSWER_FIELDS, copy, now, practiceQuestions, uid } from "@/state/factories";
import { downloadBlob, dateLabel } from "@/lib/download";
import { ai, AIError } from "@/lib/ai";
import { Blank, Btn, IconBtn, Modal, Notice, PageTitle, Pick, TextField, useQuietMotion } from "@/components/ui/app";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Checkbox, FieldGroup } from "@/components/ui/primitives";

type AnswerKey = (typeof ANSWER_FIELDS)[number][0];
type Answer = Practice["answers"][string];
type PracticePatch = Partial<Practice> | ((practice: Practice) => Practice);

/** "mm:ss" for a number of seconds. */
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;

const hasNotes = (answer: Answer | undefined) => Object.values(answer || {}).some((value) => value?.trim());

const countWithNotes = (practice: Practice) =>
  practice.questions.filter((question) => hasNotes(practice.answers[question.id])).length;

/** Use AI questions as returned, but only if they are a usable list. */
const usableQuestions = (questions: unknown): questions is PracticeQuestion[] =>
  Array.isArray(questions) &&
  questions.length > 0 &&
  questions.every((q) => q && typeof q.id === "string" && typeof q.title === "string") &&
  new Set(questions.map((q) => q.id)).size === questions.length;

const assistanceMessage = (error: unknown, fallback: string) =>
  error instanceof AIError && error.status === 429
    ? `Daily assistance limit reached. ${fallback}`
    : `Assistance is unavailable right now. ${fallback}`;

type ProfileItem = Entry & { type: string };

export function RehearsalRoom({ applicationId }: { applicationId?: string }) {
  const { state, update, go, ask } = useStudio();
  const quiet = useQuietMotion();
  const studio = state.studio || {};
  const practice = studio.practice;
  const [target, setTarget] = useState(
    state.applications.some((app) => app.id === applicationId) ? (applicationId as string) : "general",
  );
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState<Practice | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [chosenEntry, setChosenEntry] = useState("");
  const [beginning, setBeginning] = useState(false);
  const [askingFeedback, setAskingFeedback] = useState(false);
  const timer = useRef<{ base: number; at: number } | null>(null);
  const practiceRef = useRef(practice);
  practiceRef.current = practice;

  const patch = (next: PracticePatch) =>
    update((s) => {
      const current = s.studio?.practice;
      if (!current) return s;
      return {
        ...s,
        studio: {
          ...s.studio,
          practice: typeof next === "function" ? next(current) : { ...current, ...next },
        },
      };
    });

  const elapsedNow = () =>
    timer.current
      ? Math.floor(timer.current.base + (Date.now() - timer.current.at) / 1000)
      : practiceRef.current?.seconds || 0;

  const pause = () => {
    if (timer.current) {
      const seconds = elapsedNow();
      timer.current = null;
      patch({ seconds });
    }
    setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const seconds = elapsedNow();
      patch((current) => ({ ...current, seconds }));
    }, 1000);
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(
    () => () => {
      timer.current = null;
    },
    [],
  );

  useEffect(() => {
    requestAnimationFrame(() => document.getElementById("root")?.scrollTo({ top: 0, behavior: "instant" }));
  }, [practice?.id]);

  const toggle = () => {
    if (running) pause();
    else {
      timer.current = { at: Date.now(), base: practice?.seconds || 0 };
      setRunning(true);
    }
  };

  const begin = async () => {
    if (beginning) return;
    const app = state.applications.find((a) => a.id === target);
    const role = app?.role || state.profile.headline || "";
    const company = app?.company || "";
    setBeginning(true);
    let questions: PracticeQuestion[];
    let assisted = false;
    try {
      const result = await ai.rehearsal({ role, company, jd: app?.jd || "", profile: state.profile });
      if (!usableQuestions(result)) throw new AIError("No usable questions returned.");
      questions = result;
      assisted = true;
    } catch (error) {
      questions = practiceQuestions(app?.role || "", company);
      toast(assistanceMessage(error, "Used the built-in prompts instead."));
    }
    update((s) => ({
      ...s,
      usage: assisted ? [...(s.usage || []), { id: uid(), date: now(), action: "Rehearsal questions" }] : s.usage,
      studio: {
        ...s.studio,
        practice: {
          id: uid(),
          started: now(),
          appId: app?.id || "",
          company,
          role,
          index: 0,
          seconds: 0,
          questions,
          answers: {},
          checks: {},
        },
      },
    }));
    setRunning(false);
    setBeginning(false);
  };

  const changeAnswer = (key: AnswerKey, value: string) =>
    patch((current) => {
      const questionId = current.questions[current.index].id;
      return {
        ...current,
        answers: {
          ...current.answers,
          [questionId]: { ...(current.answers[questionId] || {}), [key]: value },
        },
      };
    });

  const move = (step: number) => {
    pause();
    patch((current) => ({ ...current, index: current.index + step }));
    document.getElementById("root")?.scrollTo({ top: 0, behavior: quiet ? "instant" : "smooth" });
  };

  const complete = () => {
    pause();
    if (!practiceRef.current) return;
    const session: Practice = { ...copy(practiceRef.current), seconds: elapsedNow(), finished: now() };
    update((s) => ({
      ...s,
      studio: {
        ...s.studio,
        practice: null,
        sessions: [session, ...(s.studio?.sessions || [])],
      },
    }));
    setCompleted(session);
  };

  const requestFeedback = async () => {
    if (!practice || askingFeedback) return;
    const question = practice.questions[practice.index];
    const answer = practice.answers[question.id] || {};
    if (!hasNotes(answer)) {
      toast("Write a few notes first, then ask for feedback.");
      return;
    }
    const practiceId = practice.id;
    setAskingFeedback(true);
    try {
      const { feedback } = await ai.rehearsalFeedback({ question: question.title, answer });
      update((s) => {
        const current = s.studio?.practice;
        if (!current || current.id !== practiceId) return s;
        return {
          ...s,
          usage: [...(s.usage || []), { id: uid(), date: now(), action: "Answer feedback" }],
          studio: {
            ...s.studio,
            practice: { ...current, feedback: { ...(current.feedback || {}), [question.id]: feedback } },
          },
        };
      });
    } catch (error) {
      toast(assistanceMessage(error, "Your notes are safe. Try again later."));
    } finally {
      setAskingFeedback(false);
    }
  };

  const download = (session: Practice) => {
    const lines = [
      "Storyline / Rehearsal notes",
      [session.role, session.company].filter(Boolean).join(" · "),
      `Saved ${new Date(session.finished || Date.now()).toLocaleString("en-US")}`,
      `Practice timer: ${formatTime(session.seconds)}`,
      "",
    ];
    for (const question of session.questions) {
      lines.push(question.title);
      const answer = session.answers[question.id] || {};
      for (const [key, label] of ANSWER_FIELDS) lines.push(`${label}: ${answer[key] || "(Not yet written)"}`);
      const feedback = session.feedback?.[question.id];
      if (feedback) lines.push(`Optional AI feedback: ${feedback}`);
      lines.push("");
    }
    lines.push("Private practice notes. No score and no audio recording. Any feedback above is optional AI coaching.");
    downloadBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), "Storyline-rehearsal-notes.txt");
    toast.success("Practice notes download requested");
  };

  const profileItems: ProfileItem[] = [
    ...state.profile.experience.map((entry) => ({ ...entry, type: "Experience" })),
    ...state.profile.projects.map((entry) => ({ ...entry, type: "Project" })),
    ...(state.profile.achievements || []).map((entry) => ({ ...entry, type: "Achievement" })),
  ];
  const selectedItem = profileItems.find((item) => item.id === chosenEntry) || profileItems[0];
  const currentQuestion = practice ? practice.questions[practice.index] : null;
  const currentAnswer: Answer = practice && currentQuestion ? practice.answers[currentQuestion.id] || {} : {};
  const currentFeedback = practice && currentQuestion ? practice.feedback?.[currentQuestion.id] : undefined;
  const notedCount = practice ? countWithNotes(practice) : 0;
  const total = practice ? practice.questions.length : 0;
  const sessions = studio.sessions || [];

  return (
    <div className={"rehearsal-room " + (practice ? "practice-active" : "")}>
      <button
        className="back-link"
        onClick={() => {
          pause();
          go("/studio");
        }}
      >
        <ArrowLeft size={18} />
        The studio
      </button>
      {practice && currentQuestion ? (
        <>
          <header className="practice-header">
            <div>
              <span className="eyebrow">{practice.company || "YOUR REHEARSAL ROOM"}</span>
              <h1>{practice.role || "A career conversation"}</h1>
            </div>
            <div className="practice-clock">
              <Clock size={16} />
              <output aria-label="Practice time">{formatTime(practice.seconds)}</output>
              <IconBtn
                icon={running ? Pause : Play}
                label={running ? "Pause practice timer" : "Start practice timer"}
                onClick={toggle}
              />
            </div>
          </header>
          <div className="practice-progress" aria-label={`Prompt ${practice.index + 1} of ${total}`}>
            {practice.questions.map((question, index) => (
              <span
                className={index === practice.index ? "current" : index < practice.index ? "visited" : ""}
                key={question.id}
              >
                <i />
                {String(index + 1).padStart(2, "0")}
              </span>
            ))}
          </div>
          <div className="practice-grid">
            <section className="question-stage">
              <div className="question-margin">
                {String(practice.index + 1).padStart(2, "0")}
                {" / " + String(total).padStart(2, "0")}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  className="question-content"
                  initial={quiet ? false : { opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: quiet ? 0 : -10 }}
                  transition={{ duration: quiet ? 0 : 0.18 }}
                  key={currentQuestion.id}
                >
                  <span className="eyebrow">{currentQuestion.label}</span>
                  <h2>{currentQuestion.title}</h2>
                  <p>{currentQuestion.hint}</p>
                </motion.div>
              </AnimatePresence>
              <div className="question-bottom">
                <span>
                  <i className={running ? "breath-mark ticking" : "breath-mark"} />
                  {running ? "Take your time. This is yours." : "Press play when you want to time yourself."}
                </span>
                <button onClick={() => setDrawOpen(true)}>
                  <BookOpen size={18} />
                  {"Draw from my experience "}
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
            <section className="practice-writing">
              <div className="section-head">
                <div>
                  <span className="eyebrow">A FEW NOTES, NOT A SCRIPT</span>
                  <h2>Make the answer yours.</h2>
                </div>
                <FileText size={22} />
              </div>
              <FieldGroup>
                {ANSWER_FIELDS.map(([key, label, placeholder]) => (
                  <TextField
                    label={label}
                    area
                    rows={3}
                    value={currentAnswer[key] || ""}
                    onChange={(value) => changeAnswer(key, value)}
                    placeholder={placeholder}
                    key={key}
                  />
                ))}
              </FieldGroup>
              <button className="text-link" onClick={requestFeedback} disabled={askingFeedback}>
                <Sparkles size={15} />
                {askingFeedback ? "Reading your notes…" : "Ask for feedback"}
              </button>
              {currentFeedback && (
                <Notice title="Optional coaching (Gemini)" icon={Sparkles} tone="lilac">
                  {currentFeedback}
                </Notice>
              )}
              <label className="practice-self-check">
                <Checkbox
                  checked={!!practice.checks[currentQuestion.id]}
                  onCheckedChange={(checked) =>
                    patch((current) => ({
                      ...current,
                      checks: { ...current.checks, [current.questions[current.index].id]: !!checked },
                    }))
                  }
                  aria-label="I used an example I can explain"
                />
                <span>
                  I used an example I can explain.
                  <small>A self-check, not a score. Feedback is optional coaching.</small>
                </span>
              </label>
            </section>
          </div>
          <footer className="practice-actions">
            <Btn variant="outline" disabled={practice.index === 0} icon={ArrowLeft} onClick={() => move(-1)}>
              Previous
            </Btn>
            <span>
              {notedCount}
              {` of ${total} prompts with notes`}
            </span>
            {practice.index < total - 1 ? (
              <Btn icon={ArrowRight} onClick={() => move(1)}>
                Next prompt
              </Btn>
            ) : (
              <Btn
                icon={Check}
                onClick={() => {
                  if (notedCount < total)
                    ask(
                      "Save this practice session?",
                      `${notedCount} of ${total} prompts have notes. You can save an unfinished session without losing anything.`,
                      complete,
                      "Save session",
                    );
                  else complete();
                }}
              >
                Save session
              </Btn>
            )}
          </footer>
          <p className="practice-exit-note">
            <Check size={14} />
            Notes save automatically. Leaving pauses the timer; you can resume later.
          </p>
          <Modal
            open={drawOpen}
            onClose={() => setDrawOpen(false)}
            title="You already have a story."
            description="Draw from real profile entries. These are your words, not generated answers."
            footer={
              <Btn onClick={() => setDrawOpen(false)}>
                {"Back to my answer "}
                <ArrowRight />
              </Btn>
            }
          >
            {profileItems.length && selectedItem ? (
              <>
                <Pick
                  label="Choose an experience"
                  value={selectedItem.id}
                  onChange={setChosenEntry}
                  options={profileItems.map((item) => ({
                    value: item.id,
                    label: `${item.title || "Untitled"} · ${item.type}`,
                  }))}
                />
                <blockquote className="practice-evidence">{selectedItem.body || "No highlights added yet."}</blockquote>
                <Btn
                  variant="outline"
                  icon={Plus}
                  onClick={() => {
                    changeAnswer(
                      "context",
                      [currentAnswer.context, `${selectedItem.title}${selectedItem.org ? " at " + selectedItem.org : ""}`]
                        .filter(Boolean)
                        .join("\n"),
                    );
                    setDrawOpen(false);
                    toast("Experience title added to your context. Write the rest in your own words.");
                  }}
                >
                  Use as my starting point
                </Btn>
              </>
            ) : (
              <Blank title="Save an experience first.">
                Your roles, projects, and achievements appear here once you add them to your profile. You can still
                write your own notes now.
              </Blank>
            )}
          </Modal>
        </>
      ) : (
        <>
          <PageTitle eyebrow="THE REHEARSAL ROOM" title="Your story sounds better in your voice.">
            A quiet place to find the words, before the conversation that counts.
          </PageTitle>
          <section className="rehearsal-invitation">
            <div className="practice-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
              <div>
                <Play size={30} strokeWidth={1.5} />
              </div>
            </div>
            <div className="rehearsal-invitation-copy">
              <span className="eyebrow">A LITTLE PRACTICE. A LITTLE MORE CLARITY.</span>
              <h2>
                No audience.
                <br />
                No perfect answers.
              </h2>
              <p>
                Four thoughtful prompts. Your own experience.
                <br />
                As much time as you need.
              </p>
              <FieldGroup>
                <Pick
                  label="What are you preparing for?"
                  value={target}
                  onChange={setTarget}
                  options={[
                    { value: "general", label: "A general career conversation" },
                    ...state.applications.map((app) => ({ value: app.id, label: app.company + " · " + app.role })),
                  ]}
                />
              </FieldGroup>
              <Btn onClick={begin} icon={ArrowRight} disabled={beginning}>
                {beginning ? "Preparing prompts…" : "Begin rehearsal"}
              </Btn>
              <span className="practice-private">
                <ShieldCheck size={16} />
                No microphone. No recording. No score. Prompts may be AI-suggested.
              </span>
            </div>
          </section>
          {completed && (
            <section className="practice-complete mint" aria-live="polite">
              <div className="completion-seal">
                <CheckCheck size={30} />
              </div>
              <div>
                <span className="eyebrow">A LITTLE MORE PREPARED</span>
                <h2>That’s a chapter worth keeping.</h2>
                <p>Your notes are saved. This is practice, not a performance score.</p>
              </div>
              <Btn variant="outline" onClick={() => download(completed)} icon={Download}>
                Download notes
              </Btn>
            </section>
          )}
          <div className="section-head">
            <h2>Your practice notebook</h2>
            <span className="eyebrow">
              {sessions.length}
              {" SAVED"}
            </span>
          </div>
          {sessions.length ? (
            <Accordion type="single" collapsible>
              {sessions.map((session) => (
                <AccordionItem value={session.id} key={session.id}>
                  <AccordionTrigger>
                    <span className="session-title">
                      <strong>{session.company || "Career conversation"}</strong>
                      <span>
                        {dateLabel(session.finished)}
                        {" · "}
                        {countWithNotes(session)}
                        {" prompts with notes · "}
                        {formatTime(session.seconds)}
                        {" timed"}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="session-notes">
                      {session.questions.map((question) => (
                        <div key={question.id}>
                          <h3>{question.title}</h3>
                          {ANSWER_FIELDS.map(([key, label]) => (
                            <p key={key}>
                              <strong>{label}</strong>
                              {session.answers[question.id]?.[key] || "No note added."}
                            </p>
                          ))}
                          {session.feedback?.[question.id] && (
                            <p>
                              <strong>Optional AI feedback</strong>
                              {session.feedback[question.id]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <Btn variant="outline" icon={Download} onClick={() => download(session)}>
                      Download this session
                    </Btn>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <Blank title="The first conversation starts here.">
              Your completed sessions and notes will live in this notebook.
            </Blank>
          )}
        </>
      )}
    </div>
  );
}
