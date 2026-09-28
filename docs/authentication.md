# Authentication

## Online mode

Online mode uses Supabase Auth. The application restores the browser session, loads the matching `public.users` profile, role, and branch assignments, and signs inactive users out. Password recovery uses Supabase email links. New users are invited by the `invite-user` Edge Function so the service-role key never reaches the browser.

Deploy `src/database/supabase/migrations/0007_authentication_profiles.sql`, then deploy `supabase/functions/invite-user`. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the function environment.

## Offline mode

Offline accounts are device-local. Passwords are derived with PBKDF2-SHA-256 using a random 16-byte salt and 210,000 iterations. Only the salt and derived hash are retained in browser storage; plaintext passwords are never stored.

The development seed accounts initially use `ChangeMe123!` and are forced to replace it at first sign-in. This bootstrap credential is for local development only and must not be distributed as a production credential.

Super Admin can set a temporary password for a new or existing offline account. The account must replace that password at the next sign-in.
