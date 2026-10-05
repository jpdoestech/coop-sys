alter table public.employment_assignments
  add column transfer_source text
    check (transfer_source is null or transfer_source in ('employee', 'member', 'system')),
  add column transferred_by uuid references auth.users(id) on delete set null;

comment on column public.employment_assignments.transfer_source is
  'Workflow that initiated this historical placement: employee, member, or system.';
comment on column public.employment_assignments.transferred_by is
  'Authenticated user who completed the transfer.';

create or replace function public.transfer_employee(
  p_employee_id uuid,
  p_assignment jsonb,
  p_source text default 'employee'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_assignment public.employment_assignments%rowtype;
  target_assignment_id uuid := coalesce(nullif(p_assignment ->> 'id', '')::uuid, gen_random_uuid());
  target_branch_id uuid := nullif(p_assignment ->> 'branch_id', '')::uuid;
  target_client_id uuid := nullif(p_assignment ->> 'client_id', '')::uuid;
  target_start_date date := nullif(p_assignment ->> 'start_date', '')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if not public.current_user_has_permission('employees.update') then
    raise exception 'Your effective access does not permit employee transfers.';
  end if;
  if not public.current_user_can_access_employee(p_employee_id) then
    raise exception 'This employee is outside your assigned scope.';
  end if;
  if p_source not in ('employee', 'member', 'system') then
    raise exception 'Invalid transfer source.';
  end if;
  if target_branch_id is null or target_start_date is null then
    raise exception 'A destination branch and effective date are required.';
  end if;
  if target_start_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'Future transfers are not supported. Select today or a past effective date.';
  end if;
  if not exists (select 1 from public.branches where id = target_branch_id and deleted_at is null) then
    raise exception 'The destination branch was not found.';
  end if;
  if not public.current_user_can_access_branch(target_branch_id) then
    raise exception 'The destination branch is outside your assigned scope.';
  end if;
  if target_client_id is not null then
    if not public.current_user_can_access_client(target_client_id) then
      raise exception 'The destination client is outside your assigned scope.';
    end if;
    if not exists (
      select 1 from public.clients
      where id = target_client_id
        and branch_id = target_branch_id
        and deleted_at is null
    ) then
      raise exception 'The selected client does not belong to the destination branch.';
    end if;
  end if;

  perform 1 from public.employees where id = p_employee_id and deleted_at is null for update;
  if not found then
    raise exception 'The employee was not found.';
  end if;
  select * into current_assignment
  from public.employment_assignments
  where employee_id = p_employee_id
    and end_date is null
    and deleted_at is null
  for update;

  if current_assignment.id is null then
    raise exception 'The employee does not have an active assignment to transfer.';
  end if;
  if target_start_date < current_assignment.start_date then
    raise exception 'The transfer date cannot be earlier than the current assignment start date.';
  end if;
  if current_assignment.branch_id is not distinct from target_branch_id
    and current_assignment.client_id is not distinct from target_client_id then
    raise exception 'The destination must differ from the current placement.';
  end if;
  if nullif(trim(p_assignment ->> 'transfer_reason'), '') is null then
    raise exception 'A transfer reason is required.';
  end if;

  update public.employment_assignments
  set end_date = target_start_date,
      updated_at = now(),
      sync_status = 'synced'
  where id = current_assignment.id;

  insert into public.employment_assignments (
    id, employee_id, branch_id, client_id, assignment_code, start_date,
    end_date, work_location, transfer_reason, transfer_source, transferred_by,
    notes, sync_status
  ) values (
    target_assignment_id,
    p_employee_id,
    target_branch_id,
    target_client_id,
    nullif(p_assignment ->> 'assignment_code', ''),
    target_start_date,
    null,
    nullif(p_assignment ->> 'work_location', ''),
    nullif(trim(p_assignment ->> 'transfer_reason'), ''),
    p_source,
    auth.uid(),
    nullif(p_assignment ->> 'notes', ''),
    'synced'
  );

  update public.employees
  set work_location = nullif(p_assignment ->> 'work_location', ''),
      updated_at = now(),
      sync_status = 'synced'
  where id = p_employee_id;

  return target_assignment_id;
end;
$$;

revoke all on function public.transfer_employee(uuid, jsonb, text) from public;
grant execute on function public.transfer_employee(uuid, jsonb, text) to authenticated;

-- Repair linked records whose member placement was changed before transfers
-- became transactional. Each repair remains visible in assignment history.
do $$
declare
  record_to_repair record;
  effective_date date;
begin
  for record_to_repair in
    select
      e.id as employee_id,
      ea.id as assignment_id,
      ea.start_date,
      m.proposed_branch_id,
      m.proposed_client_id,
      b.name as branch_name
    from public.employees e
    join public.members m on m.id = e.member_id
    join public.employment_assignments ea
      on ea.employee_id = e.id
      and ea.end_date is null
      and ea.deleted_at is null
    left join public.branches b on b.id = m.proposed_branch_id
    where e.deleted_at is null
      and m.deleted_at is null
      and m.proposed_branch_id is not null
      and (
        ea.branch_id is distinct from m.proposed_branch_id
        or ea.client_id is distinct from m.proposed_client_id
      )
  loop
    effective_date := greatest((now() at time zone 'Asia/Manila')::date, record_to_repair.start_date);

    update public.employment_assignments
    set end_date = effective_date,
        updated_at = now(),
        sync_status = 'synced'
    where id = record_to_repair.assignment_id;

    insert into public.employment_assignments (
      employee_id, branch_id, client_id, start_date, work_location,
      transfer_reason, transfer_source, notes, sync_status
    ) values (
      record_to_repair.employee_id,
      record_to_repair.proposed_branch_id,
      record_to_repair.proposed_client_id,
      effective_date,
      record_to_repair.branch_name,
      'Placement synchronized from the linked member record',
      'system',
      'Automatic repair performed by migration 0024',
      'synced'
    );

    update public.employees
    set work_location = record_to_repair.branch_name,
        updated_at = now(),
        sync_status = 'synced'
    where id = record_to_repair.employee_id;
  end loop;
end;
$$;

-- Once employment exists, access follows its current assignment. Proposed
-- placement is used only for membership applications without employment.
create or replace function public.current_user_can_access_member(target_member_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce((select scope_type from public.users where id = auth.uid()), 'self') = 'organization' then true
    when exists (select 1 from public.employees where member_id = target_member_id and deleted_at is null) then
      exists (select 1 from public.employees e where e.member_id = target_member_id and e.deleted_at is null and public.current_user_can_access_employee(e.id))
    else exists (
      select 1 from public.members m where m.id = target_member_id
        and case coalesce((select scope_type from public.users where id = auth.uid()), 'self')
          when 'assigned_branches' then exists (select 1 from public.user_branch_access where user_id = auth.uid() and branch_id = m.proposed_branch_id)
          when 'assigned_clients' then exists (select 1 from public.user_client_access where user_id = auth.uid() and client_id = m.proposed_client_id)
          else false
        end
    )
  end;
$$;

create or replace function public.guard_linked_member_placement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.employees e
    join public.employment_assignments ea on ea.employee_id = e.id
    where e.member_id = new.id and e.deleted_at is null
      and ea.end_date is null and ea.deleted_at is null
      and (ea.branch_id is distinct from new.proposed_branch_id or ea.client_id is distinct from new.proposed_client_id)
  ) then
    raise exception 'Use the recorded employee transfer workflow to change linked placement.';
  end if;
  return new;
end;
$$;

create trigger members_guard_linked_placement
before update of proposed_branch_id, proposed_client_id on public.members
for each row execute function public.guard_linked_member_placement();

create or replace function public.guard_assignment_placement_history()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.branch_id is distinct from new.branch_id or old.client_id is distinct from new.client_id then
    raise exception 'Existing placements cannot be overwritten. Record an employee transfer.';
  end if;
  return new;
end;
$$;

create trigger employment_assignments_guard_placement_history
before update of branch_id, client_id on public.employment_assignments
for each row execute function public.guard_assignment_placement_history();
