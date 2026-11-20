import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Download,
  Eye,
  EyeOff,
  Layers,
  Maximize,
  Minimize,
  PenLine,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Blank, Btn, Choices, IconBtn, Modal, Notice, PageTitle, TextField, useQuietMotion } from "@/components/ui/app";
import { Checkbox, FieldGroup } from "@/components/ui/primitives";
import { useStudio } from "@/state/context";
import { emptyDeck, now, uid } from "@/state/factories";
import { downloadBlob } from "@/lib/download";
import type { Deck, DeckCard, Entry } from "@/state/types";

type DeckSourceSection = "achievements" | "projects" | "experience" | "volunteering";

const DECK_SOURCE_SECTIONS: DeckSourceSection[] = ["achievements", "projects", "experience", "volunteering"];

/** A profile entry offered in the "add from profile" dialog. */
type DeckSource = Entry & { key: string; section: DeckSourceSection };

type EditableCardField = "title" | "context" | "body" | "notes";

export function StoryDeck({ present = false }: { present?: boolean }) {
  const { state, update, go, ask } = useStudio();
  const quiet = useQuietMotion();
  const deck: Deck = state.studio?.deck || emptyDeck();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [finished, setFinished] = useState(false);

  const sources: DeckSource[] = DECK_SOURCE_SECTIONS.flatMap((section) =>
    (state.profile[section] || []).map((entry) => ({
      ...entry,
      key: section + ":" + entry.id,
      section,
    })),
  );

  const patch = (changes: Partial<Deck>) =>
    update((current) => ({
      ...current,
      studio: {
        ...current.studio,
        deck: {
          ...emptyDeck(),
          ...current.studio?.deck,
          ...changes,
          updated: now(),
        },
      },
    }));

  const saveCard = (id: string, field: EditableCardField, value: string) =>
    patch({
      cards: deck.cards.map((card) => (card.id === id ? { ...card, [field]: value } : card)),
    });

  const current: DeckCard | undefined = deck.cards[Math.min(index, Math.max(0, deck.cards.length - 1))];
  const editing = deck.cards.find((card) => card.id === editingId);

  const change = (next: number) => {
    if (next < 0 || next >= deck.cards.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
    setFinished(false);
  };

  useEffect(() => {
    setIndex((value) => Math.max(0, Math.min(value, deck.cards.length - 1)));
  }, [deck.cards.length]);

  useEffect(() => {
    if (!present) return;
    toast.dismiss();
    const label = () => {
      const body = document.querySelector<HTMLElement>(".story-slide-body");
      if (body) {
        body.tabIndex = 0;
        body.setAttribute("role", "region");
        body.setAttribute("aria-label", "Chapter evidence; scroll for more");
      }
    };
    label();
    const timer = setTimeout(label, 300);
    return () => clearTimeout(timer);
  }, [present, index, current?.body]);

  useEffect(() => {
    if (!present) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('input,textarea,[role="dialog"],select,[role="combobox"]')) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        change(index + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        change(index - 1);
      }
      if (event.key === "Escape") go("/studio/deck");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, index, deck.cards.length]);

  const append = () => {
    const added: DeckCard[] = sources
      .filter((source) => selected.includes(source.key))
      .map((source) => ({
        id: uid(),
        source: source.key,
        title: source.title || "An untitled chapter",
        context: [source.org, source.dates].filter(Boolean).join(" · "),
        body: source.body || "",
        notes: "",
        kind: source.section,
      }));
    patch({ cards: [...deck.cards, ...added] });
    setSelected([]);
    setAddOpen(false);
    toast.success(added.length + " " + (added.length === 1 ? "chapter" : "chapters") + " added as independent copies.");
  };

  const move = (position: number, offset: number) => {
    const cards = [...deck.cards];
    [cards[position], cards[position + offset]] = [cards[position + offset], cards[position]];
    patch({ cards });
  };

  const exportNotes = () => {
    const text = [
      `Storyline / ${deck.title}`,
      deck.subtitle,
      `Prepared by ${state.profile.name || "Me"}`,
      "",
      ...deck.cards.flatMap((card, position) => [
        `${position + 1}. ${card.title}`,
        card.context,
        card.body,
        card.notes ? "Speaker notes: " + card.notes : "",
        "",
      ]),
      "Private story deck. Downloaded locally; not published.",
    ].join("\n");
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), "Storyline-story-deck.txt");
  };

  return present ? (
    <div className={"deck-theater " + (deck.style === "After hours" ? "after-hours" : "editorial-theater")}>
      <header className="deck-theater-header">
        <button onClick={() => go("/studio/deck")}>
          <ArrowLeft size={18} />
          <span>Back to my deck</span>
        </button>
        <span className="eyebrow">{deck.title}</span>
        <div>
          <IconBtn
            icon={showNotes ? EyeOff : Eye}
            label={showNotes ? "Hide speaker notes" : "Show speaker notes"}
            onClick={() => setShowNotes(!showNotes)}
          />
          <IconBtn icon={Minimize} label="Exit presentation" onClick={() => go("/studio/deck")} />
        </div>
      </header>
      {current ? (
        <>
          <div
            className="deck-stage"
            onTouchStart={(event) => {
              touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            }}
            onTouchEnd={(event) => {
              if (!touchStart.current) return;
              const deltaX = event.changedTouches[0].clientX - touchStart.current.x;
              const deltaY = event.changedTouches[0].clientY - touchStart.current.y;
              if (Math.abs(deltaX) > 75 && Math.abs(deltaX) > Math.abs(deltaY) * 1.7)
                change(index + (deltaX < 0 ? 1 : -1));
              touchStart.current = null;
            }}
          >
            <div className="deck-underlay" aria-hidden="true" />
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.article
                className="story-slide"
                custom={direction}
                initial={quiet ? false : { opacity: 0, x: direction * 32, rotateY: direction * 4, scale: 0.99 }}
                animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
                exit={{ opacity: 0, x: quiet ? 0 : -direction * 28, rotateY: quiet ? 0 : -direction * 3 }}
                transition={{ duration: quiet ? 0 : 0.25, ease: [0.2, 0.7, 0.2, 1] }}
                key={current.id}
              >
                <div className="story-slide-margin">
                  <span className="eyebrow">
                    {String(index + 1).padStart(2, "0")}
                    {" / A CHAPTER THAT COUNTS"}
                  </span>
                  <BookOpen size={24} />
                </div>
                <div className="story-slide-content">
                  <p className="story-slide-context">{current.context || "In my own words"}</p>
                  <h1>{current.title}</h1>
                  <div className="story-slide-body">
                    {current.body
                      .split("\n")
                      .filter(Boolean)
                      .map((line, position) => (
                        <p key={position}>{line}</p>
                      ))}
                  </div>
                </div>
                <footer>
                  <span>{state.profile.name || "My story"}</span>
                  <span className="eyebrow">{state.profile.headline || "STILL BEING WRITTEN"}</span>
                </footer>
              </motion.article>
            </AnimatePresence>
          </div>
          {showNotes && (
            <div className="deck-speaker-notes">
              <span className="eyebrow">PRIVATE SPEAKER NOTES</span>
              <p>{current.notes || "No notes for this chapter. Add a reminder in the deck editor."}</p>
            </div>
          )}
          <div className="deck-controls">
            <IconBtn icon={ArrowLeft} label="Previous chapter" disabled={index === 0} onClick={() => change(index - 1)} />
            <div className="deck-chapter-indicators" aria-label="Choose a chapter">
              {deck.cards.map((card, position) => (
                <button
                  aria-label={`Go to chapter ${position + 1}: ${card.title}`}
                  aria-current={position === index ? "step" : undefined}
                  onClick={() => change(position)}
                  key={card.id}
                >
                  <span />
                </button>
              ))}
            </div>
            <span className="deck-page-count" aria-live="polite">
              {index + 1}
              {" / "}
              {deck.cards.length}
            </span>
            {index < deck.cards.length - 1 ? (
              <IconBtn icon={ArrowRight} label="Next chapter" onClick={() => change(index + 1)} />
            ) : (
              <Btn onClick={() => setFinished(true)} icon={Check}>
                Finish
              </Btn>
            )}
          </div>
          <p className="deck-hint">Swipe or use arrow keys. Take your time. Nothing is shared.</p>
        </>
      ) : (
        <Blank title="Give your story a first chapter." action="Build my deck" onAction={() => go("/studio/deck")}>
          Choose real experiences and preview them here.
        </Blank>
      )}
      <Modal
        open={finished}
        onClose={() => setFinished(false)}
        title="And the story continues."
        description="Those chapters are yours. Keep refining them, or take them into your next conversation."
        footer={
          <Btn onClick={() => go("/studio/rehearse")} icon={ArrowRight}>
            Practice the conversation
          </Btn>
        }
      >
        <div className="deck-ending lilac">
          <BookOpen size={48} />
          <h2>
            Real experience.
            <br />
            Room to shine.
          </h2>
          <button
            className="text-link"
            onClick={() => {
              setFinished(false);
              setIndex(0);
            }}
          >
            {"Back to the first chapter "}
            <ArrowLeft size={16} />
          </button>
        </div>
      </Modal>
    </div>
  ) : (
    <div className="story-deck-editor">
      <button className="back-link" onClick={() => go("/studio")}>
        <ArrowLeft size={18} />
        The studio
      </button>
      <PageTitle
        eyebrow="YOUR STORY DECK"
        title="Give your work the room it deserves."
        action={
          <Btn disabled={!deck.cards.length} icon={Maximize} onClick={() => go("/studio/deck/present")}>
            Enter presentation
          </Btn>
        }
      >
        A private, visual collection of the work you can speak to.
      </PageTitle>
      <div className="deck-intro cream">
        <div>
          <span className="eyebrow">NOT A SLIDE FULL OF CLAIMS</span>
          <h2>
            A few real chapters.
            <br />
            An unmistakably you story.
          </h2>
          <p>
            Choose from your profile. Refine the words.
            <br />
            Then let one experience take the stage at a time.
          </p>
        </div>
        <div className="deck-stack-illustration" aria-hidden="true">
          <i />
          <i />
          <div>
            <span>
              SELECTED
              <br />
              CHAPTERS
            </span>
            <Layers size={34} />
            <strong>{String(deck.cards.length).padStart(2, "0")}</strong>
          </div>
        </div>
      </div>
      <div className="deck-editor-layout">
        <section>
          <div className="section-head">
            <h2>Your chapters</h2>
            <Btn variant="outline" onClick={() => setAddOpen(true)} icon={Plus}>
              Add from my profile
            </Btn>
          </div>
          {deck.cards.length ? (
            <div className="deck-card-list">
              {deck.cards.map((card, position) => (
                <motion.div
                  layout={!quiet}
                  transition={{ duration: quiet ? 0 : 0.22 }}
                  className="deck-edit-card"
                  key={card.id}
                >
                  <span className="deck-card-number">{String(position + 1).padStart(2, "0")}</span>
                  <button className="deck-edit-card-copy" onClick={() => setEditingId(card.id)}>
                    <span>{card.context || "Your own experience"}</span>
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                    <small>
                      {"Edit this chapter "}
                      <PenLine size={14} />
                    </small>
                  </button>
                  <div className="deck-card-actions">
                    <IconBtn
                      icon={ArrowUp}
                      label={"Move chapter " + (position + 1) + " up"}
                      disabled={position === 0}
                      onClick={() => move(position, -1)}
                    />
                    <IconBtn
                      icon={ArrowDown}
                      label={"Move chapter " + (position + 1) + " down"}
                      disabled={position === deck.cards.length - 1}
                      onClick={() => move(position, 1)}
                    />
                    <IconBtn
                      icon={Trash2}
                      label={"Remove chapter " + (position + 1)}
                      onClick={() =>
                        ask(
                          "Remove this chapter?",
                          "This removes only the deck copy. Your profile and resumes stay untouched.",
                          () => patch({ cards: deck.cards.filter((item) => item.id !== card.id) }),
                          "Remove chapter",
                        )
                      }
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <Blank
              title="Your experience is the starting point."
              action="Choose my first chapters"
              onAction={() => setAddOpen(true)}
            >
              Projects, achievements, work, and volunteering can all belong here. We don’t invent the content.
            </Blank>
          )}
          <div className="actions">
            <Btn disabled={!deck.cards.length} onClick={() => go("/studio/deck/present")} icon={Maximize}>
              Present my story
            </Btn>
            <Btn variant="outline" disabled={!deck.cards.length} onClick={exportNotes} icon={Download}>
              Download deck notes
            </Btn>
          </div>
        </section>
        <aside className="deck-settings">
          <FieldGroup>
            <TextField label="Deck title" value={deck.title} onChange={(title) => patch({ title })} />
            <TextField
              label="A line to set the scene"
              value={deck.subtitle}
              onChange={(subtitle) => patch({ subtitle })}
            />
          </FieldGroup>
          <span className="eyebrow">CHOOSE THE ROOM</span>
          <Choices<string>
            label="Presentation appearance"
            value={deck.style}
            onChange={(style) => patch({ style })}
            options={["Editorial", "After hours"]}
          />
          <div
            className={"deck-theme-sample " + (deck.style === "After hours" ? "night-sample" : "")}
            aria-hidden="true"
          >
            <div>
              <i />
              <span>
                Your story.
                <br />
                Beautifully told.
              </span>
              <i />
            </div>
          </div>
          <Notice title="Your profile stays untouched">
            Deck chapters are independent copies. Editing them won’t change your master profile or saved resumes.
            Downloaded notes include any private speaker notes.
          </Notice>
          <p className="deck-privacy">
            <ShieldCheck size={16} />
            Private by default. No public sharing link.
          </p>
        </aside>
      </div>
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Which stories belong here?"
        description="Pick real entries from your profile. You can reorder and edit the copies after adding them."
        footer={
          <Btn disabled={!selected.length} onClick={append} icon={Plus}>
            {"Add "}
            {selected.length || ""} {selected.length === 1 ? "chapter" : "chapters"}
          </Btn>
        }
      >
        {sources.length ? (
          <div className="deck-source-list">
            {sources.map((source) => (
              <label key={source.key}>
                <Checkbox
                  checked={selected.includes(source.key)}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? [...selected, source.key] : selected.filter((key) => key !== source.key))
                  }
                  aria-label={"Select " + (source.title || "untitled entry")}
                />
                <span>
                  <strong>{source.title || "Untitled entry"}</strong>
                  <small>
                    {source.org || source.section}
                    {" · "}
                    {source.dates || "Undated"}
                  </small>
                  <p>
                    {source.body.slice(0, 130)}
                    {source.body.length > 130 ? "…" : ""}
                  </p>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <Blank title="Add some real experience first." action="Open my profile" onAction={() => go("/profile")}>
            Saved projects, achievements, roles, and volunteering will appear here.
          </Blank>
        )}
      </Modal>
      <Modal
        open={!!editing}
        onClose={() => setEditingId(null)}
        title="Shape this chapter."
        description="Your deck copy updates as you type. Your original profile entry stays unchanged."
        footer={
          <Btn onClick={() => setEditingId(null)} icon={Check}>
            Keep this chapter
          </Btn>
        }
      >
        {editing && (
          <FieldGroup>
            <TextField
              label="Chapter title"
              value={editing.title}
              onChange={(value) => saveCard(editing.id, "title", value)}
            />
            <TextField
              label="Context / date"
              value={editing.context}
              onChange={(value) => saveCard(editing.id, "context", value)}
            />
            <TextField
              area
              rows={7}
              label="The story"
              value={editing.body}
              onChange={(value) => saveCard(editing.id, "body", value)}
              hint="One thought per line. Only include details you can support."
            />
            <TextField
              area
              rows={4}
              label="Private speaker notes"
              value={editing.notes}
              onChange={(value) => saveCard(editing.id, "notes", value)}
              placeholder="A reminder, context, or a question to invite…"
            />
          </FieldGroup>
        )}
      </Modal>
    </div>
  );
}
