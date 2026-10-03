alter table public.roles add column if not exists permissions text[] not null default '{}';
alter table public.roles add column if not exists is_active boolean not null default true;
alter table public.roles add column if not exists is_system boolean not null default false;
alter table public.users add column if not exists scope_type text not null default 'organization' check (scope_type in ('organization','assigned_branches','assigned_clients','self'));
alter table public.users add column if not exists manager_user_id uuid references public.users(id) on delete set null;

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.users(id) on delete cascade,
  permission text not null,
  effect text not null check (effect in ('grant','deny')),
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);
create table if not exists public.user_client_access (
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
create table if not exists public.user_resource_assignments (
  user_id uuid not null references public.users(id) on delete cascade,
  resource_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_key)
);

update public.roles set permissions = case code
  when 'super_admin' then array['dashboard.view','members.view','members.create','members.update','members.delete','members.import','members.export','members.approve','members.manage','members.sensitive.view','members.sensitive.update','employees.view','employees.create','employees.update','employees.delete','employees.import','employees.export','employees.approve','employees.manage','employees.sensitive.view','employees.sensitive.update','payments.view','payments.create','payments.update','payments.delete','payments.import','payments.export','payments.approve','payments.manage','payments.settings.view','payments.settings.manage','organization.view','organization.create','organization.update','organization.delete','organization.manage','documents.view','documents.create','documents.update','documents.delete','documents.export','documents.manage','reports.view','reports.export','sync.view','sync.manage','audit.view','audit.export','settings.view','settings.manage','users.view','users.create','users.update','users.delete','users.manage','roles.view','roles.create','roles.update','roles.delete','roles.manage']
  when 'general_manager' then array['dashboard.view','members.view','members.create','members.update','members.delete','members.import','members.export','members.approve','members.manage','members.sensitive.view','members.sensitive.update','employees.view','employees.create','employees.update','employees.delete','employees.import','employees.export','employees.approve','employees.manage','employees.sensitive.view','employees.sensitive.update','payments.view','payments.create','payments.update','payments.delete','payments.import','payments.export','payments.approve','payments.manage','organization.view','organization.create','organization.update','organization.delete','organization.manage','documents.view','documents.create','documents.update','documents.delete','documents.export','documents.manage','reports.view','reports.export','audit.view','audit.export']
  when 'hr_manager' then array['dashboard.view','members.view','members.create','members.update','members.delete','members.import','members.export','members.approve','members.manage','members.sensitive.view','members.sensitive.update','employees.view','employees.create','employees.update','employees.delete','employees.import','employees.export','employees.approve','employees.manage','employees.sensitive.view','employees.sensitive.update','organization.view','organization.create','organization.update','organization.delete','organization.manage','documents.view','documents.create','documents.update','documents.delete','documents.export','documents.manage','reports.view','reports.export','audit.view','audit.export']
  when 'accounting_manager' then array['dashboard.view','members.view','employees.view','payments.view','payments.create','payments.update','payments.import','payments.export','payments.manage','documents.view','reports.view','reports.export']
  when 'head_office_staff' then array['dashboard.view','members.view','members.create','members.update','members.delete','members.import','members.export','members.approve','members.manage','members.sensitive.view','members.sensitive.update','employees.view','employees.create','employees.update','employees.delete','employees.import','employees.export','employees.approve','employees.manage','employees.sensitive.view','employees.sensitive.update','payments.view','payments.create','payments.update','payments.delete','payments.import','payments.export','payments.approve','payments.manage','documents.view','documents.create','documents.update','documents.delete','documents.export','documents.manage','reports.view','reports.export']
  when 'branch_admin' then array['dashboard.view','members.view','members.create','members.update','members.delete','members.import','members.export','members.approve','members.manage','members.sensitive.view','members.sensitive.update','employees.view','employees.create','employees.update','employees.delete','employees.import','employees.export','employees.approve','employees.manage','employees.sensitive.view','employees.sensitive.update','payments.view','payments.create','payments.update','payments.delete','payments.import','payments.export','payments.approve','payments.manage','documents.view','documents.create','documents.update','documents.delete','documents.export','documents.manage','reports.view','reports.export']
  when 'branch_user' then array['dashboard.view','members.view','employees.view','payments.view','documents.view']
  else permissions end,
  is_system = (code = 'super_admin'), updated_at = now();

update public.users u set scope_type = 'assigned_branches'
where scope_type = 'organization' and exists (
  select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = u.id and r.code in ('branch_admin','branch_user')
);

create or replace function public.current_user_has_permission(permission_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_has_role(array['super_admin']) or (
    not exists (select 1 from public.user_permission_overrides where user_id = auth.uid() and permission = permission_code and effect = 'deny')
    and (
      exists (select 1 from public.user_permission_overrides where user_id = auth.uid() and permission = permission_code and effect = 'grant')
      or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = auth.uid() and r.is_active and permission_code = any(r.permissions))
    )
  );
