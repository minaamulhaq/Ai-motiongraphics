create table public.project_video_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id text not null,
  run_id uuid not null references public.project_video_versions(run_id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  render_id text,
  output_bucket text,
  output_key text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_video_exports_owner_recent on public.project_video_exports(owner_id, created_at desc);
create unique index project_video_exports_one_active on public.project_video_exports(project_id, run_id)
  where status in ('queued', 'rendering');
create unique index project_video_exports_completed_source on public.project_video_exports(project_id, run_id)
  where status = 'completed';

alter table public.project_video_exports enable row level security;
revoke all on public.project_video_exports from public, anon, authenticated;
grant select on public.project_video_exports to anon, authenticated;
create policy project_video_exports_owner_access on public.project_video_exports
  for select to anon, authenticated
  using ((select auth.jwt()->>'sub') = owner_id);

grant all on public.project_video_exports to service_role;
