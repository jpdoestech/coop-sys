# Activity Feedback

`LoadingProgress` is the shared, responsive loading display. Known totals show a
measured percentage and completed/total counts. Requests without progress telemetry
use an explicitly labeled estimate, capped at 90% until the request finishes.
An estimated number is never exposed as an exact ARIA progress value.

`withActivity(label, async (report) => ...)` adds an operation to the shared status
indicator and removes it in `finally`, including failed operations. Call
`report(completed, total)` for measurable work. Report saved rows only after their
write completes; do not count prepared payment rows as committed transactions.
Single database batch requests remain estimated until the server confirms success.

Member/employee validation and import, aliases, and refund import report row counts.
Shared authentication, route, dashboard, table, payment-history, address, and
maintenance loading views use the same percentage component.

Await `showTransactionSuccess(title, message)` before clearing a successful bulk
form, closing its modal, or switching views. The shared native dialog displays the
result and waits for Done (or Escape), traps keyboard focus, and queues concurrent
notices. Partial person imports report successful and failed counts and retain
failed rows for review. Failed operations do not display a success notice.

No migration is needed for this update. Rebuild the offline EXE manually to package
the updated UI.
