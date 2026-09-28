-- PostgreSQL development seed. All people and contact details are fictional.
insert into public.roles (id, code, name, description) values
  ('00000000-0000-4000-8000-000000000001', 'ADMIN', 'Administrator', 'Full system administration'),
  ('00000000-0000-4000-8000-000000000002', 'HR', 'HR Officer', 'Employee and document management'),
  ('00000000-0000-4000-8000-000000000003', 'MEMBERSHIP', 'Membership Officer', 'Member records management');

insert into public.departments (id, code, name, description) values
  ('10000000-0000-4000-8000-000000000001', 'ADM', 'Administration', 'Executive and administrative services'),
  ('10000000-0000-4000-8000-000000000002', 'FIN', 'Finance', 'Accounting, treasury, and controls'),
  ('10000000-0000-4000-8000-000000000003', 'MEM', 'Membership Services', 'Member onboarding and support'),
  ('10000000-0000-4000-8000-000000000004', 'OPS', 'Operations', 'Daily cooperative operations'),
  ('10000000-0000-4000-8000-000000000005', 'IT', 'Information Technology', 'Systems and technical support');

insert into public.positions (id, department_id, code, name) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'GM', 'General Manager'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'AO', 'Administrative Officer'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'FM', 'Finance Manager'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'BK', 'Bookkeeper'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'MO', 'Membership Officer'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'MSA', 'Member Services Associate'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000004', 'OM', 'Operations Manager'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'OA', 'Operations Associate'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000005', 'SA', 'Systems Administrator'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000005', 'TS', 'Technical Support Specialist');

insert into public.member_types (id, code, name) values
  ('30000000-0000-4000-8000-000000000001', 'REGULAR', 'Regular'),
  ('30000000-0000-4000-8000-000000000002', 'ASSOCIATE', 'Associate'),
  ('30000000-0000-4000-8000-000000000003', 'LABOR', 'Labor');

insert into public.member_statuses (id, code, name) values
  ('31000000-0000-4000-8000-000000000001', 'ACTIVE', 'Active'),
  ('31000000-0000-4000-8000-000000000002', 'INACTIVE', 'Inactive'),
  ('31000000-0000-4000-8000-000000000003', 'TERMINATED', 'Terminated'),
  ('31000000-0000-4000-8000-000000000004', 'RESIGNED', 'Resigned');

insert into public.employment_types (id, code, name) values
  ('32000000-0000-4000-8000-000000000001', 'REGULAR', 'Regular'),
  ('32000000-0000-4000-8000-000000000002', 'PROBATIONARY', 'Probationary'),
  ('32000000-0000-4000-8000-000000000003', 'CONTRACTUAL', 'Contractual'),
  ('32000000-0000-4000-8000-000000000004', 'PART_TIME', 'Part-time'),
  ('32000000-0000-4000-8000-000000000005', 'TEMPORARY', 'Temporary'),
  ('32000000-0000-4000-8000-000000000006', 'OTHER', 'Other');

insert into public.employment_statuses (id, code, name) values
  ('33000000-0000-4000-8000-000000000001', 'ACTIVE', 'Active'),
  ('33000000-0000-4000-8000-000000000002', 'ON_LEAVE', 'On Leave'),
  ('33000000-0000-4000-8000-000000000003', 'SEPARATED', 'Separated'),
  ('33000000-0000-4000-8000-000000000004', 'INACTIVE', 'Inactive'),
  ('33000000-0000-4000-8000-000000000005', 'RETIRED', 'Retired'),
  ('33000000-0000-4000-8000-000000000006', 'RESIGNED', 'Resigned'),
  ('33000000-0000-4000-8000-000000000007', 'TERMINATED', 'Terminated');

insert into public.document_types (id, code, name, is_required) values
  ('34000000-0000-4000-8000-000000000001', 'BIO_DATA', 'Bio-data', true),
  ('34000000-0000-4000-8000-000000000002', 'GOV_ID', 'Government ID', true),
  ('34000000-0000-4000-8000-000000000003', 'CONTRACT', 'Employment Contract', true),
  ('34000000-0000-4000-8000-000000000004', 'CLEARANCE', 'Clearance', false);

insert into public.religion_affiliations (id, code, name, category) values
  ('35000000-0000-4000-8000-000000000001', 'ROMAN_CATHOLIC', 'Roman Catholic', 'religion'),
  ('35000000-0000-4000-8000-000000000002', 'ISLAM', 'Islam', 'religion'),
  ('35000000-0000-4000-8000-000000000003', 'INC', 'Iglesia ni Cristo', 'religion'),
  ('35000000-0000-4000-8000-000000000004', 'PROTESTANT', 'Protestant / Evangelical', 'religion'),
  ('35000000-0000-4000-8000-000000000005', 'SDA', 'Seventh-day Adventist', 'religion'),
  ('35000000-0000-4000-8000-000000000006', 'BUDDHIST', 'Buddhist', 'religion'),
  ('35000000-0000-4000-8000-000000000007', 'INDIGENOUS', 'Indigenous belief', 'religion'),
  ('35000000-0000-4000-8000-000000000008', 'NONE', 'None', 'none'),
  ('35000000-0000-4000-8000-000000000009', 'OTHER', 'Other', 'other'),
  ('35000000-0000-4000-8000-000000000010', 'UNDISCLOSED', 'Prefer not to say', 'other'),
  ('35000000-0000-4000-8000-000000000011', 'CIVIC', 'Civic / community organization', 'social'),
  ('35000000-0000-4000-8000-000000000012', 'PROFESSIONAL', 'Professional association', 'social'),
  ('35000000-0000-4000-8000-000000000013', 'LABOR_ORG', 'Labor organization', 'social');

