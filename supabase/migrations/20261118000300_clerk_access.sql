-- Enable Clerk in Supabase Third Party Auth before serving signed-in requests.
-- Clerk subjects are text. auth.uid() expects a UUID, so use JWT sub directly.
drop policy if exists project_visibility on public.projects;
drop policy if exists project_creation on public.projects;
drop policy if exists projects_all_access on public.projects;
drop policy if exists users_all on public.users;
alter table public.projects alter column owner_id drop default;
grant select, insert on public.users to authenticated;
grant insert(user_id) on public.projects to authenticated;
grant update(art,hue,seconds,ratio) on public.projects to authenticated;
grant select, insert on public.project_messages to authenticated;

create policy clerk_user_read on public.users for select to authenticated
using (id = (select auth.jwt()->>'sub'));
create policy clerk_user_create on public.users for insert to authenticated
with check (id = (select auth.jwt()->>'sub') and credit = 100);
create policy clerk_project_read on public.projects for select to anon, authenticated
using (shared or user_id = (select auth.jwt()->>'sub'));
create policy clerk_project_create on public.projects for insert to authenticated
with check (user_id = (select auth.jwt()->>'sub') and owner_id is null and collection_position is null);
create policy clerk_project_update on public.projects for update to authenticated
using (user_id = (select auth.jwt()->>'sub'))
with check (user_id = (select auth.jwt()->>'sub'));
create policy clerk_chat_read on public.project_messages for select to authenticated
using (exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.jwt()->>'sub')));
create policy clerk_chat_create on public.project_messages for insert to authenticated
with check (exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.jwt()->>'sub')));
