# Data Access and Pagination Standard

All persisted record tables must paginate through a repository or database query. A page component must never load an unrestricted persisted collection and then use `Array.slice` as its primary pagination mechanism.

## Query contract

- Send search, filters, sort key, sort direction, limit, and offset to the repository.
- Return only the requested records plus an exact filtered total.
- Apply RBAC scope in the query or through database row-level security before counting and paging.
- Reset the UI to page 1 when search, filters, sorting, or page size changes.
- Keep table headers sticky and expose page sizes through the shared `PaginationControls` component.
- Add indexes for common scope, date, and foreign-key filters.

## Full-result operations

Exports and print reports are explicit full-result operations. They use a separate repository path and must not reuse or infer data from the visible page. For very large exports, the production implementation should move workbook generation to a queued server job rather than accumulating rows in the browser.

## Client-side exceptions

Client-side paging or rendering is allowed only for bounded transient data that does not yet exist in the database, such as an Excel validation preview. Reference-data controls may cache small lookup directories, but their administrative record tables still use repository pagination.
