create or replace function public.reports_amounts_page(
  p_filters jsonb default '{}'::jsonb, p_limit integer default 25, p_offset integer default 0,
  p_sort text default 'branch', p_direction text default 'asc', p_export boolean default false
)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  date_from date := nullif(p_filters->>'dateFrom', '')::date;
  date_to date := nullif(p_filters->>'dateTo', '')::date;
  as_of date := coalesce(date_to, (now() at time zone 'Asia/Manila')::date);
  result jsonb;
begin
  if auth.uid() is null or not public.current_user_has_permission('reports.view')
    or not public.current_user_has_permission('members.view')
    or not public.current_user_has_permission('employees.view')
    or not public.current_user_has_permission('payments.view') then
    raise exception 'Your effective access does not permit payment reports.';
  end if;
  if p_export and (not public.current_user_has_permission('reports.export')
    or not public.current_user_has_permission('members.export')
    or not public.current_user_has_permission('payments.export')) then
    raise exception 'Your effective access does not permit this export.';
  end if;
  if date_from > date_to then raise exception 'The end date must not precede the start date.'; end if;
  if coalesce(p_filters->>'paymentStatus', '') not in ('', 'paid', 'unpaid') then raise exception 'Unknown payment status.'; end if;
  if p_sort not in ('branch', 'client', 'members', 'paid', 'unpaid', 'amountCentavos', 'paidAmountCentavos', 'unpaidAmountCentavos', 'balanceCentavos')
    or p_direction not in ('asc', 'desc') then raise exception 'Unknown sort column or direction.'; end if;

  execute format($query$
    with target as (
      select coalesce((select membership_fee_centavos + capital_share_target_centavos
        from public.payment_settings where effective_from <= $4 and (effective_to is null or effective_to >= $4)
        order by effective_from desc, updated_at desc, created_at desc, id desc limit 1), 550000)::bigint as amount,
      coalesce((select membership_fee_centavos from public.payment_settings where effective_from <= $4 and (effective_to is null or effective_to >= $4) order by effective_from desc, updated_at desc, created_at desc, id desc limit 1), 50000)::bigint as fee
    ), payments as (
      select member_id, sum(amount_centavos)::bigint as amount, sum(membership_fee_centavos)::bigint as fee, sum(capital_share_centavos)::bigint as capital
      from public.member_payments
      where deleted_at is null and ($2 is null or payment_date >= $2) and ($3 is null or payment_date <= $3)
      group by member_id
    ), refunds as (
      select member_id, sum(amount_centavos)::bigint as amount from public.over_deduction_refunds
      where deleted_at is null and ($2 is null or refund_date >= $2) and ($3 is null or refund_date <= $3) group by member_id
    ), source as (
      select m.id,
        coalesce(case when e.id is not null then a.branch_id else m.proposed_branch_id end::text, '') as "branchId",
        coalesce(case when e.id is not null then a.client_id else m.proposed_client_id end::text, '') as "clientId",
        coalesce(b.name, 'No placement') as branch, coalesce(c.name, 'Direct members') as client,
        coalesce(payments.amount, 0)::bigint as "amountCentavos",
        (target.amount > 0 and coalesce(payments.amount, 0) - coalesce(refunds.amount, 0) >= target.amount)::integer as paid,
        greatest(0, target.amount - (coalesce(payments.amount, 0) - coalesce(refunds.amount, 0)))::bigint as "balanceCentavos",
        coalesce(payments.fee, 0)::bigint as "membershipFeeCentavos",
        coalesce(payments.capital, 0)::bigint as "capitalShareCentavos",
        coalesce(refunds.amount, 0)::bigint as "refundCentavos",
        greatest(0, coalesce(payments.amount, 0) - coalesce(refunds.amount, 0) - target.fee)::bigint as "retainedCapitalShareCentavos",
        greatest(0, coalesce(payments.amount, 0) - coalesce(refunds.amount, 0) - target.amount)::bigint as "overpaidCentavos",
        concat_ws(' ', m.membership_number, m.first_name, m.middle_name, m.last_name, m.suffix, b.name, c.name) as search_text
      from public.members m
      left join lateral (select id from public.employees where member_id=m.id and deleted_at is null order by id limit 1) e on true
      left join lateral (select branch_id, client_id from public.employment_assignments where employee_id=e.id and end_date is null and deleted_at is null order by start_date desc,id limit 1) a on true
      left join public.branches b on b.id=case when e.id is not null then a.branch_id else m.proposed_branch_id end
      left join public.clients c on c.id=case when e.id is not null then a.client_id else m.proposed_client_id end
      left join payments on payments.member_id=m.id
      left join refunds on refunds.member_id=m.id
      cross join target
      where m.deleted_at is null
    ), filtered as (
      select * from source where
        public.person_search_matches(search_text, $1->>'search')
        and (coalesce($1->>'branchId','')='' or "branchId"=$1->>'branchId')
        and (coalesce($1->>'clientId','')='' or "clientId"=$1->>'clientId')
        and (coalesce($1->>'paymentStatus','')='' or $1->>'paymentStatus'=case when paid=1 then 'paid' else 'unpaid' end)
    ), grouped as (
      select "branchId", branch,
        case when grouping("clientId")=1 then '' else "clientId" end as "clientId",
        case when grouping("clientId")=1 then 'Branch total' else client end as client,
        case when grouping("clientId")=1 then 'branch' else 'client' end as level,
        count(*)::bigint as members, sum(paid)::bigint as paid, (count(*)-sum(paid))::bigint as unpaid,
        sum("amountCentavos")::bigint as "amountCentavos",
        sum("membershipFeeCentavos")::bigint as "membershipFeeCentavos",
        sum("capitalShareCentavos")::bigint as "capitalShareCentavos",
        sum("refundCentavos")::bigint as "refundCentavos",
        sum("retainedCapitalShareCentavos")::bigint as "retainedCapitalShareCentavos",
        sum("overpaidCentavos")::bigint as "overpaidCentavos",
        sum(case when paid=1 then "amountCentavos" else 0 end)::bigint as "paidAmountCentavos",
        sum(case when paid=0 then "amountCentavos" else 0 end)::bigint as "unpaidAmountCentavos",
        sum("balanceCentavos")::bigint as "balanceCentavos"
      from filtered group by grouping sets (("branchId",branch), ("branchId",branch,"clientId",client))
    ), output as (
      select level||':'||"branchId"||case when level='client' then ':'||"clientId" else '' end as id,
        *, '' as number, '' as name, '' as department, '' as position, '' as "statusId", '' as "typeId", '' as date, '' as approval,
        false as attention, 0 as employees, 0 as active, 0 as direct, 0 as "clientDeployed" from grouped
    ), paged as (
      select *, row_number() over(order by %I %s,level asc,client asc,id asc) as ordinal
      from output order by %I %s,level asc,client asc,id asc limit $5 offset $6
    ) select jsonb_build_object(
      'items',coalesce((select jsonb_agg(to_jsonb(p)-'ordinal' order by ordinal) from paged p),'[]'::jsonb),
      'total',(select count(*) from output), 'records',(select count(*) from filtered),
      'paid',coalesce((select sum(paid) from filtered),0), 'unpaid',(select count(*)-coalesce(sum(paid),0) from filtered),
      'amountCentavos',coalesce((select sum("amountCentavos") from filtered),0),
      'balanceCentavos',coalesce((select sum("balanceCentavos") from filtered),0),
      'active',0,'pending',0,'attention',0
    )
  $query$, p_sort,p_direction,p_sort,p_direction)
  into result using p_filters,date_from,date_to,as_of,least(500,greatest(1,p_limit)),greatest(0,p_offset);
  return result;
end;
$$;

revoke all on function public.reports_amounts_page(jsonb,integer,integer,text,text,boolean) from public;
grant execute on function public.reports_amounts_page(jsonb,integer,integer,text,text,boolean) to authenticated;
