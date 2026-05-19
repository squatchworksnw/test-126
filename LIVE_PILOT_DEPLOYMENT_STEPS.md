# Live Pilot Deployment Steps

Use this checklist to prepare the GitHub Pages app and Supabase project for manual pilot testing with real Owner, Admin, and Submitter/Contractor accounts.

This is a pilot package, not a production launch package.

## 1. Exact Files To Deploy To GitHub Pages

Deploy only the static app runtime files listed below.

Root files:

- `index.html`
- `styles.css`
- `app.js`

Runtime folders:

- `auth/roles.js`
- `auth/session.js`
- `components/cards.js`
- `components/forms.js`
- `services/auth-service.js`
- `services/demo-service.js`
- `services/import-review-service.js`
- `services/interaction-service.js`
- `services/mappers.js`
- `services/materials-service.js`
- `services/supabase-service.js`
- `services/sync-service.js`
- `state/app-state.js`
- `styles/tokens/tokens.css`
- `sync/pending-queue.js`
- `views/registry.js`
- `views/today-dashboard.js`
- `views/work-orders.js`
- `views/documents.js`
- `views/projects-budget.js`
- `views/materials.js`
- `views/review-queue.js`
- `views/fleet.js`

External browser dependencies loaded by `index.html`:

- `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`
- `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js`
- `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`

Keep these files in the repo for operators, but they do not need to be served as app runtime files:

- `PILOT_TEST_CHECKLIST.md`
- `SECURITY_TRUST_REVIEW.md`
- `LIVE_PILOT_DEPLOYMENT_STEPS.md`
- `sql/rls_verification.sql`

Do not deploy:

- `_incoming_working_loop/`
- `tests/`
- local screenshots
- private notes
- temporary downloads
- Supabase service-role keys
- `.env` files or any secret-bearing config

Important:

- GitHub Pages is static hosting only.
- The frontend may contain the Supabase publishable/anon key.
- Never put a Supabase service-role key in frontend code or GitHub Pages.

## 2. Exact Supabase SQL / Scripts Before Testing

Run this verification script before pilot testing:

- `sql/rls_verification.sql`

This script is read-only. It inspects RLS, policies, and important columns. It does not modify data.

Do not run this for the current pilot unless intentionally enabling the future native Materials / Takeoffs schema:

- `sql/materials_takeoffs_proposed.sql`

The current pilot does not require `materials_takeoffs_proposed.sql`. Materials/estimate submissions can continue through Review Queue and existing operational records.

Before testing, confirm the live Supabase project already contains the expected operational tables/views:

- `field_ops_workspaces`
- `field_ops_memberships`
- `field_ops_my_workspaces`
- `field_ops_import_reviews`
- `field_ops_documents`
- `field_ops_work_orders`
- `field_ops_buildings`
- `field_ops_spaces`
- `field_ops_assets`
- `field_ops_projects`
- `field_ops_vendors`
- `field_ops_vehicles`
- `field_ops_fuel_receipts`
- `field_ops_budget_items`
- `field_ops_vehicle_alerts`

Also confirm:

- Supabase Auth is enabled.
- The GitHub Pages URL is allowed in Supabase Auth redirect URLs.
- The `documents` Storage bucket exists.
- Storage policies allow workspace-safe uploads/downloads.
- `field_ops_my_workspaces` returns the correct role for each pilot user.

## 3. Exact Test Accounts Needed

Create or confirm these real Supabase Auth users. All three should belong to the same pilot workspace first.

Owner account:

- Email: ___________________________
- Workspace ID: ____________________
- Membership role: `owner`
- Expected access: full command center, Settings, diagnostics, Review Queue approval, Work Orders, archive/restore.
- Pass/Fail: _______________________
- Notes: ___________________________

Admin account:

- Email: ___________________________
- Workspace ID: ____________________
- Membership role: `admin`
- Expected access: daily operations workspace, Review Queue, Work Orders, Projects, Fleet, Documents, Materials, Reports, limited Settings.
- Pass/Fail: _______________________
- Notes: ___________________________

Submitter / Contractor account:

- Email: ___________________________
- Workspace ID: ____________________
- Membership role: `submitter`
- Expected access: simple portal only, request submission, document/photo upload, estimates/material submissions, My Submissions.
- Pass/Fail: _______________________
- Notes: ___________________________

Workspace isolation accounts:

- Workspace A user email: ___________________________
- Workspace A ID: ___________________________________
- Workspace B user email: ___________________________
- Workspace B ID: ___________________________________
- Expected result: Workspace A cannot read/write Workspace B records, and Workspace B cannot read/write Workspace A records.
- Pass/Fail: _______________________
- Notes: ___________________________

## 4. Run `sql/rls_verification.sql`

