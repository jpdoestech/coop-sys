create index payroll_team_employee_date_idx on public.payroll_setup_records(employee_id, effective_from desc)
  where deleted_at is null and kind in ('employee_terms','override');

create or replace function public.attendance_team_page(p_date date, p_worksite_id uuid, p_department_id uuid default null,
  p_search text default null, p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.current_user_can_read_payroll_setup() then raise exception 'Organization-wide payroll access is required.'; end if;
  if p_date is null or p_worksite_id is null or p_limit not between 1 and 100 or p_offset<0 then raise exception 'Invalid worksheet filters.'; end if;
  with bases as (
    select distinct on (employee_id) * from public.payroll_setup_records
    where deleted_at is null and kind='employee_terms' and effective_from<=p_date
    order by employee_id,effective_from desc,id
  ), overrides as (
    select * from public.payroll_setup_records where deleted_at is null and kind='override' and effective_from=p_date
  ), candidates as (
    select coalesce(o.employee_id,b.employee_id) employee_id, coalesce(to_jsonb(o),to_jsonb(b)) candidate, to_jsonb(b) base
    from bases b full join overrides o on o.employee_id=b.employee_id
  ), filtered as (
    select c.*,concat(e.employee_number,' - ',e.last_name,', ',e.first_name,
      case when coalesce(e.middle_name,'')<>'' then ' '||e.middle_name else '' end) label
    from candidates c join public.employees e on e.id=c.employee_id
    where e.deleted_at is null and (e.date_hired is null or e.date_hired<=p_date) and (e.date_separated is null or e.date_separated>=p_date)
      and c.candidate->'data'->>'worksite_id'=p_worksite_id::text
      and (p_department_id is null or c.candidate->'data'->>'department_id'=p_department_id::text)
      and public.person_search_matches(concat_ws(' ',e.employee_number,e.last_name,e.first_name,e.middle_name),p_search)
  ), page as (
    select * from filtered order by label,employee_id limit p_limit offset p_offset
  ), rows as (
    select p.label,p.employee_id,jsonb_build_object('employeeId',p.employee_id,'employeeLabel',p.label,'date',p_date,
      'baseTerms',p.base,'terms',case when exists(select 1 from public.payroll_setup_records where id=p_worksite_id and kind='worksite' and deleted_at is null)
        and (nullif(p.candidate->'data'->>'effective_to','') is null or (p.candidate->'data'->>'effective_to')::date>=p_date) then p.candidate else null end,
      'attendance',(select to_jsonb(a) from public.attendance_records a where a.employee_id=p.employee_id and a.work_date=p_date and a.deleted_at is null),
      'neighbors',coalesce((select jsonb_agg(to_jsonb(a) order by a.work_date) from public.attendance_records a
        where a.employee_id=p.employee_id and a.work_date in (p_date-1,p_date+1) and a.deleted_at is null),'[]'::jsonb),
      'restDay',coalesce(p.candidate->'data'->'rest_days' @> jsonb_build_array(extract(dow from p_date)::integer),false)) item
    from page p
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(item order by label,employee_id) from rows),'[]'::jsonb),
    'total',(select count(*) from filtered)) into result;
  return result;
end;
$$;
revoke all on function public.attendance_team_page(date,uuid,uuid,text,integer,integer) from public;
grant execute on function public.attendance_team_page(date,uuid,uuid,text,integer,integer) to authenticated;
