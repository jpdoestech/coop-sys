pragma foreign_keys = on;

create table roles (
  id text primary key,
  code text not null unique,
  name text not null,
  description text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table users (
  id text primary key,
  email text not null unique,
  display_name text not null,
  password_hash text,
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text
);

create table user_roles (
  user_id text not null references users(id) on delete cascade,
  role_id text not null references roles(id) on delete cascade,
  created_at text not null default (datetime('now')),
  primary key (user_id, role_id)
);

create table departments (
  id text primary key,
  code text not null unique,
  name text not null unique,
  description text,
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict'))
);

create table positions (
  id text primary key,
  department_id text references departments(id) on delete set null,
  code text not null unique,
  name text not null,
  description text,
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict'))
);

create table member_types (id text primary key, code text not null unique, name text not null unique, is_active integer not null default 1);
create table member_statuses (id text primary key, code text not null unique, name text not null unique, is_active integer not null default 1);
create table employment_types (id text primary key, code text not null unique, name text not null unique, is_active integer not null default 1);
create table employment_statuses (id text primary key, code text not null unique, name text not null unique, is_active integer not null default 1);

create table members (
  id text primary key,
  membership_number text not null unique,
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
  membership_date text,
  membership_status_id text references member_statuses(id) on delete set null,
  membership_type_id text references member_types(id) on delete set null,
  member_category text,
  termination_date text,
  termination_reason text,
  emergency_contact text,
  notes text,
  profile_photo_ref text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict'))
);

create table employees (
  id text primary key,
  employee_number text not null unique,
  member_id text unique references members(id) on delete set null,
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
  supervisor_id text references employees(id) on delete set null,
  work_location text,
  notes text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict'))
);

create table document_types (id text primary key, code text not null unique, name text not null unique, is_required integer not null default 0, is_active integer not null default 1);

create table employee_documents (
  id text primary key,
  employee_id text not null references employees(id) on delete cascade,
  document_type_id text references document_types(id) on delete set null,
  file_name text not null,
  storage_ref text not null,
  mime_type text,
  file_size_bytes integer,
  notes text,
  uploaded_by text references users(id) on delete set null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text,
  sync_status text not null default 'synced' check (sync_status in ('synced','pending_create','pending_update','pending_delete','conflict'))
);

create table audit_logs (
  id text primary key,
  actor_user_id text references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data text,
  after_data text,
  created_at text not null default (datetime('now'))
);

create table sync_queue (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('create','update','delete')),
  payload text,
  attempt_count integer not null default 0,
  last_error text,
  queued_at text not null default (datetime('now')),
  processed_at text
);

create table sync_conflicts (
  id text primary key,
  sync_queue_id text references sync_queue(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  local_data text not null,
  remote_data text not null,
  resolution text,
  resolved_by text references users(id) on delete set null,
  created_at text not null default (datetime('now')),
  resolved_at text
);

create table sync_logs (
  id text primary key,
  direction text not null check (direction in ('push','pull')),
  status text not null check (status in ('started','completed','failed')),
  records_processed integer not null default 0,
  message text,
  started_at text not null default (datetime('now')),
  completed_at text
);

create table system_settings (
  key text primary key,
  value text not null,
  description text,
  updated_by text references users(id) on delete set null,
  updated_at text not null default (datetime('now'))
);

create index members_name_idx on members(last_name, first_name);
create index members_status_idx on members(membership_status_id, deleted_at);
create index employees_name_idx on employees(last_name, first_name);
create index employees_department_idx on employees(department_id, deleted_at);
create index employees_position_idx on employees(position_id, deleted_at);
create index employee_documents_employee_idx on employee_documents(employee_id);
create index audit_logs_entity_idx on audit_logs(entity_type, entity_id, created_at);
create index sync_queue_pending_idx on sync_queue(processed_at, queued_at);