1. Open the Supabase Dashboard.
2. Select the live pilot project.
3. Open SQL Editor.
4. Click New query.
5. Open local file `sql/rls_verification.sql`.
6. Paste the entire file into the SQL editor.
7. Click Run.
8. Review the first result set.
9. Confirm every `field_ops_%` base table has `rls_enabled = true`.
10. Review the policy result set.
11. Confirm operational tables have policies for Owner/Admin access.
12. Confirm submitter-facing tables have limited intake/upload policies.
13. Review the column result set.
14. Confirm workspace-owned tables include `workspace_id`.
15. Confirm archive-capable tables include `archived_at`.
16. Confirm intake/review tables track `submitted_by`, `created_by`, or `reviewed_by` where applicable.
17. Save a screenshot or copy of the results with the pilot notes.

Stop the pilot if:

- Any operational base table has RLS disabled.
- Workspace-owned records do not have `workspace_id`.
- Submitters can directly create live operational records.
- A user from one workspace can read records from another workspace.
- Storage files can be opened by the wrong workspace.

## 5. Manual Pilot Test Steps

Record each test result before moving to the next section.

### A. Sign In

Tested by: _________________________
Date: ______________________________
Account used: ______________________

1. Open the GitHub Pages URL.
2. Confirm signed-out users see only the login/welcome screen.
3. Confirm no full navigation appears before sign-in.
4. Sign in as Owner.
5. Sign out.
6. Sign in as Admin.
7. Sign out.
8. Sign in as Submitter/Contractor.

Expected result:

- Signed-out users cannot see operational records, admin navigation, diagnostics, or edit controls.

Pass/Fail: _________________________
Notes: _____________________________

### B. Role Routing

Tested by: _________________________
Date: ______________________________

Owner:

1. Sign in as Owner.
2. Confirm Owner lands in the full command center.
3. Confirm these areas are visible: Today, Review Queue, Add New, Work Orders, Projects, Fleet / Mobile Assets, Buildings, Spaces / Rooms, Assets / Systems, Vendors, Materials / Inventory, Documents, Budget, Reports, Settings.
4. Confirm Pilot Diagnostics are visible.

Admin:

1. Sign in as Admin.
2. Confirm Admin lands in the operations workspace.
3. Confirm these areas are visible: Today, Review Queue, Add New, Work Orders, Projects, Fleet / Mobile Assets, Vendors, Materials / Inventory, Documents, Reports, limited Settings.
4. Confirm owner-only ownership controls are not visible.

Submitter / Contractor:

1. Sign in as Submitter.
2. Confirm Submitter lands in the simplified portal.
3. Confirm these areas are visible: My Home, Submit Request, Upload Document / Photo, Submit Estimate, Submit Materials, My Submissions.
4. Confirm these are not visible: full Work Orders, Budget, Reports, Vendors, Settings, diagnostics, archive controls.
5. Try opening a blocked admin route directly if possible.
6. Confirm the app redirects back to the correct Submitter home or shows Access Denied.

Pass/Fail: _________________________
Notes: _____________________________

### C. Create Work Order

Tested by: _________________________
Date: ______________________________
Account used: Owner / Admin

1. Sign in as Owner or Admin.
2. Open Work Orders.
3. Create a new Work Order.
4. Enter a clear title.
5. Set status to open.
6. Set priority to urgent.
7. Set due date to today.
8. Link building, space, asset/system, vehicle/mobile asset, vendor, or project if available.
9. Save.
10. Confirm the inline save state shows success.
11. Confirm the Work Order appears in the Work Orders list.
12. Open Today Mode.
13. Confirm the Work Order appears in urgent, blocked, or due-today areas as appropriate.
14. Refresh the browser.
15. Confirm the Work Order still appears after reload.
16. Confirm Supabase `field_ops_work_orders` contains the row with the correct `workspace_id`.

Expected result:

- Owner/Admin can create live Work Orders.
- Submitter cannot directly create live Work Orders.
- Work Order data persists from Supabase after refresh.

Pass/Fail: _________________________
Notes: _____________________________

### D. Submit Review Item

Tested by: _________________________
Date: ______________________________
Account used: Submitter / Contractor

1. Sign in as Submitter.
2. Open Submit Request.
3. Enter location.
4. Set urgency.
5. Add notes.
6. Attach a small photo or document if available.
7. Submit.
8. Confirm the app shows a calm success or pending state.
9. Confirm the item appears in My Submissions if available.
10. In Supabase, confirm a row exists in `field_ops_import_reviews`.
11. If a file was attached, confirm a row exists in `field_ops_documents`.
12. Confirm no direct row was created in `field_ops_work_orders`.

Expected result:

- Submitter records go to Review Queue / Import Review first.
- Submitters do not bypass the trust layer.

Pass/Fail: _________________________
Notes: _____________________________

### E. Approve Review Item Into Work Order

Tested by: _________________________
Date: ______________________________
Account used: Owner / Admin

