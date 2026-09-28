pragma foreign_keys = on;

alter table branches add column unit_type text not null default 'branch'
  check (unit_type in ('head_office', 'branch'));
alter table branches add column parent_branch_id text references branches(id) on delete set null;
alter table clients add column branch_id text references branches(id) on delete set null;
alter table employment_assignments add column transfer_reason text;

insert or ignore into branches (id, code, name, address, unit_type, parent_branch_id)
values ('60000000-0000-4000-8000-000000000000', 'HO', 'Head Office', 'Main Office', 'head_office', null);

update branches
set parent_branch_id = '60000000-0000-4000-8000-000000000000'
where unit_type = 'branch' and id <> '60000000-0000-4000-8000-000000000000';

update clients set branch_id = '60000000-0000-4000-8000-000000000001'
where id = '61000000-0000-4000-8000-000000000001';
update clients set branch_id = '60000000-0000-4000-8000-000000000002'
where id = '61000000-0000-4000-8000-000000000002';

create index clients_branch_idx on clients(branch_id, deleted_at);

