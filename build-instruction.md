# Cooperative Membership & Employee Management System

## Build Prompt

You are a senior full-stack software architect and developer. Build a modern **small, maintainable Cooperative Membership & Employee Management System**.

The system is **NOT a full HRIS**. Keep the scope intentionally small.

It should primarily manage:

1. Cooperative members
2. Employee information
3. Basic employee management
4. Basic organizational/department information
5. Employee documents and status information
6. Basic search, filtering, reporting, and export

The application must work **online and offline**.

---

# 1. Core Objective

Create a simple system for a cooperative organization to maintain accurate records of its members and employees.

Think of it as:

> **Cooperative Membership Database + Lightweight Employee Management**

Do NOT build payroll, accounting, recruitment, performance management, attendance, leave management, benefits administration, or a complete enterprise HRIS unless explicitly requested later.

The application should be simple enough for a small organization to operate and maintain.

---

# 2. Technology Requirements

## Frontend

Use:

- React
- TypeScript
- Vite
- Tailwind CSS
- Responsive design

The frontend must be deployable to:

- GitHub Pages
- Vercel

It should work well on:

- Windows desktop
- Laptop
- Tablet
- Mobile browser

GitHub Pages and Vercel deployments should not require major code changes.

---

# 3. Backend / Cloud Database

Use:

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage where necessary

The Supabase project must be compatible with the **free tier**.

Do not introduce paid infrastructure unless absolutely necessary.

The cloud version should be accessible through the Vercel deployment.

Architecture:

