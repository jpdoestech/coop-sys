create index if not exists member_payments_employee_date_idx
  on public.member_payments(employee_id, payment_date desc)
  where deleted_at is null;

create or replace function public.payment_summary_page(
  p_search_term text default null,
  p_year_from integer default extract(year from current_date)::integer,
  p_year_to integer default extract(year from current_date)::integer,
  p_branch_ids uuid[] default null,
  p_client_ids uuid[] default null,
  p_sort_key text default 'employee',
  p_sort_direction text default 'asc',
  p_page_limit integer default 10,
  p_page_offset integer default 0
)
returns table (
  employee_id uuid,
  employee_number text,
  first_name text,
  middle_name text,
  last_name text,
  suffix text,
  branch_id uuid,
  branch_label text,
  client_id uuid,
  client_label text,
  first_payment date,
  last_payment date,
  membership_fee_centavos bigint,
  capital_share_centavos bigint,
  total_paid_centavos bigint,
  total_balance_centavos bigint,
  payment_status text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with summarized as (
    select
      e.id as employee_id,
      e.employee_number,
      e.first_name,
      e.middle_name,
      e.last_name,
      e.suffix,
      ea.branch_id,
      b.name as branch_label,
      ea.client_id,
      c.name as client_label,
      min(mp.payment_date) as first_payment,
      max(mp.payment_date) as last_payment,
      coalesce(sum(mp.membership_fee_centavos), 0)::bigint as membership_fee_centavos,
      coalesce(sum(mp.capital_share_centavos), 0)::bigint as capital_share_centavos,
      coalesce(sum(mp.amount_centavos), 0)::bigint as total_paid_centavos,
      greatest(
        0,
        coalesce(ps.membership_fee_centavos + ps.capital_share_target_centavos, 0)
          - coalesce(sum(mp.amount_centavos), 0)
      )::bigint as total_balance_centavos,
      case
        when coalesce(ps.membership_fee_centavos + ps.capital_share_target_centavos, 0) > 0
          and coalesce(sum(mp.amount_centavos), 0) >= ps.membership_fee_centavos + ps.capital_share_target_centavos
        then 'Paid'
        else 'Unpaid'
      end as payment_status
    from public.employees e
    left join public.employment_assignments ea
      on ea.employee_id = e.id and ea.end_date is null and ea.deleted_at is null
    left join public.branches b on b.id = ea.branch_id and b.deleted_at is null
    left join public.clients c on c.id = ea.client_id and c.deleted_at is null
    left join lateral (
      select s.membership_fee_centavos, s.capital_share_target_centavos
      from public.payment_settings s
      where s.effective_from <= make_date(p_year_to, 12, 31)
        and (s.effective_to is null or s.effective_to >= make_date(p_year_from, 1, 1))
      order by s.effective_from desc
      limit 1
    ) ps on true
    left join public.member_payments mp
      on mp.employee_id = e.id
      and mp.deleted_at is null
      and mp.payment_date between make_date(p_year_from, 1, 1) and make_date(p_year_to, 12, 31)
    where e.deleted_at is null
      and e.member_id is not null
      and public.current_user_can_access_employee(e.id)
      and (
        p_search_term is null
        or concat_ws(' ', e.employee_number, e.first_name, e.middle_name, e.last_name, e.suffix)
          ilike '%' || trim(p_search_term) || '%'
      )
      and (p_branch_ids is null or ea.branch_id = any(p_branch_ids))
      and (p_client_ids is null or ea.client_id = any(p_client_ids))
    group by
      e.id, e.employee_number, e.first_name, e.middle_name, e.last_name, e.suffix,
      ea.branch_id, b.name, ea.client_id, c.name,
      ps.membership_fee_centavos, ps.capital_share_target_centavos
  ), counted as (
    select summarized.*, count(*) over() as total_count
    from summarized
  )
  select *
  from counted
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
    last_name asc,
    first_name asc,
    employee_id asc
  limit p_page_limit
  offset greatest(p_page_offset, 0);
$$;

grant execute on function public.payment_summary_page(text, integer, integer, uuid[], uuid[], text, text, integer, integer)
  to authenticated;
