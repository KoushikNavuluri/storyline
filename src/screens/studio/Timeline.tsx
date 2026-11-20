import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Compass,
  Flag,
  GraduationCap,
  Layers,
  NotebookPen,
  Play,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useStudio } from "@/state/context";
import type { Entry } from "@/state/types";
import { Blank, Btn, Choices, PageTitle, Reveal, useQuietMotion } from "@/components/ui/app";
import { Input } from "@/components/ui/primitives";
import { QuickCapture } from "@/components/shell/QuickCapture";

export type TimelineSectionKey = "experience" | "education" | "projects" | "achievements" | "volunteering";

/** Profile sections shown on the career timeline, with their singular label and icon (prototype `Pz`). */
export const TIMELINE_SECTIONS: Record<TimelineSectionKey, { label: string; icon: LucideIcon }> = {
  experience: { label: "Experience", icon: BriefcaseBusiness },
  education: { label: "Education", icon: GraduationCap },
  projects: { label: "Project", icon: Layers },
  achievements: { label: "Achievement", icon: Flag },
  volunteering: { label: "Volunteering", icon: BookOpen },
};

const FILTERS = ["All", "Experience", "Project", "Achievement", "Education", "Volunteering"];

type Chapter = Entry & { section: TimelineSectionKey; type: string; year: string };

/** Career timeline: every saved profile entry grouped by year, with search, filters, and quick capture. */
export function StoryTimeline() {
  const { state, go } = useStudio();
  const quiet = useQuietMotion();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);

  const chapters: Chapter[] = (Object.entries(TIMELINE_SECTIONS) as [TimelineSectionKey, { label: string }][])
    .flatMap(([section, meta]) =>
      (state.profile[section] || []).map((entry) => ({
        ...entry,
        section,
        type: meta.label,
        year: entry.dates?.match(/\b(?:19|20)\d{2}\b/)?.[0] || "Undated",
      })),
    )
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));

  const visible = chapters.filter(
    (chapter) =>
      (filter === "All" || chapter.type === filter) &&
      `${chapter.title} ${chapter.org} ${chapter.body}`.toLowerCase().includes(query.toLowerCase()),
  );

  const years = [...new Set(visible.map((chapter) => chapter.year))].sort((a, b) =>
    a === "Undated" ? 1 : b === "Undated" ? -1 : Number(b) - Number(a),
  );

  const threads = (state.profile.skills || "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div className="story-timeline">
      <button className="back-link" onClick={() => go("/studio")}>
        <ArrowLeft size={18} />
        The studio
      </button>
      <PageTitle
        eyebrow={state.sample ? "SAMPLE CAREER / THE CONNECTING THREAD" : "YOUR CAREER / THE CONNECTING THREAD"}
        title="Look how far your story goes."
        action={
          <Btn icon={Plus} onClick={() => setCaptureOpen(true)}>
            Capture a win
          </Btn>
        }
      >
        Not a straight line. A collection of things you made happen.
      </PageTitle>
      <div className="timeline-intro cream">
        <div>
          <span className="eyebrow">THE THREAD SO FAR</span>
          <h2>
            {state.profile.name || "Your story"}
            <span>{state.profile.headline || "A career in the making"}</span>
          </h2>
        </div>
        <div className="timeline-bookmark">
          <BookOpen />
          <strong>{chapters.length}</strong>
          <span>saved chapters</span>
        </div>
      </div>
      <div className="timeline-tools">
        <div className="search-field">
          <Search />
          <Input
            aria-label="Search timeline evidence"
            placeholder="Find an experience, skill, or contribution"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Choices label="Timeline filter" value={filter} onChange={setFilter} options={FILTERS} />
        {threads.length > 0 && (
          <div className="thread-chips">
            <span>Follow a thread</span>
            {threads.map((thread) => (
              <button
                aria-pressed={query === thread}
                onClick={() => setQuery(query === thread ? "" : thread)}
                key={thread}
              >
                {thread}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="timeline-workspace">
        <div className="career-rail">
          {years.map((year) => (
            <section className="career-year" key={year}>
              <div className="year-stamp">
                <span>{year}</span>
                <i />
              </div>
              <div className="chapter-list">
                {visible
                  .filter((chapter) => chapter.year === year)
                  .map((chapter, index) => {
                    const Icon = TIMELINE_SECTIONS[chapter.section].icon;
                    const key = chapter.section + ":" + chapter.id;
                    return (
                      <Reveal delay={Math.min(index * 0.035, 0.14)} key={key}>
                        <button
                          className={"career-chapter " + (key === openKey ? "chapter-active" : "")}
                          onClick={() => setOpenKey(openKey === key ? "" : key)}
                          aria-expanded={openKey === key}
                        >
                          <Icon size={22} />
                          <span>
                            <small>
                              {chapter.type}
                              {" \xB7 "}
                              {chapter.dates || "Dates not specified"}
                            </small>
                            <strong>{chapter.title || "Untitled chapter"}</strong>
                            <span>{chapter.org || "Independent experience"}</span>
                          </span>
                          <ArrowUpRight size={21} />
                        </button>
                        <AnimatePresence initial={false}>
                          {openKey === key && (
                            <motion.div
                              className="chapter-expanded"
                              initial={quiet ? false : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: quiet ? 0 : 0.23 }}
                            >
                              <div>
                                <p className="eyebrow">IN YOUR OWN WORDS</p>
                                <p className="chapter-evidence">
                                  {chapter.body || "Add a few details to preserve this part of your story."}
                                </p>
                                <button
                                  className="text-link"
                                  onClick={() =>
                                    go(chapter.section === "achievements" ? "/achievements" : "/profile/" + chapter.section)
                                  }
                                >
                                  {"Edit this chapter "}
                                  <ArrowRight size={16} />
                                </button>
                                <button className="text-link" onClick={() => go("/studio/rehearse")}>
                                  {"Practice telling this story "}
                                  <Play size={16} />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Reveal>
                    );
                  })}
              </div>
            </section>
          ))}
          {!visible.length && (
            <Blank
              title={chapters.length ? "No chapters match that thread." : "Every career starts with a chapter."}
              action={chapters.length ? "Clear filters" : "Add experience"}
              onAction={() => {
                if (chapters.length) {
                  setQuery("");
                  setFilter("All");
                } else {
                  go("/profile/experience");
                }
              }}
            >
              {chapters.length
                ? "A skill in your profile may not yet appear in your experience descriptions."
                : "Add a role, project, or achievement to see your story take shape."}
            </Blank>
          )}
          <div className="next-chapter-marker">
            <i />
            <span>The next chapter is yours.</span>
            <ArrowRight size={18} />
          </div>
        </div>
        <aside className="timeline-margin">
          <div className="margin-art">
            <span className="margin-number">↗</span>
            <Compass size={45} strokeWidth={1} />
            <h2>
              Connect.
              <br />
              Don’t invent.
            </h2>
            <p>Your timeline uses only entries you’ve saved in your profile.</p>
          </div>
          <p className="fine-print">
            Grouped by the first year in each entry’s dates. Undated entries stay visible. A keyword match is a thread to
            explore, not a verified qualification.
          </p>
          <Btn variant="outline" icon={NotebookPen} onClick={() => go("/tailor")}>
            Shape a new resume
          </Btn>
        </aside>
      </div>
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  );
}
