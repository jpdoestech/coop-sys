with ranked as (
  select
    id,
    row_number() over (
      partition by effective_from
      order by updated_at desc, created_at desc, id desc
    ) as position
  from public.payment_settings
)
delete from public.payment_settings settings
using ranked
where settings.id = ranked.id and ranked.position > 1;

create unique index if not exists payment_settings_effective_from_unique
  on public.payment_settings(effective_from);

create or replace function public.save_payment_settings(
  p_membership_fee_centavos bigint,
  p_capital_share_target_centavos bigint,
  p_effective_from date
)
returns public.payment_settings
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.payment_settings;
begin
  if not public.current_user_has_role(array['super_admin']) then
    raise exception 'Only Super Admin can change payment settings.';
  end if;

  insert into public.payment_settings (
    membership_fee_centavos,
    capital_share_target_centavos,
    effective_from,
    effective_to,
    is_active,
    updated_at
  ) values (
    p_membership_fee_centavos,
    p_capital_share_target_centavos,
    p_effective_from,
    null,
    true,
    now()
  )
  on conflict (effective_from) do update set
    membership_fee_centavos = excluded.membership_fee_centavos,
    capital_share_target_centavos = excluded.capital_share_target_centavos,
    updated_at = now()
  returning * into saved;

  with periods as (
    select
      id,
      lead(effective_from) over (order by effective_from) - 1 as effective_to,
      lead(effective_from) over (order by effective_from) is null as is_active
    from public.payment_settings
  )
  update public.payment_settings settings set
    effective_to = periods.effective_to,
    is_active = periods.is_active
  from periods
  where settings.id = periods.id;

  select * into saved from public.payment_settings where id = saved.id;
  return saved;
end;
$$;

grant execute on function public.save_payment_settings(bigint, bigint, date)
  to authenticated;

with periods as (
  select
    id,
    lead(effective_from) over (order by effective_from) - 1 as effective_to,
    lead(effective_from) over (order by effective_from) is null as is_active
  from public.payment_settings
)
update public.payment_settings settings set
  effective_to = periods.effective_to,
  is_active = periods.is_active
from periods
where settings.id = periods.id;

