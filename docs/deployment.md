# Deployment Strategy

## Vercel

Vercel is the primary application deployment. Supabase provides PostgreSQL,
Auth, and Storage. Store the real production configuration in the Vercel
project's Environment Variables, not in Git. `.env.production.example` lists
the required names; a developer may use an ignored `.env.production` for a
local production-build check.

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

The current hosted project records migrations `0001` through `0019`. Run
`supabase migration list` before deployment and use `supabase db push
--dry-run` before applying any later migration.

## GitHub Pages

The Vite build output can be published from `dist/`. SPA routing should use hash routing or a Pages fallback when enabled later.

## Supported Offline/LAN Server

`build-database-exe.bat` creates the supported offline multi-user deployment:

```text
release\windows-database-server\CooperativeRecordsDatabaseServer.exe
```

It uses a host-managed SQLite WAL database and server authentication. A Super
Admin can enable synchronization from the Synchronization workspace. The
current transport replicates to another Cooperative Records database server;
it does not yet translate SQLite records into the normalized Supabase schema.

## Legacy Browser-Local Server

`build-exe.bat` creates a standalone WinForms server executable with the Vite
bundle embedded as a compressed resource. This build is explicitly compiled in
offline mode and stores records separately in each browser. It is retained for
compatibility but is not the recommended offline deployment.

```text
release\windows-lan-server\CooperativeRecordsServer.exe
```

Build requirements are Node.js/npm and the Windows .NET Framework compiler.
The target host only needs a supported Windows installation. The default port
is `8787`; pass `--port=NUMBER` to override it.

Use `build-database-exe.bat` whenever offline users must share one host database.
