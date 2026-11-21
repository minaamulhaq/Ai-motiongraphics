-- Reinforce PostgREST RPC argument names used by the deployed app.
drop function if exists public.fail_project_generation(uuid, uuid, text);
create function public.fail_project_generation(target uuid, target_run uuid, failure_message text)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id text; refund integer; new_balance integer;
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
