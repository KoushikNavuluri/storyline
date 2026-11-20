/** Server-side Supabase access: verify the caller's session and enforce assistance quotas. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 80;
export const MINUTE_LIMIT = Number(process.env.AI_MINUTE_LIMIT) || 12;

/** Returns a reason string when the user is over a limit, otherwise null. */
export async function overQuota(userId: string): Promise<string | null> {
  const db = adminClient();
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const minute = new Date(Date.now() - 60 * 1000).toISOString();
  const [daily, recent] = await Promise.all([
    db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", day),
    db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", minute),
  ]);
  if ((daily.count || 0) >= DAILY_LIMIT) return "Daily assistance limit reached. It resets within 24 hours.";
  if ((recent.count || 0) >= MINUTE_LIMIT) return "That's a lot of requests at once. Wait a minute and try again.";
  return null;
}

export async function logUsage(entry: {
  userId: string;
  task: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  ok: boolean;
}) {
  const { error } = await adminClient().from("ai_usage").insert({
    user_id: entry.userId,
    task: entry.task,
    model: entry.model,
    tokens_in: entry.tokensIn,
    tokens_out: entry.tokensOut,
    ok: entry.ok,
  });
  if (error) console.error("Could not log AI usage", error.message);
}
