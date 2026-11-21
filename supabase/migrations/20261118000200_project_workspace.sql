-- Clerk owns the account lifecycle. The server validates each project request.
create table if not exists public.users (
  id text primary key,
  email text not null,
  full_name text not null,
  credit integer not null default 100 check (credit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;

alter table public.projects add column if not exists user_id text references public.users(id) on delete cascade;
alter table public.projects drop constraint if exists projects_check;
alter table public.projects add constraint projects_account_check check (
  ((owner_id is not null or user_id is not null) and collection_position is null)
  or (owner_id is null and user_id is null and collection_position is not null and shared)
);
alter table public.projects drop constraint projects_prompt_check;
alter table public.projects add constraint projects_prompt_check check (length(trim(prompt)) between 1 and 2000);
create index projects_clerk_user on public.projects(user_id,created_at desc);
drop policy if exists projects_all_access on public.projects;
drop policy if exists users_all on public.users;
alter table public.projects alter column owner_id set default auth.uid();

create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(trim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index project_messages_history on public.project_messages(project_id,created_at);
alter table public.project_messages enable row level security;
revoke all on public.project_messages from anon, authenticated;
-- The route owns authorization for Clerk identities. Existing Supabase Auth
-- project policies continue to apply to their original records.

