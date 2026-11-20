/** Account entry: sign in, create account, email link, password reset. Uses the welcome layout. */
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, Mail, ShieldCheck } from "lucide-react";
import { Btn, Choices, Notice, Paper, TextField } from "@/components/ui/app";
import { FieldGroup } from "@/components/ui/primitives";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { makeDoc, SAMPLE_PROFILE } from "@/state/factories";

type Mode = "Sign in" | "Create account";
type View = "form" | "forgot" | "sent" | "reset";

const redirectTo = () => `${window.location.origin}/`;

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don’t match an account.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first. Check your inbox for the link.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists. Sign in instead.";
  if (/password/i.test(message) && /least|short|weak/i.test(message)) return "Use a password with at least 8 characters.";
  return message || "Something went wrong. Try again.";
}

export function SignIn({ recovery = false, onRecovered }: { recovery?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<Mode>("Sign in");
  const [view, setView] = useState<View>(recovery ? "reset" : "form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentText, setSentText] = useState("");
  const sample = useMemo(() => makeDoc(SAMPLE_PROFILE, { hidden: ["projects"] }), []);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (caught) {
      setError(friendly(caught instanceof Error ? caught.message : String(caught)));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (view === "forgot")
      return run(async () => {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
        if (e) throw e;
        setSentText("If an account exists for this email, a reset link is on its way.");
        setView("sent");
      });
    if (view === "reset")
      return run(async () => {
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        const { error: e } = await supabase.auth.updateUser({ password });
        if (e) throw e;
        onRecovered?.();
      });
    return run(async () => {
      if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
      if (mode === "Sign in") {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        if (e) throw e;
        if (!data.session) {
          setSentText("Confirm your email to finish creating your account. The link opens Storyline.");
          setView("sent");
        }
      }
    });
  };

  const magicLink = () =>
    run(async () => {
      if (!email.trim()) throw new Error("Enter your email first.");
      const { error: e } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo(), shouldCreateUser: mode === "Create account" },
      });
      if (e) throw e;
      setSentText("A sign-in link is on its way. Open it on this device.");
      setView("sent");
    });

  const heading =
    view === "reset" ? (
      <>
        Choose a new
        <br />
        <span className="serene">password.</span>
      </>
    ) : view === "forgot" ? (
      <>
        Let’s get you
        <br />
        <span className="serene">back in.</span>
      </>
    ) : (
      <>
        Your experience.
        <br />
        Your story.
        <br />
        <span className="serene">Your next move.</span>
      </>
    );

  return (
    <div className="app onboarding">
      <div className="app-body">
        <main id="main-content" tabIndex={-1} className="main-content">
          <div className="welcome">
            <div className="welcome-copy">
              <p className="eyebrow">
                <span className="small-line" />
                {view === "reset" ? " ACCOUNT / NEW PASSWORD" : " YOUR NEXT CHAPTER"}
              </p>
              <h1>{heading}</h1>
              {view === "sent" ? (
                <div className="auth-panel">
                  <Notice title="Check your inbox" icon={Mail} tone="mint">
                    {sentText}
                  </Notice>
                  <div className="welcome-actions">
                    <Btn variant="outline" onClick={() => setView("form")}>
                      Back to sign in
                    </Btn>
                  </div>
                </div>
              ) : (
                <form className="auth-panel" onSubmit={submit} noValidate>
                  {view === "form" && (
                    <Choices value={mode} onChange={setMode} options={["Sign in", "Create account"] as const} label="Account" />
                  )}
                  {!supabaseConfigured && (
                    <Notice title="Storyline is not connected" tone="cream">
                      The account service is not configured for this deployment.
                    </Notice>
                  )}
                  <FieldGroup>
                    {view !== "reset" && (
                      <TextField
                        label="Email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={setEmail}
                      />
                    )}
                    {view !== "forgot" && (
                      <TextField
                        label={view === "reset" ? "New password" : "Password"}
                        type="password"
                        autoComplete={mode === "Sign in" && view === "form" ? "current-password" : "new-password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={setPassword}
                        hint={mode === "Create account" || view === "reset" ? "At least 8 characters." : undefined}
                      />
                    )}
                  </FieldGroup>
                  {error && (
                    <p className="auth-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="welcome-actions">
                    <Btn type="submit" disabled={busy} icon={ArrowRight}>
                      {busy
                        ? "One moment…"
                        : view === "forgot"
                          ? "Send reset link"
                          : view === "reset"
                            ? "Save new password"
                            : mode === "Sign in"
                              ? "Sign in"
                              : "Create my account"}
                    </Btn>
                    {view === "form" && (
                      <Btn type="button" variant="outline" disabled={busy} onClick={magicLink}>
                        Email me a link
                      </Btn>
                    )}
                  </div>
                  {view === "form" && mode === "Sign in" && (
                    <button type="button" className="text-link" onClick={() => setView("forgot")}>
                      Forgot your password?
                    </button>
                  )}
                  {view === "forgot" && (
                    <button type="button" className="text-link" onClick={() => setView("form")}>
                      Back to sign in
                    </button>
                  )}
                </form>
              )}
              <p className="privacy-caption">
                <ShieldCheck size={16} />
                Your workspace is private to your account.
              </p>
            </div>
            <div className="welcome-art lilac">
              <div className="art-eyebrow">A LITTLE CLARITY. A NEW POSSIBILITY.</div>
              <div className="hero-paper-back" />
              <div className="hero-paper">
                <Paper doc={sample} mini />
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