1. Sign in as Owner or Admin.
2. Open Review Queue.
3. Open the submitted item.
4. Review and correct title.
5. Review and correct type/category.
6. Review and correct urgency/priority.
7. Link building, space, asset/system, vehicle/mobile asset, vendor, or project if available.
8. Set due date if known.
9. Review notes/description.
10. Confirm attached documents/photos are visible or referenced.
11. Approve as Work Order.
12. Confirm a new row exists in `field_ops_work_orders`.
13. Confirm the original review item is marked approved/converted.
14. Confirm `created_record_table` and `created_record_id` are set on the review item.
15. Confirm linked documents/photos remain attached to the new Work Order where applicable.
16. Attempt to approve the same review item again.
17. Confirm a duplicate Work Order is not created.
18. Open Today Mode.
19. Confirm the converted Work Order appears where expected.
20. Open Work Orders.
21. Confirm the converted Work Order appears in the list and detail view.

Expected result:

- Owner/Admin can convert intake into a live Work Order.
- Converted items cannot be approved twice.
- Failure states do not create partial duplicate records.

Pass/Fail: _________________________
Notes: _____________________________

### F. Archive / Restore

Tested by: _________________________
Date: ______________________________
Account used: Owner / Admin

1. Open an active Work Order.
2. Archive it.
3. Confirm it disappears from active Work Orders.
4. Confirm it disappears from active Today Mode lists.
5. Confirm the Supabase row has `archived_at`.
6. Confirm the Supabase row has `archived_by` if supported by the table.
7. Open the archive/recoverable view if available.
8. Restore the Work Order.
9. Confirm it returns to active Work Orders.
10. Confirm it returns to Today Mode if still relevant.
11. Sign in as Submitter.
12. Confirm Submitter cannot archive or restore live operational records.

Expected result:

- Normal UI uses soft archive/restore.
- Hard delete is not exposed through normal pilot workflows.

Pass/Fail: _________________________
Notes: _____________________________

### G. Document Upload

Tested by: _________________________
Date: ______________________________
Account used: Owner / Admin / Submitter

1. Sign in as Submitter.
2. Upload a small PDF, image, or document through the portal.
3. Confirm the app shows success or pending state.
4. Confirm Supabase Storage contains the file in the `documents` bucket.
5. Confirm `field_ops_documents` contains metadata for the upload.
6. Sign in as Owner/Admin.
7. Confirm the document is visible through Review Queue or Documents as appropriate.
8. Attach or link the document to a Work Order if available.
9. Confirm it appears in the Work Order linked documents section.
10. Sign in as a different workspace user.
11. Confirm the other workspace cannot open/read the file or metadata.

Expected result:

- Documents are stored in Supabase Storage.
- Document metadata is stored in Supabase tables.
- Workspace boundaries apply to both metadata and file access.

Pass/Fail: _________________________
Notes: _____________________________

### H. Workspace Isolation

Tested by: _________________________
Date: ______________________________

1. Sign in as Workspace A Owner/Admin.
2. Create or view a Work Order.
3. Note the Workspace A `workspace_id`.
4. Sign out.
5. Sign in as Workspace B user.
6. Confirm Workspace A records do not appear.
7. Attempt to open a direct Workspace A route or record if the URL exposes an id.
8. Confirm no Workspace A data is returned.
9. If possible, run a direct API request while authenticated as Workspace B using Workspace A `workspace_id`.
10. Expected result is no rows returned or RLS denial.
11. Repeat for documents/storage.

Expected result:

- Workspace A cannot read or write Workspace B data.
- Workspace B cannot read or write Workspace A data.

Pass/Fail: _________________________
Notes: _____________________________

## 6. Known Limitations Before Pilot

- The repo includes `sql/rls_verification.sql`, but not a complete authoritative Supabase schema/RLS migration for every table.
- Live RLS and Storage policies must be verified in the actual Supabase project before using real operational data.
- Review Queue conversion has frontend/service duplicate prevention, but should eventually move into a single database RPC/transaction for stronger concurrency safety.
- Audit readiness exists conceptually, but there is not yet a complete immutable audit log for every create, update, approve, archive, restore, and upload action.
- Offline retry is limited to pending text/data writes. File uploads should show pending/failed until online and accepted by Supabase.
- Conflict resolution is not yet a full multi-device merge engine.
- Materials / Takeoffs native tables are proposed only. Do not run the proposed migration unless intentionally expanding the pilot scope.
- GitHub Pages can cache aggressively. After deploys, testers may need a hard refresh.
- Supabase Auth redirect URLs must be configured for the exact GitHub Pages URL.
- The publishable Supabase key is public by design. A service-role key must never be added to the app.
- This package is ready for controlled pilot testing, not broad production rollout.

## Pilot Sign-Off

Pilot URL: __________________________
Supabase project: ___________________
Workspace ID: _______________________
Tested by: __________________________
Date: _______________________________
Overall result: Pass / Fail
Blocking issues: ____________________
Next action: ________________________

