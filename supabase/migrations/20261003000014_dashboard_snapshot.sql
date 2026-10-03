create or replace function public.dashboard_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with scoped_members as (
    select m.id, m.membership_status_id, m.bod_approval_status
    from public.members m
    where m.deleted_at is null
      and public.current_user_can_access_member(m.id)
  ),
  scoped_employees as (
    select e.id, e.employment_status_id
    from public.employees e
    where e.deleted_at is null
      and public.current_user_can_access_employee(e.id)
  ),
  current_assignments as (
    select ea.employee_id, ea.branch_id, ea.client_id
    from public.employment_assignments ea
    join scoped_employees se on se.id = ea.employee_id
    where ea.end_date is null
      and ea.deleted_at is null
  ),
  membership_status_counts as (
    select values_table.key,
           values_table.label,
           values_table.sort_order,
           count(sm.id)::integer as count
    from (values
      ('active', 'Active', 1, '31000000-0000-4000-8000-000000000001'::uuid),
      ('inactive', 'Inactive', 2, '31000000-0000-4000-8000-000000000002'::uuid),
      ('resigned', 'Resigned', 3, '31000000-0000-4000-8000-000000000004'::uuid),
      ('terminated', 'Terminated', 4, '31000000-0000-4000-8000-000000000003'::uuid)
    ) as values_table(key, label, sort_order, status_id)
    left join scoped_members sm on sm.membership_status_id = values_table.status_id
    group by values_table.key, values_table.label, values_table.sort_order
  ),
  branch_workforce as (
    select b.id as branch_id,
           b.name as branch_label,
           count(ca.employee_id)::integer as total,
           count(ca.employee_id) filter (
             where se.employment_status_id = '33000000-0000-4000-8000-000000000001'::uuid
           )::integer as active,
           count(ca.employee_id) filter (
             where se.employment_status_id = '33000000-0000-4000-8000-000000000001'::uuid
               and ca.client_id is not null
           )::integer as client_deployed,
           count(ca.employee_id) filter (
             where se.employment_status_id = '33000000-0000-4000-8000-000000000001'::uuid
               and ca.client_id is null
           )::integer as direct
    from public.branches b
    join current_assignments ca on ca.branch_id = b.id
    join scoped_employees se on se.id = ca.employee_id
    where b.deleted_at is null
      and b.is_active
      and public.current_user_can_access_branch(b.id)
    group by b.id, b.name
  )
  select jsonb_build_object(
    'total_members', (select count(*) from scoped_members),
    'active_members', (select count(*) from scoped_members where membership_status_id = '31000000-0000-4000-8000-000000000001'::uuid),
    'pending_approvals', (select count(*) from scoped_members where bod_approval_status = 'pending'),
    'total_employees', (select count(*) from scoped_employees),
    'active_employees', (select count(*) from scoped_employees where employment_status_id = '33000000-0000-4000-8000-000000000001'::uuid),
    'client_deployed', (
      select count(*) from current_assignments ca
      join scoped_employees se on se.id = ca.employee_id
      where se.employment_status_id = '33000000-0000-4000-8000-000000000001'::uuid
        and ca.client_id is not null
    ),
    'direct_employees', (
      select count(*) from scoped_employees se
      left join current_assignments ca on ca.employee_id = se.id
      where se.employment_status_id = '33000000-0000-4000-8000-000000000001'::uuid
        and ca.client_id is null
    ),
    'membership_statuses', coalesce((
      select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'count', count) order by sort_order)
      from membership_status_counts
    ), '[]'::jsonb),
    'workforce_by_branch', coalesce((
      select jsonb_agg(jsonb_build_object(
        'branch_id', branch_id,
        'branch_label', branch_label,
        'total', total,
        'active', active,
        'client_deployed', client_deployed,
        'direct', direct
      ) order by active desc, branch_label)
      from branch_workforce
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.dashboard_snapshot() to authenticated;

comment on function public.dashboard_snapshot() is
  'Returns access-scoped dashboard aggregates without loading full member or employee datasets in the browser.';
