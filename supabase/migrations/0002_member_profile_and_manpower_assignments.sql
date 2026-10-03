alter table public.members
  add column tax_identification_number text,
  add column acceptance_resolution_number text,
  add column highest_educational_attainment text,
  add column occupation_income_source text,
  add column annual_income numeric(14, 2),
  add column number_of_dependents integer,
  add column beneficiary_name text,
  add column religion_affiliation text;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  contact_person text,
  contact_details text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create table public.employment_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  assignment_code text,
  start_date date not null,
  end_date date,
  work_location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced',
  check (end_date is null or end_date >= start_date)
);

create unique index employment_assignments_one_active_idx
  on public.employment_assignments (employee_id)
  where end_date is null and deleted_at is null;
create index employment_assignments_client_idx
  on public.employment_assignments (client_id, start_date desc);
create index employment_assignments_branch_idx
  on public.employment_assignments (branch_id, start_date desc);

alter table public.branches enable row level security;
alter table public.clients enable row level security;
alter table public.employment_assignments enable row level security;

create policy "authenticated users can read branches"
  on public.branches for select to authenticated using (true);
create policy "authenticated users can read clients"
  on public.clients for select to authenticated using (true);
create policy "authenticated users can read employment assignments"
  on public.employment_assignments for select to authenticated using (true);

comment on column public.employees.member_id is
  'Links an employee to the authoritative cooperative member profile when the person has both roles.';
comment on table public.employment_assignments is
  'Manpower branch/client deployment history. This is distinct from cooperative membership.';
