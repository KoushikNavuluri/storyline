/**
 * End-to-end check against a deployed Storyline (real Supabase, real /api/ai).
 * Creates two confirmed throwaway users with the service role, exercises the UI as user A,
 * verifies persistence and row-level security, then deletes both users.
 *
 * Env: SITE, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, [CHROME_PATH]
 */
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const { SITE, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CHROME_PATH } = process.env;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const makeUser = async (tag) => {
  const email = `storyline-e2e-${tag}-${randomBytes(4).toString("hex")}@example.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email, password };
};
const clientFor = async (user) => {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return c;
};

const a = await makeUser("a");
const b = await makeUser("b");
const browser = await chromium.launch({ executablePath: CHROME_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Sign in
  await page.goto(SITE);
  await page.getByLabel("Email").fill(a.email);
  await page.getByLabel("Password").fill(a.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Explore a sample" }).waitFor({ timeout: 20000 });
  check("sign in lands on the welcome screen for a new account", await page.getByText("Your next move.").isVisible());

  // Wrong password message
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(SITE);
  await p2.getByLabel("Email").fill(a.email);
  await p2.getByLabel("Password").fill("wrong-password-123");
  await p2.getByRole("button", { name: "Sign in", exact: true }).click();
  await p2.getByText("That email and password don’t match an account.").waitFor({ timeout: 15000 });
  check("wrong password shows a friendly error", true);
  await ctx2.close();

  // Sample workspace → sync
  await page.getByRole("button", { name: "Explore a sample" }).click();
  await page.waitForURL(/#\/home/);
  await page.getByText("Saved to your account").waitFor({ timeout: 20000 });
  const ca = await clientFor(a);
  let docs = { data: [] };
  for (let i = 0; i < 20 && docs.data?.length !== 2; i++) {
    docs = await ca.from("documents").select("id,title");
    if (docs.data?.length !== 2) await page.waitForTimeout(1000);
  }
  const apps = await ca.from("applications").select("id,company");
  const ws = await ca.from("workspaces").select("sample,profile").single();
  check("sample workspace synced to Supabase", docs.data?.length === 2 && apps.data?.length === 1 && ws.data?.sample === true,
    `${docs.data?.length} docs, ${apps.data?.length} apps`);

  // Reload persistence
  await page.reload();
  await page.getByText("Alex Morgan").first().waitFor({ timeout: 20000 });
  check("workspace reloads from the database", page.url().includes("#/home"));

  // Tailor flow (AI or fallback)
  await page.evaluate(() => (location.hash = "/tailor"));
  await page.getByLabel("Company").fill("Acme Health");
  await page.getByLabel("Target role").fill("Senior Product Designer");
  await page.getByLabel("Job description").fill(
    "Acme Health is hiring a Senior Product Designer to lead design systems work, run user research, and prototype accessible patient experiences with engineering. Figma expertise is essential; SQL is a plus.",
  );
  await page.getByRole("button", { name: "Review requirements" }).click();
  await page.getByRole("button", { name: /Continue to review/ }).waitFor({ timeout: 60000 });
  check("requirements step reached", true);
  await page.getByRole("button", { name: /Continue to review/ }).click();
  await page.getByRole("button", { name: "Create and review my draft" }).click();
  await page.waitForURL(/#\/editor\/.+\/Content/, { timeout: 90000 });
  const docId = page.url().split("/editor/")[1].split("/")[0];
  await page.getByText("Saved to your account").waitFor({ timeout: 20000 });
  let savedTitle = "";
  for (let i = 0; i < 20 && !savedTitle; i++) {
    const row = await ca.from("documents").select("title").eq("id", docId).maybeSingle();
    savedTitle = row.data?.title || "";
    if (!savedTitle) await page.waitForTimeout(1000);
  }
  check("tailored draft created and saved", savedTitle === "Acme Health · Senior Product Designer", savedTitle);

  // Export PDF
  await page.evaluate((id) => (location.hash = `/export/${id}`), docId);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  const path = await download.path();
  const head = path ? (await import("node:fs")).readFileSync(path).subarray(0, 8).toString() : "";
  check("PDF export downloads a PDF", head.startsWith("%PDF-1.4"), download.suggestedFilename());

  // Command palette
  await page.keyboard.press("Escape");
  await page.evaluate(() => (location.hash = "/home"));
  await page.keyboard.press("Control+k");
  await page.getByText("Where shall we go?").waitFor({ timeout: 5000 });
  check("Ctrl+K opens the command palette", true);
  await page.keyboard.press("Escape");

  // Studio screens render
  for (const route of ["/studio", "/studio/pitch", "/studio/deck", "/studio/launch", "/studio/timeline", "/studio/compare", "/studio/rehearse", "/applications", "/settings/ai"]) {
    await page.evaluate((r) => (location.hash = r), route);
    await page.waitForTimeout(700);
  }
  check("studio and settings screens render without errors", errors.length === 0, errors.join(" | "));

  // AI endpoint directly
  const token = (await ca.auth.getSession()).data.session.access_token;
  const aiRes = await fetch(`${SITE}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task: "requirements", payload: { company: "Acme", role: "Designer", jd: "We need design systems and user research experience. SQL is a plus." } }),
  });
  const aiBody = await aiRes.json();
  check("AI endpoint authenticates and answers", aiRes.status === 200, `status ${aiRes.status}: ${JSON.stringify(aiBody).slice(0, 120)}`);
  const usage = await admin.from("ai_usage").select("task,ok").eq("user_id", a.id);
  check("AI usage is logged server-side", (usage.data?.length || 0) > 0, `${usage.data?.length} rows`);

  // Row-level security
  const cb = await clientFor(b);
  const leak = await cb.from("documents").select("id");
  const tamper = await cb.from("documents").update({ title: "hacked" }).eq("id", docId).select("id");
  const wsLeak = await cb.from("workspaces").select("user_id");
  check("RLS: other users see none of A's rows", (leak.data?.length || 0) === 0 && (wsLeak.data?.length || 0) === 0);
  check("RLS: other users cannot modify A's rows", (tamper.data?.length || 0) === 0);
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const anonLeak = await anonClient.from("documents").select("id");
  check("RLS: anonymous visitors see nothing", (anonLeak.data?.length || 0) === 0);

  // Sign out
  await page.evaluate(() => (location.hash = "/settings/account"));
  await page.getByText("Sign out", { exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor({ timeout: 15000 });
  check("sign out returns to the sign-in screen", true);
} catch (error) {
  check("unexpected error", false, error.message);
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(a.id);
  await admin.auth.admin.deleteUser(b.id);
  const left = await admin.from("documents").select("id", { count: "exact", head: true }).eq("user_id", a.id);
  console.log(`cleanup: test users deleted, ${left.count ?? 0} rows left for user A`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