```text
Browser
   ↓
React + TypeScript
   ↓
Supabase Client
   ↓
Supabase
   ├── PostgreSQL
   ├── Authentication
   └── Storage

4. Offline / Hybrid Requirement
This is a critical requirement.

The application must support two operating modes.

Online Mode
Frontend
   ↓
Supabase
   ↓
PostgreSQL

Data is stored in Supabase PostgreSQL.

Offline Mode
Frontend/Desktop Application
   ↓
Local Database
   ↓
SQLite

The application must remain usable without an internet connection.

5. Desktop / Windows Application
Create the architecture so the same application can eventually be packaged as a Windows desktop application.

Preferred approach:

Tauri

Alternative:

Electron

Prefer Tauri if practical because the application is relatively simple and a smaller desktop footprint is desirable.

The desktop application should use:

React + TypeScript
        ↓
Tauri
        ↓
SQLite

Do not make the desktop application dependent on an internet connection.

The Windows application should eventually be buildable as:

.exe

6. Database Compatibility
Design the database schema with PostgreSQL and SQLite compatibility in mind.

The logical schema should be as similar as possible between:

Supabase PostgreSQL

and:

Local SQLite

Avoid PostgreSQL-specific functionality in the core data model when an equivalent portable approach exists.

Supabase-specific functionality may still be used where appropriate, including:

Row Level Security

Supabase Auth

Supabase Storage

PostgreSQL-specific indexes

Document any differences between the SQLite and PostgreSQL implementations.

7. Synchronization
The application must support synchronization between:

Local SQLite
        ↕
Supabase PostgreSQL

The user must be able to work offline and synchronize later.

Each important record should have fields such as:

id
created_at
updated_at
deleted_at
sync_status

Use UUIDs where practical so records can be created offline and later synchronized safely.

Possible sync states:

synced
pending_create
pending_update
pending_delete
conflict

Basic synchronization flow:

User works offline
        ↓
Changes stored in SQLite
        ↓
Internet becomes available
        ↓
Application detects connection
        ↓
Pending changes are uploaded
        ↓
Server changes are downloaded
        ↓
Local database becomes synchronized

8. Conflict Handling
Do not silently overwrite data when a conflict occurs.

For the initial implementation, use a simple last-modified strategy:

If local.updated_at > server.updated_at:
    local change wins

If server.updated_at > local.updated_at:
    server change wins

However, record the conflict in a synchronization log.

Structure the system so a more advanced conflict-resolution interface can be added later.

9. Main Modules
Keep the application focused.

The main modules are:

Dashboard

Cooperative Members

Employees

Departments

Positions

Employee Documents

Reports

Synchronization

Audit Logs

Settings

10. Dashboard
Create a simple dashboard showing:

Total cooperative members

Active members

Inactive members

Total employees

Active employees

Employees by department

Recent employee/member changes

Synchronization status

Online/offline status

Do not over-design the dashboard.

11. Cooperative Member Management
Create a member management module.

Identification
Fields:

Member ID

Membership number

First name

Middle name

Last name

Suffix

Date of birth

Sex

Civil status

Contact
Fields:

Mobile number

Email

Address

Barangay

City/Municipality

Province

Postal code

Membership
Fields:

Membership date

Membership status

Membership type

Member category

Date of termination, if applicable

Reason for termination, if applicable

Additional Information
Fields:

Emergency contact

Notes

Profile photo

Keep exact fields configurable where reasonable.

12. Employee Management
Employees may or may not be cooperative members.

Personal Information
Fields:

Employee ID

Employee number

First name

Middle name

Last name

Suffix

Date of birth

Sex

Civil status

Contact Information
Fields:

Mobile number

Email

Address

Barangay

City/Municipality

Province

Postal code

Employment Information
Fields:

Employment status

Employment type

Date hired

Date regularized

Date separated

Position

Department

Supervisor

Work location

Possible employment statuses:

Active
Inactive
On Leave
Separated
Retired

Possible employment types:

Regular
Probationary
Contractual
Part-time
Temporary
Other

Do not assume these values are permanently fixed. Make them configurable if practical.

13. Employee Documents
Allow basic employee document records.

Examples:

Employment contract

Government ID

Resume/CV

Clearance

Certificates

Other documents

For the online version:

Store metadata in PostgreSQL

Store actual files in Supabase Storage

For offline mode:

Store files locally or use an appropriate local document-storage mechanism

Each document should contain:

Document ID

Employee ID

Document type

Document name

File path/storage reference

Date uploaded

Expiration date, if applicable

Notes

14. Departments
Create a simple department management feature.

Fields:

Department ID

Department code

Department name

Description

Department head

Active/inactive

Employees should reference departments through IDs rather than storing department names directly.

15. Positions
Create a simple position/job-title table.

Fields:

Position ID

Position code

Position title

Department

Description

Active/inactive

Employees should reference positions through IDs.

16. User Accounts and Access
Use Supabase Auth for online authentication.

Implement basic roles.

Administrator
Can:

Manage users

Manage members

Manage employees

Manage departments

Manage positions

Upload documents

Export data

Configure system settings

Manage synchronization

HR / Manager
Can:

View members

View employees

Add/edit employee records

Manage employee documents

View reports

Viewer
Can:

View records

Search records

View basic reports

The architecture should allow additional roles later.

For offline desktop usage, implement a local authentication mechanism appropriate for the desktop application.

Never store passwords in plain text.

17. Security
Employee and member information is sensitive.

Implement:

Authentication

Role-based authorization

Supabase Row Level Security

Secure database access

Input validation

File upload restrictions

Audit logging

Environment variables

Secure document access

Never expose:

Supabase service-role keys

Database passwords

Private API keys

Other secrets

The browser application must only use the appropriate Supabase public/anon key.

18. Audit Log
Track important actions such as:

Login

Logout

Employee created

Employee updated

Employee archived/deleted

Member created

Member updated

Member archived/deleted

Document uploaded

Document deleted

User created

User role changed

Synchronization performed

Fields:

id
user_id
action
entity_type
entity_id
old_values
new_values
created_at
device_id

Do not store unnecessary sensitive information in logs.

19. Search
Implement fast search.

Employees
Search by:

Employee number

Name

Position

Department

Employment status

Members
Search by:

Membership number

Name

Member status

Member type

Provide:

Search

Filtering

Sorting

20. Tables
Use clean data tables with:

Pagination

Search

Filtering

Sorting

Column visibility where practical

View details

Edit

Archive

Restore

Export

For mobile screens, tables should transform into a usable card/list layout where appropriate.

21. Record Deletion
Avoid permanent deletion by default.

Prefer soft deletion:

deleted_at

Important records should be recoverable by an administrator.

The UI should distinguish:

Active
Archived
Deleted

where appropriate.

22. Import / Export
Export
Implement:

CSV

Excel-compatible format

PDF reports where practical

Import
Allow administrators to import:

Members

Employees

Departments

Positions

CSV import should include:

File selection

Column mapping

Validation

Preview

Error reporting

Confirmation

Import

Import summary

Never silently import invalid data.

23. Reports
Keep reports simple.

Employee Reports
Employee master list

Active employees

Employees by department

Employees by employment type

Employees by employment status

Member Reports
Member master list

Active members

Inactive members

Members by category/type

Allow filtering before export.

24. UI/UX
The UI should be:

Simple

Clean

Professional

Fast

Easy for non-technical staff

Desktop-first but responsive

Accessible

Suggested navigation:

Dashboard

Members
  ├── All Members
  ├── Active Members
  └── Archived Members

Employees
  ├── All Employees
  ├── Active Employees
  └── Archived Employees

Organization
  ├── Departments
  └── Positions

Documents

Reports

Synchronization

Audit Logs

Settings

Use a sidebar navigation on desktop.

Use a mobile-friendly navigation on small screens.

25. Online / Offline Indicator
Always show the current state:

🟢 Online
🔴 Offline
🟡 Synchronizing

Also display:

Last synchronized:
September 28, 2026 09:45

When offline, clearly indicate:

Working Offline — Changes will synchronize when connection is restored.

26. Sync Center
Create a synchronization page.

Show:

Connection: Online

Last Sync:
September 28, 2026 09:45

Pending Changes:
3

Conflicts:
0

Sync Errors:
0

Buttons:

Sync Now
Retry Failed Changes
View Conflicts
View Sync Log

If synchronization fails, do not lose local data.

27. Database Design
Create a normalized relational database.

At minimum consider these tables:

users
roles
user_roles

members
member_types
member_statuses

employees
employment_types
employment_statuses

departments
positions

employee_documents
document_types

audit_logs

sync_queue
sync_conflicts
sync_logs

system_settings

Add appropriate:

Foreign keys

Indexes

Unique constraints

Timestamps

Soft-delete fields

Do not create unnecessary tables merely for theoretical normalization.

Keep the database understandable to a future developer.

28. IDs
Use UUIDs for primary keys where practical.

Human-readable IDs can still exist:

Employee ID:
EMP-000001

Member ID:
MEM-000001

The human-readable identifier should not necessarily be the database primary key.

29. Database Migration
Create migration files for:

SQLite

and:

Supabase PostgreSQL

The repository must include the complete database schema.

A new developer should be able to clone the repository and initialize the database without manually creating tables.

30. Seed Data
Provide development seed data:

5 departments
10 positions
20 employees
50 cooperative members
3 users/roles

Use obviously fictional names and information.

Never use real people's personal information in seed data.

31. Environment Configuration
Create:

.env.example

Example:

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_MODE=

Do not commit actual credentials.

Document how to configure:

Development
Production
Offline/Desktop

32. Application Modes
Support explicit application modes:

ONLINE
OFFLINE
AUTO

AUTO
Automatically determine whether online Supabase access is available.

If unavailable:

Use local SQLite

When connectivity returns:

Synchronize local changes

33. Architecture
Prefer this architecture:

                 ┌──────────────────────┐
                 │     React Frontend   │
                 │   TypeScript + Vite  │
                 └──────────┬───────────┘
                            │
                 ┌──────────▼───────────┐
                 │   Application Layer  │
                 │                      │
                 │ Services / Repository│
                 │      Pattern         │
                 └───────┬───────┬──────┘
                         │       │
                  Online │       │ Offline
                         │       │
              ┌──────────▼─┐ ┌──▼─────────┐
              │  Supabase  │ │   SQLite   │
              │ PostgreSQL │ │   Local DB │
              └────────────┘ └────────────┘

The frontend should NOT directly depend everywhere on Supabase.

Use a repository/data-access abstraction.

For example:

interface EmployeeRepository {
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | null>;
  createEmployee(employee: Employee): Promise<Employee>;
  updateEmployee(id: string, employee: Employee): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;
}

Then implement:

SupabaseEmployeeRepository
SQLiteEmployeeRepository

This is extremely important because it makes the online/offline architecture maintainable.

34. State Management
Use a lightweight state management solution.

Possible choices:

TanStack Query

Zustand

Use the smallest practical solution.

Do not introduce a complicated architecture unnecessarily.

35. Validation
Use schema validation.

Preferred:

Zod

Validate both:

Form input

Imported data

Provide human-readable validation errors.

Examples:

Employee number is required.

Date hired cannot be later than today.

Department does not exist.

Email address is invalid.

36. Error Handling
The system must gracefully handle:

Network failure

Supabase unavailable

Database errors

Invalid data

Authentication failure

File upload failure

Sync failure

Duplicate records

Conflicts

Never silently fail.

Show useful error messages to the user.

37. Duplicate Detection
Implement basic duplicate detection.

For employees:

Employee number already exists

For members:

Membership number already exists

Optionally warn about possible duplicate people based on:

First name
Last name
Date of birth

Do not automatically merge records.

38. Testing
Include tests for important functionality.

Unit Tests
Test:

Validation

Employee service

Member service

Sync logic

Conflict detection

Integration Tests
Test:

Database operations

Authentication

CRUD operations

UI Tests Where Practical
Test:

Login

Employee creation

Employee editing

Member creation

Search

Offline mode

Synchronization

39. Deployment
Vercel
Document:

GitHub
  ↓
Vercel
  ↓
React application
  ↓
Supabase

Include required environment variables.

GitHub Pages
Provide a compatible build configuration.

Account for SPA routing issues on GitHub Pages.

Windows
Provide instructions to build:

.exe

using Tauri.

40. Local Development
A new developer should be able to do approximately:

git clone <repository>

npm install

npm run dev

and start the application.

Document all prerequisites.

If local Supabase development is useful, document it, but do not make local Supabase mandatory for the basic offline application.

41. Project Structure
Use a clean structure similar to:

src/
├── app/
├── components/
├── features/
│   ├── members/
│   ├── employees/
│   ├── departments/
│   ├── positions/
│   ├── documents/
│   ├── reports/
│   ├── synchronization/
│   └── settings/
├── services/
│   ├── repositories/
│   ├── sync/
│   └── auth/
├── database/
│   ├── sqlite/
│   └── supabase/
├── hooks/
├── types/
├── utils/
└── pages/

Adjust the structure if there is a better maintainable architecture.

42. Important Scope Restrictions
Do NOT implement these unless explicitly requested later:

Payroll

Payroll computation

Timekeeping

Biometric attendance

Leave management

Recruitment/Applicant Tracking

Performance management

Training management

Benefits administration

Government contribution computation

Tax computation

Accounting

General ledger

Cooperative financial accounting

Loan management

Share capital accounting

Dividend computation

Banking

Inventory

Procurement

CRM

The system should remain a:

Membership + Employee Information Management System

43. Philippine Context
The organization may operate in the Philippines.

Make common Philippine information configurable where appropriate, such as:

Philippine address structure

Province

City/Municipality

Barangay

Postal code

Mobile number

Do not hard-code assumptions that prevent the system from being adapted to another organization.

Do not implement Philippine payroll or tax rules.

44. Privacy
Employee and member data is sensitive.

Follow privacy-by-design principles.

Provide:

Role-based access

Minimal data collection

Audit logs

Secure authentication

Secure document access

Data export controls

Ability to archive records

Ability to remove records where appropriate

Do not expose employee information publicly.

45. Deliverables
Build the actual application, not merely a prototype mockup.

Provide:

Complete source code

Database schema

Supabase migrations

SQLite schema/migrations

Seed data

Authentication

CRUD functionality

Offline functionality

Synchronization

Basic conflict handling

Audit logs

Import/export

Reports

Responsive UI

Tests

README

Deployment instructions

Windows build instructions

Environment variable documentation

Architecture documentation

46. Development Approach
Do not try to build everything blindly in one huge implementation.

Build in phases.

Phase 1 — Foundation
Implement:

Project setup

React/TypeScript/Vite

Tailwind

Routing

Database abstraction

Supabase connection

SQLite connection

Authentication foundation

Basic layout

Phase 2 — Members
Implement:

Member database

Member CRUD

Member search

Member filters

Member details

Member import/export

Phase 3 — Employees
Implement:

Employee database

Employee CRUD

Departments

Positions

Search/filter

Employee details

Phase 4 — Documents
Implement:

Document records

File uploads

Document management

Phase 5 — Offline Mode
Implement:

SQLite

Offline CRUD

Offline indicator

Local authentication

Local data storage

Phase 6 — Synchronization
Implement:

Sync queue

Push local changes

Pull server changes

Conflict detection

Conflict log

Sync UI

Phase 7 — Security
Implement:

Roles

Permissions

RLS

Audit logs

Secure file access

Phase 8 — Reports and Export
Implement:

Reports

CSV

Excel-compatible exports

PDF where appropriate

Phase 9 — Deployment
Implement and document:

Vercel

GitHub Pages

Windows/Tauri

47. Important Engineering Rule
Before writing a large amount of code, first produce:

Architecture diagram

Database ERD

Database schema

Data synchronization strategy

Folder structure

Authentication/authorization strategy

Offline strategy

Deployment strategy

Then implement the system incrementally.

Do not create unnecessary abstractions.

Prioritize:

Reliability
Simplicity
Maintainability
Data integrity
Security
Offline capability

over visual complexity.

48. Final Acceptance Criteria
Online
A user can:

Login
 ↓
View dashboard
 ↓
Create member
 ↓
Edit member
 ↓
Search member
 ↓
Create employee
 ↓
Edit employee
 ↓
Assign department/position
 ↓
Upload employee document
 ↓
Search/filter employees
 ↓
View reports
 ↓
Export records

Offline
The user can:

Open Windows application
 ↓
Login locally
 ↓
View locally cached records
 ↓
Create/edit members
 ↓
Create/edit employees
 ↓
Search records
 ↓
Continue working without internet

Then:

Internet becomes available
 ↓
Sync
 ↓
Changes uploaded to Supabase
 ↓
Server changes downloaded
 ↓
Conflicts identified
 ↓
Local database synchronized

No user data should be lost during synchronization.

49. Development Instructions to the AI
You are responsible for making reasonable technical decisions where the specification does not dictate an exact implementation.

However:

Do not unnecessarily increase scope.

Do not introduce paid services.

Do not replace Supabase with another cloud database.

Do not remove SQLite/offline support.

Do not build a full HRIS.

Do not hard-code secrets.

Do not create fake backend functionality that only looks functional.

Do not leave core functionality as TODO placeholders.

Prefer working simple implementations over elaborate incomplete ones.

Explain important architectural decisions.

Keep the code modular.

Write documentation as you build.

Use migrations rather than manually created database structures.

Include error handling.

Include validation.

Include tests for critical functionality.

When something is ambiguous, choose the simplest implementation that satisfies the requirements and document the decision.

Start by producing the architecture, ERD, database schema, repository abstraction, synchronization design, and implementation plan before implementing the application.

Do not begin by generating the entire application in one response. Work incrementally, verify each phase, and keep the project buildable after every major phase.