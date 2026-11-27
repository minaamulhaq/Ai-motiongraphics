-- Studio Database Schema (Idempotent: Safe to run multiple times in Supabase SQL Editor)
-- ==============================================================================

-- 1. Create Artwork Enum
do $$ begin
  create type public.artwork as enum ('ember', 'chrome', 'terrain', 'tide');
exception
  when duplicate_object then null;
end $$;

-- 2. Profiles Table (Linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 40)
);

-- Trigger to automatically create a profile entry when a user signs up
create or replace function public.create_studio_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'), 40), ''), 'Creator')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_studio_profile() from public, anon, authenticated;

drop trigger if exists on_studio_signup on auth.users;
create trigger on_studio_signup
  after insert on auth.users
  for each row execute function public.create_studio_profile();

-- Backfill profile for any existing users
insert into public.profiles (id, display_name)
select id, coalesce(nullif(left(trim(raw_user_meta_data->>'display_name'), 40), ''), 'Creator')
from auth.users
on conflict (id) do nothing;


-- 2.1. Clerk Users & Credits Table
create table if not exists public.users (
  id text primary key, -- Clerk User ID (e.g. user_2...)
  email text,
  full_name text,
  credit integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
grant all on public.users to anon, authenticated, postgres, service_role;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'users_all') then
    create policy users_all on public.users for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

-- 3. Projects Table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references public.profiles on delete cascade,
  collection_position smallint unique,
  title text not null check(length(trim(title)) between 1 and 64),
  prompt text not null check(length(trim(prompt)) between 1 and 1200),
  art public.artwork not null,
  seconds smallint not null check(seconds in (5, 10, 20)),
  ratio text not null check(ratio in ('10:19', '16:9', '19:6')),
  video_engine text not null default 'remotion' check (video_engine in ('remotion', 'hyperframes')),
  hue smallint not null default 0 check(hue between -180 and 180),
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (owner_id is not null and collection_position is null)
    or (owner_id is null and collection_position is not null and collection_position >= 0 and shared)
  )
);

create index if not exists projects_owner_created on public.projects(owner_id, created_at desc);
create index if not exists projects_shared_created on public.projects(created_at desc) where shared;

-- 4. Contact Messages Table
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  email text not null check(length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  body text not null check(length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- 5. Row Level Security (RLS) & Permissions
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.contact_messages enable row level security;

revoke all on public.profiles, public.projects, public.contact_messages from public, anon, authenticated;
grant select on public.profiles, public.projects to anon, authenticated;
grant insert (title, prompt, art, seconds, ratio, hue, shared) on public.projects to authenticated;
grant insert (email, body) on public.contact_messages to anon, authenticated;

-- Policies for projects
drop policy if exists project_visibility on public.projects;
create policy project_visibility on public.projects for select to anon, authenticated
using (shared or owner_id = (select auth.uid()));

drop policy if exists project_creation on public.projects;
create policy project_creation on public.projects for insert to authenticated
with check (owner_id = (select auth.uid()) and collection_position is null);

-- Policies for profiles
drop policy if exists profile_visibility on public.profiles;
create policy profile_visibility on public.profiles for select to anon, authenticated
using (id = (select auth.uid()) or exists (
  select 1 from public.projects where owner_id = profiles.id and shared
));

-- Policies for contact messages
drop policy if exists inbox_submission on public.contact_messages;
create policy inbox_submission on public.contact_messages for insert to anon, authenticated
with check (true);

-- 6. Seed Collection Reels (Required by GET /api/studio hero query)
insert into public.projects (collection_position, title, prompt, art, seconds, ratio, shared)
values
  (0, 'Ember Loop', 'An ember-orange knot winds through a dark studio, its fine ridges catching the light.', 'ember', 10, '16:9', true),
  (1, 'Liquid Chrome', 'A polished lavender sculpture slowly turning in soft studio light.', 'chrome', 10, '16:9', true),
  (2, 'Soft Topography', 'Glide across rippling moss-green terrain with delicate pleated ridges.', 'terrain', 5, '19:6', true),
  (3, 'Blue Frequency', 'A deep blue sculptural loop drifts through a cool monochrome space.', 'tide', 20, '10:19', true)
on conflict (collection_position) do update set
  title = excluded.title,
  prompt = excluded.prompt,
  art = excluded.art,
  seconds = excluded.seconds,
  ratio = excluded.ratio,
  shared = excluded.shared;
