drop function if exists public.queue_project_generation(uuid,text,boolean);

create function public.queue_project_generation(
  target uuid,
  requested_prompt text default null,
  retry_requested boolean default false,
  actor_id text default null
)
returns setof public.project_generations
language plpgsql
security definer
set search_path=''
as $$
declare
  actor text := actor_id;
  existing public.project_generations%rowtype;
  current_balance integer;
  cost integer;
  kind text;
  prompt_value text;
  next_run uuid := gen_random_uuid();
begin
  if actor is null or not exists(
    select 1 from public.projects p where p.id=target and p.user_id=actor
  ) then
    raise exception 'project_access_denied' using errcode='42501';
  end if;
  if requested_prompt is not null then
    requested_prompt := nullif(trim(requested_prompt),'');
    if requested_prompt is null or length(requested_prompt)>2000 then
      raise exception 'invalid_modification_prompt' using errcode='22023';
    end if;
  end if;

  select * into existing from public.project_generations
    where project_id=target for update;

  if found and existing.status not in ('completed','failed') then
    if requested_prompt is null or (existing.request_type='modification' and existing.request_prompt=requested_prompt) then
      return query select * from public.project_generations where project_id=target;
      return;
    end if;
    raise exception 'generation_in_progress' using errcode='55000';
  end if;

  if retry_requested then
    if not found or existing.status<>'failed' then
      raise exception 'generation_not_retryable' using errcode='55000';
    end if;
    kind:=case when existing.request_type='modification' then 'modification' else 'new_video' end;
    prompt_value:=existing.request_prompt;
    cost:=case when kind='modification' then 10 else 20 end;
  elsif requested_prompt is not null then
    if not found or existing.status<>'completed' then
      raise exception 'generate_original_first' using errcode='55000';
    end if;
    if existing.request_type='modification' and existing.request_prompt=requested_prompt then
      return query select * from public.project_generations where project_id=target;
      return;
    end if;
    kind:='modification'; prompt_value:=requested_prompt; cost:=10;
  elsif found then
    return query select * from public.project_generations where project_id=target;
    return;
  else
    kind:='new_video'; prompt_value:=null; cost:=20;
  end if;

  select u.credit into current_balance from public.users u where u.id=actor for update;
  if current_balance is null then
    raise exception 'user_account_missing' using errcode='P0001';
  end if;
  if current_balance<cost then
    raise exception 'insufficient_credits' using errcode='P0001';
  end if;
  current_balance:=current_balance-cost;
  update public.users set credit=current_balance,updated_at=now() where id=actor;

  if existing.project_id is null then
    insert into public.project_generations(project_id,run_id,status,progress,request_type,credit_cost,request_prompt,updated_at)
    values(target,next_run,'queued',0,kind,cost,prompt_value,now());
  else
    update public.project_generations set run_id=next_run,attempt=attempt+1,status='queued',progress=0,
      error=null,brief=null,theme=null,composition_code=null,request_type=kind,credit_cost=cost,
      request_prompt=prompt_value,updated_at=now()
      where project_id=target;
  end if;

  insert into public.credit_transactions(user_id,project_id,run_id,generation_type,credits,balance_after)
    values(actor,target,next_run,kind,cost,current_balance);
  return query select * from public.project_generations where project_id=target;
end $$;

revoke all on function public.queue_project_generation(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.queue_project_generation(uuid,text,boolean,text) to service_role;
