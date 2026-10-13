# Payroll Roadmap

## Delivered

- Effective-dated worksite, rate, schedule, allowance and deduction setup.
- Daily attendance records, Excel imports, correction history and approval locks.
- Team worksheet: worksite/date and department filters, selected-row defaults,
  bulk absence/leave, inline punches, page-level exceptions and guarded saves.

## Next Dependencies

Multiple independently assigned duties within a day require effective assignment
segments and an explicit premium/rate allocation policy. Punch segments alone do
not represent separate paid duties. Next establish client-specific cutoff calendars,
monthly proration/conversion policies, reviewed premium rules, leave/holiday
classification, authorized overtime, statutory tables and deduction ledgers.

## Payroll Runs (Planned)

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

Payroll Runs is not implemented or exposed as an empty tab yet. Attendance review
does not calculate salaries or authorize payroll release. No compliance claim is
made by this foundation.
