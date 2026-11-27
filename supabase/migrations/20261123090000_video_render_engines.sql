alter table public.projects
  add column if not exists video_engine text not null default 'remotion';

alter table public.projects
  drop constraint if exists projects_video_engine_check;
alter table public.projects
  add constraint projects_video_engine_check check (video_engine in ('remotion', 'hyperframes'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hyperframes-videos', 'hyperframes-videos', false, 2147483648, array['video/mp4']::text[])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

alter table public.project_generations
  add column if not exists video_engine text not null default 'remotion';
alter table public.project_generations
  drop constraint if exists project_generations_video_engine_check;
alter table public.project_generations
  add constraint project_generations_video_engine_check check (video_engine in ('remotion', 'hyperframes'));

alter table public.project_video_versions
  add column if not exists video_engine text not null default 'remotion';
alter table public.project_video_versions
  drop constraint if exists project_video_versions_video_engine_check;
alter table public.project_video_versions
  add constraint project_video_versions_video_engine_check check (video_engine in ('remotion', 'hyperframes'));

update public.project_generations g
set video_engine = p.video_engine
from public.projects p
where p.id = g.project_id and g.status in ('queued', 'loading_project', 'generating_theme', 'generating_prompt', 'generating_composition', 'validating');

update public.project_video_versions v
set video_engine = g.video_engine
from public.project_generations g
where g.run_id = v.run_id;

drop function if exists public.complete_project_generation(uuid, uuid, text);

create function public.complete_project_generation(
  target uuid,
  target_run uuid,
  source_code text,
  source_engine text
)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  changed integer;
begin
  if source_engine not in ('remotion', 'hyperframes') then
    raise exception 'invalid_video_engine' using errcode='22023';
  end if;
  update public.project_generations
    set status='completed', progress=100, composition_code=source_code,
        video_engine=source_engine, error=null, updated_at=now()
    where project_id=target and run_id=target_run and status not in ('completed','failed');
  get diagnostics changed=row_count;
  if changed=0 then return false; end if;
  insert into public.project_video_versions(run_id,project_id,brief,theme,composition_code,request_prompt,video_engine)
    select run_id,project_id,brief,theme,composition_code,request_prompt,video_engine
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
revoke all on function public.complete_project_generation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_project_generation(uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
