-- Employment records are only useful to scoped users once their placement is
-- saved. The original schema provided assignment reads but omitted writes.

create or replace function public.current_user_can_access_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case coalesce((select scope_type from public.users where id = auth.uid()), 'self')
    when 'organization' then true
    when 'assigned_branches' then exists (
      select 1
      from public.clients c
      join public.user_branch_access uba on uba.branch_id = c.branch_id
      where c.id = target_client_id
        and uba.user_id = auth.uid()
    )
    when 'assigned_clients' then exists (
      select 1 from public.user_client_access
      where user_id = auth.uid() and client_id = target_client_id
    )
    else exists (
      select 1
      from public.users u
      join public.employment_assignments ea on ea.employee_id = u.employee_id
      where u.id = auth.uid()
        and ea.client_id = target_client_id
        and ea.end_date is null
        and ea.deleted_at is null
    )
  end;
$$;

drop policy if exists "role scoped assignment access" on public.employment_assignments;
drop policy if exists "permission scoped assignment read" on public.employment_assignments;
drop policy if exists "permission scoped assignment create" on public.employment_assignments;
drop policy if exists "permission scoped assignment update" on public.employment_assignments;
drop policy if exists "permission scoped assignment delete" on public.employment_assignments;

create policy "permission scoped assignment read"
  on public.employment_assignments for select to authenticated
  using (
    public.current_user_has_permission('employees.view')
    and public.current_user_can_access_employee(employee_id)
  );

create policy "permission scoped assignment create"
  on public.employment_assignments for insert to authenticated
  with check (
    public.current_user_has_permission('employees.create')
    and public.current_user_can_access_branch(branch_id)
    and (client_id is null or public.current_user_can_access_client(client_id))
  );

create policy "permission scoped assignment update"
  on public.employment_assignments for update to authenticated
  using (
    public.current_user_has_permission('employees.update')
    and public.current_user_can_access_employee(employee_id)
  )
  with check (
    public.current_user_has_permission('employees.update')
    and public.current_user_can_access_branch(branch_id)
    and (client_id is null or public.current_user_can_access_client(client_id))
  );

create policy "permission scoped assignment delete"
  on public.employment_assignments for delete to authenticated
  using (
    public.current_user_has_permission('employees.delete')
    and public.current_user_can_access_employee(employee_id)
  );
