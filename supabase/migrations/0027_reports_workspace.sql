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
        (coalesce($2->>'search','')='' or strpos(lower(concat_ws(' ',number,name,branch,client,department,position)),lower(trim($2->>'search')))>0)
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
