# Data Maintenance

Only an active Super Admin can access Settings > Data maintenance. Supabase RPCs
and the SQLite server API enforce this independently of the UI and configurable
permission grants.

## Deployment

- Apply `supabase/migrations/0025_super_admin_data_cleanup.sql` to enable cloud cleanup.
- Rebuild the database-server EXE to enable SQLite cleanup. No SQLite schema change
  or deletion of the existing database file is required.
- Browser-offline cleanup acts only on that browser's local records.

## Operations

- Archive selected records, or all unassigned records, with `ARCHIVE` confirmation.
  Linked member/employee records are archived together. Financial history is retained.
- Permanently delete selected records, all unassigned records, or all records of the
  chosen kind with `DELETE` confirmation. Related payments, corrections, refunds,
  settlements, aliases, beneficiaries, assignments and document metadata are removed.
- Reset people and transactions with `RESET` confirmation, regardless of the chosen
  record kind. Users, credentials, roles, organization/reference setup, payment settings
  and maintenance audit history are preserved. User employee links become null.
- An unassigned employee has no current branch deployment. Head Office employees
  without clients are assigned, not unassigned. A linked member uses the employee's
  actual deployment rather than an outdated intended-placement field.

Selection may span pages (maximum 500 IDs). Cloud and LAN pagination runs on the
backend. Select-this-page affects only that page. All/unassigned operations run over
the complete corresponding dataset and ignore the search and archive-state filters.
Unassigned cleanup excludes already archived records; selected/all cleanup includes
them. Always inspect the confirmation scope.

Back up first. Permanent cleanup cannot be undone. Disconnect replicas before
permanent deletion/reset; a disconnected replica still containing old records can
restore them if later reconnected without being cleaned. The LAN API rejects
permanent operations while a replication remote is configured. Archiving retains
sync deletion markers. Uploaded object-storage binaries are not purged by deleting
document metadata; storage retention should be managed separately.

## Import Corrections And Progress

Click an unimported row or its employee/member name to open its complete imported
field editor. Search field labels or filter validation categories, then apply the
correction. The entire workbook is revalidated, including duplicate IDs; only the
edited row's save-failure result is cleared. Imported and partially saved rows stay
locked to avoid duplicate creation. Remaining issues stay in the preview.

The shared activity indicator covers queries, mutations, server requests, Excel
reading, person imports and payment export/print preparation. It appears for slow
operations rather than flashing for quick requests. Cleanup and import controls also
show explicit pending states and protect navigation while processing.
