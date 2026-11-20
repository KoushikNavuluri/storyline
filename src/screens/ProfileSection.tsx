import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, GripVertical, Plus, Trash2 } from "lucide-react";
import { Blank, Btn, IconBtn, Modal, PageTitle, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { SECTION_KEYS, SECTION_LABELS, uid } from "@/state/factories";
import type { Entry, ListSectionKey, Profile, SectionKey } from "@/state/types";

/** Route segment under /profile/: "contact", "achievements", or a resume section key. */
export type ProfileSectionName = "contact" | "achievements" | SectionKey;

type EntryField = Exclude<keyof Entry, "id">;

export function ProfileSection({ section }: { section: ProfileSectionName | string }) {
  const { state, update, go, ask } = useStudio();
  const [editingId, setEditingId] = useState<string | null>(null);
  const profile = state.profile;
  const label: string | undefined = SECTION_LABELS[section as SectionKey];
  const change = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    update((current) => ({
      ...current,
      onboarded: true,
      profile: {
        ...current.profile,
        [key]: value,
      },
    }));
  const title =
    section === "contact"
      ? "Make it yours."
      : section === "achievements"
        ? "Keep the small wins."
        : label || "Profile section";
  if (!(["contact", "achievements", ...SECTION_KEYS] as string[]).includes(section))
    return <Blank title="Section not found" action="Open profile" onAction={() => go("/profile")} />;
  const listKey = section as ListSectionKey;
  const sectionValue = profile[section as keyof Profile];
  const entries: Entry[] = Array.isArray(sectionValue) ? (sectionValue as Entry[]) : [];
  const editing = entries.find((entry) => entry.id === editingId);
  const patch = (field: EntryField, value: string) =>
    change(
      listKey,
      entries.map((entry) =>
        entry.id === editingId
          ? {
              ...entry,
              [field]: value,
            }
          : entry,
      ),
    );
  const add = () => {
    const entry: Entry = {
      id: uid(),
      title: "",
      org: "",
      dates: "",
      body: "",
    };
    change(listKey, [...entries, entry]);
    setEditingId(entry.id);
  };
  const move = (index: number, offset: number) => {
    const next = [...entries];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change(listKey, next);
  };
  return (
    <div className="narrow">
      <button className="back-link" onClick={() => go("/profile")}>
        <ArrowLeft size={18} />
        Master profile
      </button>
      <PageTitle eyebrow="YOUR FOUNDATION" title={title}>
        {section === "contact"
          ? "Only include details you want in your resumes."
          : section === "achievements"
            ? "Capture real contributions while they’re fresh."
            : "Edits save to your account as you work."}
      </PageTitle>
      {section === "contact" ? (
        <>
          <FieldGroup>
            <TextField
              label="Full name"
              value={profile.name}
              onChange={(value) => change("name", value)}
              placeholder="Your name"
            />
            <TextField
              label="Professional headline"
              value={profile.headline}
              onChange={(value) => change("headline", value)}
              placeholder="What do you do?"
            />
            <TextField
              label="Location"
              value={profile.location}
              onChange={(value) => change("location", value)}
              placeholder="City, region"
            />
            <TextField
              label="Professional links"
              value={profile.links}
              onChange={(value) => change("links", value)}
              placeholder="Portfolio or professional website"
              hint="Use public professional links. No passwords or private credentials."
            />
          </FieldGroup>
          <Btn disabled={!profile.name.trim()} onClick={() => go("/direction")} icon={ArrowRight}>
            Continue
          </Btn>
        </>
      ) : section === "summary" || section === "skills" ? (
        <>
          <FieldGroup>
            <TextField
              area
              label={label}
              value={profile[section]}
              onChange={(value) => change(section, value)}
              rows={section === "summary" ? 9 : 5}
              hint={
                section === "skills"
                  ? "Separate skills with commas. Include only skills you actually have."
                  : "Use your own words. You can tailor this for individual opportunities later."
              }
            />
          </FieldGroup>
          <Btn onClick={() => go("/profile")} icon={Check}>
            Done
          </Btn>
        </>
      ) : (
        <>
          <div className="entry-list">
            {entries.map((entry, index) => (
              <div className="entry-row" key={entry.id}>
                <GripVertical size={18} />
                <button className="entry-text" onClick={() => setEditingId(entry.id)}>
                  <strong>{entry.title || "Untitled entry"}</strong>
                  <span>{[entry.org, entry.dates].filter(Boolean).join(" · ") || "Add the details"}</span>
                </button>
                <div className="entry-controls">
                  <IconBtn
                    icon={ArrowUp}
                    label={`Move ${entry.title || "entry"} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconBtn
                    icon={ArrowDown}
                    label={`Move ${entry.title || "entry"} down`}
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <IconBtn
                    icon={Trash2}
                    label={`Delete ${entry.title || "entry"}`}
                    onClick={() =>
                      ask(
                        "Delete this profile entry?",
                        "Saved documents will not change.",
                        () =>
                          change(
                            listKey,
                            entries.filter((item) => item.id !== entry.id),
                          ),
                        "Delete entry",
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          {!entries.length && (
            <Blank title={`Your ${title.toLowerCase()} belongs here.`}>
              Add a real contribution, credential, or experience. No need to fill every section.
            </Blank>
          )}
          <Btn onClick={add} icon={Plus}>
            {"Add "}
            {section === "experience" ? "experience" : "entry"}
          </Btn>
          <Modal
            open={!!editing}
            onClose={() => setEditingId(null)}
            title={`Edit ${label?.toLowerCase() || "achievement"}`}
            description="Saved to your account as you type. Close when you’re done."
            footer={
              <Btn onClick={() => setEditingId(null)} icon={Check}>
                Done
              </Btn>
            }
          >
            {editing && (
              <FieldGroup>
                <TextField
                  label={section === "experience" ? "Role" : "Title"}
                  value={editing.title}
                  onChange={(value) => patch("title", value)}
                />
                <TextField
                  label={section === "education" ? "Institution" : "Organization / context"}
                  value={editing.org}
                  onChange={(value) => patch("org", value)}
                />
                <TextField
                  label="Dates"
                  value={editing.dates}
                  onChange={(value) => patch("dates", value)}
                  placeholder="2022 to Present"
                />
                <TextField
                  area
                  label="Highlights"
                  value={editing.body}
                  onChange={(value) => patch("body", value)}
                  rows={6}
                  hint="One point per line. Include only outcomes you can support."
                />
              </FieldGroup>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
