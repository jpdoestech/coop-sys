# Daily Attendance

Payroll > Attendance supports manual daily entry and Excel imports. Attendance
does not calculate salaries, premiums, statutory deductions or cooperative payments.

## Access and Deployment

Apply migrations 0035 and 0036 for Supabase. Rebuild the SQLite/LAN database-server
bundle for local server deployments. Organization-wide `payroll.view` is required
to read attendance, `payroll.manage` to create or correct drafts, and
`payroll.approve` to lock records. Super Admin has these permissions by default.
Employee selection also requires employee-directory access.

## Entry and Import

Each employee/work date has one current record. Statuses are present, absent,
paid leave, unpaid leave and rest day. Dated employee terms or a daily override
must exist. Rest-day entries must match the applicable schedule. A reason or
attendance reference is required, and dates must fall within employment dates.

Present records contain up to 12 non-overlapping punch segments. Times have
whole-minute precision; explicit next-day flags identify overnight punches.
Unpaid breaks are entered per segment. Adjacent work dates cannot overlap.
Worked minutes, late arrival and early departure are raw measures, not payable
hours, salary penalties, approved overtime or statutory night premiums.

Download the Excel template from the attendance toolbar. Imports accept up to
500 worksheet rows per batch and use exact six-digit employee IDs, not guessed
names. Multiple present rows for one employee/date/reason combine into segments.
Preview separates valid records from errors. Save valid records writes that
subset atomically; existing days must be corrected rather than imported twice.
Concurrent changes are checked again when saving. This batch limit is not a
claim that the local JSON store is optimized for 500,000 attendance records.

## Corrections and Approval

Correcting a draft creates a new revision and preserves the superseded record.
Approval checks the applicable terms again and locks the current record. Approved
records cannot be edited, replaced or deleted. Approved-record corrections need
a future adjustment workflow. Review history is available under More Filters.

The term snapshot and Rate at entry preserve what was applicable when recorded.
New effective-dated agreements may still be created later. The future payroll
engine must resolve the correct dated agreement again before payroll approval,
handle retroactive adjustments explicitly and freeze approved payroll separately.
Attendance approval alone does not approve salary amounts or legal compliance.
