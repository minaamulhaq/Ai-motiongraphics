create table public.subscription_credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  source_key text not null unique,
  plan_slug text not null,
  credits integer not null check (credits > 0),
  balance_after integer not null check (balance_after >= 0),
  period_start timestamptz not null,
  created_at timestamptz not null default now()
);

create index subscription_credit_grants_user_created
  on public.subscription_credit_grants(user_id, created_at desc);

alter table public.subscription_credit_grants enable row level security;
revoke all on public.subscription_credit_grants from public, anon, authenticated;
grant select on public.subscription_credit_grants to authenticated;
create policy subscription_credit_grants_owner_read
  on public.subscription_credit_grants for select to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

create or replace function public.grant_subscription_credits(
  target_user text,
  source_key_value text,
  plan_slug_value text,
  credit_amount integer,
  billing_period_start timestamptz
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  current_balance integer;
  inserted_count integer;
begin
  if target_user is null or source_key_value is null or plan_slug_value is null
     or credit_amount is null or credit_amount <= 0 or credit_amount > 1000000 then
    raise exception 'invalid_subscription_credit_grant' using errcode='22023';
  end if;

  select credit into current_balance
    from public.users where id=target_user for update;
  if current_balance is null then
    raise exception 'user_account_missing' using errcode='P0001';
  end if;

  insert into public.subscription_credit_grants(
    user_id, source_key, plan_slug, credits, balance_after, period_start
  ) values (
    target_user, source_key_value, plan_slug_value, credit_amount,
    current_balance + credit_amount, billing_period_start
  ) on conflict (source_key) do nothing;
  get diagnostics inserted_count=row_count;

  if inserted_count=1 then
    current_balance:=current_balance+credit_amount;
    update public.users set credit=current_balance,updated_at=now() where id=target_user;
  end if;
  return current_balance;
end $$;

revoke all on function public.grant_subscription_credits(text,text,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.grant_subscription_credits(text,text,text,integer,timestamptz) to service_role;
notify pgrst,'reload schema';
