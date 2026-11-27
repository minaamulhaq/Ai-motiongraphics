alter table public.clip_jobs add column credits_charged integer not null default 0
  check (credits_charged in (0,100));

create function public.queue_paid_clip(p_owner text, p_job uuid) returns text
language plpgsql set search_path = public as $$
declare current_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner, 0));
  select status into strict current_status from clip_jobs
    where id=p_job and owner_id=p_owner for update;
  if current_status <> 'uploading' then return current_status; end if;
  if exists(select 1 from clip_jobs where owner_id=p_owner and status in ('queued','processing')) then
    return 'busy';
  end if;
  update users set credit=credit-100, updated_at=now() where id=p_owner and credit>=100;
  if not found then return 'insufficient'; end if;
  update clip_jobs set status='queued', stage='Queued', credits_charged=100 where id=p_job;
  return 'queued';
end; $$;
revoke all on function public.queue_paid_clip(text,uuid) from public, anon, authenticated;
grant execute on function public.queue_paid_clip(text,uuid) to service_role;
