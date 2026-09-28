alter table members add column acceptance_date text;
alter table members add column bod_approval_status text not null default 'pending'
  check (bod_approval_status in ('pending', 'approved'));

update members
set acceptance_resolution_number = case
      when instr(acceptance_resolution_number, '-') > 0
        then printf('%06d', cast(substr(acceptance_resolution_number, -4) as integer))
      else printf('%06d', cast(acceptance_resolution_number as integer))
    end,
    acceptance_date = coalesce(membership_date, date('now')),
    bod_approval_status = 'approved'
where nullif(trim(acceptance_resolution_number), '') is not null;

create trigger members_bod_approval_complete_insert
before insert on members
when new.bod_approval_status = 'approved' and (
  new.acceptance_date is null or new.acceptance_resolution_number is null or
  length(new.acceptance_resolution_number) <> 6 or
  new.acceptance_resolution_number not glob '[0-9][0-9][0-9][0-9][0-9][0-9]'
)
begin select raise(abort, 'Approved memberships require a date and six-digit BOD resolution number.'); end;

create trigger members_bod_approval_complete_update
before update of bod_approval_status, acceptance_date, acceptance_resolution_number on members
when new.bod_approval_status = 'approved' and (
  new.acceptance_date is null or new.acceptance_resolution_number is null or
  length(new.acceptance_resolution_number) <> 6 or
  new.acceptance_resolution_number not glob '[0-9][0-9][0-9][0-9][0-9][0-9]'
)
begin select raise(abort, 'Approved memberships require a date and six-digit BOD resolution number.'); end;
