/**
 * Supabase persistence for the Storyline workspace.
 *
 * The UI keeps one in-memory `StudioState` (same shape as the prototype). This module maps it to rows
 * (`workspaces`, `documents`, `applications`), and on every change upserts only the rows whose JSON
 * changed and deletes rows that disappeared. A per-user localStorage cache keeps unsynced edits across
 * reloads and offline periods.
 */
import { supabase } from "@/lib/supabase";
import { initialState } from "./factories";
import type { Application, Doc, StudioState } from "./types";

export const SAVE_SAVING = "Saving…";
export const SAVE_SAVED = "Saved to your account";
export const SAVE_OFFLINE = "Offline. Changes will sync.";
export const SAVE_FAILED = "Saving failed. Export a backup.";

interface WorkspaceRow {
  user_id: string;
  onboarded: boolean;
  sample: boolean;
  profile: StudioState["profile"];
  settings: StudioState["settings"];
  studio: NonNullable<StudioState["studio"]>;
  tailor: StudioState["tailor"];
  drafts: { importText?: string; importDraft?: StudioState["importDraft"]; applicationDraft?: StudioState["applicationDraft"] };
  plans: StudioState["plans"];
  usage: StudioState["usage"];
}

interface DocumentRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  status: string;
  archived: boolean;
  position: number;
  data: Doc;
}

interface ApplicationRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  stage: string;
  position: number;
  data: Application;
}

interface Rows {
  workspace: WorkspaceRow;
  documents: DocumentRow[];
  applications: ApplicationRow[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Older backups or imports may carry non-UUID ids; rows need UUID primary keys. */
export function normaliseIds(state: StudioState): StudioState {
  const docIds = new Map<string, string>();
  const docs = state.docs.map((doc) => {
    if (UUID.test(doc.id)) return doc;
    const id = crypto.randomUUID();
    docIds.set(doc.id, id);
    return { ...doc, id };
  });
  const applications = state.applications.map((app) => {
    const fixed = {
      ...app,
      docId: docIds.get(app.docId) ?? app.docId,
      letterId: docIds.get(app.letterId) ?? app.letterId,
    };
    return UUID.test(app.id) ? fixed : { ...fixed, id: crypto.randomUUID() };
  });
  return { ...state, docs, applications };
}

export function toRows(state: StudioState, userId: string): Rows {
  return {
    workspace: {
      user_id: userId,
      onboarded: state.onboarded,
      sample: state.sample,
      profile: state.profile,
      settings: state.settings,
      studio: state.studio || {},
      tailor: state.tailor,
      drafts: {
        importText: state.importText,
        importDraft: state.importDraft ?? null,
        applicationDraft: state.applicationDraft ?? null,
      },
      plans: state.plans,
      usage: state.usage,
    },
    documents: state.docs.map((doc, position) => ({
      id: doc.id,
      user_id: userId,
      kind: doc.kind === "letter" ? "letter" : "resume",
      title: doc.title || "",
      status: doc.status || "Draft",
      archived: !!doc.archived,
      position,
      data: doc,
    })),
    applications: state.applications.map((app, position) => ({
      id: app.id,
      user_id: userId,
      company: app.company || "",
      role: app.role || "",
      stage: app.stage || "Saved",
      position,
      data: app,
    })),
  };
}

export function fromRows(
  workspace: Partial<WorkspaceRow> | null,
  documents: Pick<DocumentRow, "data">[],
  applications: Pick<ApplicationRow, "data">[],
): StudioState {
  const base = initialState();
  if (!workspace) return base;
  const drafts = workspace.drafts || {};
  return {
    ...base,
    onboarded: !!workspace.onboarded,
    sample: !!workspace.sample,
    profile: { ...base.profile, ...(workspace.profile || {}) },
    settings: { ...base.settings, ...(workspace.settings || {}) },
    studio: workspace.studio && Object.keys(workspace.studio).length ? workspace.studio : undefined,
    tailor: { ...base.tailor, ...(workspace.tailor || {}) },
    importText: drafts.importText || "",
    importDraft: drafts.importDraft ?? null,
    applicationDraft: drafts.applicationDraft ?? null,
    plans: Array.isArray(workspace.plans) && workspace.plans.length ? workspace.plans : base.plans,
    usage: Array.isArray(workspace.usage) ? workspace.usage : [],
    docs: documents.map((row) => row.data),
    applications: applications.map((row) => row.data),
  };
}

/* ------------------------------- Local cache ------------------------------- */

interface CacheEntry {
  state: StudioState;
  dirty: boolean;
  at: string;
}

const cacheKey = (userId: string) => `storyline.cache.${userId}`;

export function readCache(userId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry?.state?.schema === 1 && Array.isArray(entry.state.docs) && Array.isArray(entry.state.applications))
      return entry;
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

function writeCache(userId: string, state: StudioState, dirty: boolean) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ state, dirty, at: new Date().toISOString() }));
  } catch {
    /* storage full or blocked: the database is the source of truth */
  }
}

