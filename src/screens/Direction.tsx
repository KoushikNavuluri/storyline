import { ArrowRight } from "lucide-react";
import { Btn, PageTitle, Pick, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import type { Profile } from "@/state/types";

type PreferenceKey = keyof Profile["preferences"];

export function Direction() {
  const { state, update, go } = useStudio();
  const change = (key: PreferenceKey, value: string) =>
    update((current) => ({
      ...current,
      profile: {
        ...current.profile,
        preferences: {
          ...current.profile.preferences,
          [key]: value,
        },
      },
    }));
  return (
    <div className="narrow">
      <PageTitle eyebrow="OPTIONAL / CAREER DIRECTION" title="Where would you like to go?">
        A little direction helps. You can change it anytime.
      </PageTitle>
      <FieldGroup>
        <TextField
          label="Target roles"
          value={state.profile.preferences.roles}
          onChange={(value) => change("roles", value)}
          placeholder="e.g. Product Designer"
        />
        <TextField
          label="Preferred location"
          value={state.profile.preferences.location}
          onChange={(value) => change("location", value)}
        />
        <Pick
          label="Work arrangement"
          value={state.profile.preferences.arrangement}
          onChange={(value) => change("arrangement", value)}
          options={["Flexible", "Remote", "Hybrid", "On-site"]}
        />
      </FieldGroup>
      <div className="actions">
        <Btn variant="outline" onClick={() => go("/home")}>
          Skip for now
        </Btn>
        <Btn
          onClick={() => {
            update({
              onboarded: true,
            });
            go("/home");
          }}
        >
          {"Open my workspace "}
          <ArrowRight />
        </Btn>
      </div>
    </div>
  );
}
