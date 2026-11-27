create table public.clip_jobs (
 id uuid primary key default gen_random_uuid(), owner_id text not null,
 source_key text not null unique, source_name text not null, source_size bigint not null check(source_size between 1 and 524288000),
 requested_clips int not null check(requested_clips between 1 and 10), ratio text not null check(ratio in ('9:16','16:9')),
 status text not null default 'uploading' check(status in ('uploading','queued','processing','completed','failed')),
 stage text not null default 'Uploading', progress int not null default 0, attempts int not null default 0,
 lease_token uuid, lease_until timestamptz, outputs jsonb not null default '[]', error text,
 created_at timestamptz not null default now()
);
create index clip_jobs_queue on public.clip_jobs(status, created_at);
create index clip_jobs_owner on public.clip_jobs(owner_id, created_at desc);
alter table public.clip_jobs enable row level security;
revoke all on public.clip_jobs from anon, authenticated;
grant all on public.clip_jobs to service_role;
create function public.claim_clip_job() returns setof public.clip_jobs language plpgsql security definer set search_path=public as $$
begin
 update clip_jobs set status='failed', error='Processing could not finish. Please upload again.' where status='processing' and lease_until < now() and attempts>=3;
 return query update clip_jobs set status='processing', attempts=attempts+1, lease_token=gen_random_uuid(), lease_until=now()+interval '2 minutes'
 where id=(select id from clip_jobs where (status='queued' or (status='processing' and lease_until<now())) and attempts<3 order by created_at for update skip locked limit 1) returning *;
end; $$;
revoke all on function public.claim_clip_job() from public, anon, authenticated;
grant execute on function public.claim_clip_job() to service_role;
