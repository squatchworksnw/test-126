# Manual Supabase Migration: Operational Continuity Closure

## Why This Migration Is Needed

The app now treats work-order assignment as first-class operational data instead of parsing `Assigned:` from notes.

That means `field_ops_work_orders` must have:

- `assigned_person`
- an index that supports Assigned Work filtering and manager review

Do not deploy the app until this migration and verification both pass. New work-order create, edit, and approval flows write `assigned_person`.

## Where To Run It

Run these scripts manually in the Supabase SQL Editor for the live project:

1. `sql/operational_continuity_closure.sql`
2. `sql/verify_operational_continuity_closure.sql`

## Run Order

1. Open Supabase.
2. Open SQL Editor.
3. Paste and run the full contents of `sql/operational_continuity_closure.sql`.
4. Paste and run the full contents of `sql/verify_operational_continuity_closure.sql`.
5. Confirm the verification output before deploying the app.

## Expected Successful Output

The verification script should return rows like:

- `assigned_person column exists` -> `pass`
- `assigned_person supporting index exists` -> `pass`
- `work order table still has RLS enabled` -> `pass`
- `work order RLS policies still present` -> `pass`
- `app write payload shape is compatible` -> `pass`

The row named `existing work order rows remain intact` is informational. It should show the current row counts and assignment counts.

The row named `legacy assignment notes safely backfilled when empty` should usually show `pass`. If it shows `review`, stop and inspect the counts before proceeding. It may mean some old note assignments differ from existing structured assignments.

## Stop And Ask For Help If You See

- `column "assigned_person" does not exist` after running the migration.
- Any verification row with `fail`.
- `work order table still has RLS enabled` returns `fail`.
- `work order RLS policies still present` returns `fail`.
- Any permission error while running the migration.
- Any syntax error from either SQL file.

## After Verification Passes

Use an Owner/Admin account in the app to confirm:

- Create Work Order with Assigned person.
- Edit Assigned person from Work Order detail.
- Approve a Needs Review item into a Work Order with Assigned person.
- Assigned Work and Today/My Work show the structured assignment.

Only deploy after the SQL verification and app QA both pass.
