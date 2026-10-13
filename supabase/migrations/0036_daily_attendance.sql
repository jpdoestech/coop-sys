create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  employee_label text not null,
  work_date date not null,
  status text not null check(status in ('present','absent','paid_leave','unpaid_leave','rest_day')),
  segments jsonb not null,
  reason text not null,
  terms_id uuid not null references public.payroll_setup_records(id),
  worksite_id uuid not null references public.payroll_setup_records(id),
  terms_snapshot jsonb not null,
  source_file text,
  review_status text not null default 'draft' check(review_status in ('draft','approved')),
  supersedes_id uuid references public.attendance_records(id),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id), reviewed_at timestamptz, deleted_at timestamptz
);
create unique index attendance_employee_day_idx on public.attendance_records(employee_id,work_date) where deleted_at is null;
create index attendance_date_review_idx on public.attendance_records(work_date desc,review_status) where deleted_at is null;
alter table public.attendance_records enable row level security;
create policy "payroll attendance readers" on public.attendance_records for select to authenticated using(public.current_user_can_read_payroll_setup());
grant select on public.attendance_records to authenticated;

create or replace function public.applicable_attendance_terms(p_employee uuid,p_date date)
returns setof public.payroll_setup_records language sql stable security invoker set search_path=public as $$
  select * from (select * from public.payroll_setup_records where employee_id=p_employee and deleted_at is null
    and kind in ('employee_terms','override') and effective_from<=p_date and (kind<>'override' or effective_from=p_date)
    order by (kind='override') desc,effective_from desc limit 1) t
  where nullif(data->>'effective_to','') is null or (data->>'effective_to')::date>=p_date;
$$;
revoke all on function public.applicable_attendance_terms(uuid,date) from public;

create or replace function public.attendance_segment_ranges(p_date date,p_segments jsonb)
returns table(start_time timestamp,end_time timestamp) language sql immutable set search_path=public as $$
  select p_date+(s->>'time_in')::time+case when (s->>'in_next_day')::boolean then interval '1 day' else interval '0 day' end,
    p_date+(s->>'time_out')::time+case when (s->>'out_next_day')::boolean then interval '1 day' else interval '0 day' end
  from jsonb_array_elements(p_segments) s;
$$;
revoke all on function public.attendance_segment_ranges(date,jsonb) from public;

