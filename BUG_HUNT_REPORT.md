# Bug Hunt Report

Date: 2026-05-15

## Scope

Reviewed the current V3 pilot app for save-state bugs, RLS-sensitive update paths, upload/review workflow issues, refresh-after-write failures, preview rendering edge cases, and small UI logic mistakes.

## Fixed

### 1. Successful writes could look failed after refresh errors

Several shared write helpers treated the Supabase write and the full workspace refresh as one operation. If the insert/update/archive succeeded but `loadWorkspaceData()` failed, the caller could show a failure and retry a write that had already succeeded.

Risk:
- duplicate records
- false error messages
- user repeating successful actions

Fix:
- Added `refreshAfterWrite()` in `app.js`.
- Shared insert/update/archive/restore helpers now keep successful writes successful even if the refresh fails.
- Review approval, document upload, and material submission now use the same non-fatal refresh behavior.

### 2. Archive/restore could silently update zero rows

`archiveRow()` and `restoreRow()` did not request a returned row, so an RLS-blocked update or workspace mismatch could look successful.

Risk:
- user thinks a record archived/restored when nothing changed

Fix:
- `archiveRow()` and `restoreRow()` now call `.select().single()`.
- Zero-row updates now surface as real errors.

### 3. Pilot password controls stayed visible after login

After adding password login fallback, the email field hid after login but password input/button did not.

Risk:
- confusing signed-in header
- user may think they need to sign in again

Fix:
- `renderAuthState()` now hides password field and password sign-in button after login.

### 4. Preview URL generation tried non-storage/demo files

Document preview generation tried to create signed URLs for any file with a storage path, including demo/non-document-bucket rows.

Risk:
- noisy background errors
- confusing preview fallback states

Fix:
- Preview signed URLs are requested only for real `documents` bucket records.

### 5. Final completion/update feedback was too vague

Work order completion and detail-save flows could say only "Saving completion..." or generic failure.

Risk:
- unclear whether the work order saved, document link failed, or refresh failed

Fix:
- Completion update now reports the table/action that failed.
- Work order detail save separates work order update, document link, upload, document metadata, and refresh states.

## Live RLS Findings

Tested direct Supabase update behavior:

- Owner `PATCH field_ops_work_orders` completion update succeeded.
- Submitter `PATCH field_ops_work_orders` with single-object response returned:

```text
406 Not Acceptable
PGRST116
Cannot coerce the result to a single JSON object
The result contains 0 rows
```

Interpretation:
- RLS is blocking Submitter updates to live work orders as intended.
- The app now handles that failure more clearly.

## Tests Run

```text
node tests/architecture-boundaries.test.js
node tests/role-flow.test.js
node tests/mobile-usability.test.js
node tests/work-order-detail-hardening.test.js
```

All passed.

The role-flow test intentionally logs simulated permission/save errors while verifying blocked paths.

## Remaining Watch Items

- Fuel receipt creation is a multi-step workflow: receipt insert, budget item insert, receipt update. It should eventually become a database RPC or transaction to avoid partial records.
- Review approval is mostly duplicate-safe because the proposed work order id is generated before conversion, but a backend RPC would make it stronger.
- Generic add forms still rely mostly on global status text rather than per-form inline states.
- Magic-link testing can still hit Supabase email rate limits; password fallback is pilot-only convenience.
