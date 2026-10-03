alter table public.members
  add column acceptance_date date,
  add column bod_approval_status text not null default 'pending'
    check (bod_approval_status in ('pending', 'approved'));

update public.members
set acceptance_resolution_number = lpad(right(coalesce(substring(acceptance_resolution_number from '([0-9]+)$'), ''), 6), 6, '0'),
    acceptance_date = coalesce(membership_date, current_date),
    bod_approval_status = 'approved'
where nullif(trim(acceptance_resolution_number), '') is not null;

alter table public.members
  add constraint members_bod_approval_complete check (
    bod_approval_status = 'pending' or (
      acceptance_date is not null and
      acceptance_resolution_number ~ '^\d{6}$'
    )
  );
