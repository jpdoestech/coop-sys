-- Payroll setup only. No payroll runs, attendance, or statutory calculations.
create table public.payroll_setup_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('worksite','wage','client_terms','employee_terms','override','cooperative_policy','deduction')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  employee_id uuid references public.employees(id),
  worksite_id uuid references public.payroll_setup_records(id),
  effective_from date,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index payroll_setup_kind_date_idx on public.payroll_setup_records(kind,effective_from desc) where deleted_at is null;
create index payroll_setup_employee_date_idx on public.payroll_setup_records(employee_id,effective_from desc) where deleted_at is null;
create index payroll_setup_worksite_idx on public.payroll_setup_records(worksite_id) where deleted_at is null;
create unique index payroll_setup_wage_version_idx on public.payroll_setup_records((data->>'series'),effective_from) where kind='wage' and deleted_at is null;
create unique index payroll_setup_employee_version_idx on public.payroll_setup_records(kind,employee_id,effective_from) where kind in ('employee_terms','override') and deleted_at is null;
create unique index payroll_setup_client_version_idx on public.payroll_setup_records(worksite_id,coalesce(data->>'department_id',''),coalesce(data->>'position_id',''),effective_from) where kind='client_terms' and deleted_at is null;
create unique index payroll_setup_cooperative_policy_idx on public.payroll_setup_records(effective_from) where kind='cooperative_policy' and deleted_at is null;
create unique index payroll_setup_worksite_name_idx on public.payroll_setup_records((data->>'branch_id'),coalesce(data->>'client_id',''),lower(trim(data->>'label'))) where kind='worksite' and deleted_at is null;
create unique index payroll_setup_deduction_version_idx on public.payroll_setup_records(employee_id,(data->>'deduction_type'),(case when data->>'deduction_type'='cooperative' then '' else data->>'deduction_reference' end),effective_from) where kind='deduction' and deleted_at is null;

alter table public.payroll_setup_records enable row level security;
create or replace function public.current_user_can_read_payroll_setup()
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and public.current_user_has_permission('payroll.view')
    and exists(select 1 from public.users where id=auth.uid() and scope_type='organization' and is_active);
$$;
revoke all on function public.current_user_can_read_payroll_setup() from public;
grant execute on function public.current_user_can_read_payroll_setup() to authenticated;
create policy "payroll setup salary access" on public.payroll_setup_records for select to authenticated using(public.current_user_can_read_payroll_setup());
create policy "payroll managers create versions" on public.payroll_setup_records for insert to authenticated with check(public.current_user_can_read_payroll_setup() and public.current_user_has_permission('payroll.manage') and created_by=auth.uid());
create policy "payroll managers archive setup" on public.payroll_setup_records for update to authenticated using(public.current_user_can_read_payroll_setup() and public.current_user_has_permission('payroll.manage')) with check(public.current_user_can_read_payroll_setup() and public.current_user_has_permission('payroll.manage'));
grant select,insert,update on public.payroll_setup_records to authenticated;

