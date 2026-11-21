begin;
insert into public.users(id,email,full_name) values
('workspace-test-owner','owner@example.com','Owner'),
('workspace-test-other','other@example.com','Other');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"workspace-test-owner","role":"authenticated"}',true);
insert into public.projects(user_id,title,prompt,art,seconds,ratio,shared) values
('workspace-test-owner','Private test','Verification','ember',5,'16:9',false),
('workspace-test-owner','Shared test','Verification','tide',10,'10:19',true);
insert into public.project_messages(project_id,role,content)
select id,'user','Hello' from public.projects where title='Private test' and user_id='workspace-test-owner';
do $$ begin
  if (select count(*) from public.projects where user_id='workspace-test-owner') <> 2 then
    raise exception 'Owner could not read both projects';
  end if;
end $$;
select set_config('request.jwt.claims','{"sub":"workspace-test-other","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.projects where title='Private test' and user_id='workspace-test-owner') then
    raise exception 'Private project visible to another user';
  end if;
  if exists(select 1 from public.project_messages) then
    raise exception 'Another user can read chat history';
  end if;
  begin
    insert into public.projects(user_id,title,prompt,art,seconds,ratio) values
    ('workspace-test-owner','Forbidden','Denied','ember',5,'16:9');
    raise exception 'Ownership spoofing succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  if (select count(*) from public.projects where title='Shared test' and user_id='workspace-test-owner') <> 1 then
    raise exception 'Shared project unavailable to guests';
  end if;
  if exists(select 1 from public.projects where title='Private test' and user_id='workspace-test-owner') then
    raise exception 'Private project visible to a guest';
  end if;
end $$;
rollback;
