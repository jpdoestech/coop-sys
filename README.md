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

### Windows quick start

Run `setup.bat` once to install dependencies, create the local environment file,
run checks, and build the application. After setup, run `start.bat` whenever you
want to open the local system at `http://127.0.0.1:5173/`.

The start script detects an already-running instance, so it is safe to run it
again. Command-line users can pass `--no-pause` to `setup.bat` and
`--no-browser` to `start.bat` for unattended validation.

### Manual setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill Supabase values when testing online mode.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_APP_MODE=AUTO
```

`VITE_APP_MODE` supports `ONLINE`, `OFFLINE`, and `AUTO`.

For a new Supabase project, generate the one-run SQL bootstrap and execute the
result in the project's SQL Editor before the first cloud sign-in:

```powershell
.\tools\supabase\build-bootstrap.ps1
```

The generated file is
`release\supabase\cooperative-records-bootstrap.sql`. It applies every
migration in order, creates profiles for existing Supabase Auth users, and
assigns the oldest Auth user as the initial Super Admin only when the project
does not have one yet.

### Windows LAN executable

Run `build-exe.bat` to validate the project, build the production bundle, and
create a standalone Windows server at:

```text
release\windows-lan-server\CooperativeRecordsServer.exe
```

The host PC does not need Node.js after the EXE has been built. Start the EXE,
allow Private-network access if Windows Firewall prompts, and share the LAN URL
shown in its control window. Closing or selecting **Hide** keeps the server in
the notification area; use **Terminate** to stop it. The default port is `8787`
and can be changed with `CooperativeRecordsServer.exe --port=9000`.

The EXE shares the application over the LAN. To share the same records between
devices, configure `.env.local` with Supabase credentials and
`VITE_APP_MODE=ONLINE` before building. An OFFLINE build stores data separately
inside each user's browser.

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
- [Data Access Standard](./docs/data-access.md)
- [Authentication](./docs/authentication.md)
- [Access Control](./docs/access-control.md)
