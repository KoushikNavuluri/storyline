import { ArrowUpRight, Flag } from "lucide-react";
import { useStudio } from "@/state/context";

export function ChapterThreeTeaser() {
  const { go } = useStudio();
  return (
    <button className="chapter-three-teaser" onClick={() => go("/studio/launch")}>
      <span className="teaser-mark">
        <Flag size={20} />
      </span>
      <span>
        <strong>A little momentum.</strong>
        <small>Your launch plan, pitch studio, and story deck.</small>
      </span>
      <ArrowUpRight size={20} />
    </button>
  );
}
