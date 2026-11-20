/** App frame and route table (port of the prototype root's render). Screens load lazily per route. */
import { lazy, Suspense } from "react";
import { BriefcaseBusiness, Check, ChevronRight, Files, House, Mail, Settings, ShieldCheck, FileText, BookOpen, UserRound } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Badge } from "@/components/ui/primitives";
import { Blank, Btn, IconBtn, Logo, Modal, Row } from "@/components/ui/app";
import { useStudio } from "@/state/context";
import { makeDoc } from "@/state/factories";
import { SAVE_FAILED } from "@/state/sync";
import type { AskState } from "@/state/StudioProvider";
import { StudioCommand } from "./StudioCommand";

const Welcome = lazy(() => import("@/screens/Welcome").then((m) => ({ default: m.Welcome })));
const Start = lazy(() => import("@/screens/Start").then((m) => ({ default: m.Start })));
const ImportFlow = lazy(() => import("@/screens/ImportFlow").then((m) => ({ default: m.ImportFlow })));
const Direction = lazy(() => import("@/screens/Direction").then((m) => ({ default: m.Direction })));
const Dashboard = lazy(() => import("@/screens/Dashboard").then((m) => ({ default: m.Dashboard })));
const Documents = lazy(() => import("@/screens/Documents").then((m) => ({ default: m.Documents })));
const DocumentDetail = lazy(() => import("@/screens/DocumentDetail").then((m) => ({ default: m.DocumentDetail })));
const Profile = lazy(() => import("@/screens/Profile").then((m) => ({ default: m.Profile })));
const ProfileSection = lazy(() => import("@/screens/ProfileSection").then((m) => ({ default: m.ProfileSection })));
const Tailor = lazy(() => import("@/screens/Tailor").then((m) => ({ default: m.Tailor })));
const Editor = lazy(() => import("@/screens/Editor").then((m) => ({ default: m.Editor })));
const Templates = lazy(() => import("@/screens/Templates").then((m) => ({ default: m.Templates })));
const History = lazy(() => import("@/screens/History").then((m) => ({ default: m.History })));
const ExportView = lazy(() => import("@/screens/ExportView").then((m) => ({ default: m.ExportView })));
const Applications = lazy(() => import("@/screens/Applications").then((m) => ({ default: m.Applications })));
const ApplicationDetail = lazy(() => import("@/screens/ApplicationDetail").then((m) => ({ default: m.ApplicationDetail })));
const Followup = lazy(() => import("@/screens/Followup").then((m) => ({ default: m.Followup })));
const Interview = lazy(() => import("@/screens/Interview").then((m) => ({ default: m.Interview })));
const CoverBrief = lazy(() => import("@/screens/CoverBrief").then((m) => ({ default: m.CoverBrief })));
const SettingsView = lazy(() => import("@/screens/Settings").then((m) => ({ default: m.SettingsView })));
const StudioHome = lazy(() => import("@/screens/studio/StudioHome").then((m) => ({ default: m.StudioHome })));
const NextChapterLinks = lazy(() => import("@/screens/studio/NextChapterLinks").then((m) => ({ default: m.NextChapterLinks })));
const LaunchPlan = lazy(() => import("@/screens/studio/Launch").then((m) => ({ default: m.LaunchPlan })));
const PitchStudio = lazy(() => import("@/screens/studio/Pitch").then((m) => ({ default: m.PitchStudio })));
const StoryDeck = lazy(() => import("@/screens/studio/Deck").then((m) => ({ default: m.StoryDeck })));
const StoryTimeline = lazy(() => import("@/screens/studio/Timeline").then((m) => ({ default: m.StoryTimeline })));
const OpportunityCompare = lazy(() => import("@/screens/studio/Compare").then((m) => ({ default: m.OpportunityCompare })));
const RehearsalRoom = lazy(() => import("@/screens/studio/Rehearsal").then((m) => ({ default: m.RehearsalRoom })));

