/** Auth gate → workspace load → provider + shell. */
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from "sonner";
import { Logo } from "@/components/ui/app";
import { Shell } from "@/components/shell/Shell";
import { supabase } from "@/lib/supabase";
import { SignIn } from "@/screens/SignIn";
import { StudioProvider } from "@/state/StudioProvider";
import { clearCache, loadWorkspace } from "@/state/sync";
import type { StudioState } from "@/state/types";

function Loading({ text = "Opening your workspace…" }: { text?: string }) {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <Logo />
      <span>{text}</span>
    </div>
  );
}

function Workspace({ session }: { session: Session }) {
  const userId = session.user.id;
  const [loaded, setLoaded] = useState<{ state: StudioState; pending: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoaded(null);
    loadWorkspace(userId)
      .then((result) => alive && setLoaded(result))
      .catch((caught) => {
        console.error(caught);
        if (alive) setError("We couldn’t open your workspace. Check your connection and reload.");
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (error) return <Loading text={error} />;
  if (!loaded) return <Loading />;

  return (
    <StudioProvider
      key={userId}
      userId={userId}
      email={session.user.email || ""}
      initial={loaded.state}
      pending={loaded.pending}
      signOut={async () => {
        await supabase.auth.signOut();
        clearCache(userId);
        location.hash = "";
      }}
    >
      {(shell) => <Shell {...shell} />}
    </StudioProvider>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Drop auth query parameters (?code=…) once Supabase has consumed them.
  useEffect(() => {
    if (session && /[?&](code|error_description)=/.test(location.search))
      history.replaceState(null, "", location.pathname + location.hash);
  }, [session]);

  if (session === undefined) return <Loading text="Opening Storyline…" />;
  if (!session || recovery)
    return (
      <>
        <SignIn recovery={recovery} onRecovered={() => setRecovery(false)} />
        <Toaster position="bottom-center" duration={2200} offset={90} closeButton />
      </>
    );
  return <Workspace session={session} />;
}
