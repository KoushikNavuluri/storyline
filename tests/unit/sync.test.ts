import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { table: string; kind: "upsert" | "delete"; rows?: unknown; ids?: string[] };
const ops: Op[] = [];
let failNext = false;

vi.mock("@/lib/supabase", () => {
  const table = (name: string) => ({
    upsert: (rows: unknown) => {
      ops.push({ table: name, kind: "upsert", rows });
      const error = failNext ? new Error("boom") : null;
      return Promise.resolve({ error });
    },
    delete: () => ({
      in: (_column: string, ids: string[]) => {
        ops.push({ table: name, kind: "delete", ids });
        return Promise.resolve({ error: null });
      },
    }),
  });
  return { supabase: { from: table } };
});

const { fromRows, normaliseIds, SAVE_FAILED, SAVE_SAVED, SyncEngine, toRows } = await import("@/state/sync");
const { blankApp, makeDoc, SAMPLE_PROFILE, seededState } = await import("@/state/factories");

const USER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  ops.length = 0;
  failNext = false;
  vi.stubGlobal("navigator", { onLine: true });
});

describe("row mapping", () => {
  it("round-trips the workspace through rows", () => {
    const state = seededState();
    const rows = toRows(state, USER);
    expect(rows.documents).toHaveLength(2);
    expect(rows.documents[0].position).toBe(0);
    expect(rows.applications[0].stage).toBe("Saved");
    const back = fromRows(rows.workspace, rows.documents, rows.applications);
    expect(back.profile.name).toBe("Alex Morgan");
    expect(back.docs.map((d) => d.id)).toEqual(state.docs.map((d) => d.id));
    expect(back.applications[0].docId).toBe(state.docs[0].id);
    expect(back.sample).toBe(true);
  });

  it("gives non-UUID records UUIDs and keeps links intact", () => {
    const state = seededState();
    state.docs[0].id = "legacy-doc";
    state.applications[0].docId = "legacy-doc";
    state.applications[0].id = "legacy-app";
    const fixed = normaliseIds(state);
    expect(fixed.docs[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fixed.applications[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fixed.applications[0].docId).toBe(fixed.docs[0].id);
  });
});

describe("SyncEngine", () => {
  it("writes only what changed and deletes removed rows", async () => {
    const statuses: string[] = [];
    const engine = new SyncEngine(USER, (s) => statuses.push(s));
    const state = seededState();
    engine.setBaseline(state);

    const edited = {
      ...state,
      docs: state.docs.map((d, i) => (i === 1 ? { ...d, title: "Renamed" } : d)),
      applications: [],
    };
    engine.schedule(edited, 10_000);
    await engine.flush();

    const docUpserts = ops.filter((o) => o.table === "documents" && o.kind === "upsert");
    expect(docUpserts).toHaveLength(1);
    expect((docUpserts[0].rows as { title: string }[]).map((r) => r.title)).toEqual(["Renamed"]);
    expect(ops.some((o) => o.table === "workspaces")).toBe(false);
    expect(ops.find((o) => o.table === "applications" && o.kind === "delete")?.ids).toEqual([state.applications[0].id]);
    expect(statuses.at(-1)).toBe(SAVE_SAVED);

    ops.length = 0;
    engine.schedule(edited, 10_000);
    await engine.flush();
    expect(ops).toHaveLength(0);
  });

  it("writes everything on first sync and reports failures", async () => {
    const statuses: string[] = [];
    const engine = new SyncEngine(USER, (s) => statuses.push(s));
    const state = { ...seededState(), applications: [blankApp()], docs: [makeDoc(SAMPLE_PROFILE)] };
    engine.resetBaseline();
    failNext = true;
    engine.schedule(state, 10_000);
    await engine.flush();
    expect(statuses.at(-1)).toBe(SAVE_FAILED);

    failNext = false;
    ops.length = 0;
    engine.schedule(state, 10_000);
    await engine.flush();
    expect(ops.map((o) => o.table).sort()).toEqual(["applications", "documents", "workspaces"]);
    expect(statuses.at(-1)).toBe(SAVE_SAVED);
  });
});
