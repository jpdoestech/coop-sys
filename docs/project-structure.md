# Project Structure

The codebase uses feature ownership for business workflows and technical layers for shared infrastructure.

```text
coop-sys/
|-- docs/                         Architecture and operating decisions
|-- src/
|   |-- address/                  Philippine geographic reference data and query service
|   |-- app/                      Routing, providers, and application composition
|   |-- components/
|   |   |-- forms/                Shared domain-aware form controls
|   |   |-- layout/               Shared page shells and navigation
|   |   `-- ui/                   Reusable presentation components
|   |-- database/
|   |   |-- seeds/                Fictional development data
|   |   |-- sqlite/               Offline database migrations and adapters
|   |   `-- supabase/             Online client and PostgreSQL migrations
|   |-- features/                 Business modules owned end to end
|   |   |-- members/
|   |   |-- employees/
|   |   |-- users/
|   |   |-- organization/
|   |   |-- departments/
|   |   |-- positions/
|   |   |-- documents/
|   |   |-- reports/
|   |   |-- synchronization/
|   |   |-- audit-logs/
|   |   `-- settings/
|   |-- hooks/                    Cross-feature React hooks
|   |-- services/
|   |   |-- access/               Role permissions and organization scope rules
|   |   |-- auth/                 Online and offline authentication services
|   |   |-- identity/             Member/employee profile synchronization rules
|   |   |-- lookups/              Shared configurable reference values
|   |   |-- repositories/         Persistence interfaces and implementations
|   |   |-- sync/                 Synchronization rules and conflict handling
|   |   `-- validation/           Domain input schemas
|   |-- test/                     Shared test configuration and fixtures
|   |-- types/                    Shared domain contracts
|   `-- utils/                    Small framework-independent helpers
`-- public/                       Static assets when required
```

## Ownership Rules

1. A business workflow starts in its matching `features/<feature>` folder.
2. Feature-only components, hooks, schemas, and tests stay inside that feature folder.
3. Code moves into `components`, `hooks`, `types`, or `utils` only after it has a genuine cross-feature consumer.
4. UI code never imports Supabase, SQLite, or browser storage directly. It depends on repository interfaces.
5. Database-specific SQL and adapters remain under `database/<provider>` or `services/repositories/<provider>`.
6. Tests live beside the behavior they verify; `src/test` is reserved for shared setup and fixtures.
7. New top-level folders require a distinct responsibility that is not already represented here.

## Feature Growth Pattern

As a feature becomes functional, expand it locally instead of creating broad global folders:

```text
features/members/
|-- components/
|-- hooks/
|-- pages/
|-- memberQueries.ts
|-- memberRoutes.tsx
`-- memberQueries.test.ts
```

This keeps domain changes reviewable and prevents unrelated features from becoming coupled.
