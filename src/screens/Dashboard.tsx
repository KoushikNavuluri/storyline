import { ArrowRight, ArrowUpRight, BriefcaseBusiness, ShieldCheck, UserRound } from "lucide-react";
import { Blank, Btn, PageTitle, Paper, Row } from "@/components/ui/app";
import { DocTile } from "@/components/DocTile";
import { StudioRibbon } from "@/screens/studio/StudioRibbon";
import { ChapterThreeTeaser } from "@/screens/studio/ChapterThreeTeaser";
import { useStudio } from "@/state/context";
import { makeDoc, SAMPLE_PROFILE } from "@/state/factories";
import { dateLabel } from "@/lib/download";

export function Dashboard() {
  const { state, go } = useStudio();
  const recent = state.docs
    .filter((doc) => !doc.archived)
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 3);
  const essentials = [
    state.profile.name,
    state.profile.headline,
    state.profile.summary,
    state.profile.experience.length || state.profile.projects.length,
    state.profile.education.length,
    state.profile.skills,
  ].filter(Boolean).length;
  return (
    <div className="dashboard">
      <PageTitle
        eyebrow={state.sample ? "SAMPLE WORKSPACE / ALEX’S STORY" : "YOUR CAREER STUDIO"}
        title={state.profile.name ? `A new chapter, ${state.profile.name.split(" ")[0]}.` : "Your next chapter starts here."}
        action={
          <Btn variant="outline" onClick={() => go("/applications")} icon={ArrowUpRight}>
            My applications
          </Btn>
        }
      >
        Good work deserves a good story.
      </PageTitle>
      <div className="dash-top">
        <section className="next-move lime">
          <p className="eyebrow">YOUR NEXT OPPORTUNITY</p>
          <h2>
            A stronger fit.
            <br />
            Not a different you.
          </h2>
          <p>
            Turn your real experience into
            <br className="desktop-only" />
            {" a resume that feels right for the role."}
          </p>
          <Btn onClick={() => go(state.profile.name ? "/tailor" : "/start")} icon={ArrowRight}>
            Tailor a resume
          </Btn>
          <div className="dash-paper">
            <Paper doc={recent[0] || makeDoc(SAMPLE_PROFILE)} mini />
          </div>
          <span className="panel-index">THE NEXT CHAPTER ↗</span>
        </section>
        <section className="profile-progress">
          <div className="section-head">
            <span className="eyebrow">THE FOUNDATION</span>
            <UserRound size={20} />
          </div>
          <h3>Your master profile</h3>
          <p>
            One source of truth.
            <br />
            Every version starts here.
          </p>
          <div className="completion-number">
            {essentials}
            <span>/ 6 essentials</span>
          </div>
          <div className="completion-bars" aria-label={`${essentials} of 6 profile essentials complete`}>
            {Array.from(
              {
                length: 6,
              },
              (_, index) => (
                <span className={index < essentials ? "filled" : ""} key={index} />
              ),
            )}
          </div>
          <button className="text-link" onClick={() => go("/profile")}>
            {essentials === 6 ? "Review your profile" : "Build your foundation"}
            <ArrowRight size={18} />
          </button>
        </section>
      </div>
      <StudioRibbon />
      <ChapterThreeTeaser />
      <div className="section-head">
        <h2>Your recent stories</h2>
        <button className="text-link" onClick={() => go("/docs")}>
          {"View all "}
          <ArrowUpRight size={18} />
        </button>
      </div>
      {recent.length ? (
        <div className="document-grid">
          {recent.map((doc, index) => (
            <DocTile doc={doc} index={index} key={doc.id} />
          ))}
        </div>
      ) : (
        <Blank title="Your first resume is a few steps away." action="Create a resume" onAction={() => go("/start")}>
          Start with a profile or explore the sample workflow.
        </Blank>
      )}
      <div className="dashboard-bottom">
        <div>
          <div className="section-head">
            <h2>On your horizon</h2>
            <button className="text-link" onClick={() => go("/applications")}>
              {"Open tracker "}
              <ArrowUpRight size={18} />
            </button>
          </div>
          {state.applications.length ? (
            state.applications
              .slice(0, 2)
              .map((application) => (
                <Row
                  icon={BriefcaseBusiness}
                  title={application.company}
                  sub={`${application.role} · ${application.stage}${application.reminder ? " · Follow up " + dateLabel(application.reminder) : ""}`}
                  onClick={() => go("/application/" + application.id)}
                  key={application.id}
                />
              ))
          ) : (
            <Row
              icon={BriefcaseBusiness}
              title="Keep an opportunity in view"
              sub="Save a role before you’re ready to apply"
              onClick={() => go("/application/new")}
            />
          )}
        </div>
        <div className="studio-note">
          <ShieldCheck />
          <h3>Your story stays yours.</h3>
          <p>Writing assistance works only from your own profile and never adds qualifications. You review every change.</p>
          <button className="text-link" onClick={() => go("/settings/ai")}>
            {"How assistance works "}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
