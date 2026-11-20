import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { Btn, Paper } from "@/components/ui/app";
import { useStudio } from "@/state/context";
import { makeDoc, SAMPLE_PROFILE } from "@/state/factories";

export function Welcome({ seed }: { seed: () => void }) {
  const { go } = useStudio();
  const heroDoc = makeDoc(SAMPLE_PROFILE, {
    hidden: ["projects"],
  });
  return (
    <div className="welcome">
      <div className="welcome-copy">
        <p className="eyebrow">
          <span className="small-line" />
          {" YOUR NEXT CHAPTER"}
        </p>
        <h1>
          Your experience.
          <br />
          Your story.
          <br />
          <span className="serene">Your next move.</span>
        </h1>
        <p className="welcome-lede">
          You’ve done the work.
          <br />
          Let’s make it read that way.
        </p>
        <div className="welcome-actions">
          <Btn onClick={() => go("/start")} icon={ArrowRight}>
            Start my story
          </Btn>
          <Btn variant="outline" onClick={seed}>
            Explore a sample
          </Btn>
        </div>
        <p className="privacy-caption">
          <ShieldCheck size={16} />
          Your work is saved privately to your account.
        </p>
      </div>
      <div className="welcome-art lilac">
        <div className="art-eyebrow">A LITTLE CLARITY. A NEW POSSIBILITY.</div>
        <div className="hero-paper-back" />
        <div className="hero-paper">
          <Paper doc={heroDoc} mini />
        </div>
        <div className="floating-note">
          <Check size={18} />
          Still you. Just clearer.
        </div>
        <div className="art-bottom">
          <span>EXPERIENCE → OPPORTUNITY</span>
          <ArrowUpRight />
        </div>
      </div>
      <div className="welcome-footer">
        <span>Storyline / Your career, considered.</span>
        <button onClick={() => go("/settings/privacy")}>
          {"A note on privacy "}
          <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
