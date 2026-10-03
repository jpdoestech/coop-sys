# Synchronization Strategy

## Record Metadata

Important records include:

- `id`
- `created_at`
- `updated_at`
- `deleted_at`
- `sync_status`

Offline-created records use UUIDs so they can be uploaded safely later.

## Sync Flow

```text
User edits offline
    |
Local repository saves record and adds sync_queue item
    |
Connectivity returns
    |
Sync engine pushes pending local changes
    |
Sync engine pulls server changes
    |
Conflicts are detected and logged
    |
Local database marks synchronized records as synced
```

## Current Transport Boundary

Synchronization is available only in the SQLite database-server build and is
restricted by `sync.view` and `sync.manage`. Its current remote endpoint is
another Cooperative Records database server at `/api/replication/exchange`.
It does not currently write to Supabase's normalized member, employee, payment,
and access-control tables. A Supabase synchronization bridge must map each data
group to those tables before the offline server can safely synchronize with the
Vercel deployment.

## Initial Conflict Rule

The first implementation uses last-modified wins:

- If `local.updated_at > server.updated_at`, local wins.
- If `server.updated_at > local.updated_at`, server wins.
- Every conflict is logged in `sync_conflicts` and `sync_logs`.

The sync layer is structured so a manual conflict-resolution UI can be added later.

## Data Safety

Sync failures must not delete local data. Failed queue items remain pending or become conflict records with enough context for administrators to inspect later.
