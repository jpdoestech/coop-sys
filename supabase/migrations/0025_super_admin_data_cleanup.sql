-- Cleanup is a single server-side transaction; no service key is exposed to clients.
create function public.maintenance_require_super_admin()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid() and u.is_active and u.deleted_at is null
      and r.code = 'super_admin' and r.is_active
  ) then
    raise exception 'Only Super Admin can manage data cleanup.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.maintenance_require_super_admin() from public;

create function public.maintenance_people_page(
  p_kind text, p_search text default '', p_state text default 'active',
  p_unassigned boolean default false, p_offset integer default 0, p_limit integer default 25
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  perform public.maintenance_require_super_admin();
  if p_kind is null or p_kind not in ('employee', 'member') or p_state is null or p_state not in ('active', 'archived', 'all') then
    raise exception 'Invalid record filter.';
  end if;
  with people as (
    select e.id, e.employee_number as number, concat(e.last_name, ', ', e.first_name) as name,
      e.deleted_at is not null as archived,
      not exists (select 1 from public.employment_assignments a where a.employee_id = e.id and a.deleted_at is null and a.end_date is null and a.branch_id is not null) as unassigned
    from public.employees e where p_kind = 'employee'
    union all
    select m.id, m.membership_number, concat(m.last_name, ', ', m.first_name),
      m.deleted_at is not null, case when exists (select 1 from public.employees e where e.member_id = m.id and e.deleted_at is null)
        then not exists (select 1 from public.employees e join public.employment_assignments a on a.employee_id = e.id where e.member_id = m.id and e.deleted_at is null and a.deleted_at is null and a.end_date is null and a.branch_id is not null)
        else m.proposed_branch_id is null end
    from public.members m where p_kind = 'member'
  ), filtered as (
    select * from people where (p_state = 'all' or archived = (p_state = 'archived'))
      and (not p_unassigned or unassigned)
      and (trim(p_search) = '' or position(lower(trim(p_search)) in lower(number || ' ' || name)) > 0)
  ), page as (
    select * from filtered order by number, id limit least(100, greatest(1, p_limit)) offset greatest(0, p_offset)
  ) select jsonb_build_object('total', (select count(*) from filtered), 'items', coalesce((select jsonb_agg(to_jsonb(page) order by number, id) from page), '[]'::jsonb)) into result;
  return result;
end;
$$;

create function public.maintenance_cleanup_people(
  p_kind text, p_action text, p_target text, p_ids uuid[] default '{}', p_confirmation text default ''
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  employee_ids uuid[] := '{}'; member_ids uuid[] := '{}'; payment_ids uuid[] := '{}'; batch_ids uuid[] := '{}';
  result jsonb; stamp timestamptz := now();
begin
  perform public.maintenance_require_super_admin();
  if p_kind is null or p_kind not in ('employee', 'member') or p_action is null or p_action not in ('soft', 'hard', 'reset') or p_target is null or p_target not in ('selected', 'unassigned', 'all') then
    raise exception 'Invalid cleanup operation.';
  end if;
  if p_confirmation is distinct from (case p_action when 'soft' then 'ARCHIVE' when 'hard' then 'DELETE' else 'RESET' end) then
    raise exception 'The typed confirmation does not match this operation.';
  end if;
  if p_action <> 'reset' and p_target = 'selected' and coalesce(cardinality(p_ids), 0) not between 1 and 500 then
    raise exception 'Select between 1 and 500 records.';
  end if;
  -- Serialize maintenance with other maintenance operations and block concurrent writes.
  perform pg_advisory_xact_lock(hashtext('coop_people_cleanup'));
  lock table public.employees, public.members, public.employment_assignments,
    public.member_payments, public.payment_batches, public.over_deduction_refunds,
    public.final_pay_settlements, public.payment_corrections, public.member_aliases,
    public.beneficiaries, public.employee_documents in share row exclusive mode;
  if p_kind = 'employee' or p_action = 'reset' then
    select coalesce(array_agg(e.id), '{}') into employee_ids from public.employees e
    where p_action = 'reset' or p_target = 'all' or (p_target = 'selected' and e.id = any(p_ids))
      or (p_target = 'unassigned' and e.deleted_at is null and not exists (
        select 1 from public.employment_assignments a where a.employee_id = e.id and a.end_date is null and a.deleted_at is null and a.branch_id is not null
      ));
  end if;
  select coalesce(array_agg(m.id), '{}') into member_ids from public.members m
  where p_action = 'reset' or m.id in (select member_id from public.employees where id = any(employee_ids))
    or (p_kind = 'member' and (p_target = 'all' or (p_target = 'selected' and m.id = any(p_ids)) or (p_target = 'unassigned' and m.deleted_at is null and case
      when exists (select 1 from public.employees e where e.member_id = m.id and e.deleted_at is null)
        then not exists (select 1 from public.employees e join public.employment_assignments a on a.employee_id = e.id where e.member_id = m.id and e.deleted_at is null and a.deleted_at is null and a.end_date is null and a.branch_id is not null)
      else m.proposed_branch_id is null end)));
  select coalesce(array_agg(e.id), '{}') into employee_ids from public.employees e
  where e.id = any(employee_ids) or e.member_id = any(member_ids);
  select coalesce(array_agg(id), '{}') into payment_ids from public.member_payments
    where employee_id = any(employee_ids) or member_id = any(member_ids);
  select coalesce(array_agg(distinct batch_id), '{}') into batch_ids from public.member_payments where id = any(payment_ids);
  result := jsonb_build_object('employees', cardinality(employee_ids), 'members', cardinality(member_ids), 'payments', case when p_action = 'soft' then 0 else cardinality(payment_ids) end);
  if p_action = 'soft' then
    update public.employees set deleted_at = stamp, updated_at = stamp, sync_status = 'synced' where id = any(employee_ids) and deleted_at is null;
    update public.members set deleted_at = stamp, updated_at = stamp, sync_status = 'synced' where id = any(member_ids) and deleted_at is null;
  else
    delete from public.payment_corrections where payment_id = any(payment_ids);
    delete from public.over_deduction_refunds where employee_id = any(employee_ids) or member_id = any(member_ids);
    delete from public.final_pay_settlements where employee_id = any(employee_ids) or member_id = any(member_ids);
    delete from public.member_payments where id = any(payment_ids);
    delete from public.payment_batches b where (p_action = 'reset' or b.id = any(batch_ids)) and not exists (select 1 from public.member_payments p where p.batch_id = b.id);
    delete from public.sync_conflicts where p_action = 'reset' or entity_id = any(employee_ids || member_ids || payment_ids);
    delete from public.sync_queue where p_action = 'reset' or entity_id = any(employee_ids || member_ids || payment_ids);
    -- Dependent beneficiaries, assignments, aliases and document metadata cascade.
    -- Users remain intact; their employee foreign key becomes NULL.
    delete from public.employees where id = any(employee_ids);
    delete from public.members where id = any(member_ids);
  end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, after_data)
    values (auth.uid(), 'maintenance_' || p_action, 'people', result || jsonb_build_object('kind', p_kind, 'target', p_target));
  return result;
end;
$$;

revoke all on function public.maintenance_people_page(text, text, text, boolean, integer, integer) from public;
revoke all on function public.maintenance_cleanup_people(text, text, text, uuid[], text) from public;
grant execute on function public.maintenance_people_page(text, text, text, boolean, integer, integer) to authenticated;
grant execute on function public.maintenance_cleanup_people(text, text, text, uuid[], text) to authenticated;
