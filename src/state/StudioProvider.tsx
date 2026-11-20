/**
 * Workspace state, hash routing and persistence (port of the prototype root component `Storyline`).
 * localStorage persistence is replaced by Supabase sync (see ./sync.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { copy, now, seededState, uid } from "./factories";
import { StudioContext, type StudioContextValue, type Updater } from "./context";
import { normaliseIds, SAVE_FAILED, SAVE_OFFLINE, SAVE_SAVED, SyncEngine } from "./sync";
import type { Doc, StudioState, Version } from "./types";

export const getRoute = () => decodeURI(location.hash.slice(1)) || "/welcome";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const needsIds = (s: StudioState) => s.docs.some((d) => !UUID.test(d.id)) || s.applications.some((a) => !UUID.test(a.id));

export interface AskState {
  title: string;
  description: string;
  action: () => void;
  button: string;
}

export function StudioProvider({
  userId,
  email,
  initial,
  pending,
  signOut,
  children,
}: {
  userId: string;
  email: string;
  initial: StudioState;
  pending: boolean;
  signOut: () => Promise<void>;
  children: (shell: { askState: AskState | null; closeAsk: () => void; online: boolean }) => ReactNode;
}) {
  const [state, setState] = useState<StudioState>(() => (needsIds(initial) ? normaliseIds(initial) : initial));
  const [route, setRoute] = useState(getRoute);
  const [save, setSave] = useState<string>(pending ? SAVE_OFFLINE : SAVE_SAVED);
  const [askState, setAskState] = useState<AskState | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const stateRef = useRef(state);
  stateRef.current = state;

  const engine = useMemo(() => new SyncEngine(userId, setSave), [userId]);
  const first = useRef(true);

  // Baseline = what the database holds. With pending local edits (or a new account) write everything.
  useEffect(() => {
    if (pending) {
      engine.resetBaseline();
      engine.schedule(stateRef.current, 0);
    } else {
      engine.setBaseline(stateRef.current);
    }
  }, [engine, pending]);

  const update = useCallback((patch: Updater) => {
    setState((current) => {
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      return needsIds(next) ? normaliseIds(next) : next;
    });
  }, []);

  const go = useCallback((next: string) => {
    if (getRoute() === next) {
      setRoute(next);
      return;
    }
    location.hash = next;
  }, []);

  // Scroll to top on every route change.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.getElementById("root")?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [route]);

  // Hash routing.
  useEffect(() => {
    const onHash = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    if (!location.hash || getRoute() === "/signin") go(stateRef.current.onboarded ? "/home" : "/welcome");
    return () => window.removeEventListener("hashchange", onHash);
  }, [go]);

  // Persist every change (debounced, diffed) to Supabase.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    engine.schedule(state);
  }, [state, engine]);

  // Warn before leaving with unsaved or failed changes; flush when the tab is hidden.
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (save === SAVE_FAILED || engine.hasPending()) {
        void engine.flush();
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const hide = () => {
      if (document.visibilityState === "hidden") void engine.flush();
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [save, engine]);

  // Connection status; replay pending changes when back online.
  useEffect(() => {
    const onChange = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) engine.schedule(stateRef.current, 0);
    };
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, [engine]);

  // Theme, reduced motion and large UI.
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        state.settings.theme === "dark" || (state.settings.theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    document.documentElement.classList.toggle("reduce-motion", state.settings.motion);
    document.documentElement.classList.toggle("large-ui", state.settings.large);
    return () => media.removeEventListener("change", apply);
  }, [state.settings]);

  const ask = useCallback(
    (title: string, description: string, action: () => void, button = "Confirm") =>
      setAskState({ title, description, action, button }),
    [],
  );

  const updateDoc = useCallback(
    (id: string, patch: Partial<Doc> | ((doc: Doc) => Doc)) =>
      update((current) => ({
        ...current,
        docs: current.docs.map((doc) =>
          doc.id === id
            ? { ...(typeof patch === "function" ? patch(doc) : { ...doc, ...patch }), updated: now() }
            : doc,
        ),
      })),
    [update],
  );

  const snap = useCallback(
    (id: string, name = "Saved version"): Version | null => {
      const doc = stateRef.current.docs.find((d) => d.id === id);
      if (!doc) return null;
      const version: Version = { id: uid(), name, date: now(), snapshot: copy({ ...doc, versions: [] }) };
      updateDoc(id, (d) => ({ ...d, versions: [...d.versions, version] }));
      return version;
    },
    [updateDoc],
  );

  const exportData = useCallback(() => {
    downloadBlob(
      new Blob([JSON.stringify(stateRef.current, null, 2)], { type: "application/json" }),
      "Storyline-backup.json",
    );
    toast.success("Backup download requested");
  }, []);

  const seed = useCallback(() => {
    update(seededState());
    go("/home");
  }, [update, go]);

  const value: StudioContextValue = {
    state,
    update,
    route,
    go,
    ask,
    updateDoc,
    snap,
    exportData,
    save,
    seed,
    email,
    signOut: async () => {
      await engine.flush();
      await signOut();
    },
  };

  return (
    <StudioContext.Provider value={value}>
      {children({ askState, closeAsk: () => setAskState(null), online })}
    </StudioContext.Provider>
  );
}
