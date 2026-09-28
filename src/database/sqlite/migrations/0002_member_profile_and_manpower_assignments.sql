pragma foreign_keys = on;

alter table members add column tax_identification_number text;
alter table members add column acceptance_resolution_number text;
alter table members add column highest_educational_attainment text;
alter table members add column occupation_income_source text;
alter table members add column annual_income real;
alter table members add column number_of_dependents integer;
alter table members add column beneficiary_name text;
alter table members add column religion_affiliation text;

create table branches (
  id text primary key,
  code text not null unique,
  name text not null,
  address text,
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict'))
);

create table clients (
  id text primary key,
  code text not null unique,
  name text not null,
  address text,
  contact_person text,
  contact_details text,
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict'))
);

create table employment_assignments (
  id text primary key,
  employee_id text not null references employees(id) on delete cascade,
  branch_id text references branches(id) on delete set null,
  client_id text references clients(id) on delete set null,
  assignment_code text,
  start_date text not null,
  end_date text,
  work_location text,
  notes text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict')),
  check (end_date is null or end_date >= start_date)
);

create unique index employment_assignments_one_active_idx
  on employment_assignments(employee_id)
  where end_date is null and deleted_at is null;
create index employment_assignments_client_idx on employment_assignments(client_id, start_date);
create index employment_assignments_branch_idx on employment_assignments(branch_id, start_date);
