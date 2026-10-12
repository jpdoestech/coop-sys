-- Refund-aware summaries and serialized over-deduction refund validation.
drop function if exists public.payment_summary_page(text, integer, integer, uuid[], uuid[], date, date, date, text, text, integer, integer);

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
  p_page_limit integer default 25,
  p_page_offset integer default 0,
  p_status text default null
)
returns table (
  employee_id uuid, employee_number text, first_name text, middle_name text, last_name text, suffix text,
  branch_id uuid, branch_label text, client_id uuid, client_label text, first_payment date, last_payment date,
  membership_fee_centavos bigint, capital_share_centavos bigint, total_paid_centavos bigint,
  total_balance_centavos bigint, payment_status text, refund_centavos bigint, net_paid_centavos bigint, overpaid_centavos bigint, retained_capital_share_centavos bigint, total_count bigint, overpaid_count bigint
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
      greatest(0, coalesce(ps.membership_fee_centavos + ps.capital_share_target_centavos, 0) - (coalesce(sum(mp.amount_centavos), 0) - coalesce(r.amount, 0)))::bigint as total_balance_centavos,
      case when coalesce(ps.membership_fee_centavos + ps.capital_share_target_centavos, 0) > 0
        and coalesce(sum(mp.amount_centavos), 0) - coalesce(r.amount, 0) > ps.membership_fee_centavos + ps.capital_share_target_centavos then 'Overpaid'
        when coalesce(ps.membership_fee_centavos + ps.capital_share_target_centavos, 0) > 0
        and coalesce(sum(mp.amount_centavos), 0) - coalesce(r.amount, 0) = ps.membership_fee_centavos + ps.capital_share_target_centavos then 'Paid' else 'Unpaid' end as payment_status,
      coalesce(r.amount, 0)::bigint as refund_centavos,
      (coalesce(sum(mp.amount_centavos), 0) - coalesce(r.amount, 0))::bigint as net_paid_centavos,
      case when ps.membership_fee_centavos is null then 0 else greatest(0, coalesce(sum(mp.amount_centavos), 0) - coalesce(r.amount, 0) - ps.membership_fee_centavos - ps.capital_share_target_centavos) end::bigint as overpaid_centavos,
      greatest(0, coalesce(sum(mp.amount_centavos), 0) - coalesce(r.amount, 0) - coalesce(ps.membership_fee_centavos, 0))::bigint as retained_capital_share_centavos
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
    left join lateral (
      select sum(od.amount_centavos) as amount from public.over_deduction_refunds od
      where od.employee_id = e.id and od.deleted_at is null
        and od.refund_date between make_date(p_year_from, 1, 1) and make_date(p_year_to, 12, 31)
        and ((p_cutoff_from is null and p_cutoff_to is null and p_payment_date is null)
          or (p_cutoff_from is not null and p_cutoff_to is not null and od.cutoff_from = p_cutoff_from and od.cutoff_to = p_cutoff_to)
          or (p_payment_date is not null and od.refund_date = p_payment_date and od.cutoff_from is null and od.cutoff_to is null))
    ) r on true
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
      ea.branch_id, b.name, ea.client_id, c.name, ps.membership_fee_centavos, ps.capital_share_target_centavos, r.amount
    having (p_cutoff_from is null and p_cutoff_to is null and p_payment_date is null) or count(mp.id) > 0
  ), counted as (select summarized.*, count(*) over() as total_count, (select count(*) from summarized where payment_status = 'Overpaid') as overpaid_count from summarized where p_status is null or payment_status = p_status)
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

revoke all on function public.payment_summary_page(text, integer, integer, uuid[], uuid[], date, date, date, text, text, integer, integer, text) from public;
grant execute on function public.payment_summary_page(text, integer, integer, uuid[], uuid[], date, date, date, text, text, integer, integer, text) to authenticated;

create index if not exists over_deduction_refunds_employee_idx on public.over_deduction_refunds(employee_id, refund_date) where deleted_at is null;

create or replace function public.validate_over_deduction_refund()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  required_amount bigint;
  paid_amount bigint;
  refunded_amount bigint;
  linked_member uuid;
begin
  if new.deleted_at is not null then return new; end if;
  -- Serialize refund writes without requiring employee-update permission.
  perform pg_advisory_xact_lock(hashtextextended(new.employee_id::text, 0));
  select member_id into linked_member from public.employees where id = new.employee_id;
  if linked_member is null or linked_member <> new.member_id then raise exception 'Select a linked member/employee.'; end if;
  if exists (select 1 from public.final_pay_settlements where employee_id = new.employee_id and deleted_at is null) then
    raise exception 'This employee already has a final-pay settlement.';
  end if;
  if new.amount_centavos <= 0 then raise exception 'Refund amount must be greater than zero.'; end if;
  if (new.cutoff_from is null) <> (new.cutoff_to is null) or new.cutoff_from > new.cutoff_to then
    raise exception 'Enter both valid refund cut-off dates, or leave both blank.';
  end if;
  select membership_fee_centavos + capital_share_target_centavos into required_amount
    from public.payment_settings where effective_from <= new.refund_date and (effective_to is null or effective_to >= new.refund_date)
    order by effective_from desc, updated_at desc, created_at desc, id desc limit 1;
  if required_amount is null then raise exception 'No payment settings apply to the refund date.'; end if;
  select coalesce(sum(amount_centavos),0) into paid_amount from public.member_payments
    where employee_id = new.employee_id and deleted_at is null and payment_date <= new.refund_date;
  select coalesce(sum(amount_centavos),0) into refunded_amount from public.over_deduction_refunds
    where employee_id = new.employee_id and deleted_at is null and id <> new.id;
  if new.amount_centavos > greatest(0, paid_amount - refunded_amount - required_amount) then
    raise exception 'Refund cannot exceed the remaining overpayment.';
  end if;
  return new;
end;
$$;

create trigger validate_over_deduction_refund before insert or update on public.over_deduction_refunds
for each row execute function public.validate_over_deduction_refund();

