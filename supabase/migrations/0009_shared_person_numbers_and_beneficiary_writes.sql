update public.members
set membership_number = lpad(right(regexp_replace(membership_number, '\D', '', 'g'), 6), 6, '0');

update public.employees employee
set employee_number = coalesce(
  (select member.membership_number from public.members member where member.id = employee.member_id),
  lpad(right(regexp_replace(employee.employee_number, '\D', '', 'g'), 6), 6, '0')
);

alter table public.members
  add constraint members_six_digit_number check (membership_number ~ '^\d{6}$');
alter table public.employees
  add constraint employees_six_digit_number check (employee_number ~ '^\d{6}$');

create function public.use_shared_person_number()
returns trigger language plpgsql as $$
begin
  if new.member_id is not null then
    select membership_number into new.employee_number
    from public.members where id = new.member_id;
  end if;
  return new;
end;
$$;

create trigger employees_shared_person_number
before insert or update of member_id, employee_number on public.employees
for each row execute function public.use_shared_person_number();

create function public.sync_shared_person_number()
returns trigger language plpgsql as $$
begin
  if new.membership_number is distinct from old.membership_number then
    update public.employees set employee_number = new.membership_number where member_id = new.id;
  end if;
  return new;
end;
$$;

create trigger members_shared_person_number
after update of membership_number on public.members
for each row execute function public.sync_shared_person_number();

update public.beneficiaries beneficiary
set member_id = employee.member_id,
    employee_id = null,
    updated_at = now()
from public.employees employee
where beneficiary.employee_id = employee.id
  and employee.member_id is not null;

create policy "authenticated users can insert beneficiaries"
  on public.beneficiaries for insert to authenticated with check (true);
create policy "authenticated users can update beneficiaries"
  on public.beneficiaries for update to authenticated using (true) with check (true);
create policy "authenticated users can delete beneficiaries"
  on public.beneficiaries for delete to authenticated using (true);
