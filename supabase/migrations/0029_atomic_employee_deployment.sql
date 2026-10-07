-- Save placement before returning a scoped employee, avoiding an invisible
-- employee between the insert and the assignment request.
create or replace function public.create_employee_with_assignment(p_employee jsonb, p_assignment jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  employee_record public.employees%rowtype;
  assignment_record public.employment_assignments%rowtype;
  target_id uuid;
begin
  if auth.uid() is null or not public.current_user_has_permission('employees.create') then
    raise exception 'Employee creation is not permitted.';
  end if;
  employee_record := jsonb_populate_record(null::public.employees, p_employee || jsonb_build_object(
    'id',gen_random_uuid(),'created_at',now(),'updated_at',now(),'deleted_at',null,'sync_status','synced'));
  assignment_record := jsonb_populate_record(null::public.employment_assignments, p_assignment || jsonb_build_object(
    'id',coalesce(nullif(p_assignment->>'id','')::uuid,gen_random_uuid()),'employee_id',employee_record.id,
    'created_at',now(),'updated_at',now(),'deleted_at',null,'sync_status','synced',
    'transfer_source','system','transferred_by',auth.uid()));
  if employee_record.employee_number is null or employee_record.employee_number !~ '^[0-9]{6}$' or nullif(trim(employee_record.first_name),'') is null
    or nullif(trim(employee_record.last_name),'') is null then raise exception 'A six-digit ID and complete name are required.'; end if;
  if assignment_record.branch_id is null or assignment_record.start_date is null
    or not public.current_user_can_access_branch(assignment_record.branch_id)
    or not exists(select 1 from public.branches where id=assignment_record.branch_id and deleted_at is null and is_active) then
    raise exception 'Select an active branch within your assigned scope.';
  end if;
  if assignment_record.client_id is not null and (not public.current_user_can_access_client(assignment_record.client_id)
    or not exists(select 1 from public.clients where id=assignment_record.client_id and branch_id=assignment_record.branch_id and deleted_at is null and is_active)) then
    raise exception 'Select an active client within the selected branch and scope.';
  end if;
  if (select scope_type from public.users where id=auth.uid())='assigned_clients' and assignment_record.client_id is null then
    raise exception 'Select one of your assigned clients.';
  end if;
  if assignment_record.client_id is not null and exists(select 1 from public.branches where id=assignment_record.branch_id and unit_type='head_office') then
    raise exception 'Head Office cannot have a client.';
  end if;
  if employee_record.member_id is not null and not exists(select 1 from public.members
    where id=employee_record.member_id and deleted_at is null and membership_number=employee_record.employee_number
      and public.current_user_can_access_member(id)) then raise exception 'The linked member is outside your scope or has another ID.'; end if;
  if employee_record.supervisor_id is not null and not public.current_user_can_access_employee(employee_record.supervisor_id) then
    raise exception 'The supervisor is outside your scope.';
  end if;
  if coalesce(employee_record.sss_number,employee_record.pagibig_number,employee_record.philhealth_number,employee_record.tax_identification_number) is not null
    and not public.current_user_has_permission('employees.sensitive.update') then raise exception 'Government ID entry is not permitted.'; end if;
  select id into target_id from public.employees where employee_number=employee_record.employee_number for update;
  if target_id is not null then
    if not exists(select 1 from public.employees e where e.id=target_id and e.deleted_at is null
      and e.member_id is not distinct from employee_record.member_id
      and not exists(select 1 from public.employment_assignments where employee_id=e.id and deleted_at is null)) then
      raise exception 'The employee number already belongs to another or already assigned record.';
    end if;
    assignment_record.employee_id := target_id;
  else
    insert into public.employees select employee_record.*;
    target_id := employee_record.id;
  end if;
  insert into public.employment_assignments select assignment_record.*;
  return target_id;
end;
$$;
revoke all on function public.create_employee_with_assignment(jsonb,jsonb) from public;
grant execute on function public.create_employee_with_assignment(jsonb,jsonb) to authenticated;
