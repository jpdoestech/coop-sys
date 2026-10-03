# Deployment Strategy

## Vercel

Vercel hosts the React application. Supabase provides PostgreSQL, Auth, and Storage.

Required environment variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_APP_MODE=ONLINE
```

## Supabase from GitHub

Keep the Supabase integration working directory set to `.`. The root
`supabase/config.toml` configures the project, and timestamped files in
`supabase/migrations/` are applied in order. New migrations should always be
committed instead of making production schema changes directly in the Table or
SQL Editor.

### Existing manually bootstrapped project

If `cooperative-records-bootstrap.sql` was already run in the SQL Editor, the
schema exists but Supabase migration history does not contain migrations 1-18.
Before enabling automatic production deployment, link the CLI and mark those
versions as applied once:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration repair --status applied 20261003000001 20261003000002 20261003000003 20261003000004 20261003000005 20261003000006 20261003000007 20261003000008 20261003000009 20261003000010 20261003000011 20261003000012 20261003000013 20261003000014 20261003000015 20261003000016 20261003000017 20261003000018
npx supabase db push --dry-run
```

The dry run should list only `20261003000019_rls_hardening.sql`. The next
GitHub production deployment can then apply that migration safely.

## GitHub Pages

The Vite build output can be published from `dist/`. SPA routing should use hash routing or a Pages fallback when enabled later.

## Windows LAN Server

`build-exe.bat` creates a standalone WinForms server executable with the Vite
bundle embedded as a compressed resource. It listens on all local IPv4
interfaces, serves SPA route fallbacks, and provides a small controller with
Open Browser, Copy Address, Hide, and Terminate controls.

```text
release\windows-lan-server\CooperativeRecordsServer.exe
```

Build requirements are Node.js/npm and the Windows .NET Framework compiler.
The target host only needs a supported Windows installation. The default port
is `8787`; pass `--port=NUMBER` to override it.

For multi-user records, build with Supabase credentials and
`VITE_APP_MODE=ONLINE`. OFFLINE mode uses browser-local storage and therefore
does not provide a shared LAN database. A future SQLite-backed desktop client
would be a separate deployment target, not the LAN web server.