create or replace function public.save_attendance_batch(p_records jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare input jsonb; s jsonb; workday date; emp public.employees; terms public.payroll_setup_records;
  previous public.attendance_records; punches jsonb; start_clock timestamp; end_clock timestamp; minutes numeric;
begin
  if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.manage') then raise exception 'Payroll management permission is required.'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 500 then raise exception 'Save between 1 and 500 attendance records.'; end if;
  -- Consistent lock order makes concurrent batches and corrections deterministic.
  for input in select value from jsonb_array_elements(p_records) order by value->>'employee_id',value->>'work_date' loop
    perform pg_advisory_xact_lock(hashtextextended(input->>'employee_id',0));
    if coalesce(input->>'work_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid attendance date.'; end if;
    workday:=(input->>'work_date')::date;
    select * into emp from public.employees where id=(input->>'employee_id')::uuid and deleted_at is null;
    if emp.id is null or emp.date_hired>workday or emp.date_separated<workday then raise exception 'Attendance date is outside the employment period.'; end if;
    select * into terms from public.applicable_attendance_terms(emp.id,workday);
    if terms.id is null or terms.id<>(input->>'terms_id')::uuid then raise exception 'Applicable pay terms changed or are missing. Reload this work date.'; end if;
    if coalesce(input->>'status','') not in ('present','absent','paid_leave','unpaid_leave','rest_day') then raise exception 'Invalid attendance status.'; end if;
    if coalesce(length(trim(input->>'reason')),0)=0 or length(input->>'reason')>1000 or length(input->>'source_file')>255 then raise exception 'Attendance reason or source filename is invalid.'; end if;
    if input->>'status'='rest_day' and not (terms.data->'rest_days' @> jsonb_build_array(extract(dow from workday)::integer)) then raise exception 'Record a schedule override before marking this date as a rest day.'; end if;
    punches:=input->'segments';
    if jsonb_typeof(punches) is distinct from 'array' then raise exception 'Invalid work segments.'; end if;
    if (input->>'status'='present' and jsonb_array_length(punches) not between 1 and 12) or (input->>'status'<>'present' and jsonb_array_length(punches)<>0) then raise exception 'Present records require punches; non-working statuses cannot contain punches.'; end if;
    for s in select value from jsonb_array_elements(punches) loop
      if coalesce(s->>'time_in','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or coalesce(s->>'time_out','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
        or jsonb_typeof(s->'in_next_day') is distinct from 'boolean' or jsonb_typeof(s->'out_next_day') is distinct from 'boolean' then raise exception 'Invalid punch times or next-day flags.'; end if;
      select r.start_time,r.end_time into start_clock,end_clock from public.attendance_segment_ranges(workday,jsonb_build_array(s)) r;
      minutes:=extract(epoch from(end_clock-start_clock))/60;
      if minutes<=0 or minutes>1440 or (s->>'break_minutes') is null or (s->>'break_minutes')::numeric<0 or (s->>'break_minutes')::numeric<>trunc((s->>'break_minutes')::numeric) or (s->>'break_minutes')::numeric>=minutes then raise exception 'Invalid segment duration or unpaid break.'; end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(punches) with ordinality a(s,i) join jsonb_array_elements(punches) with ordinality b(s,i) on a.i<b.i
      cross join lateral public.attendance_segment_ranges(workday,jsonb_build_array(a.s)) ar
      cross join lateral public.attendance_segment_ranges(workday,jsonb_build_array(b.s)) br
      where ar.start_time<br.end_time and ar.end_time>br.start_time) then raise exception 'Work segments overlap.'; end if;
    if nullif(input->>'replace_id','') is not null then
      select * into previous from public.attendance_records where id=(input->>'replace_id')::uuid and deleted_at is null for update;
      if previous.id is null or previous.employee_id<>emp.id or previous.work_date<>workday or previous.review_status<>'draft' then raise exception 'Only the current draft for the same employee/date can be corrected.'; end if;
      update public.attendance_records set deleted_at=now(),updated_at=now() where id=previous.id;
    end if;
    if exists(select 1 from public.attendance_records where employee_id=emp.id and work_date=workday and deleted_at is null) then raise exception 'Attendance already exists for this employee and work date.'; end if;
    if exists(select 1 from public.attendance_records a
      cross join lateral public.attendance_segment_ranges(a.work_date,a.segments) existing
      cross join lateral public.attendance_segment_ranges(workday,punches) incoming
      where a.employee_id=emp.id and a.deleted_at is null and a.work_date between workday-1 and workday+1
        and incoming.start_time<existing.end_time and incoming.end_time>existing.start_time) then raise exception 'Attendance overlaps another work date.'; end if;
    insert into public.attendance_records(employee_id,employee_label,work_date,status,segments,reason,terms_id,worksite_id,terms_snapshot,source_file,supersedes_id,created_by)
      values(emp.id,concat(emp.employee_number,' - ',emp.last_name,', ',emp.first_name),workday,input->>'status',punches,input->>'reason',terms.id,(terms.data->>'worksite_id')::uuid,terms.data,nullif(input->>'source_file',''),nullif(input->>'replace_id','')::uuid,auth.uid());
  end loop;
end;
$$;

create or replace function public.approve_attendance(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare record public.attendance_records; terms public.payroll_setup_records;
begin
  if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.approve') then raise exception 'Payroll approval permission is required.'; end if;
  select * into record from public.attendance_records where id=p_id and deleted_at is null;
  if record.id is null or record.review_status<>'draft' then raise exception 'Select a current draft attendance record.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(record.employee_id::text,0));
  select * into record from public.attendance_records where id=p_id and deleted_at is null for update;
  if record.id is null or record.review_status<>'draft' then raise exception 'Select a current draft attendance record.'; end if;
  select * into terms from public.applicable_attendance_terms(record.employee_id,record.work_date);
  if terms.id is null or terms.id<>record.terms_id then raise exception 'Pay terms changed. Correct the draft before approval.'; end if;
  if not exists(select 1 from public.employees where id=record.employee_id and deleted_at is null and (date_hired is null or date_hired<=record.work_date) and (date_separated is null or date_separated>=record.work_date)) then raise exception 'Attendance date is outside the employment period.'; end if;
  update public.attendance_records set review_status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_id;
end;
$$;

create or replace function public.attendance_page(p_search text default null,p_from date default null,p_to date default null,p_employee_id uuid default null,p_review text default null,p_archived boolean default false,p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
  if not public.current_user_can_read_payroll_setup() then raise exception 'Payroll salary access is required.'; end if;
  if p_from>p_to or p_review is not null and p_review not in ('draft','approved') then raise exception 'Invalid attendance filters.'; end if;
  with filtered as (select * from public.attendance_records where (p_archived or deleted_at is null)
    and (p_from is null or work_date>=p_from) and (p_to is null or work_date<=p_to) and (p_employee_id is null or employee_id=p_employee_id)
    and (p_review is null or review_status=p_review) and public.person_search_matches(employee_label,p_search)),
  page as (select * from filtered order by work_date desc,employee_label,id limit least(100,greatest(1,p_limit)) offset greatest(0,p_offset))
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by work_date desc,employee_label,id) from page),'[]'::jsonb),'total',(select count(*) from filtered)) into result;
  return result;
end;
$$;

create or replace function public.protect_attendance_setup_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.deleted_at is not null and exists(select 1 from public.attendance_records where review_status='approved' and (terms_id=old.id or worksite_id=old.id)) then raise exception 'Approved attendance references this setup record. Use a new effective-dated version.'; end if;
  return new;
end;
$$;
create trigger payroll_attendance_history_guard before update on public.payroll_setup_records for each row execute function public.protect_attendance_setup_history();
revoke all on function public.save_attendance_batch(jsonb),public.approve_attendance(uuid),public.attendance_page(text,date,date,uuid,text,boolean,integer,integer) from public;
grant execute on function public.save_attendance_batch(jsonb),public.approve_attendance(uuid),public.attendance_page(text,date,date,uuid,text,boolean,integer,integer) to authenticated;
update public.roles set permissions=array(select distinct p from unnest(permissions||array['payroll.approve']) p),updated_at=now() where code='super_admin';
