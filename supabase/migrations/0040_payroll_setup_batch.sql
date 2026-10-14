-- Atomic salary setup imports and bulk employee changes. Existing salary RBAC remains enforced.
create or replace function public.lock_employee_payroll_setup()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.kind='employee_terms' and nullif(new.data->>'employee_id','') is not null then
    perform pg_advisory_xact_lock(hashtextextended('employee-payroll:'||(new.data->>'employee_id')::uuid::text,0));
  end if;
  return new;
end;
$$;
create trigger payroll_setup_batch_lock before insert or update on public.payroll_setup_records
  for each row execute function public.lock_employee_payroll_setup();

create or replace function public.save_payroll_setup_batch(p_inputs jsonb)
returns setof public.payroll_setup_records
language plpgsql security invoker set search_path=public as $$
declare item jsonb; saved public.payroll_setup_records; source_id uuid; employee_key text;
begin
  if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.manage') then
    raise exception 'Payroll management permission is required.';
  end if;
  if jsonb_typeof(p_inputs) is distinct from 'array' or jsonb_array_length(p_inputs) not between 1 and 500 then
    raise exception 'Select between 1 and 500 payroll records.';
  end if;
  -- Stable lock order serializes competing imports for the same employees.
  for employee_key in select distinct (value->'data'->>'employee_id')::uuid::text
    from jsonb_array_elements(p_inputs) where value->>'kind'='employee_terms' and nullif(value->'data'->>'employee_id','') is not null
    order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('employee-payroll:'||employee_key,0));
  end loop;
  -- Salary validation, references, immutable versions, and RLS also run on every insert.
  for item in select value from jsonb_array_elements(p_inputs) loop
    if item ? 'expected_source_id' then
      if item->>'kind'<>'employee_terms' then raise exception 'Source checks require employee terms.'; end if;
      select case when nullif(data->>'effective_to','') is null or (data->>'effective_to')::date>=(item->'data'->>'effective_from')::date then id else null end into source_id
        from public.payroll_setup_records where kind='employee_terms' and deleted_at is null
          and employee_id=(item->'data'->>'employee_id')::uuid and effective_from<=(item->'data'->>'effective_from')::date
        order by effective_from desc limit 1;
      if source_id is distinct from nullif(item->>'expected_source_id','')::uuid then
        raise exception 'Employee terms changed. Reload the preview before saving.';
      end if;
    end if;
    insert into public.payroll_setup_records(kind,data,created_by)
      values(item->>'kind',item->'data',auth.uid()) returning * into saved;
    return next saved;
  end loop;
end;
$$;
revoke all on function public.save_payroll_setup_batch(jsonb) from public;
grant execute on function public.save_payroll_setup_batch(jsonb) to authenticated;
