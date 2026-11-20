import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CircleQuestionMark,
  Download,
  Files,
  FileText,
  LogOut,
  Monitor,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserRound,
  UserX,
} from "lucide-react";
import { useStudio } from "@/state/context";
import { initialState, SECTION_KEYS } from "@/state/factories";
import type { Settings, StudioState } from "@/state/types";
import { dateLabel } from "@/lib/download";
import { supabase } from "@/lib/supabase";
import { Blank, Choices, Logo, Notice, PageTitle, Row, TextField } from "@/components/ui/app";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Input, Switch } from "@/components/ui/primitives";

export type SettingsSection = "appearance" | "privacy" | "ai" | "plans" | "help" | "account" | "reminders";

const TITLES: Record<SettingsSection, string> = {
  appearance: "Make room for comfort.",
  privacy: "Your story. Your control.",
  ai: "Helpful, not make-believe.",
  plans: "Clarity, including the cost.",
  help: "A little guidance.",
  account: "Your account.",
  reminders: "Follow through, thoughtfully.",
};

const THEMES = ["light", "dark", "system"] as const;

const SERVICES: [name: string, status: string][] = [
  ["Resume editing & versions", "Saved to your account"],
  ["PDF generation", "In your browser · Latin-script text"],
  ["Writing assistance", "Gemini, server-side · daily limit"],
  ["Resume import", "TXT, Markdown, PDF, or Word (DOCX)"],
  ["Keyword coverage", "Literal matching · not an ATS result"],
  ["Sign-in & cloud sync", "Connected · your Storyline account"],
  ["Payments & subscriptions", "Not connected"],
  ["Email & push notifications", "Not connected"],
];

const FAQ: [question: string, answer: string][] = [
  [
    "How do I start?",
    "Create your master profile, enter a job description, then review wording suggestions from the writing assistant. Edit the resume, save a named version, choose a template, and export. Associate that fixed version with an application.",
  ],
  [
    "What can I import?",
    "TXT, Markdown, PDF, and Word (DOCX) files up to 3 MB, or pasted text. The writing assistant reads the resume and proposes a profile; you review everything before it is saved.",
  ],
  [
    "Is the assistance real AI?",
    "Yes. Writing assistance uses Google Gemini through Storyline’s server, never directly from your browser. It works only from your own profile and the job details you provide, and never adds experience, metrics, or qualifications. Only the parts a request needs are sent, and you review every change. Requests count toward a daily limit; if assistance is unavailable, Storyline uses its built-in rules instead. Keyword coverage is literal matching, not an employer score.",
  ],
  [
    "Will my data be here tomorrow?",
    "Yes. Your work is saved to your account and is available when you sign in on another device. You can also export a JSON backup from Privacy & data.",
  ],
  [
    "How does PDF export work?",
    "Preview and PDF share the same page-layout model. PDF text is selectable. The built-in fonts support Latin-script text; unsupported characters trigger a warning and block PDF download rather than silently corrupting text.",
  ],
  [
    "Why are there multiple pages?",
    "Content flows onto additional pages when needed. Inspect each page or adjust margins, spacing, or content. Nothing is silently clipped.",
  ],
  [
    "Can I sign in or buy a plan?",
    "You are signed in with your Storyline account, which keeps your work saved and in sync. Payments and notifications are not connected. No card information is collected.",
  ],
];

type Loose = Record<string, unknown>;
const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null;

