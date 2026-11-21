create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null unique,
  generation_type text not null check (generation_type in ('new_video','modification')),
  credits integer not null check (credits in (15,20)),
  status text not null default 'reserved' check (status in ('reserved','charged','refunded')),
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index credit_transactions_user_created on public.credit_transactions(user_id,created_at desc);
create index credit_transactions_project_created on public.credit_transactions(project_id,created_at desc);
alter table public.credit_transactions enable row level security;
revoke all on public.credit_transactions from public,anon,authenticated;
grant select on public.credit_transactions to authenticated;
create policy credit_transaction_read on public.credit_transactions for select to authenticated
using(user_id=(select auth.jwt()->>'sub'));

alter table public.project_generations
  add column request_type text not null default 'legacy' check(request_type in ('legacy','new_video','modification')),
  add column credit_cost integer not null default 0 check(credit_cost in (0,15,20)),
  add column request_prompt text check(request_prompt is null or length(trim(request_prompt)) between 1 and 2000);

drop function if exists public.queue_project_generation(uuid,boolean);
create function public.queue_project_generation(
  target uuid,
  requested_prompt text default null,
  retry_requested boolean default false
)
returns setof public.project_generations
language plpgsql
security definer
set search_path=''
as $$
declare
  actor text := auth.jwt()->>'sub';
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
    cost:=case when kind='modification' then 15 else 20 end;
  elsif requested_prompt is not null then
    if not found or existing.status<>'completed' then
      raise exception 'generate_original_first' using errcode='55000';
    end if;
    kind:='modification'; prompt_value:=requested_prompt; cost:=15;
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
revoke all on function public.queue_project_generation(uuid,text,boolean) from public,anon;
grant execute on function public.queue_project_generation(uuid,text,boolean) to authenticated;

create function public.complete_project_generation(target uuid,target_run uuid,source_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  changed integer;
begin
  update public.project_generations set status='completed',progress=100,composition_code=source_code,error=null,updated_at=now()
    where project_id=target and run_id=target_run and status not in ('completed','failed');
  get diagnostics changed=row_count;
  if changed=0 then return false; end if;
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

create function public.fail_project_generation(target uuid,target_run uuid,failure_message text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  owner_id text;
  refund integer;
  new_balance integer;
begin
  select user_id,credits into owner_id,refund from public.credit_transactions
    where project_id=target and run_id=target_run and status='reserved' for update;
  if not found then return false; end if;
  update public.users set credit=credit+refund,updated_at=now() where id=owner_id returning credit into new_balance;
  update public.credit_transactions set status='refunded',balance_after=new_balance,settled_at=now()
    where project_id=target and run_id=target_run and status='reserved';
  update public.project_generations set status='failed',error=left(coalesce(failure_message,'Generation failed.'),500),updated_at=now()
    where project_id=target and run_id=target_run and status not in ('completed','failed');
  return true;
end $$;
revoke all on function public.fail_project_generation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_project_generation(uuid,uuid,text) to service_role;

notify pgrst,'reload schema';
