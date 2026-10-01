create table public.payment_corrections (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.member_payments(id),
  from_amount_centavos bigint not null check (from_amount_centavos > 0),
  to_amount_centavos bigint not null check (to_amount_centavos > 0),
  from_remarks text,
  to_remarks text,
  comment text not null check (length(trim(comment)) > 0),
  corrected_by uuid not null references public.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, sync_status public.sync_status not null default 'synced'
);

create table public.over_deduction_refunds (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  member_id uuid not null references public.members(id),
  branch_id uuid not null references public.branches(id),
  client_id uuid references public.clients(id),
  amount_centavos bigint not null check (amount_centavos > 0),
  refund_date date not null,
  cutoff_from date, cutoff_to date,
  method text not null check (method in ('manual','import')),
  source_file_name text, remarks text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, sync_status public.sync_status not null default 'synced',
  check (cutoff_to is null or cutoff_from is null or cutoff_to >= cutoff_from)
);

create index payment_corrections_payment_idx on public.payment_corrections(payment_id, created_at desc) where deleted_at is null;
create index over_deduction_refunds_scope_idx on public.over_deduction_refunds(branch_id, client_id, refund_date desc) where deleted_at is null;

alter table public.payment_corrections enable row level security;
alter table public.over_deduction_refunds enable row level security;

create policy "scoped users read payment corrections" on public.payment_corrections for select to authenticated
  using (exists (select 1 from public.member_payments p where p.id = payment_id and public.current_user_can_access_employee(p.employee_id)));
create policy "payment managers create corrections" on public.payment_corrections for insert to authenticated
  with check (exists (select 1 from public.member_payments p where p.id = payment_id and public.current_user_can_access_employee(p.employee_id)) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
create policy "payment managers update payments" on public.member_payments for update to authenticated
  using (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']))
  with check (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
create policy "payment managers update aliases" on public.member_aliases for update to authenticated
  using (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','hr_manager','accounting_manager','head_office_staff','branch_admin']))
  with check (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','hr_manager','accounting_manager','head_office_staff','branch_admin']));
drop policy if exists "payment managers create aliases" on public.member_aliases;
create policy "authorized managers create aliases" on public.member_aliases for insert to authenticated
  with check (public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','hr_manager','accounting_manager','head_office_staff','branch_admin']));
create policy "scoped users read over-deduction refunds" on public.over_deduction_refunds for select to authenticated using (public.current_user_can_access_branch(branch_id));
create policy "payment managers create refunds" on public.over_deduction_refunds for insert to authenticated
  with check (public.current_user_can_access_branch(branch_id) and public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
create policy "payment managers update refunds" on public.over_deduction_refunds for update to authenticated
  using (public.current_user_can_access_branch(branch_id) and public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']))
  with check (public.current_user_can_access_branch(branch_id) and public.current_user_can_access_employee(employee_id) and public.current_user_has_role(array['super_admin','general_manager','accounting_manager','head_office_staff','branch_admin']));