export function clearCache(userId: string) {
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {
    /* ignore */
  }
}

/* --------------------------------- Loading -------------------------------- */

export async function loadWorkspace(userId: string): Promise<{ state: StudioState; pending: boolean }> {
  const cache = readCache(userId);
  if (cache?.dirty) return { state: cache.state, pending: true };

  const [workspace, documents, applications] = await Promise.all([
    supabase.from("workspaces").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("documents").select("data").order("position", { ascending: true }),
    supabase.from("applications").select("data").order("position", { ascending: true }),
  ]);
  const error = workspace.error || documents.error || applications.error;
  if (error) {
    if (cache) return { state: cache.state, pending: false };
    throw error;
  }
  const state = fromRows(workspace.data, documents.data || [], applications.data || []);
  // A brand-new account has no workspace row yet: create it on first sync.
  return { state, pending: !workspace.data };
}

/* ------------------------------- Sync engine ------------------------------- */

const stringify = (value: unknown) => JSON.stringify(value);

export class SyncEngine {
  private userId: string;
  private onStatus: (status: string) => void;
  private synced = { workspace: "", documents: new Map<string, string>(), applications: new Map<string, string>() };
  private latest: StudioState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;

  constructor(userId: string, onStatus: (status: string) => void) {
    this.userId = userId;
    this.onStatus = onStatus;
  }

  /** Record what the database already holds (after loading). */
  setBaseline(state: StudioState) {
    const rows = toRows(state, this.userId);
    this.synced.workspace = stringify(rows.workspace);
    this.synced.documents = new Map(rows.documents.map((r) => [r.id, stringify(r)]));
    this.synced.applications = new Map(rows.applications.map((r) => [r.id, stringify(r)]));
  }

  /** Forget the baseline so the next flush writes everything (used for first sync / cache replay). */
  resetBaseline() {
    this.synced = { workspace: "", documents: new Map(), applications: new Map() };
  }

  schedule(state: StudioState, delay = 800) {
    this.latest = state;
    writeCache(this.userId, state, true);
    this.onStatus(typeof navigator !== "undefined" && !navigator.onLine ? SAVE_OFFLINE : SAVE_SAVING);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  hasPending() {
    return !!this.timer || !!this.running;
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.running) {
      this.again = true;
      return this.running;
    }
    if (!this.latest) return;
    this.running = this.push(this.latest).finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.flush();
      }
    });
    return this.running;
  }

  private async push(state: StudioState) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.onStatus(SAVE_OFFLINE);
      return;
    }
    const rows = toRows(state, this.userId);
    const workspaceJson = stringify(rows.workspace);
    const changedDocs = rows.documents.filter((r) => this.synced.documents.get(r.id) !== stringify(r));
    const changedApps = rows.applications.filter((r) => this.synced.applications.get(r.id) !== stringify(r));
    const docIds = new Set(rows.documents.map((r) => r.id));
    const appIds = new Set(rows.applications.map((r) => r.id));
    const removedDocs = [...this.synced.documents.keys()].filter((id) => !docIds.has(id));
    const removedApps = [...this.synced.applications.keys()].filter((id) => !appIds.has(id));
    const workspaceChanged = this.synced.workspace !== workspaceJson;

    if (!workspaceChanged && !changedDocs.length && !changedApps.length && !removedDocs.length && !removedApps.length) {
      writeCache(this.userId, state, false);
      this.onStatus(SAVE_SAVED);
      return;
    }

    this.onStatus(SAVE_SAVING);
    try {
      const ops: PromiseLike<{ error: unknown }>[] = [];
      if (workspaceChanged) ops.push(supabase.from("workspaces").upsert(rows.workspace, { onConflict: "user_id" }));
      if (changedDocs.length) ops.push(supabase.from("documents").upsert(changedDocs, { onConflict: "id" }));
      if (changedApps.length) ops.push(supabase.from("applications").upsert(changedApps, { onConflict: "id" }));
      if (removedDocs.length) ops.push(supabase.from("documents").delete().in("id", removedDocs));
      if (removedApps.length) ops.push(supabase.from("applications").delete().in("id", removedApps));
      const results = await Promise.all(ops);
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;

      if (workspaceChanged) this.synced.workspace = workspaceJson;
      for (const r of changedDocs) this.synced.documents.set(r.id, stringify(r));
      for (const r of changedApps) this.synced.applications.set(r.id, stringify(r));
      for (const id of removedDocs) this.synced.documents.delete(id);
      for (const id of removedApps) this.synced.applications.delete(id);

      if (this.latest === state) {
        writeCache(this.userId, state, false);
        this.onStatus(SAVE_SAVED);
      }
    } catch (error) {
      console.error("Storyline sync failed", error);
      this.onStatus(navigator.onLine ? SAVE_FAILED : SAVE_OFFLINE);
    }
  }
}
