-- Storyline schema: one workspace row per user, plus documents, applications and AI usage.
-- Every table is protected by row-level security so users can only reach their own rows.

create extension if not exists pgcrypto;

-- Keeps updated_at current on every write.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- workspaces: master profile, settings, studio data and drafts (one per user)
-- --------------------------------------------------------------------------
create table public.workspaces (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  onboarded   boolean not null default false,
  sample      boolean not null default false,
  profile     jsonb   not null default '{}'::jsonb,
  settings    jsonb   not null default '{}'::jsonb,
  studio      jsonb   not null default '{}'::jsonb,
  tailor      jsonb   not null default '{}'::jsonb,
  drafts      jsonb   not null default '{}'::jsonb,
  plans       jsonb   not null default '[]'::jsonb,
  usage       jsonb   not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- documents: resumes and cover letters (full document JSON in data)
-- --------------------------------------------------------------------------
create table public.documents (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null default 'resume' check (kind in ('resume', 'letter')),
  title       text not null default '',
  status      text not null default 'Draft',
  archived    boolean not null default false,
  position    integer not null default 0,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index documents_user_idx on public.documents (user_id, position);

create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- applications: tracked opportunities (full application JSON in data)
-- --------------------------------------------------------------------------
create table public.applications (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company     text not null default '',
  role        text not null default '',
  stage       text not null default 'Saved',
  position    integer not null default 0,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index applications_user_idx on public.applications (user_id, position);

create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- ai_usage: one row per Gemini request, written by the server (service role)
-- --------------------------------------------------------------------------
create table public.ai_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  task        text not null,
  model       text not null,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  ok          boolean not null default true,
  created_at  timestamptz not null default now()
);

create index ai_usage_user_day_idx on public.ai_usage (user_id, created_at desc);

-- --------------------------------------------------------------------------
-- Row-level security
-- --------------------------------------------------------------------------
alter table public.workspaces   enable row level security;
alter table public.documents    enable row level security;
alter table public.applications enable row level security;
alter table public.ai_usage     enable row level security;

create policy "Own workspace: select" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own workspace: insert" on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own workspace: update" on public.workspaces
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own workspace: delete" on public.workspaces
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Own documents: select" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own documents: insert" on public.documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own documents: update" on public.documents
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own documents: delete" on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Own applications: select" on public.applications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own applications: insert" on public.applications
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own applications: update" on public.applications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own applications: delete" on public.applications
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Users may read their own AI usage; only the server (service role, bypasses RLS) writes it.
create policy "Own AI usage: select" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- --------------------------------------------------------------------------
-- Account deletion: removes the auth user; cascades delete every row above.
-- --------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
