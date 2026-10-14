-- Split-duty schedules, AWOL/AWOP, and atomic cutoff matrix saves.
alter table public.attendance_records drop constraint attendance_records_status_check;
alter table public.attendance_records add constraint attendance_records_status_check check(status in ('present','absent','paid_leave','unpaid_leave','rest_day','awol'));

create or replace function public.validate_payroll_duties()
returns trigger language plpgsql security invoker set search_path=public as $$
declare d jsonb:=new.data; s jsonb; first_time text; last_time text; first_min integer; previous_end integer:=-1; start_min integer; end_min integer; paid integer:=0; breaks numeric; span integer; n integer:=0;
begin
 if new.kind not in ('client_terms','employee_terms','override') or not (d ? 'duty_segments') then return new; end if;
 if jsonb_typeof(d->'duty_segments') is distinct from 'array' or jsonb_array_length(d->'duty_segments') not between 1 and 12 then raise exception 'Set between 1 and 12 duty segments.'; end if;
 for s in select value from jsonb_array_elements(d->'duty_segments') loop
  if coalesce(s->>'time_in','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(s->>'time_out','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or jsonb_typeof(s->'in_next_day') is distinct from 'boolean' or jsonb_typeof(s->'out_next_day') is distinct from 'boolean' then raise exception 'Invalid duty times or next-day flags.'; end if;
  start_min:=extract(epoch from(s->>'time_in')::time)::integer/60+case when (s->>'in_next_day')::boolean then 1440 else 0 end;
  end_min:=extract(epoch from(s->>'time_out')::time)::integer/60+case when (s->>'out_next_day')::boolean then 1440 else 0 end;
  breaks:=(s->>'break_minutes')::numeric;
  if breaks is null or breaks<0 or breaks<>trunc(breaks) or end_min<=start_min or breaks>=end_min-start_min or start_min<previous_end then raise exception 'Duty segments must be chronological, non-overlapping, with valid breaks.'; end if;
  if n=0 then if (s->>'in_next_day')::boolean then raise exception 'The first duty must start on the work date.'; end if; first_min:=start_min; first_time:=s->>'time_in'; end if;
  paid:=paid+end_min-start_min-breaks::integer; previous_end:=end_min; last_time:=s->>'time_out'; n:=n+1;
 end loop;
 span:=previous_end-first_min;
 if span<=0 or span>=1440 or d->>'shift_start' is distinct from first_time or d->>'shift_end' is distinct from last_time or (d->>'break_minutes')::numeric is distinct from (span-paid)::numeric then raise exception 'Duty segments do not match the shift and unpaid-break summary.'; end if;
 return new;
end; $$;
create trigger payroll_setup_duty_validate before insert on public.payroll_setup_records for each row execute function public.validate_payroll_duties();

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
    if coalesce(input->>'status','') not in ('present','absent','paid_leave','unpaid_leave','rest_day','awol') then raise exception 'Invalid attendance status.'; end if;
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




create or replace function public.save_cutoff_attendance(p_run_id uuid,p_records jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare run public.payroll_runs; input jsonb; terms public.payroll_setup_records; prepared jsonb:='[]'; batch jsonb; employee_key text; count integer; day_index integer; override_id uuid; offset_index integer;
begin
 if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.manage') then raise exception 'Payroll management permission is required.'; end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 3100 then raise exception 'Save between 1 and 3,100 cutoff assignment-days.'; end if;
 select * into run from public.payroll_runs where id=p_run_id and status='draft' for update;
 if not found then raise exception 'Select an active cutoff.'; end if;
 if (select count(distinct value->>'employee_id') from jsonb_array_elements(p_records))>100 or
   (select count(distinct concat(value->>'employee_id',':',value->>'work_date')) from jsonb_array_elements(p_records))<>jsonb_array_length(p_records) then raise exception 'Select at most 100 employees with distinct dates.'; end if;
 -- Hold all employee attendance and pay-term locks in stable order before chunking.
 for employee_key in select distinct (value->>'employee_id')::uuid::text from jsonb_array_elements(p_records) order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('employee-payroll:'||employee_key,0));
 end loop;
 for employee_key in select distinct (value->>'employee_id')::uuid::text from jsonb_array_elements(p_records) order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended(employee_key,0));
 end loop;
 for input in select value from jsonb_array_elements(p_records) order by value->>'employee_id',value->>'work_date' loop
  if coalesce(input->>'work_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (input->>'work_date')::date not between run.period_start and run.period_end then raise exception 'Attendance date is outside this cutoff.'; end if;
  select * into terms from public.applicable_attendance_terms((input->>'employee_id')::uuid,(input->>'work_date')::date);
  if terms.id is null or terms.id<>(input->>'terms_id')::uuid or terms.worksite_id<>run.worksite_id or terms.data->>'frequency'<>run.frequency or lower(trim(terms.data->>'payroll_group'))<>lower(trim(run.payroll_group)) then raise exception 'Pay terms changed or do not match this cutoff.'; end if;
  day_index:=extract(dow from(input->>'work_date')::date)::integer;
  if input->>'status'='rest_day' and not (terms.data->'rest_days' @> jsonb_build_array(day_index)) then
   if terms.kind='override' then raise exception 'An existing daily override must be corrected before changing its day-off.'; end if;
   insert into public.payroll_setup_records(kind,data,created_by) values('override',terms.data||jsonb_build_object(
    'label',(select employee_number from public.employees where id=terms.employee_id)||' - Day-off override','reason',input->>'reason','effective_from',input->>'work_date','effective_to',input->>'work_date','source_terms_id',terms.id,
    'rest_days',(select jsonb_agg(distinct value) from jsonb_array_elements(terms.data->'rest_days'||jsonb_build_array(day_index)))),auth.uid()) returning id into override_id;
   input:=input||jsonb_build_object('terms_id',override_id);
  end if;
  prepared:=prepared||jsonb_build_array(input);
 end loop;
 count:=jsonb_array_length(prepared);
 for offset_index in 0..((count-1)/500) loop
  select jsonb_agg(value order by ordinality) into batch from jsonb_array_elements(prepared) with ordinality where ordinality>offset_index*500 and ordinality<=offset_index*500+500;
  perform public.save_attendance_batch(batch);
 end loop;
end; $$;
revoke all on function public.save_cutoff_attendance(uuid,jsonb) from public;
grant execute on function public.save_cutoff_attendance(uuid,jsonb) to authenticated;

