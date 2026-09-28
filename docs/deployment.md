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

## Windows Desktop

The planned desktop package is Tauri:

```text
React + TypeScript
        |
Tauri shell
        |
SQLite local database
```

The desktop application must run without internet access. Tauri packaging and the `.exe` build script will be added after core offline CRUD is stable.
