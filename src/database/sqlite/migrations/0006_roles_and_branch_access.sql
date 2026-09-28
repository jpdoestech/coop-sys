pragma foreign_keys = on;

alter table users add column employee_id text references employees(id) on delete set null;

create table user_branch_access (
  user_id text not null references users(id) on delete cascade,
  branch_id text not null references branches(id) on delete cascade,
  created_at text not null default (datetime('now')),
  primary key (user_id, branch_id)
);

insert or ignore into roles (id, code, name, description) values
  ('70000000-0000-4000-8000-000000000001', 'super_admin', 'Super Admin', 'Manages users and all system functions.'),
  ('70000000-0000-4000-8000-000000000002', 'general_manager', 'General Manager', 'Organization-wide operational access.'),
  ('70000000-0000-4000-8000-000000000003', 'hr_manager', 'HR Manager', 'Organization-wide member and employee management.'),
  ('70000000-0000-4000-8000-000000000004', 'accounting_manager', 'Accounting Manager', 'Organization-wide read and reporting access.'),
  ('70000000-0000-4000-8000-000000000005', 'head_office_staff', 'Head Office Staff', 'Head Office operational access.'),
  ('70000000-0000-4000-8000-000000000006', 'branch_admin', 'Branch Admin', 'Management access within assigned branches.'),
  ('70000000-0000-4000-8000-000000000007', 'branch_user', 'Branch User', 'Read access within assigned branches.');

create index user_branch_access_branch_idx on user_branch_access(branch_id, user_id);

