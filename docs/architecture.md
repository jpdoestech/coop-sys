# Architecture

## Objective

The system is a cooperative membership database plus lightweight employee information manager. It keeps sensitive records usable online through Supabase and offline through a local desktop database.

## Logical Architecture

```text
React + TypeScript + Vite
        |
        v
Application services and repositories
        |
        +--------------------+
        |                    |
        v                    v
Supabase repositories    Local repositories
PostgreSQL/Auth/Storage  SQLite for Tauri desktop
```

The UI should not directly couple feature screens to Supabase. Screens call services/repositories selected from the active application mode.

## Application Modes

- `ONLINE`: Uses Supabase repositories. Failures surface to the user.
- `OFFLINE`: Uses local repositories and queues changes for later sync.
- `AUTO`: Uses Supabase when reachable and falls back to local repositories when offline.

## Folder Structure

```text
src/
  app/
  components/
  database/
    sqlite/
    supabase/
  features/
    dashboard/
    members/
    employees/
    departments/
    positions/
    documents/
    reports/
    synchronization/
    audit-logs/
    settings/
  hooks/
  services/
    auth/
    repositories/
    sync/
  types/
  utils/
```

## Authentication And Authorization

Online authentication uses Supabase Auth. Application roles are stored in `roles` and `user_roles`, with policies enforced through Supabase Row Level Security.

Offline desktop authentication will use a local user table with password hashes managed by the desktop layer. Plain-text passwords are never stored.

Initial roles:

- Administrator
- HR / Manager
- Viewer

## UI Direction

The UI is desktop-first and operations-focused, with responsive layouts for tablets and mobile browsers. It favors clear navigation, compact data presentation, readable forms, and visible sync state over decorative complexity.
