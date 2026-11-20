/**
 * Screenshot the prototype and the built app on the same routes for a side-by-side visual check.
 * Supabase calls are mocked so this runs without a backend.
 * Usage: node scripts/visual-compare.mjs <appUrl> <prototypeUrl> <outDir> [width]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [appUrl, protoUrl, outDir, widthArg] = process.argv.slice(2);
const width = Number(widthArg) || 1440;
const height = width < 600 ? 844 : 900;
mkdirSync(outDir, { recursive: true });

const executablePath = process.env.CHROME_PATH || undefined;
const browser = await chromium.launch({ executablePath });

const routes = [
  "/home",
  "/docs",
  "/profile",
  "/applications",
  "/studio",
  "/studio/pitch",
  "/studio/deck",
  "/studio/launch",
  "/studio/timeline",
  "/studio/compare",
  "/studio/rehearse",
  "/tailor",
  "/settings",
  "/settings/ai",
];

const fakeSession = {
  access_token: "visual.test.token",
  refresh_token: "visual-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "visual@example.com" },
};

async function shoot(base, label, mock) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`[${label}] pageerror:`, e.message));
  if (mock) {
    await context.addInitScript((session) => {
      localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
    }, fakeSession);
    await page.route("**/rest/v1/**", (route) => {
      const method = route.request().method();
      if (method === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
      return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    });
    await page.route("**/auth/v1/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSession.user) }),
    );
  }
  await page.goto(base + "#/welcome");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outDir}/${label}-welcome.png` });
  await page.getByRole("button", { name: "Explore a sample" }).click();
  await page.waitForTimeout(800);
  const docId = await page.evaluate(() => {
    const raw = localStorage.getItem("storyline.studio.v1");
    if (raw) return JSON.parse(raw).docs[0].id;
    const key = Object.keys(localStorage).find((k) => k.startsWith("storyline.cache."));
    return key ? JSON.parse(localStorage.getItem(key)).state.docs[0].id : null;
  });
  const extra = docId ? [`/editor/${docId}/Content`, `/editor/${docId}/Insights`, `/export/${docId}`, `/templates/${docId}`] : [];
  for (const route of [...routes, ...extra]) {
    await page.evaluate((r) => (location.hash = r), route);
    await page.waitForTimeout(900);
    const name = route.replace(/\//g, "_").replace(docId || "@@", "doc");
    await page.screenshot({ path: `${outDir}/${label}${name}.png`, fullPage: false });
  }
  await context.close();
}

await shoot(protoUrl, "proto", false);
await shoot(appUrl, "app", true);
await browser.close();
console.log("done");
