# Storyline

Shape your next career move. Storyline is a career studio: one master profile, tailored resumes with a live A4 preview and PDF export, cover letters, an application tracker, interview preparation, and a studio for your launch plan, pitch, story deck, career timeline, decision desk, and rehearsal room.

Writing assistance runs on Google Gemini and works only from your own material. It never adds experience, metrics, or qualifications, and you review every change.

## Stack

| Layer | Choice |
|---|---|
| Front end | React 18, TypeScript, Vite, Radix UI primitives, cmdk, sonner, framer-motion, lucide icons |
| Auth and data | Supabase (email + password, magic link, password reset; Postgres with row-level security) |
| AI | Google Gemini (`gemini-3.1-flash-lite` by default) via a server-side Vercel function, structured JSON output |
| Hosting | Vercel (static app + `api/ai` serverless function) |

## Project layout

```
api/                 Vercel function: POST /api/ai (auth, quota, Gemini, validation)
  _lib/              gemini client, task prompts/schemas/validators, Supabase admin helpers
src/
  App.tsx            auth gate → workspace load → shell
  components/ui/     shadcn primitives + Storyline building blocks (Paper, Modal, PageTitle, …)
  components/shell/  app frame, routes, command palette, quick capture
  screens/           one file per route (screens/studio/* for the studio)
  state/             data model, factories, provider (routing, theme), Supabase sync engine
  lib/               AI client, keyword analysis, PDF layout + writer, downloads
  styles/            app.css (design system), auth.css
supabase/migrations/ database schema and RLS policies
tests/unit/          Vitest unit tests
scripts/             local API server, AI smoke test, visual comparison
```

## How data is stored

The app keeps one workspace object in memory. The sync engine (`src/state/sync.ts`) maps it to three tables and, on every change, upserts only rows whose content changed (debounced) and deletes removed rows:

- `workspaces` — profile, settings, studio data, drafts (one row per user)
- `documents` — resumes and cover letters, with versions
- `applications` — tracked opportunities
- `ai_usage` — one row per assistance request (written by the server; used for quotas)

Every table has row-level security (`user_id = auth.uid()`). A per-user browser cache keeps unsynced edits across reloads and offline periods. `delete_my_account()` removes the user and cascades all rows.

## Writing assistance

`POST /api/ai` with `{ task, payload }` and the user's Supabase access token. The function verifies the session, enforces daily and per-minute limits, calls Gemini with a JSON schema for the task, validates the answer, and logs usage. Tasks: `requirements`, `tailorDraft`, `suggestions`, `insights`, `coverLetter`, `followup`, `interview`, `rehearsal`, `rehearsalFeedback`, `pitch`, `importResume` (text, PDF, or DOCX text), `launchPlan`.

Guardrails: user material is passed as data, suggestions must reference real resume lines (the original text is filled in server-side), and generated text that introduces numbers not present in the user's material is rejected. If assistance is unavailable, each feature falls back to built-in rules.

## Local development

```bash
cp .env.example .env.local   # fill in your values
npm install
npm run dev:api              # serves /api/ai on :3001 (reads .env.local)
npm run dev                  # Vite on :5173, proxies /api to :3001
```

Apply the schema to your Supabase project with the SQL in `supabase/migrations/` (Supabase CLI: `supabase db push`, or the SQL editor).

## Checks

```bash
npm run typecheck   # app + API
npm test            # unit tests
npm run build       # production build
GEMINI_API_KEY=… npx tsx scripts/ai-smoke.ts   # live run of every AI task
```

## Deployment (Vercel)

Set these environment variables in the Vercel project, then deploy:

| Variable | Scope |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | build (public) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | server only |
| `GEMINI_API_KEY` | server only |
| `AI_MODEL` (default `gemini-3.1-flash-lite`; `GEMINI_MODEL` also accepted), `AI_DAILY_LIMIT`, `AI_MINUTE_LIMIT` | optional |

In Supabase Auth settings, set the Site URL to the Vercel domain and add it to the redirect URLs so confirmation, magic-link, and reset emails return to the app. For production email volume, configure custom SMTP in Supabase.
