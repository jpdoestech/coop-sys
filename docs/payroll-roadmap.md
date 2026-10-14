# Payroll Roadmap

## Delivered

- Effective-dated worksite, rate, schedule, allowance and deduction setup.
- Daily attendance records, Excel imports, correction history and approval locks.
- Team worksheet: worksite/date and department filters, selected-row defaults,
  bulk absence/leave, inline punches, page-level exceptions and guarded saves.
- Payroll Runs preparation: explicit cutoff periods/pay dates, draft history,
  cancellation references, overlap protection and live attendance coverage checks.
- Reviewed calculation policy/calendar versions and ordinary-day daily base plus
  worked-day allowance previews with source IDs and explicit unsupported-case blocks.

## Next Dependencies

Multiple independently assigned duties within a day require effective assignment
segments and an explicit premium/rate allocation policy. Punch segments alone do
not represent separate paid duties. Next establish client-specific cutoff calendars,
monthly proration/conversion policies, reviewed premium rules, leave/holiday
classification, authorized overtime, statutory tables and deduction ledgers.

## Payroll Runs (Preparation Delivered)

The user's reference image informs the future operational list, not a visual clone.
The list should show run title, client/payroll group, frequency, period start/end,
pay date, employee count, gross pay, total deductions, net pay, status and actions.
Search, compact filters, pagination and icon actions should match this system.

A run needs preparation and validation before calculation, explicit review and
approval, immutable approved calculation snapshots, controlled release, payslips
and exports. Totals must reconcile to employee calculations. Blocking exceptions
must prevent approval; retroactive rate or attendance corrections require linked
adjustments rather than overwriting an approved run. Cooperative posting must be
duplicate-safe per employee/plan/cutoff and use refund-adjusted obligations.

Payroll Runs is available for preparation and restricted ordinary-day estimates,
not final salary calculation or release. Employee
counts are calculated live in the preparation detail. Gross/net totals intentionally
show Not calculated, not zero. Reviewed attendance does not approve salaries or
authorize payroll release. See `payroll-runs.md` and `payroll-calculation.md` for
deployment and boundaries.
