create table public.religion_affiliations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  category text not null default 'religion' check (category in ('religion', 'social', 'none', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.members
  add column religion_affiliation_id uuid references public.religion_affiliations(id) on delete set null;
alter table public.employees
  add column religion_affiliation_id uuid references public.religion_affiliations(id) on delete set null;

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  date_of_birth date,
  contact_number text,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  deactivation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced',
  check ((member_id is not null)::integer + (employee_id is not null)::integer = 1),
  check (is_active or (deactivated_at is not null and nullif(trim(deactivation_reason), '') is not null))
);

create index beneficiaries_member_idx on public.beneficiaries(member_id) where deleted_at is null;
create index beneficiaries_employee_idx on public.beneficiaries(employee_id) where deleted_at is null;

create function public.enforce_three_active_beneficiaries()
returns trigger language plpgsql as $$
begin
  if new.is_active and new.deleted_at is null and (
    select count(*)
    from public.beneficiaries existing
    where existing.id <> new.id
      and existing.deleted_at is null
      and existing.is_active
      and (
        (new.member_id is not null and existing.member_id = new.member_id) or
        (new.employee_id is not null and existing.employee_id = new.employee_id)
      )
  ) >= 3 then
    raise exception 'A person can have at most three active beneficiaries.';
  end if;
  return new;
end;
$$;

create trigger beneficiaries_active_limit
before insert or update on public.beneficiaries
for each row execute function public.enforce_three_active_beneficiaries();

alter table public.religion_affiliations enable row level security;
alter table public.beneficiaries enable row level security;

create policy "authenticated users can read religion affiliations"
  on public.religion_affiliations for select to authenticated using (true);
create policy "authenticated users can read beneficiaries"
  on public.beneficiaries for select to authenticated using (true);

comment on column public.members.number_of_dependents is
  'Deprecated snapshot. Active dependent count is derived from beneficiaries.';
comment on column public.members.beneficiary_name is
  'Deprecated snapshot. Beneficiary details are stored in beneficiaries.';
