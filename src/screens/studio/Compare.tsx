import { useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowUpRight, Check, Compass, Plus, Target } from "lucide-react";
import { useStudio } from "@/state/context";
import { emptyCompare, getFit, PRIORITIES } from "@/state/factories";
import type { Compare } from "@/state/types";
import { Blank, Btn, Modal, Notice, PageTitle, Pick, Reveal, TextField } from "@/components/ui/app";
import { Checkbox, FieldGroup, Slider } from "@/components/ui/primitives";

const RATING_OPTIONS = [
  { value: "0", label: "Not enough information" },
  { value: "1", label: "1 \xB7 Poor fit" },
  { value: "2", label: "2 \xB7 Some concerns" },
  { value: "3", label: "3 \xB7 Reasonable fit" },
  { value: "4", label: "4 \xB7 Strong fit" },
  { value: "5", label: "5 \xB7 Excellent fit" },
];

/** The decision desk: compare up to three saved opportunities against the user's own weighted priorities. */
export function OpportunityCompare() {
  const { state, update, go } = useStudio();
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const compare = state.studio?.compare || emptyCompare();
  const selected = state.applications.filter((application) => compare.selected.includes(application.id)).slice(0, 3);

  const patch = (changes: Partial<Compare>) =>
    update((current) => ({
      ...current,
      studio: {
        ...current.studio,
        compare: {
          ...emptyCompare(),
          ...current.studio?.compare,
          ...changes,
        },
      },
    }));

  const rate = (applicationId: string, priorityId: string, value: string) =>
    patch({
      ratings: {
        ...compare.ratings,
        [applicationId]: {
          ...compare.ratings[applicationId],
          [priorityId]: Number(value),
        },
      },
    });

  const ranked = selected
    .map((application) => ({
      ...application,
      fit: getFit(compare.ratings[application.id] ?? {}, compare.weights),
    }))
    .filter((application) => application.fit.complete && application.fit.score !== null)
    .sort((a, b) => (b.fit.score ?? 0) - (a.fit.score ?? 0));
  const decided = selected.length >= 2 && ranked.length === selected.length;
  const tied = decided && ranked[0].fit.score === ranked[1].fit.score;
  const weightOf = (priorityId: string) => compare.weights[priorityId] ?? 3;

  return (
    <div className="decision-desk">
      <button className="back-link" onClick={() => go("/studio")}>
        <ArrowLeft size={18} />
        The studio
      </button>
      <PageTitle
        eyebrow="THE DECISION DESK"
        title="Good on paper. Right for you?"
        action={
          <Btn variant="outline" icon={Target} onClick={() => setPrioritiesOpen(true)}>
            What matters to me
          </Btn>
        }
      >
        Put opportunities side by side. Let your priorities do the talking.
      </PageTitle>
      <section className="decision-banner cream">
        <Compass size={38} strokeWidth={1.3} />
        <div>
          <span className="eyebrow">YOUR VALUES, NOT AN ALGORITHM’S</span>
          <h2>
            {decided
              ? tied
                ? "A close call. Look at the tradeoffs."
                : `${ranked[0].company} leads on your priorities.`
              : "A little clarity before the next move."}
          </h2>
          <p>
            {decided
              ? "Based only on your ratings and chosen weights. This is a reflection tool, not a hiring prediction."
              : "Unknown stays unknown. Rate the things you know; leave the rest for a conversation."}
          </p>
        </div>
      </section>
      <div className="comparison-picker">
        <div className="section-head">
          <h2>Choose up to three opportunities</h2>
          <button className="text-link" onClick={() => go("/application/new")}>
            {"Add an opportunity "}
            <Plus size={16} />
          </button>
        </div>
        <div className="opportunity-pills">
          {state.applications.map((application) => {
            const picked = compare.selected.includes(application.id);
            return (
              <label className={picked ? "opportunity-pill picked" : "opportunity-pill"} key={application.id}>
                <Checkbox
                  checked={picked}
                  disabled={!picked && selected.length >= 3}
                  onCheckedChange={(checked) =>
                    patch({
                      selected: checked
                        ? [...compare.selected, application.id]
                        : compare.selected.filter((id) => id !== application.id),
                    })
                  }
                  aria-label={`Compare ${application.company}`}
                />
                <span>
                  {application.company}
                  <small>{application.role}</small>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      {state.applications.length ? (
        selected.length ? (
          <>
            <div className="decision-columns" style={{ "--compare-count": selected.length } as CSSProperties}>
              {selected.map((application) => {
                const fit = getFit(compare.ratings[application.id] ?? {}, compare.weights);
                return (
                  <Reveal className="decision-column" key={application.id}>
                    <div className="decision-company">
                      <span className="company-mark">{application.company.slice(0, 1)}</span>
                      <div>
                        <h2>{application.company}</h2>
                        <p>{application.role}</p>
                      </div>
                      <button
                        aria-label={"Open " + application.company + " application"}
                        onClick={() => go("/application/" + application.id)}
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </div>
                    <div className="fit-readout">
                      <strong>{fit.score ?? "?"}</strong>
                      <div>
                        <span>
                          {fit.score === null ? "Not rated" : fit.complete ? "Personal fit / 100" : "Partial fit / 100"}
                        </span>
                        <small>
                          {fit.count}
                          {" of "}
                          {PRIORITIES.filter((priority) => weightOf(priority.id) > 0).length}
                          {" active priorities rated"}
                        </small>
                      </div>
                    </div>
                    <div className="fit-track" aria-hidden="true">
                      <span style={{ width: `${fit.score ?? 0}%` }} />
                    </div>
                    <FieldGroup>
                      {PRIORITIES.map((priority) => (
                        <div className="decision-rating" key={priority.id}>
                          <Pick
                            label={priority.name}
                            value={String(compare.ratings[application.id]?.[priority.id] || 0)}
                            onChange={(value) => rate(application.id, priority.id, value)}
                            options={RATING_OPTIONS}
                          />
                          <small>
                            {weightOf(priority.id) === 0
                              ? "Not included in your score"
                              : `Importance: ${weightOf(priority.id)} / 5`}
                          </small>
                        </div>
                      ))}
                      <TextField
                        area
                        label={"Questions for " + application.company}
                        value={compare.notes[application.id] || ""}
                        onChange={(value) => patch({ notes: { ...compare.notes, [application.id]: value } })}
                        rows={4}
                        placeholder="What would help me decide?"
                      />
                    </FieldGroup>
                  </Reveal>
                );
              })}
            </div>
            <Notice title="How your comparison works">
              Personal fit is the weighted average of your 1–5 ratings, scaled to 100. Unknown ratings and zero-weight
              priorities are excluded. A leading opportunity is shown only when all selected roles have every active
              priority rated. No external company data or AI is used.
            </Notice>
          </>
        ) : (
          <Blank title="Pick the possibilities you’re weighing.">
            Select one to reflect, or two or three to compare.
          </Blank>
        )
      ) : (
        <Blank title="Save a possibility first." action="Add an opportunity" onAction={() => go("/application/new")}>
          Your saved roles will appear here. No sample ratings are added for you.
        </Blank>
      )}
      <Modal
        title="What matters in your next chapter?"
        description="Choose the importance of each priority. Zero means don’t include it. Ratings and notes stay intact."
        open={prioritiesOpen}
        onClose={() => setPrioritiesOpen(false)}
        footer={
          <Btn icon={Check} onClick={() => setPrioritiesOpen(false)}>
            Keep my priorities
          </Btn>
        }
      >
        <div className="priority-sliders">
          {PRIORITIES.map((priority) => (
            <div key={priority.id}>
              <div>
                <label htmlFor={"weight-" + priority.id}>{priority.name}</label>
                <span>
                  {weightOf(priority.id)}
                  {" / 5"}
                </span>
              </div>
              <p>{priority.hint}</p>
              <Slider
                id={"weight-" + priority.id}
                aria-label={priority.name + " importance"}
                value={[weightOf(priority.id)]}
                min={0}
                max={5}
                step={1}
                onValueChange={(values) => patch({ weights: { ...compare.weights, [priority.id]: values[0] } })}
              />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
