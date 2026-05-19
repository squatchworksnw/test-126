# Pilot Test Checklist

Use this checklist with real Supabase users before operational use.

Pilot: ___________________________
Tested by: _______________________
Date: ____________________________
Environment / URL: _______________

## 1. Signed-Out Access

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Open the app in a fresh/private browser session.
- Confirm only the login/welcome screen appears.
- Confirm no navigation, records, diagnostics, settings, or edit controls are visible.

## 2. Owner Account

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Sign in as Owner.
- Confirm full command center loads.
- Confirm Settings and diagnostics are visible.
- Confirm Work Orders, Review Queue, Projects, Fleet / Mobile Assets, Places + Assets, Support, Oversight are available.

## 3. Admin Account

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Sign in as Admin.
- Confirm operations workspace loads.
- Confirm diagnostics are visible.
- Confirm Budget and owner-only Places + Assets controls are not available unless intentionally granted by RLS/product policy.
- Confirm Admin cannot transfer ownership or remove Owner.

## 4. Submitter / Contractor Account

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Sign in as Submitter/Contractor.
- Confirm simplified portal only.
- Confirm visible paths are My Home, Submit Request, Upload Document / Photo, Submit Estimate, Submit Materials, My Submissions.
- Confirm diagnostics, Settings, Budget, Reports, Vendors, Vehicles, Assets, archive controls, and full Work Orders are not visible.

## 5. Submitter Cannot Create Live Work Order

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Attempt to directly navigate to Work Orders.
- Attempt direct Supabase client insert into `field_ops_work_orders`.
- Expected: blocked by RLS, not only by frontend.

## 6. Submitter Creates Review Submission

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Submit location, urgency, notes, and optional document/photo.
- Confirm row appears in `field_ops_import_reviews`.
- Confirm document metadata appears in `field_ops_documents` if file was included.
- Confirm row is scoped to the correct `workspace_id`.

## 7. Owner/Admin Approves Review Into Work Order

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Open Review Queue as Owner/Admin.
- Open submitted item.
- Correct title, type/category, priority, due date, building/space/asset/vehicle links, and notes.
- Approve as Work Order.
- Confirm new row appears in `field_ops_work_orders`.
- Confirm original review is marked approved with `created_record_table` and `created_record_id`.
- Confirm linked document/photo remains attached to the Work Order.

## 8. Duplicate Conversion Blocked

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Reopen the approved review item.
- Attempt to approve again.
- Expected: no second Work Order is created.

## 9. Archive / Restore

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Archive a Work Order as Owner/Admin.
- Confirm it disappears from active Work Orders and Today Mode.
- Confirm `archived_at` and `archived_by` are set.
- Restore it.
- Confirm it returns to active views.

## 10. Document Upload Storage Policy

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Upload a document/photo as Submitter.
- Upload a document/photo as Admin.
- Confirm each file lands in the expected `documents` bucket path.
- Confirm unauthorized users cannot read another workspace file.

## 11. Workspace Isolation

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Use a Workspace A account and Workspace B account.
- Confirm Workspace A cannot read Workspace B records.
- Confirm direct API queries for another `workspace_id` return no rows / RLS error.
- Confirm uploads are isolated by workspace path/policy.

## 12. RLS Verification SQL

Account used: ____________________
Pass / Fail: _____________________
Notes: ___________________________

- Open Supabase Dashboard.
- Go to SQL Editor.
- Run `sql/rls_verification.sql`.
- Success means every `field_ops_*` base table has RLS enabled, policies exist, and workspace-owned tables have `workspace_id`.
- Failure means pilot is not ready for real operational data.

