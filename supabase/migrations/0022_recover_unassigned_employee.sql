-- Recover the narrow partial-write state created before assignment write
-- policies existed. Only the matching active employee with no assignment
-- history can be repaired, and the caller's create permission/scope is checked.

create or replace function public.recover_unassigned_employee(
  p_employee_number text,
  p_member_id uuid,
  p_assignment jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_employee_id uuid;
  target_branch_id uuid;
  target_client_id uuid;
begin
  if not public.current_user_has_permission('employees.create') then
    raise exception 'Employee creation is not permitted.';
  end if;

  target_branch_id := nullif(p_assignment ->> 'branch_id', '')::uuid;
  target_client_id := nullif(p_assignment ->> 'client_id', '')::uuid;

  if target_branch_id is null or not public.current_user_can_access_branch(target_branch_id) then
    raise exception 'The selected branch is outside your assigned scope.';
  end if;
  if target_client_id is not null and (
    not public.current_user_can_access_client(target_client_id)
    or not exists (
      select 1 from public.clients
      where id = target_client_id and branch_id = target_branch_id and deleted_at is null
    )
  ) then
    raise exception 'The selected client is outside your assigned scope or branch.';
  end if;

  select e.id into recovered_employee_id
  from public.employees e
  where e.employee_number = p_employee_number
    and e.member_id is not distinct from p_member_id
    and e.deleted_at is null
    and not exists (
      select 1 from public.employment_assignments ea
      where ea.employee_id = e.id and ea.deleted_at is null
    )
  for update;

  if recovered_employee_id is null then
    raise exception 'The employee number already belongs to another or already assigned record.';
  end if;

  insert into public.employment_assignments (
    id, employee_id, branch_id, client_id, assignment_code, start_date,
    end_date, work_location, transfer_reason, notes, sync_status
  ) values (
    coalesce(nullif(p_assignment ->> 'id', '')::uuid, gen_random_uuid()),
    recovered_employee_id,
    target_branch_id,
    target_client_id,
    nullif(p_assignment ->> 'assignment_code', ''),
    (p_assignment ->> 'start_date')::date,
    nullif(p_assignment ->> 'end_date', '')::date,
    nullif(p_assignment ->> 'work_location', ''),
    nullif(p_assignment ->> 'transfer_reason', ''),
    nullif(p_assignment ->> 'notes', ''),
    'synced'
  );

  return recovered_employee_id;
end;
$$;

revoke all on function public.recover_unassigned_employee(text, uuid, jsonb) from public;
grant execute on function public.recover_unassigned_employee(text, uuid, jsonb) to authenticated;