create or replace function public.validate_payroll_setup_record()
returns trigger language plpgsql security invoker set search_path=public as $$
declare d jsonb := new.data; field text; amount numeric; duration integer; allowance jsonb; day jsonb;
begin
  if tg_op='UPDATE' then
    if new.data<>old.data or new.kind<>old.kind or new.created_at<>old.created_at or new.created_by<>old.created_by
      or new.employee_id is distinct from old.employee_id or new.worksite_id is distinct from old.worksite_id or new.effective_from is distinct from old.effective_from
      or old.deleted_at is not null then raise exception 'Payroll history cannot be overwritten or restored. Create an effective-dated version.'; end if;
    if new.deleted_at is null then raise exception 'Only archival is allowed for existing setup versions.'; end if;
    if old.kind='worksite' and exists(select 1 from public.payroll_setup_records where worksite_id=old.id and deleted_at is null) then raise exception 'Archive dependent pay terms before archiving a worksite.'; end if;
    new.deleted_at:=now(); new.updated_at:=now(); return new;
  end if;
  if new.deleted_at is not null then raise exception 'New setup records cannot be archived.'; end if;
  foreach field in array array['label','reason'] loop
    if jsonb_typeof(d->field) is distinct from 'string' or length(trim(d->>field))=0 or length(d->>field)>(case when field='reason' then 1000 else 200 end) then raise exception 'Name and change reason are required.'; end if;
  end loop;
  if new.kind='worksite' then
    foreach field in array array['region','province','city','category'] loop
      if coalesce(length(trim(d->>field)),0)=0 or length(d->>field)>200 then raise exception 'Worksite location and wage category are required.'; end if;
    end loop;
    if not exists(select 1 from public.branches where id=(d->>'branch_id')::uuid and deleted_at is null and is_active) then raise exception 'Branch is unavailable.'; end if;
    if nullif(d->>'client_id','') is not null and not exists(select 1 from public.clients where id=(d->>'client_id')::uuid and branch_id=(d->>'branch_id')::uuid and deleted_at is null and is_active) then raise exception 'Client must belong to the selected branch.'; end if;
    new.employee_id:=null; new.worksite_id:=null; new.effective_from:=null; return new;
  end if;
  if coalesce(d->>'effective_from','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Effective date is required.'; end if;
  new.effective_from:=(d->>'effective_from')::date;
  if nullif(d->>'effective_to','') is not null and (d->>'effective_to')::date<new.effective_from then raise exception 'Effective end cannot precede start.'; end if;
  if new.kind in ('cooperative_policy','deduction') then
    new.worksite_id:=null;
    if new.kind='cooperative_policy' then
      new.employee_id:=null;
    else
      new.employee_id:=nullif(d->>'employee_id','')::uuid;
      if new.employee_id is null or not exists(select 1 from public.employees where id=new.employee_id and deleted_at is null) then raise exception 'Select an employee.'; end if;
      if coalesce(d->>'deduction_type','') not in ('cooperative','loan','advance') or coalesce(d->>'deduction_mode','') not in ('follow_default','fixed') then raise exception 'Invalid deduction type or amount policy.'; end if;
      if d->>'deduction_type'='cooperative' and not exists(select 1 from public.employees where id=new.employee_id and member_id is not null) then raise exception 'Cooperative deductions require a linked member.'; end if;
      if d->>'deduction_type'<>'cooperative' then
        amount:=(d->>'opening_balance_centavos')::numeric;
        if d->>'deduction_mode'<>'fixed' or amount is null or amount<=0 or amount<>trunc(amount) or amount>100000000000 or coalesce(length(trim(d->>'deduction_reference')),0)=0 or length(d->>'deduction_reference')>200 then raise exception 'Loan/advance reference, opening balance, and fixed installment are required.'; end if;
      end if;
    end if;
    if new.kind='cooperative_policy' or d->>'deduction_mode'='fixed' then
      amount:=(d->>'deduction_centavos')::numeric;
      if amount is null or amount<=0 or amount<>trunc(amount) or amount>100000000000 then raise exception 'Deduction per cutoff must be a positive centavo amount.'; end if;
    end if;
    return new;
  end if;
  if new.kind='wage' then
    foreach field in array array['series','region','category','order_reference'] loop
      if coalesce(length(trim(d->>field)),0)=0 or length(d->>field)>200 then raise exception 'Wage series, category, region, and order are required.'; end if;
    end loop;
    amount:=(d->>'minimum_daily_centavos')::numeric;
    if amount is null or amount<=0 or amount<>trunc(amount) or amount>100000000000 then raise exception 'Daily minimum must be a positive centavo amount.'; end if;
    if coalesce(d->>'source_url','') !~ '^https://([a-zA-Z0-9-]+\.)*(nwpc\.dole\.gov\.ph|dole\.gov\.ph)(/|$)' then raise exception 'Use an official DOLE or NWPC HTTPS source.'; end if;
    if jsonb_typeof(d->'reviewed') is distinct from 'boolean' then raise exception 'Specify wage review status.'; end if;
    new.employee_id:=null; new.worksite_id:=null; return new;
  end if;
  new.worksite_id:=(d->>'worksite_id')::uuid;
  if not exists(select 1 from public.payroll_setup_records where id=new.worksite_id and kind='worksite' and deleted_at is null) then raise exception 'Worksite is unavailable.'; end if;
  new.employee_id:=nullif(d->>'employee_id','')::uuid;
  if new.kind='client_terms' and new.employee_id is not null then raise exception 'Client defaults cannot belong to an employee.'; end if;
  if new.kind<>'client_terms' and (new.employee_id is null or not exists(select 1 from public.employees where id=new.employee_id and deleted_at is null)) then raise exception 'Select an active employee record.'; end if;
  if new.kind='override' and ((d->>'effective_to') is null or (d->>'effective_to')::date<>new.effective_from) then raise exception 'Daily overrides must cover one work date.'; end if;
  if nullif(d->>'department_id','') is not null and not exists(select 1 from public.departments where id=(d->>'department_id')::uuid and deleted_at is null and is_active) then raise exception 'Department is unavailable.'; end if;
  if nullif(d->>'position_id','') is not null and not exists(select 1 from public.positions where id=(d->>'position_id')::uuid and deleted_at is null and is_active and (nullif(d->>'department_id','') is null or department_id=(d->>'department_id')::uuid)) then raise exception 'Position must belong to the selected department.'; end if;
  if nullif(d->>'source_terms_id','') is not null and not exists(select 1 from public.payroll_setup_records where id=(d->>'source_terms_id')::uuid and kind in ('client_terms','employee_terms','override')) then raise exception 'Source pay terms are unavailable.'; end if;
  if coalesce(d->>'pay_basis','') not in ('daily','monthly') then raise exception 'Select pay basis.'; end if;
  amount:=(d->>'rate_centavos')::numeric;
  if amount is null or amount<=0 or amount<>trunc(amount) or amount>100000000000 then raise exception 'Rate must be a positive centavo amount.'; end if;
  if d->>'pay_basis'='monthly' then
    if coalesce(d->>'monthly_mode','') not in ('direct','daily_factor') then raise exception 'Select monthly salary method.'; end if;
    if d->>'monthly_mode'='daily_factor' and (coalesce((d->>'monthly_factor')::numeric,0)<=0 or (d->>'monthly_factor')::numeric>366) then raise exception 'Invalid monthly salary factor.'; end if;
  end if;
  if coalesce(d->>'frequency','') not in ('weekly','semi_monthly','monthly') or coalesce(length(trim(d->>'payroll_group')),0)=0 then raise exception 'Payroll group and frequency are required.'; end if;
  if coalesce(d->>'shift_start','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or coalesce(d->>'shift_end','') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'Invalid shift times.'; end if;
  duration:=((extract(epoch from (d->>'shift_end')::time)::integer-extract(epoch from (d->>'shift_start')::time)::integer+86400)%86400)/60;
  amount:=(d->>'break_minutes')::numeric;
  if amount is null or amount<0 or amount<>trunc(amount) or amount>=duration then raise exception 'Break must be shorter than the shift.'; end if;
  if jsonb_typeof(d->'rest_days') is distinct from 'array' then raise exception 'Invalid rest days.'; end if;
  for day in select value from jsonb_array_elements(d->'rest_days') loop
    if jsonb_typeof(day)<>'number' or day::numeric<>trunc(day::numeric) or day::numeric<0 or day::numeric>6 then raise exception 'Invalid rest day.'; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(d->'rest_days'))<>(select count(distinct value) from jsonb_array_elements(d->'rest_days')) then raise exception 'Duplicate rest day.'; end if;
  if jsonb_typeof(d->'allowances') is distinct from 'array' or jsonb_array_length(d->'allowances')>30 then raise exception 'Invalid allowance list.'; end if;
  for allowance in select value from jsonb_array_elements(d->'allowances') loop
    amount:=(allowance->>'amount_centavos')::numeric;
    if coalesce(length(trim(allowance->>'name')),0)=0 or length(allowance->>'name')>200 or amount is null or amount<=0 or amount<>trunc(amount) or amount>100000000000 or coalesce(allowance->>'basis','') not in ('worked_day','cutoff','month') or coalesce(allowance->>'tax_treatment','') not in ('unreviewed','taxable','non_taxable') then raise exception 'Invalid allowance component.'; end if;
  end loop;
  return new;
end;
$$;
create trigger payroll_setup_validate before insert or update on public.payroll_setup_records for each row execute function public.validate_payroll_setup_record();

create or replace function public.archive_payroll_setup(p_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.current_user_can_read_payroll_setup() or not public.current_user_has_permission('payroll.manage') then raise exception 'Payroll management permission is required.'; end if;
  update public.payroll_setup_records set deleted_at=now() where id=p_id and deleted_at is null;
  if not found then raise exception 'Payroll setup record is unavailable.'; end if;
end;
$$;
create or replace function public.payroll_work_date_records(p_employee_id uuid,p_date date)
returns setof public.payroll_setup_records language sql stable security invoker set search_path=public as $$
  with terms as (
    select * from public.payroll_setup_records where employee_id=p_employee_id and deleted_at is null and effective_from<=p_date and kind in ('employee_terms','override','deduction')
      and (kind<>'override' or effective_from=p_date)
    order by kind, effective_from desc
  ), site_ids as (select distinct worksite_id from terms), series as (
    select data->>'wage_series' as code from public.payroll_setup_records where id in(select worksite_id from site_ids)
  )
  select * from terms union all
  select * from public.payroll_setup_records where deleted_at is null and (id in(select worksite_id from site_ids) or kind='wage' and data->>'series' in(select code from series) and effective_from<=p_date or kind='cooperative_policy' and effective_from<=p_date);
$$;
revoke all on function public.archive_payroll_setup(uuid) from public;
revoke all on function public.payroll_work_date_records(uuid,date) from public;
grant execute on function public.archive_payroll_setup(uuid), public.payroll_work_date_records(uuid,date) to authenticated;
update public.roles set permissions=array(select distinct p from unnest(permissions||array['payroll.view','payroll.manage']) p),updated_at=now() where code='super_admin';
