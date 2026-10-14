# Cutoff Attendance Grid

Payroll opens on Payroll Runs. Select branch/client, worksite and payroll group,
enter the attendance cutoff and payout date, and create the cutoff. Creation opens
attendance immediately in the main page, replacing the runs list without a modal,
overlay or decorative frame. Back to Payroll Runs restores the list's filters and
page and guards unsaved attendance. The shell's desktop sidebar can be collapsed
without unmounting the cutoff or discarding its drafts. The payroll workspace has
a viewport-bound height and scrollable table area; few or zero rows do not shrink
the workspace or move pagination up. Optional titles and references live under Additional
details; blank titles use the payout month and worksite. Cutoffs may cross months
and years, with a maximum of 31 inclusive calendar days. Payout cannot precede the
last attendance date.

The grid follows the supplied attendance-mockup.zip interaction while retaining
the system's fonts, compact controls, borders and green accent. Employee names and
date headings remain frozen while scrolling. Each row shows absence, day-off,
leave, AWOL/AWOP, present-day equivalents, late minutes and undertime minutes.
These live totals include unconfirmed assumptions and are not approved payroll.

## Entry

- Pick Present, Absent, Leave, Day-off, AWOL/AWOP or Late/Undertime.
- Click or drag a rectangular block of dates. Touch pointer gestures are supported.
- Right-click an editable cell for its quick transaction menu.
- Late/Undertime opens a dialog for the selected dates. Scheduled duties come from
  effective employee terms. Actual times are applied together only when the duty
  schedules match; different schedules require separate selections.
- Undo/redo operates on staged grid changes. Nothing saves merely by selecting a
  transaction. Approved dates and dates outside assignments cannot be edited.
- Confirm page defaults, or select employees and confirm only their defaults,
  before saving any blank-day assumptions. Explicit exceptions remain unchanged.
- Save draft persists all staged dates atomically. An optional DTR reference can
  replace the automatic cutoff reference. Attendance approval remains separate.

Each account can choose exception-only encoding (blank = assumed present) or
present-required encoding (blank = assumed absent). The preference is saved in My
attendance preferences and personal settings, not shared with other accounts.
Scheduled rest days remain rest days. Missing terms and known non-ordinary dates
never become assumed present or absent.

Daily worksheet is an optional secondary view. Excel import is available inside
the cutoff, checks date and assignment scope, and uses the same atomic save.
Legacy standalone attendance entry is not exposed in the primary payroll flow.
Employee profile terms, bulk updates and effective rates remain the source of
schedule/rate data; ordinary cutoff entry does not create new pay-term versions.

## Persistence And Deployment

Apply `0042_attendance_preferences.sql` and `0043_attendance_matrix.sql` after
0041 when authorized. No production migration was applied during implementation.
0042 restricts preferences to the authenticated account. 0043 adds AWOL/AWOP,
validates split duties and provides `save_cutoff_attendance` with active-run,
assignment, stale-source, duplicate, overlap and approved-record guards. Batches
support at most 100 employees / 3,100 dates; all 500-record chunks share one SQL
transaction. A manually selected unscheduled day-off creates its one-day override
within that same transaction, not a second user workflow.

Rebuild the LAN server bundle to include the dedicated cutoff endpoint and
per-account preference storage. Offline saves validate both attendance and setup
before committing them without yielding between writes. LAN saves use a SQLite
transaction. Cloud saves use the guarded RPC. Client paging limits the visible
roster to 25, 50 or 100 employees rather than loading all employee-days.

Verification includes interaction tests, native browser drag/time-input checks,
local repository atomic-save tests, LAN permission/preference-isolation tests and
a rollback-only isolated PostgreSQL fixture exercise of both new migrations.
That fixture verified a 501-record save, failure in a later chunk, day-off override
rollback, AWOL, split-duty acceptance and own-account preference RLS. It does not
replace deployment verification against the complete production schema.

## Boundaries

The location/city Holiday Master shown in the reference is not implemented here.
Existing reviewed worksite calendar rules can annotate Legal, Special or suspended
dates; these are not automatic premium calculations. Final payroll posting,
statutory deductions, monthly conversion, salary release, payslips, scoped salary
RBAC and loan repayment ledgers remain separate phases. Organization-wide payroll
permissions are still required; selecting a branch/client does not grant salary
access. Local/LAN JSON scans are not certified for 500,000-row workloads.
