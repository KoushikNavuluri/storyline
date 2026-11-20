import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, CheckCheck, Plus, Target, Trash2 } from "lucide-react";
import { useStudio } from "@/state/context";
import type { Launch, LaunchStep } from "@/state/types";
import { initialPlan, LAUNCH_ROUTES, now, uid } from "@/state/factories";
import { dateLabel } from "@/lib/download";
import { ai, AIError } from "@/lib/ai";
import { Blank, Btn, Choices, IconBtn, Modal, PageTitle, Pick, TextField, useQuietMotion } from "@/components/ui/app";
import { Checkbox, FieldGroup } from "@/components/ui/primitives";
import { NextChapterLinks } from "./NextChapterLinks";

type StepFilter = "Next up" | "Completed" | "All";
type StepDraft = { title: string; due: string; route: string };

const FILTERS: StepFilter[] = ["Next up", "Completed", "All"];
const EMPTY_DRAFT: StepDraft = { title: "", due: "", route: "none" };
const ROUTE_VALUES = new Set(LAUNCH_ROUTES.map((route) => route.value));

/** The prototype's fixed starter path, used when assistance is unavailable. */
const STARTER_STEPS = [
  { title: "Gather the experience I want to highlight", route: "/profile" },
  { title: "Create one thoughtful, tailored resume", route: "/tailor" },
  { title: "Write an introduction that sounds like me", route: "/studio/pitch" },
  { title: "Practice telling one real story", route: "/studio/rehearse" },
];

const TRACK_POINTS: [x: number, y: number][] = [
  [35, 184],
  [101, 144],
  [207, 127],
  [150, 57],
  [74, 27],
];

