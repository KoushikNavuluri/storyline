import { useState } from "react";
import { Ellipsis, Plus, Search } from "lucide-react";
import { Blank, Btn, Choices, PageTitle, Pick, Row } from "@/components/ui/app";
import { Input } from "@/components/ui/primitives";
import { DocTile } from "@/components/DocTile";
import { useStudio } from "@/state/context";
import { dateLabel } from "@/lib/download";

type DocFilter = "All" | "Resumes" | "Letters" | "Ready" | "Archived";
type DocSort = "Recent" | "A to Z";
type DocView = "Grid" | "List";

export function Documents() {
  const { state, go } = useStudio();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DocFilter>("All");
  const [sort, setSort] = useState<DocSort>("Recent");
  const [view, setView] = useState<DocView>("Grid");
  const docs = state.docs
    .filter(
      (doc) =>
        (filter === "Archived" ? doc.archived : !doc.archived) &&
        (filter === "Resumes"
          ? doc.kind === "resume"
          : filter === "Letters"
            ? doc.kind === "letter"
            : filter === "Ready"
              ? doc.status === "Ready"
              : true) &&
        `${doc.title} ${doc.company} ${doc.role}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => (sort === "A to Z" ? a.title.localeCompare(b.title) : b.updated.localeCompare(a.updated)));
  return (
    <>
      <PageTitle
        eyebrow="YOUR DOCUMENTS"
        title="Every version of your story."
        action={
          <Btn onClick={() => go("/tailor")} icon={Plus}>
            New resume
          </Btn>
        }
      >
        A place for drafts, possibilities, and the final word.
      </PageTitle>
      <div className="library-controls">
        <div className="search-field">
          <Search />
          <Input
            aria-label="Search documents"
            placeholder="Find a resume, company, or role"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Pick label="Sort" value={sort} onChange={(value) => setSort(value as DocSort)} options={["Recent", "A to Z"]} />
        <Choices<DocView> value={view} onChange={setView} options={["Grid", "List"]} label="Document view" />
      </div>
      <Choices<DocFilter>
        value={filter}
        onChange={setFilter}
        options={["All", "Resumes", "Letters", "Ready", "Archived"]}
        label="Document filter"
      />
      {docs.length ? (
        view === "Grid" ? (
          <div className="document-grid library-grid">
            {docs.map((doc, index) => (
              <div key={doc.id}>
                <DocTile doc={doc} index={index} />
                <button className="text-link doc-manage" onClick={() => go("/doc/" + doc.id)}>
                  {"Manage document "}
                  <Ellipsis size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {docs.map((doc) => (
              <Row
                title={doc.title}
                sub={`${doc.kind === "letter" ? "Cover letter" : doc.template} · ${doc.status} · ${dateLabel(doc.updated)}`}
                onClick={() => go("/doc/" + doc.id)}
                key={doc.id}
              />
            ))}
          </div>
        )
      ) : (
        <Blank
          title={query ? "No documents match that search." : "Room for your next story."}
          action={query ? "Clear search" : "Create a resume"}
          onAction={() => (query ? setQuery("") : go("/tailor"))}
        >
          {query ? "Try a company name or a shorter phrase." : "Your saved documents will appear here."}
        </Blank>
      )}
    </>
  );
}