insert into public.members (
  id, membership_number, first_name, last_name, email, mobile_number,
  membership_date, membership_status_id, membership_type_id, city_municipality, province
)
select
  ('40000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'MEM-' || lpad(series::text, 4, '0'),
  'Member' || lpad(series::text, 2, '0'),
  'Sample' || lpad(series::text, 2, '0'),
  'member' || lpad(series::text, 2, '0') || '@example.test',
  '+6391700' || lpad(series::text, 4, '0'),
  date '2021-01-01' + series,
  '31000000-0000-4000-8000-000000000001',
  case when series % 4 = 0
    then '30000000-0000-4000-8000-000000000002'::uuid
    else '30000000-0000-4000-8000-000000000001'::uuid
  end,
  'San Isidro',
  'Laguna'
from generate_series(1, 50) as series;

insert into public.employees (
  id, employee_number, member_id, first_name, last_name, email, mobile_number,
  employment_status_id, employment_type_id, date_hired, position_id, department_id, work_location
)
select
  ('50000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'EMP-' || lpad(series::text, 4, '0'),
  ('40000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'Employee' || lpad(series::text, 2, '0'),
  'Demo' || lpad(series::text, 2, '0'),
  'employee' || lpad(series::text, 2, '0') || '@example.test',
  '+6391800' || lpad(series::text, 4, '0'),
  '33000000-0000-4000-8000-000000000001',
  case when series % 5 = 0
    then '32000000-0000-4000-8000-000000000002'::uuid
    else '32000000-0000-4000-8000-000000000001'::uuid
  end,
  date '2020-01-01' + (series * 30),
  ('20000000-0000-4000-8000-' || lpad((((series - 1) % 10) + 1)::text, 12, '0'))::uuid,
  ('10000000-0000-4000-8000-' || lpad((((series - 1) % 5) + 1)::text, 12, '0'))::uuid,
  'Main Office'
from generate_series(1, 20) as series;

insert into public.beneficiaries (
  id, employee_id, full_name, relationship, date_of_birth, is_active
) values
  ('63000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Fictional Dependent 01', 'Child', '2016-01-10', true),
  ('63000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'Fictional Dependent 02', 'Spouse', '1994-04-18', true),
  ('63000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 'Fictional Dependent 03', 'Child', '2019-07-22', true);

insert into public.branches (id, code, name, address, unit_type, parent_branch_id) values
  ('60000000-0000-4000-8000-000000000001', 'DVO', 'Davao Branch', 'Davao City', 'branch', '60000000-0000-4000-8000-000000000000'),
  ('60000000-0000-4000-8000-000000000002', 'GES', 'General Santos Branch', 'General Santos City', 'branch', '60000000-0000-4000-8000-000000000000');

insert into public.clients (id, code, name, address, branch_id) values
  ('61000000-0000-4000-8000-000000000001', 'CLIENT-A', 'Fictional Manufacturing Client', 'Davao City', '60000000-0000-4000-8000-000000000001'),
  ('61000000-0000-4000-8000-000000000002', 'CLIENT-B', 'Fictional Logistics Client', 'General Santos City', '60000000-0000-4000-8000-000000000002');

insert into public.employment_assignments (
  id, employee_id, branch_id, client_id, assignment_code, start_date, work_location
)
select
  ('62000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  ('50000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  case when series % 5 = 0
    then '60000000-0000-4000-8000-000000000000'::uuid
    when series % 2 = 0
    then '60000000-0000-4000-8000-000000000002'::uuid
    else '60000000-0000-4000-8000-000000000001'::uuid
  end,
  case when series % 5 = 0
    then null
    when series % 2 = 0
    then '61000000-0000-4000-8000-000000000002'::uuid
    else '61000000-0000-4000-8000-000000000001'::uuid
  end,
  'ASN-' || lpad(series::text, 4, '0'),
  date '2025-01-01' + (series * 7),
  case when series % 5 = 0 then 'Head Office' when series % 2 = 0 then 'General Santos Site' else 'Davao Site' end
from generate_series(1, 20) as series;

insert into public.system_settings (key, value, description) values
  ('cooperative_name', '"San Isidro Community Cooperative"'::jsonb, 'Display name used by the application'),
  ('default_timezone', '"Asia/Manila"'::jsonb, 'Timezone used for reports and audit timestamps');
