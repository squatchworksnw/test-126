const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "views/registry.js",
  "views/today-dashboard.js",
  "views/work-orders.js",
  "views/documents.js",
  "views/projects-budget.js",
  "views/materials.js",
  "views/review-queue.js",
  "views/fleet.js",
  "components/cards.js",
  "components/forms.js",
  "services/supabase-service.js",
  "services/mappers.js",
  "services/import-review-service.js",
  "services/materials-service.js",
  "services/demo-service.js",
  "services/interaction-service.js",
  "services/auth-service.js",
  "services/sync-service.js",
  "state/app-state.js",
  "auth/roles.js",
  "auth/session.js",
  "sync/pending-queue.js",
  "styles/tokens/tokens.css"
];

for (const file of requiredFiles) {
  assert.equal(fs.existsSync(path.join(root, file)), true, file + " is missing");
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const importReviewService = fs.readFileSync(path.join(root, "services/import-review-service.js"), "utf8");
const authService = fs.readFileSync(path.join(root, "services/auth-service.js"), "utf8");
const syncService = fs.readFileSync(path.join(root, "services/sync-service.js"), "utf8");
const materialsService = fs.readFileSync(path.join(root, "services/materials-service.js"), "utf8");
const demoService = fs.readFileSync(path.join(root, "services/demo-service.js"), "utf8");
const interactionService = fs.readFileSync(path.join(root, "services/interaction-service.js"), "utf8");
const appState = fs.readFileSync(path.join(root, "state/app-state.js"), "utf8");
const reviewQueueView = fs.readFileSync(path.join(root, "views/review-queue.js"), "utf8");
const supabaseService = fs.readFileSync(path.join(root, "services/supabase-service.js"), "utf8");
const sessionService = fs.readFileSync(path.join(root, "auth/session.js"), "utf8");
const rlsVerification = fs.readFileSync(path.join(root, "sql/rls_verification.sql"), "utf8");
const extractedViews = [
  "views/projects-budget.js",
  "views/materials.js",
  "views/fleet.js",
  "views/review-queue.js",
  "views/documents.js"
].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

for (const file of requiredFiles.filter(file => file.endsWith(".js"))) {
  assert.match(index, new RegExp('<script src="' + file.replace("/", "\\/") + '"><\\/script>'));
}

assert.match(index, /<link rel="stylesheet" href="styles\/tokens\/tokens.css" \/>/);
assert.match(index, /data-nav-group="command"/);
assert.match(index, /data-nav-group="operations"/);
assert.match(index, /data-nav-group="support"/);
assert.match(index, /data-nav-group="oversight"/);
assert.match(index, /aria-label="Primary tasks"/);
assert.match(index, />Needs Review</);
assert.doesNotMatch(index, /class="nav-action"[^>]*data-open-add-new/);
assert.match(index, /today-priority-grid/);
assert.match(index, /todayDueCount/);
assert.match(index, /todayClearCount/);
assert.match(index, /Pilot environment — verify before operational use/);
assert.match(index, /id="diagnosticPanel"/);
assert.match(index, /diagWorkspaceId/);
assert.doesNotMatch(index, /service_role|sb_secret|SUPABASE_SERVICE_ROLE/i);
assert.match(index, /Assets \/ Systems/);
assert.match(index, /Related asset \/ system/);
assert.match(index, /Primary facilities anchors/);
assert.doesNotMatch(styles, /:root\s*\{/);
assert.match(styles, /\.top-nav\{\s*position:fixed/);
assert.match(styles, /\.skip-link/);
assert.match(styles, /focus-visible/);
assert.match(styles, /@media\s*\(max-width:780px\)[\s\S]*\.top-nav\{/);
assert.match(styles, /\.today-priority-grid/);
assert.match(styles, /\.priority-tile\.clear/);
assert.match(styles, /\.asset-memory-strip/);
assert.match(styles, /\.pilot-indicator/);
assert.match(app, /window\.FieldOps\.Services\.supabase/);
assert.match(app, /window\.FieldOps\.Services\.mappers/);
assert.match(app, /window\.FieldOps\.Services\.importReview/);
assert.match(app, /window\.FieldOps\.Services\.auth/);
assert.match(app, /window\.FieldOps\.Services\.sync/);
assert.match(app, /VIEW_RENDERERS\.forEach/);
assert.match(app, /TodayDashboard\.render\(app,\s*createViewHelpers\(\)\)/);
assert.match(app, /ProjectsBudget\.render\(app,\s*createViewHelpers\(\)\)/);
assert.match(fs.readFileSync(path.join(root, "views/fleet.js"), "utf8"), /FleetWorkspace/);
assert.match(fs.readFileSync(path.join(root, "views/projects-budget.js"), "utf8"), /ProjectsBudget/);
assert.match(fs.readFileSync(path.join(root, "views/work-orders.js"), "utf8"), /anchorMemoryForWorkOrder/);
assert.match(fs.readFileSync(path.join(root, "views/documents.js"), "utf8"), /Asset\/System anchor/);
assert.match(fs.readFileSync(path.join(root, "services/mappers.js"), "utf8"), /fromWorkOrder/);
assert.match(fs.readFileSync(path.join(root, "services/mappers.js"), "utf8"), /workOrderPayloadFromForm/);
assert.match(importReviewService, /createRecordFromImport/);
assert.match(importReviewService, /approveReview/);
assert.match(importReviewService, /archiveReview/);
assert.match(importReviewService, /alreadyConverted/);
assert.match(importReviewService, /convertedRecordId/);
assert.match(authService, /initializeAuth/);
assert.match(authService, /signInForSync/);
assert.match(authService, /bootstrapWorkspace/);
assert.match(sessionService, /supabaseClient\.auth\.getSession/);
assert.match(sessionService, /supabaseClient\.auth\.signInWithOtp/);
assert.match(sessionService, /supabaseClient\.auth\.onAuthStateChange/);
assert.match(supabaseService, /\.eq\("workspace_id", workspaceId\)/);
assert.match(app, /insertRow\(table,\s*\{\s*workspace_id:\s*workspaceId\(\),\s*\.\.\.payload\s*\}\)/);
assert.match(rlsVerification, /relrowsecurity/);
assert.match(rlsVerification, /pg_policies/);
assert.match(fs.readFileSync(path.join(root, "PILOT_TEST_CHECKLIST.md"), "utf8"), /Workspace A cannot read Workspace B|workspace B/i);
assert.match(fs.readFileSync(path.join(root, "PILOT_TEST_CHECKLIST.md"), "utf8"), /sql\/rls_verification\.sql/);
assert.match(syncService, /flushPendingWrites/);
assert.match(syncService, /queueWrite/);
assert.match(syncService, /renderPendingQueueState/);
assert.match(materialsService, /submitMaterialList/);
assert.match(materialsService, /approveMaterialReview/);
assert.match(materialsService, /parseMaterialLines/);
assert.match(demoService, /loadDemoData/);
assert.match(demoService, /clearDemoData/);
assert.match(interactionService, /initAddNewModal/);
assert.match(interactionService, /initReviewDropZone/);
assert.match(appState, /createRuntimeState/);
assert.match(appState, /bindRuntimeGlobals/);
assert.match(appState, /setLoadedCollections/);
assert.match(appState, /setCurrentEdit/);
assert.match(appState, /resetStagedImport/);
assert.doesNotMatch(app, /function renderWorkOrderDetail/);
assert.doesNotMatch(app, /function renderReviewQueue/);
assert.doesNotMatch(app, /function renderFiles/);
assert.doesNotMatch(app, /function renderDashboard/);
assert.doesNotMatch(app, /function renderFleet/);
assert.doesNotMatch(app, /function renderProjects/);
assert.doesNotMatch(app, /function renderBids/);
assert.doesNotMatch(app, /function renderBudget/);
assert.doesNotMatch(app, /function projectCard/);
assert.doesNotMatch(app, /function bidCard/);
assert.doesNotMatch(app, /function buildReport/);
assert.doesNotMatch(app, /function from[A-Z]/);
assert.doesNotMatch(app, /function to[A-Z].*Payload/);
assert.doesNotMatch(app, /function normalizeProposedType/);
assert.doesNotMatch(app, /createRecordFromImport\(/);
assert.doesNotMatch(app, /getSession\(supabaseClient\)/);
assert.doesNotMatch(app, /onAuthStateChange\(supabaseClient/);
assert.doesNotMatch(app, /signInWithEmail/);
assert.doesNotMatch(app, /loadFirstWorkspace/);
assert.doesNotMatch(app, /localStorage/);
assert.doesNotMatch(supabaseService, /\.delete\s*\(/);
assert.doesNotMatch(app, /\.delete\s*\(/);
assert.doesNotMatch(supabaseService, /service_role|sb_secret|SUPABASE_SERVICE_ROLE/i);
assert.match(supabaseService, /sb_publishable_/);
assert.doesNotMatch(app, /pendingWrites\.push/);
assert.doesNotMatch(app, /applyQueuedWriteThroughSync/);
assert.doesNotMatch(app, /let currentSession/);
assert.doesNotMatch(app, /let currentWorkspace/);
assert.doesNotMatch(app, /let currentEdit/);
assert.doesNotMatch(app, /let pendingWrites/);
assert.doesNotMatch(app, /let stagedImport/);
assert.doesNotMatch(app, /let viewHistory/);
assert.doesNotMatch(app, /let activeViewId/);
assert.doesNotMatch(app, /let selectedWorkOrderId/);
assert.doesNotMatch(app, /let selectedReviewId/);
assert.doesNotMatch(app, /Object\.assign\(app,\s*window\.FieldOps\.State\.createEmptyAppState/);
assert.doesNotMatch(app, /isLocalPilotMode/);
assert.doesNotMatch(app, /localInsert|localUpdate|localArchive|localRestore/);
assert.doesNotMatch(interactionService, /localStorage/);
assert.doesNotMatch(interactionService, /localInsert|localUpdate|localArchive|localRestore/);
assert.doesNotMatch(extractedViews, /function to[A-Z].*Payload/);
assert.doesNotMatch(extractedViews, /toDb:item\s*=>/);
assert.doesNotMatch(reviewQueueView, /insertRecord\("field_ops_(projects|vehicles|fuel_receipts|budget_items|vendors|assets|work_orders)"/);
assert.doesNotMatch(reviewQueueView, /function createRecordFromImport/);
assert.match(extractedViews, /Mappers\./);

console.log("PASS architecture boundary test");
