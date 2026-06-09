# Manual Supabase Migration: Operational Memory Timeline

## Why This Migration Is Needed

The app now supports a structured Timeline so important records can answer:

- Who changed this?
- What changed?
- When did it happen?
- Why did it happen?

The timeline does not replace existing notes/history. It adds structured events moving forward for work orders, maintenance requests, vehicles, assets, buildings, scheduled work, documents, assignment, completion, archive/reopen, review decisions, uploads, and vehicle service updates.

## Is This Required Before Pilot?

Yes, if the pilot will test operational memory, vehicle history, repair history, assignment accountability, or timeline/history continuity.

The app is designed to avoid crashing if the table is not installed, but structured Timeline events will not persist until this migration exists.

## Where To Run It

Run this manually in the Supabase SQL Editor for the production/pilot project.

## Run Order

1. `sql/operational_memory_timeline.sql`
2. `sql/verify_operational_memory_timeline.sql`

## Expected Successful Verification

The verification query should return `pass` for:

- `timeline table exists`
- `timeline required columns exist`
- `timeline supporting indexes exist`
- `timeline RLS enabled`
- `timeline policies exist`
- `timeline event constraints exist`

It should also return:

- `manual client QA still required` -> `info`

That `info` row is expected. It means the database shape is ready, but you still need to test the app in-browser with an Owner/Admin account.

## Stop And Ask For Help If You See

- Any row with `result = fail`.
- Any permission error while running the migration.
- Any error mentioning a missing table other than the timeline table.
- Any error mentioning `field_ops_memberships`.
- Any error from Supabase that the SQL cannot find `auth.users`.

## Manual App QA After Migration

Use an Owner/Admin account and confirm:

1. Create a Work Order.
2. Assign or reassign it.
3. Complete it.
4. Upload a document linked to it.
5. Archive and reopen if available.
6. Confirm the Timeline section appears and uses plain language.
7. Confirm older notes/history still show under older history.

## Deployment Warning

Do not rely on Timeline behavior in live pilot testing until verification passes.

If the app changes are deployed before this SQL runs, the app should still load, but Timeline persistence should be considered blocked.
