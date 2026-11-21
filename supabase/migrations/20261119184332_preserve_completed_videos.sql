create table public.project_video_versions (
  run_id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  brief jsonb,
  theme jsonb,
  composition_code text not null,
  request_prompt text,
  completed_at timestamptz not null default now()
);
create index project_video_versions_latest on public.project_video_versions(project_id, completed_at desc);
alter table public.project_video_versions enable row level security;
revoke all on public.project_video_versions from public, anon, authenticated;
grant select on public.project_video_versions to anon, authenticated;
create policy project_video_versions_read on public.project_video_versions for select to anon, authenticated
using (exists (select 1 from public.projects p where p.id=project_id and (p.shared or p.user_id=(select auth.jwt()->>'sub'))));

insert into public.project_video_versions(run_id,project_id,brief,theme,composition_code,request_prompt,completed_at)
select run_id,project_id,brief,theme,composition_code,request_prompt,updated_at
from public.project_generations where status='completed' and composition_code is not null;

create or replace function public.complete_project_generation(target uuid,target_run uuid,source_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  changed integer;
begin
  update public.project_generations set status='completed',progress=100,composition_code=source_code,error=null,updated_at=now()
    where project_id=target and run_id=target_run and status not in ('completed','failed');
  get diagnostics changed=row_count;
  if changed=0 then return false; end if;
  insert into public.project_video_versions(run_id,project_id,brief,theme,composition_code,request_prompt)
    select run_id,project_id,brief,theme,composition_code,request_prompt
    from public.project_generations where project_id=target and run_id=target_run
    on conflict (run_id) do nothing;
  update public.credit_transactions set status='charged',settled_at=now()
    where project_id=target and run_id=target_run and status='reserved';
  update public.projects p set prompt=g.request_prompt
    from public.project_generations g
    where p.id=target and g.project_id=target and g.run_id=target_run
      and g.request_type='modification' and g.request_prompt is not null;
  return true;
end $$;
revoke all on function public.complete_project_generation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_project_generation(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
