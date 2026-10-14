-- Search employee rosters before paging, consistently across cutoff views.
create function public.payroll_run_coverage_search(p_id uuid,p_limit integer default 25,p_offset integer default 0,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare run public.payroll_runs; result jsonb;
begin
  if not public.current_user_can_read_payroll_setup() then raise exception 'Organization-wide payroll access is required.'; end if;
  select * into run from public.payroll_runs where id=p_id and status='draft';
  if run.id is null then raise exception 'Select an active draft run.'; end if;
  with dates as(select generate_series(run.period_start::timestamp,run.period_end::timestamp,interval '1 day')::date workday),
  bases as(select distinct on(d.workday,r.employee_id) d.workday,r.employee_id,to_jsonb(r) record from dates d join public.payroll_setup_records r on r.effective_from<=d.workday
    where r.deleted_at is null and r.kind='employee_terms' order by d.workday,r.employee_id,r.effective_from desc,r.id),
  overrides as(select d.workday,r.employee_id,to_jsonb(r) record from dates d join public.payroll_setup_records r on r.effective_from=d.workday where r.deleted_at is null and r.kind='override'),
  candidates as(select coalesce(o.workday,b.workday) workday,coalesce(o.employee_id,b.employee_id) employee_id,coalesce(o.record,b.record) record from bases b full join overrides o on o.workday=b.workday and o.employee_id=b.employee_id),
  days as(select c.*,concat(e.employee_number,' - ',e.last_name,', ',e.first_name,case when coalesce(e.middle_name,'')<>'' then ' '||e.middle_name else '' end) label,
    a.id attendance_id,a.review_status,a.terms_id,
    (not exists(select 1 from public.payroll_setup_records where id=run.worksite_id and kind='worksite' and deleted_at is null)
      or (nullif(c.record->'data'->>'effective_to','') is not null and (c.record->'data'->>'effective_to')::date<c.workday)) missing_terms
    from candidates c join public.employees e on e.id=c.employee_id left join public.attendance_records a on a.employee_id=c.employee_id and a.work_date=c.workday and a.deleted_at is null
    where public.person_search_matches(concat_ws(' ',e.employee_number,e.first_name,e.middle_name,e.last_name,e.suffix),p_search) and e.deleted_at is null and (e.date_hired is null or e.date_hired<=c.workday) and (e.date_separated is null or e.date_separated>=c.workday)
      and c.record->'data'->>'worksite_id'=run.worksite_id::text and c.record->'data'->>'frequency'=run.frequency
      and lower(trim(c.record->'data'->>'payroll_group'))=lower(trim(run.payroll_group))),
  checks as(select *,concat_ws('; ',case when missing_terms then 'Missing / expired terms' end,case when attendance_id is null then 'Missing attendance' end,
    case when review_status='draft' then 'Draft attendance' end,case when not missing_terms and terms_id<>(record->>'id')::uuid then 'Pay terms changed after entry' end) message from days),
  grouped as(select employee_id,label,count(*) expected,count(*) filter(where review_status='approved') approved,count(*) filter(where attendance_id is null) missing,
    count(*) filter(where review_status='draft') drafts,count(*) filter(where missing_terms) missing_terms_count,
    count(*) filter(where not missing_terms and terms_id<>(record->>'id')::uuid) changed_terms,
    coalesce(jsonb_agg(jsonb_build_object('date',workday,'message',message) order by workday) filter(where message<>''),'[]'::jsonb) issues from checks group by employee_id,label),
  page as(select * from grouped order by label,employee_id limit least(100,greatest(1,p_limit)) offset greatest(0,p_offset))
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('employeeId',employee_id,'employeeLabel',label,'expected',expected,'approved',approved,'missing',missing,
    'drafts',drafts,'missingTerms',missing_terms_count,'changedTerms',changed_terms,'issues',issues) order by label,employee_id) from page),'[]'::jsonb),'total',(select count(*) from grouped),
    'summary',(select jsonb_build_object('employees',count(*),'expected',coalesce(sum(expected),0),'approved',coalesce(sum(approved),0),'missing',coalesce(sum(missing),0),'drafts',coalesce(sum(drafts),0),
      'missingTerms',coalesce(sum(missing_terms_count),0),'changedTerms',coalesce(sum(changed_terms),0)) from grouped)) into result;
  return result;
end;
$$;
create function public.payroll_run_preview_source_search(p_id uuid,p_limit integer default 25,p_offset integer default 0,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare run public.payroll_runs; coverage jsonb; ids uuid[]; rows jsonb; setup jsonb; rules jsonb; members jsonb;
begin
  if not public.current_user_can_read_payroll_setup() then raise exception 'Organization-wide payroll access is required.'; end if;
  if p_limit not between 1 and 100 or p_offset<0 then raise exception 'Invalid calculation preview page.'; end if;
  select * into run from public.payroll_runs where id=p_id and status='draft';
  if run.id is null then raise exception 'Select an active draft run.'; end if;
  coverage:=public.payroll_run_coverage_search(p_id,p_limit,p_offset,p_search);
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
revoke all on function public.payroll_run_coverage_search(uuid,integer,integer,text),public.payroll_run_preview_source_search(uuid,integer,integer,text) from public;
grant execute on function public.payroll_run_coverage_search(uuid,integer,integer,text),public.payroll_run_preview_source_search(uuid,integer,integer,text) to authenticated;

