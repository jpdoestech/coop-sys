# Payroll Run Preparation

Payroll > Payroll Runs creates explicit, immutable preparation periods for a
worksite, payroll group and frequency. A run has a title, period start/end, pay date
and preparation reference. Pay date cannot precede period end. This phase supports
at most 31 calendar days per preparation period; client cutoff dates are entered
explicitly rather than guessed from frequency. Reusable cutoff calendar templates
are a future phase.

Organization-wide payroll readers can list runs and inspect coverage. Payroll
managers create/cancel drafts. No salary, deduction, cooperative payment or refund
is posted. Active runs cannot overlap for the same worksite and normalized payroll
group, even if frequency differs. Correct a mistaken period by cancelling it with
a reason and creating a replacement. Cancelled history is retained and cannot be
restored through the app. Salary approval, release and payslips are unavailable.

Preparation detail counts dated assignment-days, not payable days. Each date uses
the applicable latest terms or daily override and excludes dates outside employment.
Only matching worksite, payroll group and frequency are included. Expired latest
terms remain blockers without reviving earlier agreements. Rest days still need
reviewed attendance. Missing records, draft records, changed term sources and
missing/expired terms are reported with their dates. Fully reviewed attendance is
labelled Attendance complete, never Payroll ready or Calculated. Zero coverage is
an explicit warning. Employees without any dated assignment are not inferred.

These are live checks, not frozen payroll approval snapshots. Cross-worksite or
group assignments can produce coverage in multiple preparations. The future salary
engine must consolidate employee entitlements and prevent duplicate attendance,
deductions and cooperative postings across runs. Statutory rules, wage coverage,
premiums, authorized overtime, leave/holiday policies, monthly conversions and
multiple independent paid duties still require implementation and review. Changed
terms on approved attendance require a future adjustment workflow.

Deploy migration `0038_payroll_run_preparation.sql` after 0035/0036 and rebuild the
LAN database-server bundle. Cloud/LAN return paged employee coverage and full
run totals, but local/LAN JSON scans are not certified for 500,000-row workloads.
Run data is excluded from generic employee imports and exports; LAN writes use
dedicated permission-checked endpoints, not generic storage replacement.

## Cutoff Workspace

Payroll opens on Payroll Runs. Creating a run selects branch, client (or agency),
worksite and the explicit cutoff. Worksite search is restricted to that placement
and its query cache is partitioned by the selection.

Run preparation includes Attendance / Workdays and Employee setup. The attendance
worksheet fixes the run's worksite, restricts dates to the cutoff and filters group
and frequency before paging. It retains bulk schedule/absence/leave entry and the
existing approved-record locks. No presence is inferred merely from a schedule.
Unsaved worksheet edits are guarded when changing views or closing preparation.

Employee setup selects cutoff employees across pages for reviewed bulk terms or
allowance changes and dated deduction plans. Changes to base terms begin within
the cutoff but remain contractual versions beyond it unless explicitly expired.
Cooperative, loan and advance plans are still setup, not posted deductions. A
cutoff-limited plan does not silently restore an earlier employee-specific plan
after expiry; following cooperative defaults remains the fallback behavior.

Deploy `0041_attendance_cutoff_workspace.sql` after 0040 and rebuild the LAN server.
Organization-wide payroll permission remains required. Branch/client-scoped salary
RBAC, cutoff-only compensation transactions, loan repayment balances and deduction
posting are not implemented by these workflow controls.
