# Ordinary-Day Calculation Preview

Payroll Runs > Calculation rules contains immutable worksite policy versions and
day classifications. Policy versions identify a payroll group, effective date,
regular paid minutes, short-day treatment, worked-day allowance treatment, review
state and reference. Calendar classifications identify each date explicitly;
unclassified dates are never treated as ordinary by default. A 1-31 day calendar
batch shares one explicitly selected classification and review reference. Review
each holiday/local suspension separately. New versions supersede earlier versions,
including when the newest version has not yet been reviewed.

Run preparation > Draft calculation displays a live ordinary-day estimate. It
requires approved matching attendance, applicable daily terms, reviewed wage
coverage, reviewed calculation policy and reviewed ordinary-day classification.
The scheduled net regular minutes must match the policy. Full ordinary days use
the dated daily rate; a reviewed proportional short-day policy uses actual worked
minutes / regular minutes. Worked-day allowances follow the explicitly selected
full or proportional treatment. Each day's base and each allowance are rounded
half-up to integer centavos using integer arithmetic. Rates effective on a work
date apply to that date, including daily overrides.

Monthly wages, paid leave, holidays/special days, rest-day work, night/overnight
work, outside-shift work/overtime, unreviewed allowance treatment and cutoff/monthly
allowance allocation block the employee subtotal. Absence, unpaid leave and
scheduled non-working rest days yield no ordinary daily base or worked-day allowance
only after their terms, calendar and attendance checks pass. Missing/stale terms or
attendance block the estimate. A blocked employee is not displayed as zero pay.

The preview shows attendance, terms, policy and calendar IDs for each day. It
lists page-scoped resolved subtotals separately from blocked employees. These are
not final gross/net payroll totals or approved calculation snapshots. The runs
list continues to show Not calculated. Salary approval, release and payslips are
unavailable, and no payment or deduction is posted.

For linked cooperative members, the existing effective-dated default or fixed
employee-request installment is shown once per employee/cutoff at period end.
It is a planned installment only: no refund-adjusted obligation cap, consent check,
available-pay cap or cross-run consolidation has been applied. It is not subtracted
from the subtotal. Net pay, statutory deductions and loan/advance amortization
remain unavailable until their ledgers and reviewed rules are implemented.

Deploy `0039_ordinary_day_calculation_preview.sql` after 0035/0036/0038 and rebuild
the LAN server. Database writes use dedicated payroll-management RPCs/endpoints;
ordinary users cannot replace rules or fetch private preview sources. Supabase
returns at most 100 employees' dated sources per page, with the applicable policy
and calendar versions. Local/LAN JSON scans are not certified for 500,000 rows.

This is a restricted calculation building block, not Philippine payroll compliance
certification. Review entitlement and lawful deductions using [DOLE's employment
conditions](https://dole.gov.ph/book-3-conditions-of-employment/) and
[DOLE's statutory-benefits handbooks](https://dole.gov.ph/handbooks/). Register actual
applicable effective wage orders from [NWPC's regional wage-order register](https://nwpc.dole.gov.ph/statistics/summary-of-latest-wage-orders-issued-by-the-regional-boards/).
No official rates, multipliers or holiday calendar were automatically seeded.
