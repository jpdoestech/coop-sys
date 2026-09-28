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

## Initial Conflict Rule

The first implementation uses last-modified wins:

- If `local.updated_at > server.updated_at`, local wins.
- If `server.updated_at > local.updated_at`, server wins.
- Every conflict is logged in `sync_conflicts` and `sync_logs`.

The sync layer is structured so a manual conflict-resolution UI can be added later.

## Data Safety

Sync failures must not delete local data. Failed queue items remain pending or become conflict records with enough context for administrators to inspect later.