/** Same structural checks as the prototype's restore handler. */
function isBackup(value: unknown): value is StudioState {
  if (
    !isRecord(value) ||
    value.schema !== 1 ||
    !value.profile ||
    !value.settings ||
    !Array.isArray(value.docs) ||
    !Array.isArray(value.applications) ||
    !Array.isArray(value.usage) ||
    !Array.isArray(value.plans)
  )
    return false;
  const docs = value.docs as unknown[];
  if (!docs.every(isRecord)) return false;
  const profiles = [value.profile, ...(docs as Loose[]).map((doc) => doc.content)];
  for (const profile of profiles) {
    if (
      !isRecord(profile) ||
      typeof profile.name != "string" ||
      typeof profile.summary != "string" ||
      typeof profile.skills != "string" ||
      !profile.preferences
    )
      return false;
    for (const key of SECTION_KEYS.filter((section) => !["summary", "skills"].includes(section))) {
      const list = profile[key];
      if (!Array.isArray(list) || list.some((entry) => !isRecord(entry) || typeof entry.body != "string")) return false;
    }
  }
  if (
    (docs as Loose[]).some(
      (doc) => !doc.id || !Array.isArray(doc.order) || !Array.isArray(doc.versions) || !Array.isArray(doc.hidden),
    ) ||
    (value.applications as unknown[]).some((application) => !isRecord(application) || !Array.isArray(application.events))
  )
    return false;
  return true;
}