const NAV = [
  ["Home", House, "/home"],
  ["Documents", Files, "/docs"],
  ["Applications", BriefcaseBusiness, "/applications"],
  ["Profile", UserRound, "/profile"],
] as const;

const ONBOARDING = ["/welcome", "/start", "/import", "/review-import", "/direction"];

function useScreen() {
  const { state, update, route, go, seed } = useStudio();
  const parts = route.split("/").filter(Boolean);
  const id = parts[1];
  const doc = state.docs.find((d) => d.id === id);

  if (route === "/welcome") return <Welcome seed={seed} />;
  if (route === "/start") return <Start />;
  if (route === "/import" || route === "/review-import") return <ImportFlow review={route === "/review-import"} />;
  if (route === "/direction") return <Direction />;
  if (route === "/home") return <Dashboard />;
  if (route === "/studio")
    return (
      <>
        <StudioHome />
        <NextChapterLinks />
      </>
    );
  if (route === "/studio/launch") return <LaunchPlan />;
  if (route === "/studio/pitch") return <PitchStudio />;
  if (route === "/studio/deck" || route === "/studio/deck/present") return <StoryDeck present={parts[2] === "present"} />;
  if (route === "/studio/timeline") return <StoryTimeline />;
  if (route === "/studio/compare") return <OpportunityCompare />;
  if (parts[0] === "studio" && parts[1] === "rehearse") return <RehearsalRoom applicationId={parts[2]} />;
  if (route === "/docs") return <Documents />;
  if (parts[0] === "doc" && doc) return <DocumentDetail doc={doc} />;
  if (parts[0] === "profile")
    return id ? (
      <ProfileSection section={id} />
    ) : (
      <>
        <Profile />
        <div className="actions">
          <Btn
            disabled={!state.profile.name.trim()}
            icon={FileText}
            onClick={() => {
              const created = makeDoc(state.profile, { title: "My master resume" });
              update((s) => ({ ...s, docs: [created, ...s.docs] }));
              go("/editor/" + created.id + "/Content");
              toast.success("Independent resume created from your profile");
            }}
          >
            Create a general resume
          </Btn>
        </div>
      </>
    );
  if (route === "/achievements") return <ProfileSection section="achievements" />;
  if (route === "/tailor") return <Tailor />;
  if (parts[0] === "editor" && doc) return <Editor key={doc.id} doc={doc} tab={parts[2] || "Content"} />;
  if (parts[0] === "templates" && doc) return <Templates doc={doc} />;
  if (parts[0] === "history" && doc) return <History doc={doc} />;
  if (parts[0] === "export" && doc) return <ExportView doc={doc} />;
  if (route === "/applications") return <Applications />;
  if (parts[0] === "application")
    return (
      <>
        <ApplicationDetail id={id} />
        {id !== "new" && state.applications.some((a) => a.id === id) && (
          <Row
            icon={Mail}
            title="Prepare a follow-up"
            sub="Write a thoughtful note. Nothing is sent automatically."
            onClick={() => go("/followup/" + id)}
          />
        )}
      </>
    );
  if (parts[0] === "followup") return <Followup id={id} />;
  if (parts[0] === "interview")
    return (
      <>
        <Interview id={id} />
        {state.applications.some((a) => a.id === id) && (
          <div className="actions">
            <Btn icon={BookOpen} onClick={() => go("/studio/rehearse/" + id)}>
              Enter the rehearsal room
            </Btn>
          </div>
        )}
      </>
    );
  if (parts[0] === "cover") return <CoverBrief applicationId={id} />;
  if (parts[0] === "settings") return <SettingsView section={id} />;
  return (
    <Blank title="This page is no longer available." action="Go home" onAction={() => go("/home")}>
      The document may have been deleted. Your other work is still here.
    </Blank>
  );
}

