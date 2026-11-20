import { ArrowUpRight, BookOpen, Compass, GitCompareArrows, Play } from "lucide-react";
import { useStudio } from "@/state/context";
import { Badge } from "@/components/ui/primitives";

/** Strip of links into the chapter-two studio spaces. */
export function StudioRibbon() {
  const { go } = useStudio();
  return (
    <section className="studio-ribbon" aria-label="More ways to shape your story">
      <div className="ribbon-label">
        <Compass size={21} />
        <span>Beyond the resume</span>
        <Badge variant="outline">New</Badge>
      </div>
      <div className="ribbon-links">
        <button onClick={() => go("/studio/timeline")}>
          <BookOpen />
          Career timeline
          <ArrowUpRight />
        </button>
        <button onClick={() => go("/studio/compare")}>
          <GitCompareArrows />
          Compare opportunities
          <ArrowUpRight />
        </button>
        <button onClick={() => go("/studio/rehearse")}>
          <Play />
          Rehearsal room
          <ArrowUpRight />
        </button>
      </div>
    </section>
  );
}
