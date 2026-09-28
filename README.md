# Cooperative Membership & Employee Management System

Small, maintainable records system for cooperative members and employees. The implementation is intentionally scoped away from payroll, accounting, attendance, benefits, recruitment, and other full HRIS modules.

## Current Phase

The foundation, member register, employee register, hierarchy, and authentication baseline are functional:

- React, TypeScript, Vite, Tailwind CSS
- Responsive app shell and route structure
- Repository/data-access abstraction
- Supabase client foundation
- Local offline repository foundation
- PostgreSQL and SQLite migration files
- Seed data scripts
- Validation and sync conflict utilities with tests
- Searchable member register with create, edit, and archive workflows
- Workbook-informed member registration fields
- Manpower branch/client assignment schema linked through employee records
- Searchable employee register with member linking and client assignments
- Cascading Philippine address reference selector
- Beneficiary history with a three-active-record limit and required deactivation reasons
- Configurable religion and social-affiliation seed values
- Supabase session authentication and password recovery
- PBKDF2-secured offline authentication with forced temporary-password replacement
- Role-aware navigation and branch-scoped member/employee access
- Super Admin user invitations, roles, status, and branch assignments

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill Supabase values when testing online mode.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_MODE=AUTO
```

`VITE_APP_MODE` supports `ONLINE`, `OFFLINE`, and `AUTO`.

## Verification

```bash
npm run build
npm run test
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Project Structure](./docs/project-structure.md)
- [Reference Workbook Mapping](./docs/reference-mapping.md)
- [Database Schema](./docs/database.md)
- [Synchronization Strategy](./docs/synchronization.md)
- [Deployment Strategy](./docs/deployment.md)
- [Authentication](./docs/authentication.md)
- [Access Control](./docs/access-control.md)
