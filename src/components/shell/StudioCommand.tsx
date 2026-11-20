import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Compass,
  FileText,
  Flag,
  GitCompareArrows,
  Layers,
  NotebookPen,
  Play,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useStudio } from "@/state/context";
import { IconBtn, Modal } from "@/components/ui/app";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/primitives";
import { QuickCapture } from "./QuickCapture";

const MOVES: [label: string, icon: LucideIcon, route: string][] = [
  ["The studio", Compass, "/studio"],
  ["My launch plan", Flag, "/studio/launch"],
  ["Pitch studio", NotebookPen, "/studio/pitch"],
  ["My story deck", Layers, "/studio/deck"],
  ["Career timeline", BookOpen, "/studio/timeline"],
  ["Compare opportunities", GitCompareArrows, "/studio/compare"],
  ["Rehearsal room", Play, "/studio/rehearse"],
  ["Tailor a resume", FileText, "/tailor"],
  ["Home", Compass, "/home"],
  ["Master profile", BookOpen, "/profile"],
];

/**
 * Topbar search button plus the Ctrl/⌘K command palette. Self-contained: owns its open state,
 * the global keydown listener, and its own QuickCapture dialog.
 */
export function StudioCommand() {
  const { state, go } = useStudio();
  const [open, setOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = (route: string) => {
    setOpen(false);
    go(route);
  };

  return (
    <>
      <IconBtn icon={Search} label="Search Storyline or jump to an action" variant="ghost" onClick={() => setOpen(true)} />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Where shall we go?"
        description="Search your documents, opportunities, or next action. Ctrl / ⌘ K opens this from anywhere."
      >
        <Command className="studio-command">
          <CommandInput placeholder="Search your story…" aria-label="Search Storyline" />
          <CommandList>
            <CommandEmpty>No matches. Try a role, a document title, or “timeline”.</CommandEmpty>
            <CommandGroup heading="Make a move">
              {MOVES.map(([label, Icon, route]) => (
                <CommandItem value={label} onSelect={() => navigate(route)} key={route}>
                  <Icon />
                  <span>{label}</span>
                  <ArrowUpRight />
                </CommandItem>
              ))}
              <CommandItem
                value="Capture a win achievement"
                onSelect={() => {
                  setOpen(false);
                  setCaptureOpen(true);
                }}
              >
                <Plus />
                <span>Capture a win</span>
                <ArrowUpRight />
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Your documents">
              {state.docs
                .filter((doc) => !doc.archived)
                .map((doc) => (
                  <CommandItem
                    value={`${doc.title} ${doc.company} ${doc.role} ${doc.id}`}
                    onSelect={() => navigate(`/editor/${doc.id}/Preview`)}
                    key={doc.id}
                  >
                    <FileText />
                    <span>{doc.title || "Untitled resume"}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="Your opportunities">
              {state.applications.map((application) => (
                <CommandItem
                  value={`${application.company} ${application.role} ${application.id}`}
                  onSelect={() => navigate("/application/" + application.id)}
                  key={application.id}
                >
                  <BriefcaseBusiness />
                  <span>
                    {application.company}
                    {" \xB7 "}
                    {application.role}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </Modal>
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </>
  );
}
