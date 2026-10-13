# Payroll Foundation

This phase adds setup records and date resolution, not a production payroll engine.
The sidebar Payroll workspace contains Worksites, Wage Rules, Client Defaults,
Employee Terms, Daily Overrides, Cooperative Policy, and Employee Deductions.

## Deployment and Access

- Apply `supabase/migrations/0035_payroll_foundation.sql` and
  `supabase/migrations/0036_daily_attendance.sql`, then deploy the frontend.
- Rebuild the database-server EXE for the SQLite/LAN deployment.
- Super Admin can use setup immediately after deployment. Other users need
  explicit `payroll.view` or `payroll.manage` permissions and organization-wide scope.
  Employee lookup also requires `employees.view`, and organization selectors
  require access to the organization directory.
- Salary setup is not exposed through generic employee exports or employee imports.
- Worksite and rate data are intentionally empty; official wage values are not seeded.

## Record Semantics

Existing versions cannot be edited. New versions require an effective date and
change reason. Archive is available for correcting setup mistakes; the stored
history remains. In-use worksites cannot be archived. Approved attendance protects
its referenced terms and worksites from archival. There are no approved
payroll snapshots yet, so archived setup records are excluded from previews.
Before payroll runs are added, archival and retroactive corrections must gain
approved-run dependency checks and adjustment workflows.

Employee terms are full snapshots of the worksite, duty, pay basis, rates,
allowances, shift and rest days. Copying client defaults is explicit, not a live
link: changing defaults does not silently modify employee agreements. A new
employee version is required to adopt revised client terms.

The latest version effective on the work date supersedes earlier versions.
An expired later version does not revive older terms. Duplicate effective dates
for the same version family are rejected. A daily override covers one date and
does not permanently modify the base assignment.

Direct monthly salary and daily-reference-rate times a configurable salary
factor are supported. The factor is not attendance, a paid-day entitlement,
or a statutory hourly/daily conversion. The preview flags monthly arrangements
for policy review rather than certifying minimum-wage compliance.

## Wage Register

Each wage series identifies one region and reviewed coverage category. Record
wage-order/tranche effectivity, the daily minimum and its official source URL.
Worksites link to a series. The date preview checks the applicable series version,
review status, region/category match and reference daily rate. It does not determine
legal coverage or exemptions from a client's free-text category.

Review actual worksite locality, industry, establishment category and applicable
order before marking a rule reviewed. Official references:

- https://nwpc.dole.gov.ph/statistics/summary-of-latest-wage-orders-issued-by-the-regional-boards/
- https://dole.gov.ph/handbooks/

## Cooperative Deductions, Loans and Advances

The cooperative contribution defaults to PHP 50 per cutoff. Effective-dated
Cooperative Policy records change that default. An employee deduction plan may
follow the default or use an explicitly requested fixed amount, such as PHP 100.
Subsequent default changes do not overwrite fixed employee requests. A later
follow-default plan can return the employee to the common policy.

The cooperative installment amount is separate from Payment Settings, which
controls the membership-fee/share-capital obligation. Loan and advance plans
have their own references, opening balances and fixed installments; they do
not share the cooperative contribution balance. The change reason records
the authorization reference; consent/document storage is not yet implemented.

No deduction or payment is posted by setup or date previews. The eventual payroll
engine must determine the approved deduction date for each cutoff, deduct once
per plan/cutoff, cap cooperative contributions against the refund-adjusted
remaining obligation from Payment Settings, cap loans/advances against their
remaining ledgers, and respect available net pay and authorized deduction rules.
It must never count the per-cutoff contribution once per attendance day.

## Next Phase

Daily manual attendance, Excel imports, multiple punch segments, draft correction
history and approval locks are available; see `attendance.md`. Multiple independently
assigned duties within one day are not yet supported. Approved cutoff calendars
and proration/conversion policies; statutory calculations; loan
repayment ledgers; payroll approval snapshots; adjustment workflows; payslips;
and duplicate-safe cooperative posting remain separate implementation steps.
This phase does not calculate or disburse salaries and is not compliance certification.
