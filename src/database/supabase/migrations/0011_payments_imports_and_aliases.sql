create table public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  membership_fee_centavos bigint not null check (membership_fee_centavos >= 0),
  capital_share_target_centavos bigint not null check (capital_share_target_centavos >= 0),
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

insert into public.payment_settings (membership_fee_centavos, capital_share_target_centavos, effective_from)
values (50000, 500000, '2000-01-01');

create table public.member_aliases (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create unique index member_aliases_client_name_unique on public.member_aliases(client_id, normalized_alias) where deleted_at is null;
create index member_aliases_employee_idx on public.member_aliases(employee_id, client_id) where deleted_at is null;

create table public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  client_id uuid references public.clients(id),
  method text not null check (method in ('manual', 'payroll_deduction')),
  cutoff_from date,
  cutoff_to date,
  payroll_month smallint check (payroll_month between 1 and 12),
  payment_date date not null,
  source_file_name text,
  remarks text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced',
  check (cutoff_to is null or cutoff_from is null or cutoff_to >= cutoff_from)
);

create table public.member_payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payment_batches(id),
  employee_id uuid not null references public.employees(id),
  member_id uuid not null references public.members(id),
  amount_centavos bigint not null check (amount_centavos > 0),
  membership_fee_centavos bigint not null default 0 check (membership_fee_centavos >= 0),
  capital_share_centavos bigint not null default 0 check (capital_share_centavos >= 0),
  payment_date date not null,
  method text not null check (method in ('manual', 'payroll_deduction')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced',
  check (amount_centavos = membership_fee_centavos + capital_share_centavos)
);

create table public.final_pay_settlements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  member_id uuid not null references public.members(id),
  capital_share_refund_centavos bigint not null check (capital_share_refund_centavos >= 0),
  membership_fee_refund_centavos bigint not null check (membership_fee_refund_centavos >= 0),
  refund_membership_fee boolean not null default false,
  settlement_date date not null,
  remarks text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  sync_status public.sync_status not null default 'synced'
);

create unique index final_pay_employee_unique on public.final_pay_settlements(employee_id) where deleted_at is null;
create index payment_batches_scope_idx on public.payment_batches(branch_id, client_id, payment_date desc) where deleted_at is null;
create index member_payments_member_idx on public.member_payments(member_id, payment_date desc) where deleted_at is null;

alter table public.payment_settings enable row level security;
alter table public.member_aliases enable row level security;
alter table public.payment_batches enable row level security;
alter table public.member_payments enable row level security;
alter table public.final_pay_settlements enable row level security;

create policy "authorized users read payment settings" on public.payment_settings for select to authenticated using (true);
create policy "super admins manage payment settings" on public.payment_settings for all to authenticated
  using (public.current_user_has_role(array['super_admin'])) with check (public.current_user_has_role(array['super_admin']));
create policy "scoped users read aliases" on public.member_aliases for select to authenticated using (public.current_user_can_access_employee(employee_id));
create policy "payment managers create aliases" on public.member_aliases for insert to authenticated
  with check (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
create policy "scoped users read payment batches" on public.payment_batches for select to authenticated using (public.current_user_can_access_branch(branch_id));
create policy "payment managers create batches" on public.payment_batches for insert to authenticated
  with check (public.current_user_can_access_branch(branch_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
create policy "scoped users read payments" on public.member_payments for select to authenticated using (public.current_user_can_access_employee(employee_id));
create policy "payment managers create payments" on public.member_payments for insert to authenticated
  with check (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
create policy "scoped users read settlements" on public.final_pay_settlements for select to authenticated using (public.current_user_can_access_employee(employee_id));
create policy "payment managers create settlements" on public.final_pay_settlements for insert to authenticated
  with check (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
