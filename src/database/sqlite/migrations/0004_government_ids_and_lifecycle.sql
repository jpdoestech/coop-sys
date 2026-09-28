pragma foreign_keys = off;

create table employees_rebuilt (
  id text primary key,
  employee_number text not null unique,
  member_id text references members(id) on delete set null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix text,
  date_of_birth text,
  sex text,
  civil_status text,
  mobile_number text,
  email text,
  address text,
  barangay text,
  city_municipality text,
  province text,
  postal_code text,
  employment_status_id text references employment_statuses(id) on delete set null,
  employment_type_id text references employment_types(id) on delete set null,
  date_hired text,
  date_regularized text,
  date_separated text,
  position_id text references positions(id) on delete set null,
  department_id text references departments(id) on delete set null,
  supervisor_id text references employees_rebuilt(id) on delete set null,
  work_location text,
  notes text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict')),
  religion_affiliation_id text references religion_affiliations(id) on delete set null,
  sss_number text,
  pagibig_number text,
  philhealth_number text,
  tax_identification_number text
);

insert into employees_rebuilt (
  id, employee_number, member_id, first_name, middle_name, last_name, suffix,
  date_of_birth, sex, civil_status, mobile_number, email, address, barangay,
  city_municipality, province, postal_code, employment_status_id,
  employment_type_id, date_hired, date_regularized, date_separated, position_id,
  department_id, supervisor_id, work_location, notes, created_at, updated_at,
  deleted_at, sync_status, religion_affiliation_id
)
select
  id, employee_number, member_id, first_name, middle_name, last_name, suffix,
  date_of_birth, sex, civil_status, mobile_number, email, address, barangay,
  city_municipality, province, postal_code, employment_status_id,
  employment_type_id, date_hired, date_regularized, date_separated, position_id,
  department_id, supervisor_id, work_location, notes, created_at, updated_at,
  deleted_at, sync_status, religion_affiliation_id
from employees;

drop table employees;
alter table employees_rebuilt rename to employees;

create index employees_name_idx on employees(last_name, first_name);
create index employees_department_idx on employees(department_id, deleted_at);
create index employees_position_idx on employees(position_id, deleted_at);
create index employees_member_id_idx on employees(member_id);

alter table members add column sss_number text;
alter table members add column pagibig_number text;
alter table members add column philhealth_number text;

insert or ignore into member_statuses (id, code, name, is_active) values
  ('31000000-0000-4000-8000-000000000004', 'resigned', 'Resigned', 1);

insert or ignore into employment_statuses (id, code, name, is_active) values
  ('33000000-0000-4000-8000-000000000006', 'resigned', 'Resigned', 1),
  ('33000000-0000-4000-8000-000000000007', 'terminated', 'Terminated', 1);

pragma foreign_keys = on;

