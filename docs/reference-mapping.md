# Reference Workbook Mapping

The sample workbook at `.sample_files/share_cap.xlsx` is a read-only domain reference. It is not imported automatically and is not application seed data.

## Registration Mapping

| Workbook field | System ownership |
| --- | --- |
| Name and contact details | Member profile; authoritative when linked to an employee |
| Membership number, type, acceptance date | Member profile |
| TIN, education, occupation/income, dependents, beneficiary, affiliation | Extended member profile |
| Branch/client assigned | Employee assignment history |
| Membership termination details | Member profile |
| Initial share subscription values | Not implemented; financial accounting is outside scope |

## Relationship Rules

- A member can exist without being an employee.
- An employee can exist without being a member.
- `employees.member_id` links both roles for the same person.
- For a linked employee, personal and contact details are read from the member profile; employment-only information remains on the employee record.
- An employee can have many branch/client assignments over time, but only one active assignment.
- Placement follows `Head Office > Branch > Client > Member/Employee`. Head Office may employ linked members directly without a branch or client.
- Transfers preserve prior assignments and can move employees between Head Office, direct branch placement, and branch-client placement.
- Payment, share certificate, balance, and paid-share rows remain outside this information-management system.