$$;

create or replace function public.current_user_can_access_branch(target_branch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case coalesce((select scope_type from public.users where id = auth.uid()), 'self')
    when 'organization' then true
    when 'assigned_branches' then exists (select 1 from public.user_branch_access where user_id = auth.uid() and branch_id = target_branch_id)
    when 'assigned_clients' then exists (select 1 from public.user_client_access uca join public.clients c on c.id = uca.client_id where uca.user_id = auth.uid() and c.branch_id = target_branch_id)
    else exists (select 1 from public.users u join public.employment_assignments ea on ea.employee_id = u.employee_id where u.id = auth.uid() and ea.branch_id = target_branch_id and ea.end_date is null and ea.deleted_at is null)
  end;
$$;

create or replace function public.current_user_can_access_employee(target_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case coalesce((select scope_type from public.users where id = auth.uid()), 'self')
    when 'organization' then true
    when 'assigned_branches' then exists (select 1 from public.employment_assignments ea join public.user_branch_access uba on uba.branch_id = ea.branch_id where ea.employee_id = target_employee_id and ea.end_date is null and ea.deleted_at is null and uba.user_id = auth.uid())
    when 'assigned_clients' then exists (select 1 from public.employment_assignments ea join public.user_client_access uca on uca.client_id = ea.client_id where ea.employee_id = target_employee_id and ea.end_date is null and ea.deleted_at is null and uca.user_id = auth.uid())
    else target_employee_id = (select employee_id from public.users where id = auth.uid())
  end;
$$;

create or replace function public.current_user_can_access_member(target_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select scope_type from public.users where id = auth.uid()), 'self') = 'organization'
    or exists (select 1 from public.employees e where e.member_id = target_member_id and e.deleted_at is null and public.current_user_can_access_employee(e.id));
$$;

alter table public.roles enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.user_client_access enable row level security;
alter table public.user_resource_assignments enable row level security;

create policy "authenticated users read active roles" on public.roles for select to authenticated using (is_active or public.current_user_has_permission('roles.view'));
create policy "permission managers create roles" on public.roles for insert to authenticated with check (public.current_user_has_permission('roles.create') and not is_system);
create policy "permission managers update roles" on public.roles for update to authenticated using (public.current_user_has_permission('roles.update') and not is_system) with check (public.current_user_has_permission('roles.update') and not is_system);
create policy "permission managers delete roles" on public.roles for delete to authenticated using (public.current_user_has_permission('roles.delete') and not is_system);

create policy "users read own overrides" on public.user_permission_overrides for select to authenticated using (user_id = auth.uid() or public.current_user_has_permission('users.view'));
create policy "permission managers maintain overrides" on public.user_permission_overrides for all to authenticated using (public.current_user_has_permission('users.update')) with check (public.current_user_has_permission('users.update'));
create policy "users read own client access" on public.user_client_access for select to authenticated using (user_id = auth.uid() or public.current_user_has_permission('users.view'));
create policy "permission managers maintain client access" on public.user_client_access for all to authenticated using (public.current_user_has_permission('users.update')) with check (public.current_user_has_permission('users.update'));
create policy "users read own resource assignments" on public.user_resource_assignments for select to authenticated using (user_id = auth.uid() or public.current_user_has_permission('users.view'));
create policy "permission managers maintain resource assignments" on public.user_resource_assignments for all to authenticated using (public.current_user_has_permission('users.update')) with check (public.current_user_has_permission('users.update'));

drop policy if exists "users read own profile and super admins read all" on public.users;
drop policy if exists "super admins manage profiles" on public.users;
create policy "users read own profile or permission" on public.users for select to authenticated using (id = auth.uid() or public.current_user_has_permission('users.view'));
create policy "permission managers update profiles" on public.users for update to authenticated using (public.current_user_has_permission('users.update')) with check (public.current_user_has_permission('users.update'));
drop policy if exists "users read own roles and super admins read all" on public.user_roles;
drop policy if exists "super admins manage roles" on public.user_roles;
create policy "users read own role assignments" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.current_user_has_permission('users.view'));
create policy "permission managers maintain role assignments" on public.user_roles for all to authenticated using (public.current_user_has_permission('users.update')) with check (public.current_user_has_permission('users.update'));
drop policy if exists "users can read own branch access" on public.user_branch_access;
drop policy if exists "super admins manage branch access" on public.user_branch_access;
create policy "users read own branch assignments" on public.user_branch_access for select to authenticated using (user_id = auth.uid() or public.current_user_has_permission('users.view'));
create policy "permission managers maintain branch assignments" on public.user_branch_access for all to authenticated using (public.current_user_has_permission('users.update')) with check (public.current_user_has_permission('users.update'));

