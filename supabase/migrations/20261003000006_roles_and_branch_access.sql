alter table public.users
  add column employee_id uuid references public.employees(id) on delete set null;

create table public.user_branch_access (
  user_id uuid not null references public.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

insert into public.roles (id, code, name, description) values
  ('70000000-0000-4000-8000-000000000001', 'super_admin', 'Super Admin', 'Manages users and all system functions.'),
  ('70000000-0000-4000-8000-000000000002', 'general_manager', 'General Manager', 'Organization-wide operational access.'),
  ('70000000-0000-4000-8000-000000000003', 'hr_manager', 'HR Manager', 'Organization-wide member and employee management.'),
  ('70000000-0000-4000-8000-000000000004', 'accounting_manager', 'Accounting Manager', 'Organization-wide read and reporting access.'),
  ('70000000-0000-4000-8000-000000000005', 'head_office_staff', 'Head Office Staff', 'Head Office operational access.'),
  ('70000000-0000-4000-8000-000000000006', 'branch_admin', 'Branch Admin', 'Management access within assigned branches.'),
  ('70000000-0000-4000-8000-000000000007', 'branch_user', 'Branch User', 'Read access within assigned branches.')
on conflict (id) do update set name = excluded.name, description = excluded.description;

create index user_branch_access_branch_idx on public.user_branch_access (branch_id, user_id);
alter table public.user_branch_access enable row level security;

create or replace function public.current_user_has_role(role_codes text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = any(role_codes)
  );
$$;

create or replace function public.current_user_can_access_branch(target_branch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_has_role(array['super_admin','general_manager','hr_manager','accounting_manager','head_office_staff'])
    or exists (
      select 1 from public.user_branch_access uba
      where uba.user_id = auth.uid() and uba.branch_id = target_branch_id
    );
$$;

create or replace function public.current_user_can_access_employee(target_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_has_role(array['super_admin','general_manager','hr_manager','accounting_manager','head_office_staff'])
    or exists (
      select 1
      from public.employment_assignments ea
      join public.user_branch_access uba on uba.branch_id = ea.branch_id
      where ea.employee_id = target_employee_id
        and ea.end_date is null
        and ea.deleted_at is null
        and uba.user_id = auth.uid()
    );
$$;

create or replace function public.current_user_can_access_member(target_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_has_role(array['super_admin','general_manager','hr_manager','accounting_manager','head_office_staff'])
    or exists (
      select 1
      from public.employees e
      join public.employment_assignments ea on ea.employee_id = e.id
      join public.user_branch_access uba on uba.branch_id = ea.branch_id
      where e.member_id = target_member_id
        and e.deleted_at is null
        and ea.end_date is null
        and ea.deleted_at is null
        and uba.user_id = auth.uid()
    );
$$;

create policy "users can read own branch access"
  on public.user_branch_access for select to authenticated
  using (user_id = auth.uid() or public.current_user_has_role(array['super_admin']));
create policy "super admins manage branch access"
  on public.user_branch_access for all to authenticated
  using (public.current_user_has_role(array['super_admin']))
  with check (public.current_user_has_role(array['super_admin']));

drop policy if exists "authenticated users can read profiles" on public.users;
create policy "users read own profile and super admins read all"
  on public.users for select to authenticated
  using (id = auth.uid() or public.current_user_has_role(array['super_admin']));
create policy "super admins manage profiles"
  on public.users for all to authenticated
  using (public.current_user_has_role(array['super_admin']))
  with check (public.current_user_has_role(array['super_admin']));

create policy "users read own roles and super admins read all"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.current_user_has_role(array['super_admin']));
create policy "super admins manage roles"
  on public.user_roles for all to authenticated
  using (public.current_user_has_role(array['super_admin']))
  with check (public.current_user_has_role(array['super_admin']));

drop policy if exists "authenticated users can read employees" on public.employees;
create policy "role scoped employee access"
  on public.employees for select to authenticated
  using (public.current_user_can_access_employee(id));

drop policy if exists "authenticated users can read members" on public.members;
create policy "role scoped member access"
  on public.members for select to authenticated
  using (public.current_user_can_access_member(id));

drop policy if exists "authenticated users can read employment assignments" on public.employment_assignments;
create policy "role scoped assignment access"
  on public.employment_assignments for select to authenticated
  using (public.current_user_can_access_branch(branch_id));

drop policy if exists "authenticated users can read clients" on public.clients;
create policy "role scoped client access"
  on public.clients for select to authenticated
  using (public.current_user_can_access_branch(branch_id));