export function Shell({
  askState,
  closeAsk,
  online,
}: {
  askState: AskState | null;
  closeAsk: () => void;
  online: boolean;
}) {
  const { state, update, route, go, save, exportData } = useStudio();
  const current = useScreen();

  const section = /^\/(application|interview|followup)/.test(route)
    ? "Applications"
    : route.startsWith("/profile") || route.startsWith("/settings") || route === "/achievements"
      ? "Profile"
      : /^\/(docs|doc|editor|history|templates|export|cover)/.test(route)
        ? "Documents"
        : "Home";
  const onboarding = ONBOARDING.includes(route);
  const focused = /^\/(editor|export|templates|history)/.test(route);

  return (
    <>
      <div className={`app ${onboarding ? "onboarding" : ""} ${focused ? "focused" : ""}`}>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          Skip to content
        </a>
        <aside className="sidebar">
          <button className="logo-button" onClick={() => go(state.onboarded ? "/home" : "/welcome")}>
            <Logo />
          </button>
          <p className="sidebar-tag">
            Shape your next
            <br />
            career move.
          </p>
          <nav aria-label="Main navigation">
            {NAV.map(([label, Icon, path]) => (
              <button
                className={section === label && !onboarding ? "nav-item active" : "nav-item"}
                onClick={() => go(path)}
                key={label}
              >
                <Icon />
                {label}
                {section === label && !onboarding && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="local-label">
              <ShieldCheck size={18} />
              <span>
                Private to your account
                <br />
                <small>Writing assistance never invents</small>
              </span>
            </div>
            <button className="nav-item" onClick={() => go("/settings")}>
              <Settings />
              Settings & help
            </button>
            <button className="profile-mini" onClick={() => go("/profile")}>
              <span className="initials">
                {state.profile.name
                  ?.split(" ")
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("") || "S"}
              </span>
              <span>
                {state.profile.name || "Your workspace"}
                <small>{state.sample ? "Sample profile" : "Synced to your account"}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </aside>
        <div className="app-body">
          <header className="topbar">
            <div className="topbar-left">
              <button className="mobile-wordmark logo-button" onClick={() => go(state.onboarded ? "/home" : "/welcome")}>
                <Logo />
              </button>
              <span className="desktop-crumb">
                {onboarding ? "A new chapter" : focused ? "Your document studio" : section}
              </span>
            </div>
            <div className="topbar-right">
              <span className="save-state">
                <Check size={14} />
                {save}
              </span>
              {state.sample && <Badge variant="outline">Sample workspace</Badge>}
              <StudioCommand />
              <IconBtn icon={Settings} label="Open settings" variant="ghost" onClick={() => go("/settings")} />
            </div>
          </header>
          {!online && (
            <div className="connection-bar">
              No connection detected. Keep editing; your changes will sync when you reconnect.
            </div>
          )}
          {save === SAVE_FAILED && (
            <div className="connection-bar">
              {"Your work is safe in this tab, but it could not be saved to your account. "}
              <button onClick={exportData}>Download a backup</button>
              <button onClick={() => update((s) => ({ ...s }))}>Retry saving</button>
            </div>
          )}
          <main id="main-content" tabIndex={-1} className="main-content" key={route.split("/").slice(0, 2).join("/")}>
            <Suspense fallback={null}>{current}</Suspense>
          </main>
          {!onboarding && !focused && (
            <nav className="bottom-nav" aria-label="Mobile navigation">
              {NAV.map(([label, Icon, path]) => (
                <button
                  onClick={() => go(path)}
                  className={section === label ? "selected" : ""}
                  aria-current={section === label ? "page" : undefined}
                  key={label}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
      <Modal
        open={!!askState}
        onClose={closeAsk}
        title={askState?.title || ""}
        description={askState?.description}
        footer={
          <>
            <Btn variant="outline" onClick={closeAsk}>
              Cancel
            </Btn>
            <Btn
              onClick={() => {
                const action = askState?.action;
                closeAsk();
                action?.();
              }}
            >
              {askState?.button}
            </Btn>
          </>
        }
      />
      <Toaster position="bottom-center" duration={2200} offset={90} closeButton />
    </>
  );
}
