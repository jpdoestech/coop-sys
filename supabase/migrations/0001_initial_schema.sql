create extension if not exists pgcrypto;

create type public.sync_status as enum (
  'synced',
  'pending_create',
  'pending_update',
  'pending_delete',
  'conflict'
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create table public.member_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true
);

create table public.member_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true
);

create table public.employment_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true
);

create table public.employment_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  membership_number text not null unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix text,
  date_of_birth date,
  sex text,
  civil_status text,
  mobile_number text,
  email text,
  address text,
  barangay text,
  city_municipality text,
  province text,
  postal_code text,
  membership_date date,
  membership_status_id uuid references public.member_statuses(id) on delete set null,
  membership_type_id uuid references public.member_types(id) on delete set null,
  member_category text,
  termination_date date,
  termination_reason text,
  emergency_contact text,
  notes text,
  profile_photo_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  member_id uuid unique references public.members(id) on delete set null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  suffix text,
  date_of_birth date,
  sex text,
  civil_status text,
  mobile_number text,
  email text,
  address text,
  barangay text,
  city_municipality text,
  province text,
  postal_code text,
  employment_status_id uuid references public.employment_statuses(id) on delete set null,
  employment_type_id uuid references public.employment_types(id) on delete set null,
  date_hired date,
  date_regularized date,
  date_separated date,
  position_id uuid references public.positions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  supervisor_id uuid references public.employees(id) on delete set null,
  work_location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_required boolean not null default false,
  is_active boolean not null default true
);

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  document_type_id uuid references public.document_types(id) on delete set null,
  file_name text not null,
  storage_ref text not null,
  mime_type text,
  file_size_bytes bigint,
  notes text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('create', 'update', 'delete')),
  payload jsonb,
  attempt_count integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  sync_queue_id uuid references public.sync_queue(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  local_data jsonb not null,
  remote_data jsonb not null,
  resolution text,
  resolved_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('push', 'pull')),
  status text not null check (status in ('started', 'completed', 'failed')),
  records_processed integer not null default 0,
  message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index members_name_idx on public.members (last_name, first_name);
create index members_status_idx on public.members (membership_status_id) where deleted_at is null;
create index employees_name_idx on public.employees (last_name, first_name);
create index employees_department_idx on public.employees (department_id) where deleted_at is null;
create index employees_position_idx on public.employees (position_id) where deleted_at is null;
create index employee_documents_employee_idx on public.employee_documents (employee_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index sync_queue_pending_idx on public.sync_queue (processed_at, queued_at);

alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.members enable row level security;
alter table public.employees enable row level security;
alter table public.employee_documents enable row level security;
alter table public.audit_logs enable row level security;

create policy "authenticated users can read profiles"
  on public.users for select to authenticated using (true);
create policy "authenticated users can read members"
  on public.members for select to authenticated using (true);
create policy "authenticated users can read employees"
  on public.employees for select to authenticated using (true);
create policy "authenticated users can read documents"
  on public.employee_documents for select to authenticated using (true);
create policy "authenticated users can read audit logs"
  on public.audit_logs for select to authenticated using (true);

comment on schema public is
  'Cooperative operations schema. Mutation policies are added with role-aware authorization in the auth phase.';
