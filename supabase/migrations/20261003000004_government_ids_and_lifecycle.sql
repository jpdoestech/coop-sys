alter table public.members
  add column sss_number text,
  add column pagibig_number text,
  add column philhealth_number text;

alter table public.employees
  add column sss_number text,
  add column pagibig_number text,
  add column philhealth_number text,
  add column tax_identification_number text;

alter table public.employees drop constraint if exists employees_member_id_key;
create index employees_member_id_idx on public.employees (member_id) where member_id is not null;

insert into public.member_statuses (id, code, name) values
  ('31000000-0000-4000-8000-000000000004', 'resigned', 'Resigned')
on conflict (id) do nothing;

insert into public.employment_statuses (id, code, name) values
  ('33000000-0000-4000-8000-000000000006', 'resigned', 'Resigned'),
  ('33000000-0000-4000-8000-000000000007', 'terminated', 'Terminated')
on conflict (id) do nothing;

