import { useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Calendar, Plus, Search } from "lucide-react";
import { Blank, Btn, Choices, PageTitle } from "@/components/ui/app";
import { Badge, Input } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { STAGES } from "@/state/factories";
import { dateLabel } from "@/lib/download";

export function Applications() {
  const { state, go } = useStudio();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string>("All");
  const visible = state.applications.filter(
    (application) =>
      (stage === "All" || application.stage === stage) &&
      `${application.company} ${application.role}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="THE OPPORTUNITIES AHEAD"
        title="Keep your next move in view."
        action={
          <Btn onClick={() => go("/application/new")} icon={Plus}>
            Save an opportunity
          </Btn>
        }
      >
        The role. The right resume. What comes next.
      </PageTitle>
      <div className="tracker-intro cream">
        <BriefcaseBusiness size={35} strokeWidth={1} />
        <p>
          Not just applications.
          <br />
          <strong>Possibilities, thoughtfully organized.</strong>
        </p>
        <span>
          {state.applications.filter((application) => !["Closed", "Offer"].includes(application.stage)).length}
          {" active opportunities"}
        </span>
      </div>
      <div className="search-field">
        <Search />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search company or role"
          aria-label="Search applications"
        />
      </div>
      <Choices<string> value={stage} onChange={setStage} options={["All", ...STAGES]} label="Application stage" />
      <div className="application-list">
        {visible.map((application) => (
          <button className="application-card" onClick={() => go("/application/" + application.id)} key={application.id}>
            <span className="company-mark">{application.company.slice(0, 1).toUpperCase()}</span>
            <span className="application-title">
              <strong>{application.company}</strong>
              <span>{application.role}</span>
              {application.reminder && state.settings.reminders && (
                <small>
                  <Calendar size={14} />
                  {"Follow up "}
                  {dateLabel(application.reminder)}
                </small>
              )}
            </span>
            <Badge variant="outline">{application.stage}</Badge>
            <ArrowUpRight size={20} />
          </button>
        ))}
      </div>
      {!visible.length && (
        <Blank
          title={query || stage !== "All" ? "No opportunities in this view." : "Your next possibility belongs here."}
          action="Save an opportunity"
          onAction={() => go("/application/new")}
        >
          Save a role now. Get your documents ready when you are.
        </Blank>
      )}
    </>
  );
}
