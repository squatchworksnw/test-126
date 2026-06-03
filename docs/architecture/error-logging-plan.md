# Error Logging Plan

This app currently handles most operational errors in the browser and shows plain user-facing messages. Before outside users start testing, decide where production error records should live.

## Current Catch Points

Supabase write failures are currently caught in:

- `app.js`
  - `insertRecord`
  - `updateRecord`
  - `archiveRecord`
  - `restoreRecord`
  - `handleWriteError`
  - `refreshAfterWrite`
  - `syncNow`
- `sync/pending-queue.js` and `services/sync-service.js`
  - retry queue handling
  - retryable write detection
- View-level workflows
  - `views/documents.js` upload failures
  - `views/review-queue.js` review approval / more-info failures
  - `views/work-orders.js` completion, assignment, fleet, recurring, and upload-link failures
  - `views/fleet.js` fuel receipt failures
  - `views/materials.js` material approval failures

## Recommendation

Start with one of these:

1. Sentry or a similar client-side error monitor.
   - Best for browser errors, stack traces, release tracking, and first-month support visibility.
   - Configure privacy filters before enabling.

2. A Supabase `field_ops_error_log` table.
   - Best for operational write failures connected to a workspace and user.
   - Suggested fields:
     - `id`
     - `workspace_id`
     - `user_id`
     - `source`
     - `message`
     - `details`
     - `url`
     - `created_at`

## Table Safety Notes

If an error log table is added:

- Enable RLS.
- Allow authenticated users to insert only for their workspace.
- Restrict reads to Owner/Admin.
- Do not store passwords, tokens, file contents, or secret keys.
- Keep retention short unless logs are needed for compliance.

## Current Sprint Decision

No migration was added in this sprint. The app is not yet wired for structured log retention, and adding the table without a tested capture policy would create maintenance overhead without first-month value.
