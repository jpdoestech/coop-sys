# Reports Workspace

Reports provides membership, workforce and branch/client deployment registers.
Search, status, type, department, BOD approval, placement, joined/hired date and
needs-attention filters apply before counting, sorting and pagination. Deployment
totals describe current placement, not historical assignments or payment periods.

## Access

Users need `reports.view` and the source module's `members.view` or
`employees.view`. Existing branch/client/self scopes apply independently of UI
filters. Excel, CSV and printing additionally require `reports.export` and the
corresponding source module's export permission. These reports exclude government
IDs and contact details. They are read-only and never change underlying records.

## Database Pagination

- Supabase: apply `supabase/migrations/0027_reports_workspace.sql` before deploying
  the updated frontend. The security-invoker RPC uses existing table RLS and
  computes filtered counts, sorting, grouping and page limits in PostgreSQL.
- SQLite database server: rebuild with the existing `build-database-exe.bat`.
  `/api/reports` enforces authenticated permissions and scopes, and queries the
  stored JSON records using SQLite JSON functions with database-side pagination.
  No database-schema conversion or data reset is required.
- Browser-only offline mode: existing local storage is used as a fallback. This
  is not database-backed pagination; use the SQLite server for large shared offline
  datasets.

## Export and Print

Exports and prints include all matching rows, not just the visible page, fetched
in batches of 500. Generation is capped at 50,000 rows; narrow the filters for
larger selections. Excel includes a Report Filters sheet, frozen headers and
text-formatted identifiers. CSV and Excel protect text from spreadsheet formula
interpretation. Printing asks for portrait or landscape and opens a new tab.
Exports contain current data; concurrent edits during generation may change the
result between batches.
