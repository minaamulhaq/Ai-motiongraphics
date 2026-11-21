create table public.project_generations (
  project_id uuid primary key references public.projects(id) on delete cascade,
  run_id uuid not null default gen_random_uuid(),
  attempt integer not null default 1,
  status text not null default 'queued' check(status in ('queued','loading_project','generating_prompt','generating_theme','generating_composition','validating','completed','failed')),
  progress integer not null default 0 check(progress between 0 and 100),
  error text,
  brief jsonb,
  theme jsonb,
  composition_code text,
  updated_at timestamptz not null default now()
);
alter table public.project_generations enable row level security;
revoke all on public.project_generations from anon,authenticated;
grant select on public.project_generations to anon,authenticated;
create policy generation_read on public.project_generations for select to anon,authenticated
using(exists(select 1 from public.projects p where p.id=project_id and (p.shared or p.user_id=(select auth.jwt()->>'sub'))));

create function public.queue_project_generation(target uuid, retry boolean default false)
returns setof public.project_generations language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.projects p where p.id=target and p.user_id=(select auth.jwt()->>'sub')) then
    raise exception 'Only the project owner can generate video' using errcode='42501';
  end if;
  insert into public.project_generations(project_id) values(target) on conflict do nothing;
  if retry then
    update public.project_generations set run_id=gen_random_uuid(),attempt=attempt+1,status='queued',
      progress=0,error=null,brief=null,theme=null,composition_code=null,updated_at=now()
      where project_id=target and status='failed';
  end if;
  return query select * from public.project_generations where project_id=target;
end $$;
revoke all on function public.queue_project_generation(uuid,boolean) from public,anon;
grant execute on function public.queue_project_generation(uuid,boolean) to authenticated;
notify pgrst,'reload schema';

