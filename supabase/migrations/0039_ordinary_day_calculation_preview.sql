create table public.payroll_calculation_rules (
  id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('policy','calendar')),
  worksite_id uuid not null references public.payroll_setup_records(id),effective_from date not null,payroll_group text not null,
  reviewed boolean not null,reference text not null check(length(trim(reference)) between 1 and 1000),
  regular_minutes integer,short_day text,worked_allowance text,day_type text,
  created_by uuid not null references public.users(id),created_at timestamptz not null default clock_timestamp(),
  check((kind='policy' and length(trim(payroll_group)) between 1 and 200 and regular_minutes is not null and short_day is not null and worked_allowance is not null and regular_minutes between 1 and 1440
    and short_day in ('block','proportional') and worked_allowance in ('full','proportional'))
    or (kind='calendar' and payroll_group='' and day_type is not null and day_type in ('ordinary','regular_holiday','special_non_working','special_working','suspended')))
);
create index payroll_calculation_rule_date_idx on public.payroll_calculation_rules(worksite_id,kind,effective_from desc,created_at desc,id desc);
alter table public.payroll_calculation_rules enable row level security;
create policy "payroll calculation readers" on public.payroll_calculation_rules for select to authenticated using(public.current_user_can_read_payroll_setup());
grant select on public.payroll_calculation_rules to authenticated;

create function public.save_payroll_calculation_rules(p_rules jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
  if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.manage') then raise exception 'Payroll management permission is required.'; end if;
  if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) not between 1 and 31 then raise exception 'Save between 1 and 31 calculation rules.'; end if;
  for r in select value from jsonb_array_elements(p_rules) loop
    if coalesce(r->>'effective_from','') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(r->'reviewed') is distinct from 'boolean' then raise exception 'A valid date and review state are required.'; end if;
    if not exists(select 1 from public.payroll_setup_records where id=(r->>'worksite_id')::uuid and kind='worksite' and deleted_at is null) then raise exception 'Worksite is unavailable.'; end if;
    insert into public.payroll_calculation_rules(kind,worksite_id,effective_from,payroll_group,reviewed,reference,regular_minutes,short_day,worked_allowance,day_type,created_by)
    values(r->>'kind',(r->>'worksite_id')::uuid,(r->>'effective_from')::date,r->>'payroll_group',(r->>'reviewed')::boolean,r->>'reference',
      (r->>'regular_minutes')::integer,r->>'short_day',r->>'worked_allowance',r->>'day_type',auth.uid());
  end loop;
end;
$$;
create function public.payroll_calculation_rules_page(p_kind text,p_site uuid,p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
  if not public.current_user_can_read_payroll_setup() then raise exception 'Payroll access is required.'; end if;
  with filtered as(select * from public.payroll_calculation_rules where kind=p_kind and worksite_id=p_site),
  page as(select * from filtered order by effective_from desc,created_at desc,id desc limit least(100,greatest(1,p_limit)) offset greatest(0,p_offset))
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by effective_from desc,created_at desc,id desc) from page),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
  return result;
end;
$$;
create function public.payroll_run_preview_source(p_id uuid,p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare run public.payroll_runs; coverage jsonb; ids uuid[]; rows jsonb; setup jsonb; rules jsonb; members jsonb;
begin
  if not public.current_user_can_read_payroll_setup() then raise exception 'Organization-wide payroll access is required.'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'Invalid calculation preview page.'; end if;
  select * into run from public.payroll_runs where id=p_id and status='draft';
  if run.id is null then raise exception 'Select an active draft run.'; end if;
  coverage:=public.payroll_run_coverage(p_id,p_limit,p_offset);
  select coalesce(array_agg((r->>'employeeId')::uuid),'{}'::uuid[]) into ids from jsonb_array_elements(coverage->'items') r;
  with dates as(select generate_series(run.period_start::timestamp,run.period_end::timestamp,interval '1 day')::date workday),
  selected as(select e.id,concat(e.employee_number,' - ',e.last_name,', ',e.first_name,case when coalesce(e.middle_name,'')<>'' then ' '||e.middle_name else '' end) label,d.workday,
    to_jsonb(b) base,coalesce(to_jsonb(o),to_jsonb(b)) candidate,to_jsonb(a) attendance
    from public.employees e cross join dates d
    left join lateral(select * from public.payroll_setup_records where employee_id=e.id and kind='employee_terms' and deleted_at is null and effective_from<=d.workday order by effective_from desc,id desc limit 1) b on true
    left join lateral(select * from public.payroll_setup_records where employee_id=e.id and kind='override' and deleted_at is null and effective_from=d.workday limit 1) o on true
    left join public.attendance_records a on a.employee_id=e.id and a.work_date=d.workday and a.deleted_at is null
    where e.id=any(ids) and e.deleted_at is null and (e.date_hired is null or e.date_hired<=d.workday) and (e.date_separated is null or e.date_separated>=d.workday)),
  filtered as(select * from selected where candidate->'data'->>'worksite_id'=run.worksite_id::text and candidate->'data'->>'frequency'=run.frequency
    and lower(trim(candidate->'data'->>'payroll_group'))=lower(trim(run.payroll_group)))
  select coalesce(jsonb_agg(jsonb_build_object('employeeId',id,'employeeLabel',label,'date',workday,'baseTerms',base,
    'terms',case when exists(select 1 from public.payroll_setup_records where id=run.worksite_id and kind='worksite' and deleted_at is null)
      and (nullif(candidate->'data'->>'effective_to','') is null or (candidate->'data'->>'effective_to')::date>=workday) then candidate else null end,
    'attendance',attendance,'neighbors','[]'::jsonb,'restDay',coalesce(candidate->'data'->'rest_days' @> jsonb_build_array(extract(dow from workday)::integer),false)) order by label,workday),'[]'::jsonb) into rows from filtered;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into setup from public.payroll_setup_records r where r.deleted_at is null
    and (r.id=run.worksite_id or r.kind='cooperative_policy' or r.employee_id=any(ids) or r.kind='wage' and r.data->>'series'=(select data->>'wage_series' from public.payroll_setup_records where id=run.worksite_id));
  with dates as(select generate_series(run.period_start::timestamp,run.period_end::timestamp,interval '1 day')::date workday),
  chosen as(select distinct r.id from dates d cross join (values('policy'),('calendar')) k(kind)
    cross join lateral(select * from public.payroll_calculation_rules where worksite_id=run.worksite_id and kind=k.kind
      and (k.kind='policy' and effective_from<=d.workday and lower(trim(payroll_group))=lower(trim(run.payroll_group)) or k.kind='calendar' and effective_from=d.workday)
      order by effective_from desc,created_at desc,id desc limit 1) r)
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into rules from public.payroll_calculation_rules r join chosen c on c.id=r.id;
  select coalesce(jsonb_object_agg(id::text,member_id is not null),'{}'::jsonb) into members from public.employees where id=any(ids);
  return jsonb_build_object('run',to_jsonb(run),'rows',rows,'setup',setup,'rules',rules,'members',members,'total',coverage->'total');
end;
$$;
revoke all on function public.save_payroll_calculation_rules(jsonb),public.payroll_calculation_rules_page(text,uuid,integer,integer),public.payroll_run_preview_source(uuid,integer,integer) from public;
grant execute on function public.save_payroll_calculation_rules(jsonb),public.payroll_calculation_rules_page(text,uuid,integer,integer),public.payroll_run_preview_source(uuid,integer,integer) to authenticated;
