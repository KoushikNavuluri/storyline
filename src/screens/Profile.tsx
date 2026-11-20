import { ArrowRight, ArrowUpRight, BookOpen, BriefcaseBusiness, FileText, PenLine, Settings, UserRound } from "lucide-react";
import { Btn, IconBtn, Notice, PageTitle, Row } from "@/components/ui/app";
import { useStudio } from "@/state/context";
import { SECTION_KEYS, SECTION_LABELS } from "@/state/factories";

export function Profile() {
  const { state, go } = useStudio();
  const profile = state.profile;
  return (
    <div className="profile-layout">
      <div>
        <PageTitle eyebrow={state.sample ? "SAMPLE / MASTER PROFILE" : "MASTER PROFILE"} title="The full picture.">
          One source for every version of your story.
        </PageTitle>
        <div className="identity-block">
          <span className="initials large">
            {profile.name
              ? profile.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
              : "S"}
          </span>
          <div>
            <h2>{profile.name || "Make it yours"}</h2>
            <p>{profile.headline || "Add your name and professional headline"}</p>
            <p>{profile.location}</p>
          </div>
          <IconBtn icon={PenLine} label="Edit contact information" onClick={() => go("/profile/contact")} />
        </div>
        <Row
          icon={UserRound}
          title="Contact & headline"
          sub={profile.links || "Your name, location, and professional links"}
          onClick={() => go("/profile/contact")}
        />
        {SECTION_KEYS.map((key) => {
          const value = profile[key];
          return (
            <Row
              icon={key === "experience" ? BriefcaseBusiness : key === "education" ? BookOpen : FileText}
              title={SECTION_LABELS[key]}
              sub={
                typeof value == "string"
                  ? value
                    ? "Added"
                    : "Add your " + SECTION_LABELS[key].toLowerCase()
                  : `${value?.length || 0} ${value?.length === 1 ? "entry" : "entries"}`
              }
              onClick={() => go("/profile/" + key)}
              key={key}
            />
          );
        })}
      </div>
      <aside>
        <div className="profile-side lilac">
          <FileText size={42} strokeWidth={1} />
          <h2>
            More than
            <br />a job title.
          </h2>
          <p>Your projects, detours, and small wins belong here too.</p>
          <Btn variant="outline" onClick={() => go("/achievements")} icon={ArrowRight}>
            Achievement bank
          </Btn>
        </div>
        <Notice title="Your versions stay yours">
          Profile edits do not change saved resumes. New resumes use your latest profile.
        </Notice>
        <Row
          icon={ArrowUpRight}
          title="Career direction"
          sub="Target roles and work preferences"
          onClick={() => go("/direction")}
        />
        <Row
          icon={Settings}
          title="Settings & privacy"
          sub="Appearance, backups, and account data"
          onClick={() => go("/settings")}
        />
      </aside>
    </div>
  );
}
