# Deployment Strategy

## Vercel

Vercel hosts the React application. Supabase provides PostgreSQL, Auth, and Storage.

Required environment variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_MODE=ONLINE
```

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
