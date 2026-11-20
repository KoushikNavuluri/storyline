/**
 * POST /api/ai — Storyline writing assistance (Google Gemini).
 * Body: { task, payload }. Header: Authorization: Bearer <Supabase access token>.
 * Responses: 200 { result } | 4xx/5xx { error }.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { logUsage, overQuota, userFromToken } from "./_lib/auth.js";
import { generateJson, GeminiError, modelName } from "./_lib/gemini.js";
import { SYSTEM_BASE, TASKS, TaskError } from "./_lib/tasks.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || undefined;
  let user;
  try {
    user = await userFromToken(token);
  } catch (error) {
    console.error(error);
    return res.status(503).json({ error: "Assistance is not configured." });
  }
  if (!user) return res.status(401).json({ error: "Sign in to use writing assistance." });

  const body = (typeof req.body === "string" ? safeParse(req.body) : req.body) as
    | { task?: string; payload?: Record<string, unknown> }
    | undefined;
  const taskName = body?.task || "";
  const task = TASKS[taskName];
  if (!task) return res.status(400).json({ error: "Unknown assistance task." });
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};

  const limited = await overQuota(user.id).catch(() => null);
  if (limited) return res.status(429).json({ error: limited });

  let parts;
  try {
    parts = task.build(payload);
  } catch (error) {
    const e = error as TaskError;
    return res.status(e.status || 400).json({ error: e.message });
  }

  try {
    const response = await generateJson<Record<string, unknown>>({
      system: SYSTEM_BASE,
      parts,
      schema: task.schema,
      temperature: task.temperature,
      maxOutputTokens: task.maxOutputTokens,
    });
    const result = task.validate(response.data, payload);
    await logUsage({
      userId: user.id,
      task: taskName,
      model: response.model,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      ok: true,
    });
    return res.status(200).json({ result });
  } catch (error) {
    const status = error instanceof GeminiError || error instanceof TaskError ? error.status : 500;
    if (!(error instanceof TaskError)) console.error(`AI task ${taskName} failed`, error);
    await logUsage({ userId: user.id, task: taskName, model: modelName(), tokensIn: 0, tokensOut: 0, ok: false });
    return res.status(status).json({ error: error instanceof Error ? error.message : "Assistance failed." });
  }
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
