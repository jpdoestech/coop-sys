pragma foreign_keys = on;

create table payment_corrections (
  id text primary key, payment_id text not null references member_payments(id),
  from_amount_centavos integer not null, to_amount_centavos integer not null,
  from_remarks text, to_remarks text, comment text not null, corrected_by text not null references users(id),
  created_at text not null default (datetime('now')), updated_at text not null default (datetime('now')),
  deleted_at text, sync_status text not null default 'synced'
);

create table over_deduction_refunds (
  id text primary key, employee_id text not null references employees(id), member_id text not null references members(id),
  branch_id text not null references branches(id), client_id text references clients(id), amount_centavos integer not null,
  refund_date text not null, cutoff_from text, cutoff_to text, method text not null,
  source_file_name text, remarks text, created_by text not null references users(id),
  created_at text not null default (datetime('now')), updated_at text not null default (datetime('now')),
  deleted_at text, sync_status text not null default 'synced'
);

create index payment_corrections_payment_idx on payment_corrections(payment_id, created_at);
create index over_deduction_refunds_scope_idx on over_deduction_refunds(branch_id, client_id, refund_date);
