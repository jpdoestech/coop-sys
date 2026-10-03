alter table public.branches
  add column unit_type text not null default 'branch'
    check (unit_type in ('head_office', 'branch')),
  add column parent_branch_id uuid references public.branches(id) on delete set null;

alter table public.clients
  add column branch_id uuid references public.branches(id) on delete set null;

alter table public.employment_assignments
  add column transfer_reason text;

insert into public.branches (id, code, name, address, unit_type, parent_branch_id)
values ('60000000-0000-4000-8000-000000000000', 'HO', 'Head Office', 'Main Office', 'head_office', null)
on conflict (id) do nothing;

update public.branches
set parent_branch_id = '60000000-0000-4000-8000-000000000000'
where unit_type = 'branch' and id <> '60000000-0000-4000-8000-000000000000';

update public.clients set branch_id = '60000000-0000-4000-8000-000000000001'
where id = '61000000-0000-4000-8000-000000000001';
update public.clients set branch_id = '60000000-0000-4000-8000-000000000002'
where id = '61000000-0000-4000-8000-000000000002';

create index clients_branch_idx on public.clients (branch_id) where deleted_at is null;

comment on table public.employment_assignments is
  'Historical employee placement ledger. Transfers close the active row and create a new row.';
