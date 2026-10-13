create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(), title text not null, worksite_id uuid not null references public.payroll_setup_records(id),
  worksite_label text not null, payroll_group text not null, frequency text not null check(frequency in ('weekly','semi_monthly','monthly')),
  period_start date not null, period_end date not null, pay_date date not null, reason text not null,
  status text not null default 'draft' check(status in ('draft','cancelled')),
  created_by uuid not null references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  cancelled_by uuid references public.users(id), cancelled_at timestamptz, cancel_reason text,
  check(period_end>=period_start and period_end-period_start<=30 and pay_date>=period_end),
  check(length(trim(title)) between 1 and 200 and length(trim(payroll_group)) between 1 and 200 and length(trim(reason)) between 1 and 1000),
  check((status='draft' and cancelled_by is null and cancelled_at is null and cancel_reason is null)
    or (status='cancelled' and cancelled_by is not null and cancelled_at is not null and length(trim(cancel_reason)) between 1 and 1000))
);
create index payroll_runs_period_idx on public.payroll_runs(period_start desc,created_at desc);
create index payroll_runs_group_idx on public.payroll_runs(worksite_id,lower(trim(payroll_group)),period_start,period_end) where status='draft';
alter table public.payroll_runs enable row level security;
create policy "payroll preparation readers" on public.payroll_runs for select to authenticated using(public.current_user_can_read_payroll_setup());
grant select on public.payroll_runs to authenticated;

create function public.create_payroll_run(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare site public.payroll_setup_records; record public.payroll_runs; field text;
begin
  if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.manage') then raise exception 'Payroll management permission is required.'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid run input.'; end if;
  foreach field in array array['title','payroll_group','reason'] loop
    if jsonb_typeof(p_input->field) is distinct from 'string' or coalesce(length(trim(p_input->>field)),0)=0 or length(p_input->>field)>(case when field='reason' then 1000 else 200 end) then raise exception 'Run title, payroll group and reference are required.'; end if;
  end loop;
  foreach field in array array['period_start','period_end','pay_date'] loop
    if coalesce(p_input->>field,'') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Valid run dates are required.'; end if;
  end loop;
  select * into site from public.payroll_setup_records where id=(p_input->>'worksite_id')::uuid and kind='worksite' and deleted_at is null;
  if site.id is null then raise exception 'Worksite is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(site.id::text||':'||lower(trim(p_input->>'payroll_group')),0));
  if exists(select 1 from public.payroll_runs where worksite_id=site.id and lower(trim(payroll_group))=lower(trim(p_input->>'payroll_group')) and status='draft'
    and period_start<=(p_input->>'period_end')::date and period_end>=(p_input->>'period_start')::date) then raise exception 'An active run already overlaps this worksite, payroll group and period.'; end if;
  insert into public.payroll_runs(title,worksite_id,worksite_label,payroll_group,frequency,period_start,period_end,pay_date,reason,created_by)
  values(trim(p_input->>'title'),site.id,site.data->>'label',trim(p_input->>'payroll_group'),p_input->>'frequency',(p_input->>'period_start')::date,
    (p_input->>'period_end')::date,(p_input->>'pay_date')::date,p_input->>'reason',auth.uid()) returning * into record;
  return to_jsonb(record);
end;
$$;
create function public.cancel_payroll_run(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare record public.payroll_runs;
begin
  if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.manage') then raise exception 'Payroll management permission is required.'; end if;
  if coalesce(length(trim(p_reason)),0)=0 or length(p_reason)>1000 then raise exception 'Cancellation reference is required.'; end if;
  select * into record from public.payroll_runs where id=p_id and status='draft';
  if record.id is null then raise exception 'Select an active draft run.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(record.worksite_id::text||':'||lower(trim(record.payroll_group)),0));
  update public.payroll_runs set status='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancel_reason=p_reason,updated_at=now() where id=p_id and status='draft';
  if not found then raise exception 'Run was already cancelled.'; end if;
end;
$$;
create function public.payroll_runs_page(p_search text default null,p_cancelled boolean default false,p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
  if not public.current_user_can_read_payroll_setup() then raise exception 'Payroll access is required.'; end if;
  with filtered as(select * from public.payroll_runs where (p_cancelled or status='draft') and public.person_search_matches(concat_ws(' ',title,worksite_label,payroll_group),p_search)),
  page as(select * from filtered order by period_start desc,created_at desc,id limit least(100,greatest(1,p_limit)) offset greatest(0,p_offset))
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by period_start desc,created_at desc,id) from page),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
  return result;
end;
$$;
create function public.payroll_run_coverage(p_id uuid,p_limit integer default 25,p_offset integer default 0)
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
    where e.deleted_at is null and (e.date_hired is null or e.date_hired<=c.workday) and (e.date_separated is null or e.date_separated>=c.workday)
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
revoke all on function public.create_payroll_run(jsonb),public.cancel_payroll_run(uuid,text),public.payroll_runs_page(text,boolean,integer,integer),public.payroll_run_coverage(uuid,integer,integer) from public;
grant execute on function public.create_payroll_run(jsonb),public.cancel_payroll_run(uuid,text),public.payroll_runs_page(text,boolean,integer,integer),public.payroll_run_coverage(uuid,integer,integer) to authenticated;
