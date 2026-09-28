update members
set membership_number = printf('%06d', cast(substr(membership_number, -6) as integer));

update employees
set employee_number = coalesce(
  (select membership_number from members where members.id = employees.member_id),
  printf('%06d', cast(substr(employee_number, -6) as integer))
);

create trigger members_six_digit_number_insert
before insert on members
when length(new.membership_number) <> 6 or new.membership_number not glob '[0-9][0-9][0-9][0-9][0-9][0-9]'
begin select raise(abort, 'Membership number must contain exactly six digits.'); end;

create trigger members_six_digit_number_update
before update of membership_number on members
when length(new.membership_number) <> 6 or new.membership_number not glob '[0-9][0-9][0-9][0-9][0-9][0-9]'
begin select raise(abort, 'Membership number must contain exactly six digits.'); end;

create trigger employees_six_digit_number_insert
before insert on employees
when length(new.employee_number) <> 6 or new.employee_number not glob '[0-9][0-9][0-9][0-9][0-9][0-9]'
begin select raise(abort, 'Employee number must contain exactly six digits.'); end;

create trigger employees_six_digit_number_update
before update of employee_number on employees
when length(new.employee_number) <> 6 or new.employee_number not glob '[0-9][0-9][0-9][0-9][0-9][0-9]'
begin select raise(abort, 'Employee number must contain exactly six digits.'); end;

create trigger employees_shared_person_number_insert
after insert on employees when new.member_id is not null
begin
  update employees set employee_number = (select membership_number from members where id = new.member_id) where id = new.id;
end;

create trigger employees_shared_person_number_update
after update of member_id on employees when new.member_id is not null
begin
  update employees set employee_number = (select membership_number from members where id = new.member_id) where id = new.id;
end;

create trigger members_shared_person_number_update
after update of membership_number on members
begin
  update employees set employee_number = new.membership_number where member_id = new.id;
end;

update beneficiaries
set member_id = (select member_id from employees where employees.id = beneficiaries.employee_id),
    employee_id = null,
    updated_at = datetime('now')
where employee_id in (select id from employees where member_id is not null);
