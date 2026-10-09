-- Match every search term regardless of name order; commas separate terms.
create or replace function public.person_search_matches(p_value text, p_search text)
returns boolean language sql immutable parallel safe set search_path = public as $$
  select not exists (
    select 1 from regexp_split_to_table(lower(coalesce(p_search, '')), '[[:space:],]+') as terms(term)
    where term <> '' and strpos(lower(coalesce(p_value, '')), term) = 0
  );
$$;

create or replace function public.payment_summary_page(
  p_search_term text default null,
  p_year_from integer default extract(year from current_date)::integer,
  p_year_to integer default extract(year from current_date)::integer,
  p_branch_ids uuid[] default null,
  p_client_ids uuid[] default null,
  p_cutoff_from date default null,
  p_cutoff_to date default null,
  p_payment_date date default null,
  p_sort_key text default 'employee',
  p_sort_direction text default 'asc',
  p_page_limit integer default 10,
  p_page_offset integer default 0
)
returns table (
  employee_id uuid, employee_number text, first_name text, middle_name text, last_name text, suffix text,
  branch_id uuid, branch_label text, client_id uuid, client_label text, first_payment date, last_payment date,
  membership_fee_centavos bigint, capital_share_centavos bigint, total_paid_centavos bigint,
  total_balance_centavos bigint, payment_status text, total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with summarized as (
    select
      e.id as employee_id, e.employee_number, e.first_name, e.middle_name, e.last_name, e.suffix,
      ea.branch_id, b.name as branch_label, ea.client_id, c.name as client_label,
      min(mp.payment_date) as first_payment, max(mp.payment_date) as last_payment,
      coalesce(sum(mp.membership_fee_centavos), 0)::bigint as membership_fee_centavos,
      coalesce(sum(mp.capital_share_centavos), 0)::bigint as capital_share_centavos,
      coalesce(sum(mp.amount_centavos), 0)::bigint as total_paid_centavos,
      greatest(0, coalesce(ps.membership_fee_centavos + ps.capital_share_target_centavos, 0) - coalesce(sum(mp.amount_centavos), 0))::bigint as total_balance_centavos,
      case when coalesce(ps.membership_fee_centavos + ps.capital_share_target_centavos, 0) > 0
        and coalesce(sum(mp.amount_centavos), 0) >= ps.membership_fee_centavos + ps.capital_share_target_centavos
        then 'Paid' else 'Unpaid' end as payment_status
    from public.employees e
    left join public.employment_assignments ea on ea.employee_id = e.id and ea.end_date is null and ea.deleted_at is null
    left join public.branches b on b.id = ea.branch_id and b.deleted_at is null
    left join public.clients c on c.id = ea.client_id and c.deleted_at is null
    left join lateral (
      select s.membership_fee_centavos, s.capital_share_target_centavos from public.payment_settings s
      where s.effective_from <= make_date(p_year_to, 12, 31)
        and (s.effective_to is null or s.effective_to >= make_date(p_year_from, 1, 1))
      order by s.effective_from desc, s.updated_at desc, s.created_at desc, s.id desc limit 1
    ) ps on true
    left join public.member_payments mp on mp.employee_id = e.id and mp.deleted_at is null
      and mp.payment_date between make_date(p_year_from, 1, 1) and make_date(p_year_to, 12, 31)
      and (
        (p_cutoff_from is null and p_cutoff_to is null and p_payment_date is null)
        or exists (
          select 1 from public.payment_batches pb
          where pb.id = mp.batch_id and pb.deleted_at is null and (
            (p_cutoff_from is not null and p_cutoff_to is not null and pb.cutoff_from = p_cutoff_from and pb.cutoff_to = p_cutoff_to)
            or (p_payment_date is not null and pb.payment_date = p_payment_date and pb.cutoff_from is null and pb.cutoff_to is null)
          )
        )
      )
    where e.deleted_at is null and e.member_id is not null and public.current_user_can_access_employee(e.id)
      and public.person_search_matches(concat_ws(' ', e.employee_number, e.first_name, e.middle_name, e.last_name, e.suffix), p_search_term)
      and (p_branch_ids is null or ea.branch_id = any(p_branch_ids))
      and (p_client_ids is null or ea.client_id = any(p_client_ids))
    group by e.id, e.employee_number, e.first_name, e.middle_name, e.last_name, e.suffix,
      ea.branch_id, b.name, ea.client_id, c.name, ps.membership_fee_centavos, ps.capital_share_target_centavos
    having (p_cutoff_from is null and p_cutoff_to is null and p_payment_date is null) or count(mp.id) > 0
  ), counted as (select summarized.*, count(*) over() as total_count from summarized)
  select * from counted
  order by
    case when p_sort_direction = 'asc' and p_sort_key in ('date', 'last') then last_payment end asc nulls last,
    case when p_sort_direction = 'desc' and p_sort_key in ('date', 'last') then last_payment end desc nulls last,
    case when p_sort_direction = 'asc' and p_sort_key = 'first' then first_payment end asc nulls last,
    case when p_sort_direction = 'desc' and p_sort_key = 'first' then first_payment end desc nulls last,
    case when p_sort_direction = 'asc' and p_sort_key = 'fee' then membership_fee_centavos end asc,
    case when p_sort_direction = 'desc' and p_sort_key = 'fee' then membership_fee_centavos end desc,
    case when p_sort_direction = 'asc' and p_sort_key = 'capital' then capital_share_centavos end asc,
    case when p_sort_direction = 'desc' and p_sort_key = 'capital' then capital_share_centavos end desc,
    case when p_sort_direction = 'asc' and p_sort_key = 'balance' then total_balance_centavos end asc,
    case when p_sort_direction = 'desc' and p_sort_key = 'balance' then total_balance_centavos end desc,
    case when p_sort_direction = 'asc' and p_sort_key = 'status' then payment_status end asc,
    case when p_sort_direction = 'desc' and p_sort_key = 'status' then payment_status end desc,
    case when p_sort_direction = 'asc' and p_sort_key = 'placement' then coalesce(client_label, branch_label, '') end asc,
    case when p_sort_direction = 'desc' and p_sort_key = 'placement' then coalesce(client_label, branch_label, '') end desc,
    case when p_sort_direction = 'desc' and p_sort_key = 'employee' then last_name end desc,
    last_name asc, first_name asc, employee_id asc
  limit p_page_limit offset greatest(p_page_offset, 0);
$$;

grant execute on function public.payment_summary_page(text, integer, integer, uuid[], uuid[], date, date, date, text, text, integer, integer) to authenticated;



-- Read-only reports: filter/count/sort/page in PostgreSQL without returning PII.
create or replace function public.reports_page(
  p_kind text default 'members', p_filters jsonb default '{}'::jsonb,
  p_limit integer default 25, p_offset integer default 0,
  p_sort text default 'name', p_direction text default 'asc', p_export boolean default false
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  source_module text := case when p_kind = 'members' then 'members' else 'employees' end;
  sort_column text;
  date_from date := nullif(p_filters->>'dateFrom', '')::date;
  date_to date := nullif(p_filters->>'dateTo', '')::date;
  result jsonb;
begin
  if auth.uid() is null or not public.current_user_has_permission('reports.view')
    or not public.current_user_has_permission(source_module || '.view') then
    raise exception 'Your effective access does not permit this report.';
  end if;
  if p_export and (not public.current_user_has_permission('reports.export')
    or not public.current_user_has_permission(source_module || '.export')) then
    raise exception 'Your effective access does not permit this export.';
  end if;
  if p_kind not in ('members','employees','deployment') then raise exception 'Unknown report.'; end if;
  if date_from > date_to then raise exception 'The end date must not precede the start date.'; end if;
  sort_column := case p_sort when 'statusId' then 'status_label' when 'typeId' then 'type_label'
    when 'number' then 'number' when 'name' then 'name' when 'branch' then 'branch'
    when 'client' then 'client' when 'department' then 'department' when 'position' then 'position'
    when 'date' then 'date' when 'approval' then 'approval' when 'attention' then 'attention'
    when 'employees' then 'employees' when 'active' then 'active' when 'direct' then 'direct'
    when 'clientDeployed' then 'clientDeployed' else null end;
  if sort_column is null or p_direction not in ('asc','desc') then raise exception 'Unknown sort column or direction.'; end if;

  execute format($query$
    with source as (
      select m.id::text as id, m.membership_number as number,
        concat(m.last_name, ', ', m.first_name, case when nullif(m.middle_name,'') is not null then ' '||m.middle_name else '' end, case when nullif(m.suffix,'') is not null then ' '||m.suffix else '' end) as name,
        coalesce(m.proposed_branch_id::text,'') as "branchId", coalesce(m.proposed_client_id::text,'') as "clientId",
        coalesce(b.name,'No placement') as branch, coalesce(c.name,'Direct employee') as client,
        coalesce(m.department_id::text,'') as department_id,
        coalesce(nullif(m.pending_department_name,''),d.name,'Not set') as department,
        coalesce(nullif(m.pending_position_name,''),pos.name,'Not set') as position,
        coalesce(m.membership_status_id::text,'') as "statusId", coalesce(m.membership_type_id::text,'') as "typeId",
        coalesce(ms.name,'Not set') as status_label, coalesce(mt.name,'Not set') as type_label,
        coalesce(m.membership_date::text,'') as date, m.bod_approval_status as approval,
        (coalesce(m.import_attention <> '{}'::jsonb,false) or nullif(m.pending_department_name,'') is not null or nullif(m.pending_position_name,'') is not null) as attention,
        1::bigint as employees, case when m.membership_status_id='31000000-0000-4000-8000-000000000001' then 1 else 0 end::bigint as active,
        case when m.proposed_client_id is null then 1 else 0 end::bigint as direct,
        case when m.proposed_client_id is not null then 1 else 0 end::bigint as "clientDeployed"
      from public.members m
      left join public.branches b on b.id=m.proposed_branch_id
      left join public.clients c on c.id=m.proposed_client_id
      left join public.departments d on d.id=m.department_id
      left join public.positions pos on pos.id=m.position_id
      left join public.member_statuses ms on ms.id=m.membership_status_id
      left join public.member_types mt on mt.id=m.membership_type_id
      where $1='members' and m.deleted_at is null
      union all
      select e.id::text, e.employee_number,
        concat(e.last_name, ', ', e.first_name, case when nullif(e.middle_name,'') is not null then ' '||e.middle_name else '' end, case when nullif(e.suffix,'') is not null then ' '||e.suffix else '' end),
        coalesce(a.branch_id::text,''), coalesce(a.client_id::text,''), coalesce(b.name,'No placement'), coalesce(c.name,'Direct employee'),
        coalesce(e.department_id::text,''), coalesce(nullif(e.pending_department_name,''),d.name,'Not set'), coalesce(nullif(e.pending_position_name,''),pos.name,'Not set'),
        coalesce(e.employment_status_id::text,''), coalesce(e.employment_type_id::text,''), coalesce(es.name,'Not set'), coalesce(et.name,'Not set'),
        coalesce(e.date_hired::text,''), '',
        (coalesce(e.import_attention <> '{}'::jsonb,false) or nullif(e.pending_department_name,'') is not null or nullif(e.pending_position_name,'') is not null),
        1::bigint, case when e.employment_status_id='33000000-0000-4000-8000-000000000001' then 1 else 0 end::bigint,
        case when a.client_id is null then 1 else 0 end::bigint, case when a.client_id is not null then 1 else 0 end::bigint
      from public.employees e
      left join lateral (select branch_id,client_id from public.employment_assignments where employee_id=e.id and end_date is null and deleted_at is null order by start_date desc,id limit 1) a on true
      left join public.branches b on b.id=a.branch_id
      left join public.clients c on c.id=a.client_id
      left join public.departments d on d.id=e.department_id
      left join public.positions pos on pos.id=e.position_id
      left join public.employment_statuses es on es.id=e.employment_status_id
      left join public.employment_types et on et.id=e.employment_type_id
      where $1 in ('employees','deployment') and e.deleted_at is null
    ), filtered as (
      select * from source s where
        public.person_search_matches(concat_ws(' ',number,name,branch,client,department,position), $2->>'search')
        and (coalesce($2->>'branchId','')='' or "branchId"=$2->>'branchId')
        and (coalesce($2->>'clientId','')='' or "clientId"=$2->>'clientId')
        and (coalesce($2->>'statusId','')='' or "statusId"=$2->>'statusId')
        and (coalesce($2->>'typeId','')='' or "typeId"=$2->>'typeId')
        and (coalesce($2->>'departmentId','')='' or department_id=$2->>'departmentId')
        and (coalesce($2->>'approval','')='' or approval=$2->>'approval')
        and (not coalesce(($2->>'attentionOnly')::boolean,false) or attention)
        and ($3 is null or nullif(date,'')::date >= $3) and ($4 is null or nullif(date,'')::date <= $4)
    ), output as (
      select * from filtered where $1<>'deployment'
      union all
      select "branchId"||':'||"clientId",'','',"branchId","clientId",branch,client,
        '', '', '', '', '', '', '', '', '',
        bool_or(attention),sum(employees),sum(active),sum(direct),sum("clientDeployed")
      from filtered where $1='deployment' group by "branchId","clientId",branch,client
    ), paged as (
      select *, row_number() over(order by %I %s,id asc) as ordinal from output order by %I %s,id asc limit $5 offset $6
    ) select jsonb_build_object(
      'items',coalesce((select jsonb_agg(to_jsonb(p)-'ordinal'-'department_id'-'status_label'-'type_label' order by ordinal) from paged p),'[]'::jsonb),
      'total',(select count(*) from output),'records',(select count(*) from filtered),
      'active',coalesce((select sum(active) from filtered),0),
      'pending',(select count(*) from filtered where approval='pending'),
      'attention',(select count(*) from filtered where attention)
    )
  $query$, sort_column,p_direction,sort_column,p_direction)
  into result using p_kind,p_filters,date_from,date_to,least(500,greatest(1,p_limit)),greatest(0,p_offset);
  return result;
end;
$$;

revoke all on function public.reports_page(text,jsonb,integer,integer,text,text,boolean) from public;
grant execute on function public.reports_page(text,jsonb,integer,integer,text,text,boolean) to authenticated;
