-- Production reference data used by fixed application identifiers.
-- This intentionally excludes sample people, branches, clients, and payments.

insert into public.member_types (id, code, name, is_active) values
  ('30000000-0000-4000-8000-000000000001', 'REGULAR', 'Regular', true),
  ('30000000-0000-4000-8000-000000000002', 'ASSOCIATE', 'Associate', true),
  ('30000000-0000-4000-8000-000000000003', 'LABOR', 'Labor', true)
on conflict (id) do update set code = excluded.code, name = excluded.name, is_active = excluded.is_active;

insert into public.member_statuses (id, code, name, is_active) values
  ('31000000-0000-4000-8000-000000000001', 'ACTIVE', 'Active', true),
  ('31000000-0000-4000-8000-000000000002', 'INACTIVE', 'Inactive', true),
  ('31000000-0000-4000-8000-000000000003', 'TERMINATED', 'Terminated', true),
  ('31000000-0000-4000-8000-000000000004', 'RESIGNED', 'Resigned', true)
on conflict (id) do update set code = excluded.code, name = excluded.name, is_active = excluded.is_active;

insert into public.employment_types (id, code, name, is_active) values
  ('32000000-0000-4000-8000-000000000001', 'REGULAR', 'Regular', true),
  ('32000000-0000-4000-8000-000000000002', 'PROBATIONARY', 'Probationary', true),
  ('32000000-0000-4000-8000-000000000003', 'CONTRACTUAL', 'Contractual', true),
  ('32000000-0000-4000-8000-000000000004', 'PART_TIME', 'Part-time', true),
  ('32000000-0000-4000-8000-000000000005', 'TEMPORARY', 'Temporary', true),
  ('32000000-0000-4000-8000-000000000006', 'OTHER', 'Other', true)
on conflict (id) do update set code = excluded.code, name = excluded.name, is_active = excluded.is_active;

insert into public.employment_statuses (id, code, name, is_active) values
  ('33000000-0000-4000-8000-000000000001', 'ACTIVE', 'Active', true),
  ('33000000-0000-4000-8000-000000000002', 'ON_LEAVE', 'On Leave', true),
  ('33000000-0000-4000-8000-000000000003', 'SEPARATED', 'Separated', true),
  ('33000000-0000-4000-8000-000000000004', 'INACTIVE', 'Inactive', true),
  ('33000000-0000-4000-8000-000000000005', 'RETIRED', 'Retired', true),
  ('33000000-0000-4000-8000-000000000006', 'RESIGNED', 'Resigned', true),
  ('33000000-0000-4000-8000-000000000007', 'TERMINATED', 'Terminated', true)
on conflict (id) do update set code = excluded.code, name = excluded.name, is_active = excluded.is_active;

insert into public.departments (id, code, name, description, is_active) values
  ('10000000-0000-4000-8000-000000000001', 'ADM', 'Administration', 'Executive and administrative services', true),
  ('10000000-0000-4000-8000-000000000002', 'FIN', 'Finance', 'Accounting, treasury, and controls', true),
  ('10000000-0000-4000-8000-000000000003', 'MEM', 'Membership Services', 'Member onboarding and support', true),
  ('10000000-0000-4000-8000-000000000004', 'OPS', 'Operations', 'Daily cooperative operations', true),
  ('10000000-0000-4000-8000-000000000005', 'IT', 'Information Technology', 'Systems and technical support', true)
on conflict (id) do update set code = excluded.code, name = excluded.name, description = excluded.description, is_active = excluded.is_active;

insert into public.positions (id, department_id, code, name, is_active) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'GM', 'General Manager', true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'AO', 'Administrative Officer', true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'FM', 'Finance Manager', true),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'BK', 'Bookkeeper', true),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'MO', 'Membership Officer', true),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'MSA', 'Member Services Associate', true),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000004', 'OM', 'Operations Manager', true),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'OA', 'Operations Associate', true),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000005', 'SA', 'Systems Administrator', true),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000005', 'TS', 'Technical Support Specialist', true)
on conflict (id) do update set department_id = excluded.department_id, code = excluded.code, name = excluded.name, is_active = excluded.is_active;

insert into public.document_types (id, code, name, is_required, is_active) values
  ('34000000-0000-4000-8000-000000000001', 'BIO_DATA', 'Bio-data', true, true),
  ('34000000-0000-4000-8000-000000000002', 'GOV_ID', 'Government ID', true, true),
  ('34000000-0000-4000-8000-000000000003', 'CONTRACT', 'Employment Contract', true, true),
  ('34000000-0000-4000-8000-000000000004', 'CLEARANCE', 'Clearance', false, true)
on conflict (id) do update set code = excluded.code, name = excluded.name, is_required = excluded.is_required, is_active = excluded.is_active;

insert into public.religion_affiliations (id, code, name, category, is_active) values
  ('35000000-0000-4000-8000-000000000001', 'ROMAN_CATHOLIC', 'Roman Catholic', 'religion', true),
  ('35000000-0000-4000-8000-000000000002', 'ISLAM', 'Islam', 'religion', true),
  ('35000000-0000-4000-8000-000000000003', 'INC', 'Iglesia ni Cristo', 'religion', true),
  ('35000000-0000-4000-8000-000000000004', 'PROTESTANT', 'Protestant / Evangelical', 'religion', true),
  ('35000000-0000-4000-8000-000000000005', 'SDA', 'Seventh-day Adventist', 'religion', true),
  ('35000000-0000-4000-8000-000000000006', 'BUDDHIST', 'Buddhist', 'religion', true),
  ('35000000-0000-4000-8000-000000000007', 'INDIGENOUS', 'Indigenous belief', 'religion', true),
  ('35000000-0000-4000-8000-000000000008', 'NONE', 'None', 'none', true),
  ('35000000-0000-4000-8000-000000000009', 'OTHER', 'Other', 'other', true),
  ('35000000-0000-4000-8000-000000000010', 'UNDISCLOSED', 'Prefer not to say', 'other', true),
  ('35000000-0000-4000-8000-000000000011', 'CIVIC', 'Civic / community organization', 'social', true),
  ('35000000-0000-4000-8000-000000000012', 'PROFESSIONAL', 'Professional association', 'social', true),
  ('35000000-0000-4000-8000-000000000013', 'LABOR_ORG', 'Labor organization', 'social', true)
on conflict (id) do update set code = excluded.code, name = excluded.name, category = excluded.category, is_active = excluded.is_active;
