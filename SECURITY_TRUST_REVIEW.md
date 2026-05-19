# Security + Trust Hardening Review

Status: pilot-readiness review for the current Supabase-backed prototype.

## Already Safe In The App Layer

- Supabase is the source of truth for operational records.
- Login uses Supabase Auth through `supabase.auth.getSession`, `onAuthStateChange`, `signInWithOtp`, and `signOut`.
- Signed-out users are routed to the login screen and `loadWorkspaceData()` exits unless `requireAuth(false)` passes.
- Workspace selection loads through `field_ops_my_workspaces`, so the app depends on Supabase/RLS membership to decide workspace access.
- Operational reads call Supabase with `workspace_id` filtering through `selectActive()` / `selectArchived()`.
- Operational writes add `workspace_id` in `insertRecord()` before calling Supabase.
- Updates, archives, and restores include `workspace_id` filters for workspace-owned tables.
- Normal archive behavior uses `archived_at` / `archived_by`; no normal UI hard-delete path exists.
- Review Queue conversion requires Owner/Admin frontend permission and submitters cannot directly create live work orders.
- Converted Review Queue items are guarded against duplicate conversion by checking `convertedRecordId` and preserving a stable conversion id.
- Frontend contains only the Supabase publishable key, not a service-role key.
- Browser storage is not used as the operational database. It remains limited to the pending retry queue.

## Needs RLS / Database Enforcement Verification

Frontend checks are usability guardrails only. Supabase RLS must enforce:

- Every `field_ops_*` base table has RLS enabled.
- Every workspace-owned operational table requires matching `workspace_id`.
- A user can only read rows for workspaces where they have membership.
- Owner can manage workspace settings and operational records.
- Admin can manage operational records but cannot transfer/delete ownership or manage owner-only workspace controls.
- Submitter/contractor can insert only approved intake rows, currently `field_ops_import_reviews` and `field_ops_documents`.
- Submitter/contractor cannot insert/update/archive live `field_ops_work_orders`, `field_ops_budget_items`, `field_ops_assets`, `field_ops_vendors`, or reports/oversight data.
- Storage policies for the `documents` bucket must match workspace membership and submitter upload rules.

Run `sql/rls_verification.sql` in Supabase before pilot testing and confirm the result matches those rules.

## Urgent Gaps Before Pilot

- The repo includes an RLS verification query, but not the full canonical RLS policy migration. The actual Supabase dashboard policies must be verified before real data is used.
- Document Storage RLS/policies are not proven from this codebase. A submitter upload should be tested live with a second account.
- Audit logging is not yet centralized. Some history is stored in work-order notes, but that is not a true immutable audit log.
- Review conversion is safer now, but the ideal production version is a single database RPC/transaction that updates review + creates work order + links document atomically.

## Minimal Fixes Before Next Pilot Test

- Run `sql/rls_verification.sql` and save screenshots/results for all `field_ops_*` tables and policies.
- Manually test with three real users or test accounts: Owner, Admin, Submitter.
- Confirm Submitter cannot create `field_ops_work_orders` via Supabase client, not just the UI.
- Confirm Submitter can create only Import Review and Document records scoped to their workspace.
- Confirm Admin cannot update owner-only workspace membership/ownership settings.
- Confirm archived work orders disappear from active reads but remain recoverable by Owner/Admin.
- Add a small `field_ops_audit_log` table later for immutable create/update/archive/restore/approve/upload events.

## Future Audit Events

These should eventually write to an audit table:

- create operational record
- update operational record
- archive record
- restore record
- approve review
- convert review to work order
- upload document
- link/unlink document
- sign-in/session-sensitive workspace change

