pragma foreign_keys = on;

create table payment_settings (
  id text primary key, membership_fee_centavos integer not null, capital_share_target_centavos integer not null,
  effective_from text not null, effective_to text, is_active integer not null default 1,
  created_at text not null default (datetime('now')), updated_at text not null default (datetime('now'))
);
insert into payment_settings values ('default-payment-settings', 50000, 500000, '2000-01-01', null, 1, datetime('now'), datetime('now'));

create table member_aliases (
  id text primary key, employee_id text not null references employees(id) on delete cascade,
  client_id text not null references clients(id) on delete cascade, alias text not null, normalized_alias text not null,
  created_at text not null default (datetime('now')), updated_at text not null default (datetime('now')),
  deleted_at text, sync_status text not null default 'synced'
);
create unique index member_aliases_client_name_unique on member_aliases(client_id, normalized_alias) where deleted_at is null;

create table payment_batches (
  id text primary key, branch_id text not null references branches(id), client_id text references clients(id),
  method text not null check (method in ('manual','payroll_deduction')), cutoff_from text, cutoff_to text,
  payroll_month integer, payment_date text not null, source_file_name text, remarks text, created_by text not null references users(id),
  created_at text not null default (datetime('now')), updated_at text not null default (datetime('now')),
  deleted_at text, sync_status text not null default 'synced'
);

create table member_payments (
  id text primary key, batch_id text not null references payment_batches(id), employee_id text not null references employees(id),
  member_id text not null references members(id), amount_centavos integer not null,
  membership_fee_centavos integer not null default 0, capital_share_centavos integer not null default 0,
  payment_date text not null, method text not null, remarks text,
  created_at text not null default (datetime('now')), updated_at text not null default (datetime('now')),
  deleted_at text, sync_status text not null default 'synced',
  check (amount_centavos = membership_fee_centavos + capital_share_centavos)
);

create table final_pay_settlements (
  id text primary key, employee_id text not null references employees(id), member_id text not null references members(id),
  capital_share_refund_centavos integer not null, membership_fee_refund_centavos integer not null,
  refund_membership_fee integer not null default 0, settlement_date text not null, remarks text, created_by text not null references users(id),
  created_at text not null default (datetime('now')), updated_at text not null default (datetime('now')),
  deleted_at text, sync_status text not null default 'synced'
);
create unique index final_pay_employee_unique on final_pay_settlements(employee_id) where deleted_at is null;
create index payment_batches_scope_idx on payment_batches(branch_id, client_id, payment_date);
create index member_payments_member_idx on member_payments(member_id, payment_date);
