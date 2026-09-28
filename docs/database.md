# Database Schema

## ERD

```text
roles 1---* user_roles *---1 users

departments 1---* positions
departments 1---* employees
positions 1---* employees
employees 1---* employee_documents
employees 1---* employment_assignments
members 1---* employees
branches 1---* employment_assignments
clients 1---* employment_assignments
members 1---* beneficiaries
employees 1---* beneficiaries
religion_affiliations 1---* members
religion_affiliations 1---* employees

member_types 1---* members
member_statuses 1---* members
employment_types 1---* employees
employment_statuses 1---* employees
document_types 1---* employee_documents

users 1---* audit_logs
sync_queue 1---* sync_conflicts
```

## Portability Rules

- UUID text values are used as primary keys for both PostgreSQL and SQLite.
- Core timestamps are ISO strings.
- Soft deletion uses `deleted_at`.
- Sync state uses text values: `synced`, `pending_create`, `pending_update`, `pending_delete`, `conflict`.
- PostgreSQL-specific RLS policies and indexes live in Supabase migrations only.

## Migrations

- Supabase PostgreSQL: `src/database/supabase/migrations/0001_initial_schema.sql`
- SQLite: `src/database/sqlite/migrations/0001_initial_schema.sql`
- Seed data: `src/database/seeds/dev_seed.sql`

Apply migrations in numeric order. Migration `0002` adds member registration details and the manpower branch/client assignment history. Migration `0003` adds beneficiaries and religion/social affiliations. Migration `0004` adds government identifiers, resignation/termination statuses, and support for multiple employment engagements under one member ID.

## Current Difference Log

- Supabase uses `auth.users` for authentication and maps profiles into the local `users` table.
- SQLite has no RLS. Authorization is enforced by application services in offline mode.
- Supabase document files are stored in Supabase Storage. Offline document storage will use the Tauri filesystem in a later phase.
- When an employee is also a member, `employees.member_id` is the authoritative link. One member may have multiple employment engagements. The member profile owns shared personal/contact data, while government identifiers synchronize in both directions and each employee record owns its employment dates and placement.
- Branch/client deployments are historical `employment_assignments`, not fields embedded in a member record.
- The reference workbook's payment/share ledger is intentionally not modeled because share-capital accounting is outside system scope.
- Active dependent counts are derived from beneficiary records. Up to three may be active for one member or employee; deactivation retains history and requires a reason.
- Philippine geographic reference files live under `src/address`. Address inputs support typed search but only accept values in the region/province/city/barangay hierarchy. Barangay data is loaded only when needed because the national index is large.