drop policy if exists "role scoped employee access" on public.employees;
drop policy if exists "role scoped member access" on public.members;
create policy "permission scoped employee read" on public.employees for select to authenticated using (public.current_user_has_permission('employees.view') and public.current_user_can_access_employee(id));
create policy "permission scoped employee create" on public.employees for insert to authenticated with check (public.current_user_has_permission('employees.create'));
create policy "permission scoped employee update" on public.employees for update to authenticated using (public.current_user_has_permission('employees.update') and public.current_user_can_access_employee(id)) with check (public.current_user_has_permission('employees.update'));
create policy "permission scoped employee delete" on public.employees for delete to authenticated using (public.current_user_has_permission('employees.delete') and public.current_user_can_access_employee(id));
create policy "permission scoped member read" on public.members for select to authenticated using (public.current_user_has_permission('members.view') and public.current_user_can_access_member(id));
create policy "permission scoped member create" on public.members for insert to authenticated with check (public.current_user_has_permission('members.create'));
create policy "permission scoped member update" on public.members for update to authenticated using (public.current_user_has_permission('members.update') and public.current_user_can_access_member(id)) with check (public.current_user_has_permission('members.update'));
create policy "permission scoped member delete" on public.members for delete to authenticated using (public.current_user_has_permission('members.delete') and public.current_user_can_access_member(id));

drop policy if exists "organization managers maintain branches" on public.branches;
drop policy if exists "organization managers maintain clients" on public.clients;
drop policy if exists "organization managers maintain departments" on public.departments;
drop policy if exists "organization managers maintain positions" on public.positions;
create policy "permission managers maintain branches" on public.branches for all to authenticated using (public.current_user_has_permission('organization.update')) with check (public.current_user_has_permission('organization.create') or public.current_user_has_permission('organization.update'));
create policy "permission managers maintain clients" on public.clients for all to authenticated using (public.current_user_has_permission('organization.update')) with check (public.current_user_has_permission('organization.create') or public.current_user_has_permission('organization.update'));
create policy "permission managers maintain departments" on public.departments for all to authenticated using (public.current_user_has_permission('organization.update')) with check (public.current_user_has_permission('organization.create') or public.current_user_has_permission('organization.update'));
create policy "permission managers maintain positions" on public.positions for all to authenticated using (public.current_user_has_permission('organization.update')) with check (public.current_user_has_permission('organization.create') or public.current_user_has_permission('organization.update'));

drop policy if exists "payment managers create aliases" on public.member_aliases;
drop policy if exists "authorized managers create aliases" on public.member_aliases;
drop policy if exists "payment managers update aliases" on public.member_aliases;
drop policy if exists "payment managers create batches" on public.payment_batches;
drop policy if exists "payment managers create payments" on public.member_payments;
drop policy if exists "payment managers update payments" on public.member_payments;
drop policy if exists "payment managers create settlements" on public.final_pay_settlements;
drop policy if exists "payment managers create corrections" on public.payment_corrections;
drop policy if exists "payment managers create refunds" on public.over_deduction_refunds;
drop policy if exists "payment managers update refunds" on public.over_deduction_refunds;
create policy "permission managers create aliases" on public.member_aliases for insert to authenticated with check (public.current_user_has_permission('payments.create') and public.current_user_can_access_employee(employee_id));
create policy "permission managers update aliases" on public.member_aliases for update to authenticated using (public.current_user_has_permission('payments.update') and public.current_user_can_access_employee(employee_id)) with check (public.current_user_has_permission('payments.update'));
create policy "permission managers create batches" on public.payment_batches for insert to authenticated with check (public.current_user_has_permission('payments.import') and public.current_user_can_access_branch(branch_id));
create policy "permission managers create payments" on public.member_payments for insert to authenticated with check (public.current_user_has_permission('payments.create') and public.current_user_can_access_employee(employee_id));
create policy "permission managers update payments" on public.member_payments for update to authenticated using (public.current_user_has_permission('payments.update') and public.current_user_can_access_employee(employee_id)) with check (public.current_user_has_permission('payments.update'));
create policy "permission managers create settlements" on public.final_pay_settlements for insert to authenticated with check (public.current_user_has_permission('payments.create') and public.current_user_can_access_employee(employee_id));
create policy "permission managers create corrections" on public.payment_corrections for insert to authenticated with check (public.current_user_has_permission('payments.update') and exists (select 1 from public.member_payments p where p.id = payment_id and public.current_user_can_access_employee(p.employee_id)));
create policy "permission managers create refunds" on public.over_deduction_refunds for insert to authenticated with check (public.current_user_has_permission('payments.create') and public.current_user_can_access_branch(branch_id) and public.current_user_can_access_employee(employee_id));
create policy "permission managers update refunds" on public.over_deduction_refunds for update to authenticated using (public.current_user_has_permission('payments.update') and public.current_user_can_access_employee(employee_id)) with check (public.current_user_has_permission('payments.update'));

-- Payment settings deliberately remain Super Admin only.
update public.roles set updated_at = now() where code = 'super_admin';
