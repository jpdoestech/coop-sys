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

The current hosted project already records migrations `0001` through `0018`.
Run `supabase migration list` before deployment and use `supabase db push
--dry-run`; the next deployment should list only `0019_rls_hardening.sql`.

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