export function SettingsView({ section }: { section?: SettingsSection | string }) {
  const { state, update, go, ask, exportData, seed, email, signOut } = useStudio();
  const [restoreError, setRestoreError] = useState("");

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    update((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
      },
    }));

  const title = TITLES[section as SettingsSection] || "A studio that fits you.";

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 15e6) throw Error();
      const backup: unknown = JSON.parse(await file.text());
      if (!isBackup(backup)) throw Error();
      ask(
        "Replace your saved workspace?",
        "Your current data will be replaced with this Storyline backup. Download your current backup first if needed.",
        () => {
          update(backup);
          go("/home");
          toast.success("Backup restored");
        },
        "Restore backup",
      );
      setRestoreError("");
    } catch {
      setRestoreError(
        "This is not a compatible Storyline backup. Choose a JSON file exported from this app. Your current work has not changed.",
      );
    }
    event.target.value = "";
  };

  const deleteAccount = async () => {
    try {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      toast.success("Your account has been deleted");
      await signOut();
    } catch {
      toast.error("Your account could not be deleted. Nothing has changed. Try again in a moment.");
    }
  };

  return (
    <div className="settings-layout">
      <div>
        <button className="back-link" onClick={() => go(section ? "/settings" : "/profile")}>
          <ArrowLeft size={18} />
          {section ? "Settings" : "Profile"}
        </button>
        <PageTitle eyebrow="STUDIO SETTINGS" title={title} />
        {section ? null : (
          <>
            <Row
              icon={Monitor}
              title="Appearance & accessibility"
              sub="Theme, text size, and motion"
              onClick={() => go("/settings/appearance")}
            />
            <Row
              icon={ShieldCheck}
              title="Privacy & data"
              sub="Saved to your account, backup, and restore"
              onClick={() => go("/settings/privacy")}
            />
            <Row
              icon={Sparkles}
              title="AI & service status"
              sub="Writing assistance, limits, and what is sent"
              onClick={() => go("/settings/ai")}
            />
            <Row
              icon={Files}
              title="Plans & usage"
              sub="Editable product configuration, no payments"
              onClick={() => go("/settings/plans")}
            />
            <Row
              icon={Calendar}
              title="Reminders"
              sub="Your upcoming in-app follow-ups"
              onClick={() => go("/settings/reminders")}
            />
            <Row
              icon={CircleQuestionMark}
              title="Help"
              sub="Imports, exports, and common questions"
              onClick={() => go("/settings/help")}
            />
            <Row
              icon={UserRound}
              title="Account & workspace"
              sub="Sign-in, sample data, and deleting your data"
              onClick={() => go("/settings/account")}
            />
          </>
        )}
        {section === "appearance" && (
          <>
            <div className="theme-preview lilac">
              <div className="theme-paper">
                <FileText size={40} />
                <span>
                  Same story.
                  <br />
                  Your setting.
                </span>
              </div>
            </div>
            <h2>Appearance</h2>
            <Choices
              value={state.settings.theme}
              onChange={(value) => setSetting("theme", value)}
              options={THEMES}
              label="Appearance theme"
            />
            <div className="setting-row">
              <div>
                <strong>Reduce motion</strong>
                <p>Keep transitions quiet. System preferences are also respected.</p>
              </div>
              <Switch
                checked={state.settings.motion}
                onCheckedChange={(checked) => setSetting("motion", checked)}
                aria-label="Reduce motion"
              />
            </div>
            <div className="setting-row">
              <div>
                <strong>Larger interface text</strong>
                <p>Your exported resume keeps its own typography.</p>
              </div>
              <Switch
                checked={state.settings.large}
                onCheckedChange={(checked) => setSetting("large", checked)}
                aria-label="Larger interface text"
              />
            </div>
            <Notice title="Paper stays paper">
              Dark mode changes your workspace, not the appearance of an exported resume.
            </Notice>
          </>
        )}
        {section === "privacy" && (
          <>
            <Notice title="Saved to your account" tone="mint">
              Profiles, documents, and applications are saved to your Storyline account, so they are there when you
              sign in on any device. Signing out does not remove them. Download a backup whenever you want a copy of
              your own.
            </Notice>
            <h2>A private-by-default workflow</h2>
            <p>
              Resume content is sent to the writing assistant (Gemini) only when you ask for assistance, and only the
              parts that request needs. Nothing is sent to analytics or a public sharing service. Public sharing is not
              enabled.
            </p>
            <Row
              icon={Download}
              title="Download a data backup"
              sub="Your profile, documents, versions, and applications as JSON"
              onClick={exportData}
            />
            <div className="restore-block">
              <h3>Restore a Storyline backup</h3>
              <p>Only restore files you trust. You’ll confirm before replacing any data.</p>
              <Input type="file" accept=".json" aria-label="Restore Storyline backup" onChange={restore} />
              {restoreError && (
                <Notice title="Backup not restored" icon={TriangleAlert}>
                  {restoreError}
                </Notice>
              )}
            </div>
            <Row
              icon={Trash2}
              title="Delete my data or account"
              sub="Review the impact before removing data"
              onClick={() => go("/settings/account")}
            />
          </>
        )}
        {section === "ai" && (
          <>
            <Notice title="Writing assistance (Gemini) · grounded in your profile" tone="cream">
              Wording suggestions, cover letters, follow-ups, interview prompts, and resume import use Google Gemini
              through Storyline’s server. It works only from your own profile and the job details you provide, and never
              adds experience, metrics, or qualifications. You review every change. Requests count toward a daily
              limit.
            </Notice>
            <div className="service-list">
              {SERVICES.map(([name, status]) => (
                <div className="service-row" key={name}>
                  <strong>{name}</strong>
                  <span>{status}</span>
                </div>
              ))}
            </div>
            <p>
              What is sent: only the parts of your profile, document, or job description that a request needs, and
              only when you ask. Your sign-in details are never sent to the assistant. If assistance is unavailable or
              the daily limit is reached, Storyline uses its built-in rules instead. Never paste passwords or payment
              details into your documents.
            </p>
          </>
        )}
        {section === "plans" && (
          <>
            <Notice title="Product configuration, not a subscription">
              These editable tiers are planning settings only. Changing them does not activate a plan or charge money.
            </Notice>
            <div className="plan-config">
              {state.plans.map((plan, planIndex) => (
                <div className="plan-row" key={planIndex}>
                  <h2>{plan.name}</h2>
                  <TextField
                    type="number"
                    min="0"
                    max="10000"
                    label="Proposed monthly AI allowance"
                    value={plan.limit}
                    onChange={(value) =>
                      update((current) => ({
                        ...current,
                        plans: current.plans.map((item, index) =>
                          planIndex === index
                            ? {
                                ...item,
                                limit: Math.max(0, Math.min(1e4, Number(value) || 0)),
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                  <p>No price configured. Checkout is unavailable.</p>
                </div>
              ))}
            </div>
            <h2>Assistance history</h2>
            {state.usage.length ? (
              state.usage
                .slice()
                .reverse()
                .map((entry) => (
                  <div className="service-row" key={entry.id}>
                    <span>{entry.action}</span>
                    <small>{dateLabel(entry.date)}</small>
                  </div>
                ))
            ) : (
              <p>No assistance runs yet. Editing and PDF export do not count toward your daily assistance limit.</p>
            )}
          </>
        )}
        {section === "reminders" && (
          <>
            <div className="setting-row">
              <div>
                <strong>Show in-app follow-ups</strong>
                <p>No email or push notification service is connected.</p>
              </div>
              <Switch
                checked={state.settings.reminders}
                onCheckedChange={(checked) => setSetting("reminders", checked)}
                aria-label="Show in-app follow-ups"
              />
            </div>
            {state.settings.reminders ? (
              state.applications
                .filter((application) => application.reminder)
                .sort((a, b) => a.reminder.localeCompare(b.reminder))
                .map((application) => (
                  <Row
                    icon={Calendar}
                    title={application.company + " · " + dateLabel(application.reminder)}
                    sub={application.role}
                    onClick={() => go("/application/" + application.id)}
                    key={application.id}
                  />
                ))
            ) : (
              <p>In-app follow-ups are hidden. Your saved dates are preserved.</p>
            )}
            {!state.applications.some((application) => application.reminder) && (
              <Blank
                title="Nothing to follow up on yet."
                action="Open applications"
                onAction={() => go("/applications")}
              >
                Add a follow-up date to an opportunity.
              </Blank>
            )}
          </>
        )}
        {section === "help" && (
          <Accordion type="single" collapsible defaultValue="h0">
            {FAQ.map(([question, answer], index) => (
              <AccordionItem value={"h" + index} key={question}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent>{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
        {section === "account" && (
          <>
            <Notice title={email ? `Signed in as ${email}` : "Signed in"}>
              Your work is saved to your Storyline account. There are no subscription charges to manage.
            </Notice>
            <Row
              icon={Download}
              title="Back up my work"
              sub="Recommended before trying sample data or deleting anything"
              onClick={exportData}
            />
            <Row
              icon={BookOpen}
              title="Load the sample workspace"
              sub="Replace your saved work with Alex’s fictional career profile"
              onClick={() =>
                ask(
                  "Replace with sample data?",
                  `This replaces your profile, ${state.docs.length} documents, and ${state.applications.length} applications. Export a backup first if you want to keep them.`,
                  seed,
                  "Load sample",
                )
              }
            />
            <Row
              icon={Trash2}
              title="Delete all my data"
              sub="Profile, documents, versions, applications, and settings"
              onClick={() =>
                ask(
                  "Delete your saved workspace?",
                  `Remove your profile, ${state.docs.length} documents including their versions, and ${state.applications.length} applications from your account? You stay signed in. Downloaded files are not removed.`,
                  () => {
                    update(initialState());
                    go("/welcome");
                    toast.success("Workspace cleared");
                  },
                  "Delete my data",
                )
              }
            />
            <Row icon={LogOut} title="Sign out" sub="Your work stays saved to your account" onClick={() => void signOut()} />
            <Row
              icon={UserX}
              title="Delete my account"
              sub="Permanently remove your account and everything saved to it"
              onClick={() =>
                ask(
                  "Delete your Storyline account?",
                  `This permanently removes your account, your profile, ${state.docs.length} documents including their versions, and ${state.applications.length} applications. Download a backup first if you want a copy. This cannot be undone.`,
                  () => void deleteAccount(),
                  "Delete my account",
                )
              }
            />
          </>
        )}
      </div>
      <aside className="settings-note">
        <Logo />
        <p>
          Your experience.
          <br />
          Your decisions.
          <br />
          Always your story.
        </p>
        <span className="eyebrow">STORYLINE / V1</span>
        <button className="text-link" onClick={() => go("/home")}>
          {"Back to the studio "}
          <ArrowRight size={18} />
        </button>
      </aside>
    </div>
  );
}
