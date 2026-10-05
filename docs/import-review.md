# Person Import Review

## Blocking Checks

Required names, email syntax, government-ID characters and lengths, mobile numbers,
date validity, and duplicate identities remain validated. Exact normalized full
names, case-insensitive emails, and government-ID digits are checked within the
workbook and against records accessible to the importing account. Selecting an
existing counterpart allows linking the same person instead of duplicating them.
Database-wide cross-scope identity uniqueness is not guaranteed by these client
checks; RBAC does not expose other branches' personal information.

Similar names within the same normalized surname group are review warnings, not
automatic links or blocking matches. IDs cannot be changed in the correction
editor. An uploaded ID is retained, or the system generates a six-digit ID.

## Guidance Values

Department, position, affiliation, and other person lookup controls offer searchable
suggestions and accept custom text. Unknown foreign-key labels are retained in
`import_attention`; they are not inserted as invalid IDs. Existing/default IDs are
kept where applicable. Approval defaults to pending for unrecognized values.
Unknown departments/positions also use `pending_department_name` and
`pending_position_name`, allowing their original labels to appear in the list.

Orange controls and the Needs attention card identify unresolved fields before
import. Ready rows can include warnings. After import, Members and Employees
provide a Needs attention filter and per-field review actions in the record form.
Selecting a known value clears its warning; explicit review can acknowledge an
accepted custom value. Pending department/position mappings continue to be flagged
until resolved. Branch/client placement and authorization controls always remain
restricted to valid, authorized choices.

## Inline Classification Creation

Member, employee, and import correction forms share classification and affiliation
controls. Users with `organization.create` can add departments and positions without
leaving a person form. New records are immediately selected. A position must use an
existing active department. Cloud RLS separates creation, editing, and deletion;
the database-server storage API also checks organization changes by action.

## Deployment

Apply `supabase/migrations/0026_import_review_and_classification.sql` before deploying
the updated cloud application. This migration adds review metadata, pending labels,
member classification fields, linked classification synchronization, and separate
department/position policies. It does not delete existing records.

The cloud Needs attention predicate is applied before range/count pagination. Local
repositories apply it before their existing pagination. Rebuild the database-server
EXE to include the updated UI and server checks; no EXE is rebuilt automatically.

Use Download template in the import dialog for the current lookup suggestions and
member classification columns. Existing workbooks without these optional columns
remain supported.
