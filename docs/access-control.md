# Access control

## Roles

| Role | Scope | Member and employee access | User administration |
| --- | --- | --- | --- |
| Super Admin | Organization | Manage | Manage |
| General Manager | Organization | Manage | None |
| HR Manager | Organization | Manage | None |
| Accounting Manager | Organization | View | None |
| Head Office Staff | Organization | Manage | None |
| Branch Admin | Assigned branches | Manage | None |
| Branch User | Assigned branches | View | None |

Branch scope follows the employee's current active placement. A member is visible to a branch role when the member is linked to an employee currently assigned to one of that user's branches. Branch Admin creates new member records through the employee workflow so the branch relationship is established at the same time.

## Enforcement

- Navigation and route guards hide unavailable modules.
- Repository hooks filter records and reject unauthorized changes in offline mode.
- Supabase row-level security limits employee, member, client, and assignment reads to assigned branches.
- `user_branch_access` supports one or more branch assignments for each branch-level user.
- Only Super Admin can maintain system-user role and branch assignments.

The active access profile always comes from the authenticated session. Online mode resolves roles and branch assignments from Supabase. Offline mode resolves them from the authenticated device-local account; changing browser storage alone does not create an authenticated session.
