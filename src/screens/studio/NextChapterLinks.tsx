import { ArrowUpRight, Flag, Layers, NotebookPen, type LucideIcon } from "lucide-react";
import { useStudio } from "@/state/context";
import { Reveal } from "@/components/ui/app";

const LINKS: [title: string, description: string, icon: LucideIcon, route: string][] = [
  ["Your launch plan", "Small steps. A direction that’s yours.", Flag, "/studio/launch"],
  ["The pitch studio", "Find your introduction in your own words.", NotebookPen, "/studio/pitch"],
  ["Your story deck", "Give real work the room it deserves.", Layers, "/studio/deck"],
];

export function NextChapterLinks() {
  const { go } = useStudio();
  return (
    <section className="next-chapter-links">
      <div className="section-head">
        <div>
          <span className="eyebrow">CHAPTER THREE / MAKE IT HAPPEN</span>
          <h2>Less overthinking. More next steps.</h2>
        </div>
      </div>
      <div className="next-links-grid">
        {LINKS.map(([title, description, Icon, route], index) => (
          <Reveal delay={index * 0.04} key={route}>
            <button className="next-link" onClick={() => go(route)}>
              <Icon />
              <h3>{title}</h3>
              <p>{description}</p>
              <span>
                {"Step inside "}
                <ArrowUpRight size={18} />
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