export function LaunchPlan() {
  const { state, update, go, ask } = useStudio();
  const quiet = useQuietMotion();
  const plan = state.studio?.launch || initialPlan();
  const [directionOpen, setDirectionOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [filter, setFilter] = useState<StepFilter>("Next up");
  const [draft, setDraft] = useState<StepDraft>(EMPTY_DRAFT);
  const [drafting, setDrafting] = useState(false);

  const patch = (next: Partial<Launch>) =>
    update((s) => ({
      ...s,
      studio: {
        ...s.studio,
        launch: { ...initialPlan(), ...s.studio?.launch, ...next },
      },
    }));

  const doneCount = plan.steps.filter((step) => step.done).length;
  const nextStep = plan.steps.find((step) => !step.done && step.route !== "none");
  const visibleSteps = plan.steps.filter(
    (step) => filter === "All" || (filter === "Completed" ? step.done : !step.done),
  );

  const toggle = (id: string, checked: boolean | "indeterminate") => {
    const steps = plan.steps.map((step) =>
      step.id === id ? { ...step, done: !!checked, completedAt: checked ? now() : null } : step,
    );
    patch({ steps });
    if (checked && steps.length && steps.every((step) => step.done)) setFinishOpen(true);
  };

  const starter = async () => {
    if (drafting) return;
    setDrafting(true);
    const application = state.applications.find((app) => app.id === plan.applicationId);
    let newSteps: LaunchStep[];
    let assisted = false;
    try {
      const result = await ai.launchPlan({
        title: plan.title,
        target: plan.target,
        application: application ? { company: application.company, role: application.role } : null,
        profile: state.profile,
      });
      const usable = Array.isArray(result) ? result.filter((step) => step && typeof step.title === "string" && step.title.trim()) : [];
      if (!usable.length) throw new AIError("No usable steps returned.");
      newSteps = usable.map((step) => ({
        id: uid(),
        done: false,
        completedAt: null,
        ...step,
        title: step.title.trim(),
        due: step.due || "",
        route: ROUTE_VALUES.has(step.route) ? step.route : "none",
      }));
      assisted = true;
    } catch (error) {
      newSteps = STARTER_STEPS.map((step) => ({ ...step, id: uid(), done: false, due: "" }));
      toast(
        error instanceof AIError && error.status === 429
          ? "Daily assistance limit reached. Used the built-in rules instead."
          : "Assistance is unavailable right now. Used the built-in rules instead.",
      );
    }
    update((s) => ({
      ...s,
      usage: assisted ? [...(s.usage || []), { id: uid(), date: now(), action: "Launch plan" }] : s.usage,
      studio: {
        ...s.studio,
        launch: {
          ...initialPlan(),
          ...s.studio?.launch,
          steps: [...(s.studio?.launch?.steps || []), ...newSteps],
        },
      },
    }));
    setDrafting(false);
  };

  const move = (id: string, offset: number) => {
    const steps = [...plan.steps];
    const index = steps.findIndex((step) => step.id === id);
    if (index + offset < 0 || index + offset >= steps.length) return;
    [steps[index], steps[index + offset]] = [steps[index + offset], steps[index]];
    patch({ steps });
  };

  return (
    <div className="launch-plan">
      <button className="back-link" onClick={() => go("/studio")}>
        <ArrowLeft size={18} />
        The studio
      </button>
      <PageTitle
        eyebrow="THE LAUNCH PLAN"
        title="A next step beats a perfect plan."
        action={
          <Btn variant="outline" onClick={() => setDirectionOpen(true)} icon={Target}>
            Set my direction
          </Btn>
        }
      >
        Make a little room for the career move you want.
      </PageTitle>
      <section className="launch-cover mint">
        <div className="launch-cover-copy">
          <span className="eyebrow">YOUR NORTH STAR</span>
          <h2>{plan.title}</h2>
          <p>
            {plan.target
              ? `Working toward ${dateLabel(plan.target)}. One deliberate step at a time.`
              : "No race. No streak to protect. Just meaningful progress."}
          </p>
          <Btn
            onClick={() =>
              nextStep ? go(nextStep.route === "none" ? "/studio/launch" : nextStep.route) : setAddOpen(true)
            }
            icon={nextStep ? ArrowRight : Plus}
          >
            {nextStep && nextStep.route !== "none" ? "Take my next step" : "Add a next step"}
          </Btn>
        </div>
        <div className="launch-track-art" aria-label={`${doneCount} of ${plan.steps.length} actions completed`}>
          <svg viewBox="0 0 260 220" role="img" aria-label="Your progress follows a path, not a straight line">
            <path
              d="M35 184 C 5 111, 220 168, 212 99 S 15 76, 74 27"
              fill="none"
              stroke="#0003"
              strokeWidth="1.5"
            />
            <motion.path
              d="M35 184 C 5 111, 220 168, 212 99 S 15 76, 74 27"
              fill="none"
              stroke="#000"
              strokeWidth="2"
              initial={false}
              animate={{ pathLength: plan.steps.length ? doneCount / plan.steps.length : 0 }}
              transition={{ duration: quiet ? 0 : 0.55, ease: "easeOut" }}
            />
            {TRACK_POINTS.map(([x, y], index) => (
              <circle
                cx={x}
                cy={y}
                r={index === 4 ? 9 : 5}
                fill={doneCount / Math.max(plan.steps.length, 1) >= index / 4 ? "#000" : "#dceedd"}
                stroke="#000"
                strokeWidth="1.5"
                key={index}
              />
            ))}
            <path d="M74 27V7l20 6-20 6" fill="none" stroke="#000" strokeWidth="1.5" />
          </svg>
          <div>
            <strong>
              {doneCount}
              <span>
                {" / "}
                {plan.steps.length}
              </span>
            </strong>
            <span>your actions, completed</span>
          </div>
        </div>
      </section>
      <div className="launch-layout">
        <section>
          <div className="section-head">
            <h2>Small moves, in your order.</h2>
            <IconBtn icon={Plus} label="Add an action" onClick={() => setAddOpen(true)} />
          </div>
          <Choices label="Launch plan filter" value={filter} onChange={setFilter} options={FILTERS} />
          {plan.steps.length ? (
            <div className="launch-steps">
              {visibleSteps.map((step) => {
                const index = plan.steps.findIndex((other) => other.id === step.id);
                return (
                  <motion.div
                    layout={!quiet}
                    transition={{ duration: quiet ? 0 : 0.2 }}
                    className={"launch-step " + (step.done ? "step-done" : "")}
                    key={step.id}
                  >
                    <Checkbox
                      aria-label={"Complete " + step.title}
                      checked={step.done}
                      onCheckedChange={(checked) => toggle(step.id, checked)}
                    />
                    <div className="launch-step-copy">
                      <strong>{step.title}</strong>
                      <span>
                        {step.due ? `Your deadline: ${dateLabel(step.due)}` : "At your own pace"}
                        {step.done ? " · Completed" : ""}
                      </span>
                      {step.route !== "none" && !step.done && (
                        <button className="text-link" onClick={() => go(step.route)}>
                          {"Open workspace "}
                          <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                    <div className="launch-step-controls">
                      <IconBtn
                        icon={ArrowUp}
                        label={"Move " + step.title + " earlier"}
                        disabled={index === 0}
                        onClick={() => move(step.id, -1)}
                      />
                      <IconBtn
                        icon={ArrowDown}
                        label={"Move " + step.title + " later"}
                        disabled={index === plan.steps.length - 1}
                        onClick={() => move(step.id, 1)}
                      />
                      <IconBtn
                        icon={Trash2}
                        label={"Remove " + step.title}
                        onClick={() =>
                          ask(
                            "Remove this action?",
                            step.title,
                            () => patch({ steps: plan.steps.filter((other) => other.id !== step.id) }),
                            "Remove action",
                          )
                        }
                      />
                    </div>
                  </motion.div>
                );
              })}
              {!visibleSteps.length && (
                <Blank
                  title={
                    filter === "Completed"
                      ? "Your completed actions will live here."
                      : "A little space to decide what’s next."
                  }
                >
                  Switch views or add a new action. Nothing needs to be done just to fill a list.
                </Blank>
              )}
            </div>
          ) : (
            <Blank
              title="Start small. Make it yours."
              action={drafting ? "Drafting…" : "Add a starter path"}
              onAction={starter}
            >
              A few editable actions connect your profile, resume, introduction, and rehearsal, suggested from your own
              direction and profile. You decide when each is complete.
            </Blank>
          )}
          <Btn variant="outline" icon={Plus} onClick={() => setAddOpen(true)}>
            Add my own action
          </Btn>
        </section>
        <aside className="launch-notebook">
          <span className="eyebrow">A NOTE TO FUTURE YOU</span>
          <h2>
            What would make
            <br />
            this move worthwhile?
          </h2>
          <TextField
            area
            label="My reason for this next chapter"
            value={plan.note}
            onChange={(note) => patch({ note })}
            rows={6}
            placeholder="More interesting work? A new direction? Room to grow?"
          />
          {plan.applicationId !== "none" && state.applications.some((app) => app.id === plan.applicationId) && (
            <button className="text-link" onClick={() => go("/application/" + plan.applicationId)}>
              {"Open my target opportunity "}
              <ArrowUpRight size={16} />
            </button>
          )}
          <div className="launch-note">
            <Check size={19} />
            <p>Progress is based on actions you mark complete. It’s not a prediction of hiring success.</p>
          </div>
          <NextChapterLinks />
        </aside>
      </div>
      <Modal
        open={directionOpen}
        onClose={() => setDirectionOpen(false)}
        title="A direction, not a demand."
        description="Give this chapter a name and an optional target date. Updates save automatically."
        footer={
          <Btn onClick={() => setDirectionOpen(false)} icon={Check}>
            Keep my direction
          </Btn>
        }
      >
        <FieldGroup>
          <TextField
            label="My next chapter"
            value={plan.title}
            onChange={(title) => patch({ title })}
            placeholder="e.g. Move into product design"
          />
          <TextField label="Target date (optional)" type="date" value={plan.target} onChange={(target) => patch({ target })} />
          <Pick
            label="Related opportunity"
            value={plan.applicationId}
            onChange={(applicationId) => patch({ applicationId })}
            options={[
              { value: "none", label: "No particular role yet" },
              ...state.applications.map((app) => ({ value: app.id, label: app.company + " · " + app.role })),
            ]}
          />
        </FieldGroup>
      </Modal>
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="One useful next step."
        description="Choose something you can actually do, not an outcome you can’t control."
        footer={
          <Btn
            disabled={!draft.title.trim()}
            onClick={() => {
              patch({
                steps: [...plan.steps, { ...draft, title: draft.title.trim(), id: uid(), done: false }],
              });
              setAddOpen(false);
              setDraft(EMPTY_DRAFT);
            }}
            icon={Plus}
          >
            Add action
          </Btn>
        }
      >
        <FieldGroup>
          <TextField
            label="My action"
            value={draft.title}
            onChange={(title) => setDraft((current) => ({ ...current, title }))}
            placeholder="e.g. Rewrite my project summary"
          />
          <TextField
            type="date"
            label="My deadline (optional)"
            value={draft.due}
            onChange={(due) => setDraft((current) => ({ ...current, due }))}
          />
          <Pick
            label="Connect to a workspace"
            value={draft.route}
            onChange={(route) => setDraft((current) => ({ ...current, route }))}
            options={LAUNCH_ROUTES}
          />
        </FieldGroup>
      </Modal>
      <Modal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Look what you made happen."
        description="Every action in this plan is marked complete. Your effort is worth noticing."
        footer={
          <Btn onClick={() => setFinishOpen(false)} icon={ArrowRight}>
            Keep moving, my way
          </Btn>
        }
      >
        <div className="launch-finish mint">
          <div className="finish-rays" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <i style={{ "--ray": index } as CSSProperties} key={index} />
            ))}
          </div>
          <CheckCheck size={55} />
          <h2>
            One chapter.
            <br />
            {plan.steps.length}
            {" deliberate steps."}
          </h2>
          <p>No streak. No leaderboard. Just your progress.</p>
        </div>
      </Modal>
    </div>
  );
}
