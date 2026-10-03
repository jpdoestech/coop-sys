-- Secure every public table exposed through PostgREST that did not yet have RLS.
alter table public.member_types enable row level security;
alter table public.member_statuses enable row level security;
alter table public.employment_types enable row level security;
alter table public.employment_statuses enable row level security;
alter table public.document_types enable row level security;
alter table public.sync_queue enable row level security;
alter table public.sync_conflicts enable row level security;
alter table public.sync_logs enable row level security;
alter table public.system_settings enable row level security;

create policy "authenticated users read member types"
  on public.member_types for select to authenticated using (true);
create policy "settings managers maintain member types"
  on public.member_types for all to authenticated
  using (public.current_user_has_permission('settings.manage'))
  with check (public.current_user_has_permission('settings.manage'));

create policy "authenticated users read member statuses"
  on public.member_statuses for select to authenticated using (true);
create policy "settings managers maintain member statuses"
  on public.member_statuses for all to authenticated
  using (public.current_user_has_permission('settings.manage'))
  with check (public.current_user_has_permission('settings.manage'));

create policy "authenticated users read employment types"
  on public.employment_types for select to authenticated using (true);
create policy "settings managers maintain employment types"
  on public.employment_types for all to authenticated
  using (public.current_user_has_permission('settings.manage'))
  with check (public.current_user_has_permission('settings.manage'));

create policy "authenticated users read employment statuses"
  on public.employment_statuses for select to authenticated using (true);
create policy "settings managers maintain employment statuses"
  on public.employment_statuses for all to authenticated
  using (public.current_user_has_permission('settings.manage'))
  with check (public.current_user_has_permission('settings.manage'));

create policy "authenticated users read document types"
  on public.document_types for select to authenticated using (true);
create policy "settings managers maintain document types"
  on public.document_types for all to authenticated
  using (public.current_user_has_permission('settings.manage'))
  with check (public.current_user_has_permission('settings.manage'));

create policy "authorized users read sync queue"
  on public.sync_queue for select to authenticated
  using (public.current_user_has_permission('sync.view'));
create policy "sync managers maintain sync queue"
  on public.sync_queue for all to authenticated
  using (public.current_user_has_permission('sync.manage'))
  with check (public.current_user_has_permission('sync.manage'));

create policy "authorized users read sync conflicts"
  on public.sync_conflicts for select to authenticated
  using (public.current_user_has_permission('sync.view'));
create policy "sync managers maintain sync conflicts"
  on public.sync_conflicts for all to authenticated
  using (public.current_user_has_permission('sync.manage'))
  with check (public.current_user_has_permission('sync.manage'));

create policy "authorized users read sync logs"
  on public.sync_logs for select to authenticated
  using (public.current_user_has_permission('sync.view'));
create policy "sync managers maintain sync logs"
  on public.sync_logs for all to authenticated
  using (public.current_user_has_permission('sync.manage'))
  with check (public.current_user_has_permission('sync.manage'));

create policy "authorized users read system settings"
  on public.system_settings for select to authenticated
  using (public.current_user_has_permission('settings.view'));
create policy "settings managers maintain system settings"
  on public.system_settings for all to authenticated
  using (public.current_user_has_permission('settings.manage'))
  with check (public.current_user_has_permission('settings.manage'));

-- Cache auth.uid() once per statement so RLS does not re-evaluate it per row.
drop policy if exists "users read own overrides" on public.user_permission_overrides;
create policy "users read own overrides" on public.user_permission_overrides
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_has_permission('users.view'));

drop policy if exists "users read own client access" on public.user_client_access;
create policy "users read own client access" on public.user_client_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_has_permission('users.view'));

drop policy if exists "users read own resource assignments" on public.user_resource_assignments;
create policy "users read own resource assignments" on public.user_resource_assignments
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_has_permission('users.view'));

drop policy if exists "users read own profile or permission" on public.users;
create policy "users read own profile or permission" on public.users
  for select to authenticated
  using (id = (select auth.uid()) or public.current_user_has_permission('users.view'));

drop policy if exists "users read own role assignments" on public.user_roles;
create policy "users read own role assignments" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_has_permission('users.view'));

drop policy if exists "users read own branch assignments" on public.user_branch_access;
create policy "users read own branch assignments" on public.user_branch_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_has_permission('users.view'));
