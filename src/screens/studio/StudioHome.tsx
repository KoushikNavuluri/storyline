import { ArrowRight, ArrowUpRight, BookOpen, CheckCheck, GitCompareArrows, Play } from "lucide-react";
import { useStudio } from "@/state/context";
import { Btn, PageTitle, Reveal } from "@/components/ui/app";

/** Chapter-two landing page: cover illustration plus the editorial grid of studio spaces. */
export function StudioHome() {
  const { state, go } = useStudio();
  const sessions = state.studio?.sessions || [];
  return (
    <div className="chapter-studio">
      <PageTitle eyebrow="STORYLINE / CHAPTER TWO" title="A little perspective. A lot of possibility.">
        Three spaces to connect the dots, make a choice, and find your voice.
      </PageTitle>
      <Reveal>
        <section className="studio-cover lilac">
          <div>
            <span className="eyebrow">THE BIGGER PICTURE</span>
            <h2>
              You’re more than
              <br />
              your next application.
            </h2>
            <p>
              See where you’ve been.
              <br />
              Decide where you want to go.
            </p>
            <Btn onClick={() => go("/studio/timeline")} icon={ArrowRight}>
              Explore my timeline
            </Btn>
          </div>
          <div className="chapter-illustration" aria-hidden="true">
            <div className="chapter-sheet back-sheet">
              <span>EXPERIENCE</span>
            </div>
            <div className="chapter-sheet front-sheet">
              <BookOpen size={40} />
              <span>YOUR STORY</span>
              <strong>
                Still being
                <br />
                written.
              </strong>
              <div className="drawn-path">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
          <span className="cover-caption">YOUR PAST IS A STARTING POINT. NOT A LIMIT.</span>
        </section>
      </Reveal>
      <div className="studio-editorial-grid">
        <Reveal delay={0.05}>
          <button className="studio-feature" onClick={() => go("/studio/compare")}>
            <div className="feature-symbol">
              <GitCompareArrows size={34} />
              <ArrowUpRight size={24} />
            </div>
            <span className="eyebrow">THE DECISION DESK</span>
            <h2>
              A good role.
              <br />A better fit for you.
            </h2>
            <p>Compare opportunities against what you value, not someone else’s definition of success.</p>
            <span className="feature-link">
              {"Open comparison "}
              <ArrowRight />
            </span>
          </button>
        </Reveal>
        <Reveal delay={0.1}>
          <button className="studio-feature" onClick={() => go("/studio/rehearse")}>
            <div className="feature-symbol">
              <Play size={34} />
              <ArrowUpRight size={24} />
            </div>
            <span className="eyebrow">THE REHEARSAL ROOM</span>
            <h2>
              Find the words.
              <br />
              Then make them yours.
            </h2>
            <p>One prompt at a time. A quiet timer. Real evidence from your experience.</p>
            <span className="feature-link">
              {state.studio?.practice ? "Resume my practice" : "Step inside"} <ArrowRight />
            </span>
          </button>
        </Reveal>
      </div>
      {sessions.length > 0 && (
        <div className="studio-footnote">
          <CheckCheck size={20} />
          <p>
            {sessions.length}
            {" saved "}
            {sessions.length === 1 ? "practice session" : "practice sessions"}. Your notes are ready whenever you are.
          </p>
          <button className="text-link" onClick={() => go("/studio/rehearse")}>
            {"Review notes "}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
