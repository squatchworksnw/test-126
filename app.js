const {
  DOCUMENT_BUCKET,
  supabaseClient,
  selectActive: selectActiveFromSupabase,
  selectArchived: selectArchivedFromSupabase,
  selectVehicleAlerts,
  insertRow,
  updateRow,
  archiveRow,
  restoreRow,
  insertDocumentMetadata,
  uploadDocument,
  createDocumentPreviewUrl,
  listWorkspaceMembers,
  setMemberRoleByEmail
} = window.FieldOps.Services.supabase;
const {
  esc,
  money,
  compact,
  titleize,
  tone,
  card,
  detailRow,
  documentPreviewCard,
  relatedSummaryCard,
  linkedButton,
  empty
} = window.FieldOps.Components;
const Mappers = window.FieldOps.Services.mappers;
const ImportReviewService = window.FieldOps.Services.importReview;
const AuthService = window.FieldOps.Services.auth;
const SyncService = window.FieldOps.Services.sync;
const DemoService = window.FieldOps.Services.demo;
const InteractionService = window.FieldOps.Services.interactions;
const AppState = window.FieldOps.State;
const { renderers: VIEW_RENDERERS } = window.FieldOps.Views;

const runtimeState = AppState.bindRuntimeGlobals(AppState.createRuntimeState({
  pendingWrites: SyncService.loadPendingWrites()
}));
const app = runtimeState.app;
let lastWorkspaceLoadAt = "";

function id(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }
function activeItems(section){ return AppState.activeItems(app, section); }
function authState(){ return { currentSession, currentWorkspace }; }
function authContext(){ return { supabaseClient, app, getState:authState, setSession:value => { currentSession = value; }, setWorkspace:value => { currentWorkspace = value; }, createEmptyAppState:AppState.createEmptyAppState, titleize, setStatus, render, applyRoleVisibility, showView, loadWorkspaceData, flushPendingWrites, startAutoRefresh }; }
function syncContext(){ return { getPendingWrites:() => pendingWrites, setPendingWrites:value => { pendingWrites = value; }, workspaceId, id, card, titleize, insertRow, updateRow, archiveRow, requireAuth, loadWorkspaceData }; }
function isAuthenticated(){ return AuthService.isAuthenticated(authState()); }
function workspaceId(){ return AuthService.workspaceId(authState()); }
function currentRole(){ return AuthService.currentRole(authState()); }
function isOwner(){ return AuthService.isOwner(authState()); }
function canManageOperations(){ return AuthService.canManageOperations(authState()); }
function canSubmitOnly(){ return AuthService.canSubmitOnly(authState()); }
function allowedViewsForRole(){ return AuthService.allowedViewsForRole(authState()); }
function defaultViewForRole(){ return AuthService.defaultViewForRole(authState()); }
function canAccessView(id){ return AuthService.canAccessView(id, authState()); }
function isDemoMode(){ return Boolean(currentWorkspace?.isDemo); }

async function createImportReview(source, proposedType, proposedData, notes, documentId = null){
  return ImportReviewService.createImportReview({
    source,
    proposedType,
    proposedData,
    notes,
    documentId
  }, { insertRecord, currentUserId:() => currentSession?.user?.id });
}

function showAccessDenied(targetView){
  const message = document.getElementById("accessDeniedMessage");
  const role = titleize(currentRole() || "signed-out");
  if(message) message.textContent = `${role} access does not include ${titleize(targetView)}. Database permission rules still protect the workspace; this screen is hidden to prevent mistakes.`;
  setStatus("Access limited by role");
  setActiveView("accessDenied");
}

function noteTimestamp(){
  return new Date().toLocaleString();
}

function actorLabel(){
  return currentSession?.user?.email || currentRole() || "Unknown user";
}

function appendHistory(existingNotes, message){
  const line = `[${noteTimestamp()}] ${actorLabel()}: ${message}`;
  return compact([existingNotes, line]).join("\n");
}

function assignedFromNotes(notes){
  const match = String(notes || "").match(/(?:^|\n)Assigned:\s*([^\n]+)/i);
  return match ? match[1].trim() : "";
}

function replaceAssignedInNotes(notes, assignee){
  const cleaned = String(notes || "").replace(/(?:^|\n)Assigned:\s*[^\n]+/i, "").trim();
  return compact([assignee ? `Assigned: ${assignee}` : "", cleaned]).join("\n");
}

function setWorkOrderDetailState(text, state = ""){
  const el = document.getElementById("workOrderDetailSaveState");
  if(!el) return;
  el.textContent = text;
  el.dataset.state = state;
}

function setInlineState(idValue, text, state = ""){
  const el = document.getElementById(idValue);
  if(!el) return;
  el.textContent = text;
  el.dataset.state = state;
}

function savePendingWrites(){ return SyncService.savePendingWrites(syncContext()); }
function renderPendingQueueState(){ return SyncService.renderPendingQueueState(syncContext()); }
function queueWrite(operation){ return SyncService.queueWrite(operation, syncContext()); }
async function applyQueuedWrite(item){ return SyncService.applyQueuedWrite(item, syncContext()); }
async function flushPendingWrites(showAlert = false){ return SyncService.flushPendingWrites(showAlert, syncContext()); }
function setStatus(text){ return SyncService.setStatus(text, syncContext()); }
function requireAuth(showAlert = false){ return AuthService.requireAuth(showAlert, authContext()); }
function requireInsertPermission(table, actionLabel = "create records"){ return AuthService.requireInsertPermission(table, actionLabel, authContext()); }
function requireUpdatePermission(table, actionLabel = "change records"){ return AuthService.requireUpdatePermission(table, actionLabel, authContext()); }
function requireArchivePermission(actionLabel = "archive records"){ return AuthService.requireArchivePermission(actionLabel, authContext()); }
function requireOperationsPermission(actionLabel = "manage operations"){ return AuthService.requireOperationsPermission(actionLabel, authContext()); }
function requireOwnerPermission(actionLabel = "change workspace settings"){ return AuthService.requireOwnerPermission(actionLabel, authContext()); }

async function initializeAuth(){ return AuthService.initializeAuth(authContext()); }
function renderAuthState(){ return AuthService.renderAuthState(authContext()); }
async function signInForSync(){ return AuthService.signInForSync(authContext()); }
async function signInWithPasswordForSync(){ return AuthService.signInWithPasswordForSync(authContext()); }
function saveDisplayName(){ return AuthService.saveDisplayName(authContext()); }
function hideDisplayNamePrompt(){ return AuthService.hideDisplayNamePrompt(); }
async function signOutForSync(){
  if(isDemoMode()){
    currentSession = null;
    currentWorkspace = null;
    AppState.resetRuntimeApp(runtimeState);
    renderAuthState();
    render();
    showView("login", { skipHistory:true });
    setStatus("Sign in to load workspace");
    return;
  }
  return AuthService.signOutForSync(authContext());
}
async function bootstrapWorkspace(){ return AuthService.bootstrapWorkspace(authContext()); }

async function loadWorkspaceData(){
  if(!requireAuth(false)) return;
  setStatus("Loading workspace data...");
  const wid = workspaceId();
  const queries = await Promise.all([
    selectActive("field_ops_buildings"),
    selectActive("field_ops_spaces"),
    selectActive("field_ops_assets"),
    selectActive("field_ops_projects"),
    selectActive("field_ops_vendors"),
    selectActive("field_ops_budget_items"),
    selectActive("field_ops_work_orders"),
    selectActive("field_ops_vehicles"),
    selectActive("field_ops_fuel_receipts"),
    selectActive("field_ops_documents"),
    selectActive("field_ops_import_reviews"),
    selectVehicleAlerts(wid),
    selectArchived("field_ops_work_orders")
  ]);

  for(const result of queries){
    if(result.error) throw result.error;
  }

  const vendors = (queries[4].data || []).map(fromVendor);
  AppState.setLoadedCollections(app, {
    buildings: (queries[0].data || []).map(fromBuilding),
    spaces: (queries[1].data || []).map(fromSpace),
    assets: (queries[2].data || []).map(fromAsset),
    projects: (queries[3].data || []).map(fromProject),
    vendors,
    budgetItems: (queries[5].data || []).map(fromBudgetItem),
    bids: (queries[5].data || []).filter(row => row.item_type === "bid").map(row => fromBudgetBid(row, vendors)),
    tasks: (queries[6].data || []).map(fromWorkOrder),
    vehicles: (queries[7].data || []).map(fromVehicle),
    fuelReceipts: (queries[8].data || []).map(fromFuelReceipt),
    files: (queries[9].data || []).map(fromDocument),
    submissions: (queries[10].data || []).map(fromImportReview),
    vehicleAlerts: queries[11].data || [],
    archivedTasks: (queries[12].data || []).map(fromWorkOrder)
  });

  lastWorkspaceLoadAt = new Date().toLocaleString();
  setStatus("Workspace loaded");
  render();
}

function selectActive(table){
  return selectActiveFromSupabase(workspaceId(), table);
}

function selectArchived(table){
  return selectArchivedFromSupabase(workspaceId(), table);
}

async function syncNow(showAlert = true){
  try{
    await flushPendingWrites(false);
    await loadWorkspaceData();
    if(showAlert) alert("Workspace refreshed.");
  }catch(err){
    console.error(err);
    setStatus("Refresh failed");
    if(showAlert) alert("Refresh failed: " + err.message);
  }
}

async function loadFromCloud(){ await syncNow(true); }

async function refreshAfterWrite(successStatus = "Saved"){
  try{
    await loadWorkspaceData();
    setStatus(successStatus);
    return true;
  }catch(err){
    console.error("Write succeeded, but workspace refresh failed", err);
    setStatus(`${successStatus}; refresh failed`);
    return false;
  }
}

function startAutoRefresh(){
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if(document.visibilityState === "visible" && isAuthenticated() && currentWorkspace) {
      loadWorkspaceData().catch(console.error);
    }
  }, 45000);
}

document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && isAuthenticated() && currentWorkspace) {
    flushPendingWrites(false).catch(console.error);
  }
});

window.addEventListener("online", () => {
  if(isAuthenticated() && currentWorkspace) flushPendingWrites(false).catch(console.error);
});

window.addEventListener("offline", () => {
  if(pendingWrites.length) setStatus(`${pendingWrites.length} pending - offline`);
  else setStatus("Offline");
});

async function insertRecord(table, payload){
  if(!requireInsertPermission(table, `create records in ${titleize(table.replace("field_ops_",""))}`)) throw new Error("Role cannot create this record");
  if(isDemoMode()) throw new Error("Demo mode is read-only. Sign in to save real records.");
  setStatus("Saving...");
  try{
    const { data, error } = await insertRow(table, { workspace_id: workspaceId(), ...payload });
    if(error) throw error;
    setStatus("Saved");
    await refreshAfterWrite("Saved");
    return data;
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    const queued = queueWrite({ action:"insert", table, payload });
    return { ...payload, id:payload.id || queued.id, _queued:true };
  }
}

async function updateRecord(table, idValue, payload){
  if(!requireUpdatePermission(table, `change records in ${titleize(table.replace("field_ops_",""))}`)) throw new Error("Role cannot update this record");
  if(isDemoMode()) throw new Error("Demo mode is read-only. Sign in to save real records.");
  setStatus("Saving...");
  try{
    const { data, error } = await updateRow(table, idValue, payload, workspaceId());
    if(error) throw error;
    setStatus("Saved");
    await refreshAfterWrite("Saved");
    return data;
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    const queued = queueWrite({ action:"update", table, recordId:idValue, payload });
    return { id:queued.id, _queued:true };
  }
}

async function archiveRecord(table, idValue){
  if(!requireArchivePermission("archive records")) throw new Error("Role cannot archive this record");
  if(isDemoMode()) throw new Error("Demo mode is read-only. Sign in to save real records.");
  setStatus("Archiving...");
  const archivedAt = new Date().toISOString();
  const archivedBy = currentSession.user.id;
  try{
    const { error } = await archiveRow(table, idValue, workspaceId(), archivedAt, archivedBy);
    if(error) throw error;
    setStatus("Archived");
    await refreshAfterWrite("Archived");
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    queueWrite({ action:"archive", table, recordId:idValue, archivedAt, archivedBy });
  }
}

async function restoreRecord(table, idValue){
  if(!requireArchivePermission("restore operational records")) throw new Error("Role cannot restore this record");
  if(isDemoMode()) throw new Error("Demo mode is read-only. Sign in to save real records.");
  setStatus("Restoring...");
  try{
    const { error } = await restoreRow(table, idValue, workspaceId());
    if(error) throw error;
    setStatus("Restored");
    await refreshAfterWrite("Restored");
  }catch(err){
    if(!SyncService.isRetryableWriteError(err)) throw err;
    queueWrite({ action:"update", table, recordId:idValue, payload:Mappers.restorePayload() });
  }
}

async function addTask(e){
  e.preventDefault();
  if(!requireOperationsPermission("create work orders")) return;
  const title = taskName.value.trim();
  if(!title){
    setInlineState("taskSaveState", "Work order title is required", "failed");
    taskName.focus();
    return;
  }
  try{
    setInlineState("taskSaveState", "Saving work order...", "pending");
    const assigned = taskAssigned.value.trim();
    const notes = compact([
      assigned ? `Assigned: ${assigned}` : "",
      taskNotes.value.trim()
    ]).join("\n");
    const saved = await insertRecord("field_ops_work_orders", Mappers.workOrderPayloadFromForm({
      name:title,
      frequency:taskFrequency.value,
      status:taskStatus.value,
      priority:taskPriority.value,
      date:taskDate.value,
      projectId:taskProject.value,
      buildingId:taskBuilding.value,
      spaceId:taskSpace.value,
      assetId:taskAsset.value,
      vehicleId:taskVehicle.value,
      vendorId:taskVendorBid.value,
      location:taskLocation.value.trim(),
      notes
    }));
    e.target.reset();
    setInlineState("taskSaveState", saved?._queued ? "Queued until connection returns" : "Work order saved", saved?._queued ? "pending" : "saved");
    if(!saved?._queued) InteractionService?.showConfirmation?.("Work order created", "It is now active and visible in Work Orders.");
    if(saved?.id && !saved?._queued) selectedWorkOrderId = saved.id;
  }catch(err){
    setInlineState("taskSaveState", `Save failed: ${err.message}`, "failed");
    handleWriteError(err);
  }
}
async function addBuilding(e){ e.preventDefault(); try{ await insertRecord("field_ops_buildings", Mappers.buildingPayloadFromForm({ name:buildingName.value, code:buildingCode.value, address:buildingAddress.value, status:buildingStatus.value, notes:buildingNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
async function addSpace(e){ e.preventDefault(); try{ await insertRecord("field_ops_spaces", Mappers.spacePayloadFromForm({ buildingId:spaceBuilding.value, name:spaceName.value, spaceType:spaceType.value, floor:spaceFloor.value, status:spaceStatus.value, notes:spaceNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
async function addAsset(e){ e.preventDefault(); try{ await insertRecord("field_ops_assets", Mappers.assetPayloadFromForm({ buildingId:assetBuilding.value, spaceId:assetSpace.value, name:assetName.value, assetTag:assetTag.value, category:assetCategory.value, status:assetStatus.value, notes:assetNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
async function addVendor(e){ e.preventDefault(); try{ await insertRecord("field_ops_vendors", Mappers.vendorPayloadFromForm({ name:vendorName.value, vendorType:vendorType.value, contactName:vendorContact.value, phone:vendorPhone.value, email:vendorEmail.value, status:vendorStatus.value, insuranceExpiresOn:vendorInsurance.value, notes:vendorNotes.value })); e.target.reset(); }catch(err){ handleWriteError(err); } }
function handleWriteError(err){
  const message = permissionAwareErrorMessage(err);
  if(String(err?.message || '').includes('Demo mode is read-only')){
    console.warn(message);
    setStatus(message);
    return;
  }
  console.error(err);
  setStatus(message);
}

function isPermissionError(err){
  const text = String(err?.message || err?.details || err?.hint || err || "").toLowerCase();
  return text.includes("row-level security") ||
    text.includes("violates row-level security") ||
    text.includes("permission denied") ||
    text.includes("401") ||
    text.includes("403") ||
    text.includes("unauthorized");
}

function permissionAwareErrorMessage(err){
  if(isPermissionError(err)){
    return "Upload blocked by permissions. Confirm workspace access or role.";
  }
  return err?.message || "Save failed.";
}

function createViewHelpers(){
  return {
    activeItems,
    todayString,
    esc,
    card,
    empty,
    titleize,
    tone,
    renderVehicleAlertCard: window.FieldOps.Views.FleetWorkspace.renderVehicleAlertCard,
    workOrderCardWithActions,
    projectCard: window.FieldOps.Views.ProjectsBudget.projectCard,
    bidCard: window.FieldOps.Views.ProjectsBudget.bidCard
  };
}
globalThis.createViewHelpers = createViewHelpers;

function render(){
  renderFieldPortal();
  window.FieldOps.Views.TodayDashboard.render(app, createViewHelpers());
  window.FieldOps.Views.ProjectsBudget.render(app, createViewHelpers());
  VIEW_RENDERERS.forEach(rendererName => {
    const renderer = globalThis[rendererName];
    if(typeof renderer === "function") renderer();
  });
  renderPermissionState();
  renderGlobalSearch();
  window.FieldOps.Views.ProjectsBudget.buildReport(false);
}

function renderFieldPortal(){
  const count = document.getElementById("portalSubmissionCount");
  if(count) count.textContent = `${activeItems("submissions").length} sent`;
}

function searchTextFor(item){
  return Object.values(item || {})
    .filter(value => value !== null && value !== undefined && typeof value !== "object")
    .map(value => String(value))
    .join(" ")
    .toLowerCase();
}

function recordSearchEntry(type, view, item, detailParts = []){
  const title = item.name || item.title || item.fileName || item.vendor || item.workOrderNumber || "Untitled";
  return {
    id:item.id,
    type,
    group:searchGroupForType(type),
    view,
    title,
    detail:compact(detailParts).join(" · "),
    haystack:[type, title, detailParts.join(" "), searchTextFor(item)].join(" ").toLowerCase()
  };
}

function searchGroupForType(type){
  if(["Work order","Needs Review","Project"].includes(type)) return "Work";
  if(["Vehicle","Fuel receipt"].includes(type)) return "Fleet";
  if(["Document"].includes(type)) return "Files";
  if(["Asset / system","Building","Space / room"].includes(type)) return "Places + assets";
  if(["Vendor"].includes(type)) return "People + vendors";
  return "Other";
}

function groupedSearchResults(matches){
  const order = ["Work","Fleet","Files","Places + assets","People + vendors","Other"];
  return order
    .map(group => ({ group, items:matches.filter(item => item.group === group).slice(0, 4) }))
    .filter(section => section.items.length);
}

function buildOperationalSearchIndex(){
  return [
    ...activeItems("tasks").map(item => recordSearchEntry("Work order", "workOrders", item, [item.status, item.priority, item.location, item.notes])),
    ...activeItems("vehicles").map(item => recordSearchEntry("Vehicle", "vehicles", item, [item.plate, item.vin, item.status, item.registration, item.notes])),
    ...activeItems("assets").map(item => recordSearchEntry("Asset / system", "assets", item, [item.assetTag, item.category, item.status, item.notes])),
    ...activeItems("buildings").map(item => recordSearchEntry("Building", "buildings", item, [item.code, item.address, item.status, item.notes])),
    ...activeItems("spaces").map(item => recordSearchEntry("Space / room", "spaces", item, [item.spaceType, item.floor, item.status, item.notes])),
    ...activeItems("files").map(item => recordSearchEntry("Document", "documents", item, [item.fileType, item.source, item.notes, item.extractedText])),
    ...activeItems("vendors").map(item => recordSearchEntry("Vendor", "vendors", item, [item.vendorType, item.contactName, item.phone, item.email, item.notes])),
    ...activeItems("projects").map(item => recordSearchEntry("Project", "projects", item, [item.status, item.priority, item.location, item.notes])),
    ...activeItems("fuelReceipts").map(item => recordSearchEntry("Fuel receipt", "fuelReceipts", item, [item.vendor, item.date, item.totalAmount, item.odometer, item.notes])),
    ...activeItems("submissions").map(item => recordSearchEntry("Needs Review", "importReview", item, [item.status, item.category, item.location, item.description]))
  ];
}

function renderGlobalSearch(){
  const input = document.getElementById("globalSearchInput");
  const results = document.getElementById("globalSearchResults");
  if(!input || !results) return;
  const query = input.value.trim().toLowerCase();
  if(!query || !isAuthenticated()){
    results.classList.add("hidden");
    results.innerHTML = "";
    return;
  }
  const matches = buildOperationalSearchIndex()
    .filter(item => item.haystack.includes(query))
    .slice(0, 24);
  const groups = groupedSearchResults(matches);
  results.classList.remove("hidden");
  results.innerHTML = matches.length
    ? groups.map(section => `
      <section class="search-result-group" aria-label="${esc(section.group)} results">
        <h4>${esc(section.group)}</h4>
        ${section.items.map(item => `
          <button type="button" class="search-result" onclick="openSearchResult('${esc(item.view)}','${esc(item.id || "")}')">
            <span>${esc(item.type)}</span>
            <strong>${esc(item.title)}</strong>
            ${item.detail ? `<em>${esc(item.detail)}</em>` : ""}
          </button>
        `).join("")}
      </section>
    `).join("")
    : `<div class="search-empty">No matching records yet.</div>`;
}

function openSearchResult(view, idValue){
  const input = document.getElementById("globalSearchInput");
  const results = document.getElementById("globalSearchResults");
  if(results) results.classList.add("hidden");
  if(input) input.blur();
  if(view === "workOrders" && idValue){
    selectedWorkOrderId = idValue;
    showView("workOrderDetail");
    render();
    return;
  }
  showView(view);
}

function renderPermissionState(){
  const operationsAllowed = canManageOperations();
  const submitterOnly = canSubmitOnly();
  applyRoleVisibility();
  if(document.getElementById("taskForm")){
    document.querySelectorAll("#taskForm input,#taskForm select,#taskForm textarea,#taskForm button").forEach(el => {
      el.disabled = isAuthenticated() && currentWorkspace ? !operationsAllowed : false;
    });
  }
  if(document.getElementById("workspaceName")) workspaceName.disabled = isAuthenticated() && currentWorkspace ? !isOwner() : false;
  if(document.getElementById("workspaceNote")) workspaceNote.disabled = isAuthenticated() && currentWorkspace ? !isOwner() : false;
  document.querySelectorAll("[data-admin-only]").forEach(el => {
    el.classList.toggle("hidden", isAuthenticated() && currentWorkspace ? !operationsAllowed : false);
  });
  document.querySelectorAll("[data-submitter-optional]").forEach(el => {
    el.classList.toggle("hidden", isAuthenticated() && currentWorkspace ? submitterOnly : false);
  });
  ["fileBuilding","fileSpace","fileAsset","fileProject","fileWorkOrder","fileVehicle","fileBid","fileFuelReceipt","fileBudgetItem"].forEach(idValue => {
    const field = document.getElementById(idValue)?.closest("label");
    if(field) field.classList.toggle("hidden", submitterOnly);
  });
  const importTitle = document.querySelector("#importReview h2");
  const importMeta = document.querySelector("#importReview .meta");
  const submitButton = document.querySelector("#submissionForm button[type='submit']");
  if(importTitle) importTitle.textContent = submitterOnly ? "Submit Request" : "Needs Review";
  if(importMeta) importMeta.textContent = submitterOnly
    ? "Send a work request, receipt note, photo/document note, supply request, or field issue to the operations team."
    : "Requests, files, receipts, estimates, supply/material requests, and spreadsheet rows wait here before becoming active work.";
  if(submitButton) submitButton.textContent = submitterOnly ? "Submit Request" : "Send for Review";
  const reviewListTitle = document.querySelector("#importReview .panel:nth-of-type(2) h3");
  const reviewListMeta = document.querySelector("#importReview .panel:nth-of-type(2) .meta");
  if(reviewListTitle) reviewListTitle.textContent = submitterOnly ? "My Submissions" : "Needs Review";
  if(reviewListMeta) reviewListMeta.textContent = submitterOnly ? "Requests and uploaded items visible to your account." : "Submitted items, uploads, receipts, estimates, and supply requests stay here until they are reviewed.";
  const documentsTitle = document.querySelector("#documents h2");
  const documentsMeta = document.querySelector("#documents .meta");
  const documentsListTitle = document.querySelector("#documents .panel:nth-of-type(2) h3");
  if(documentsTitle) documentsTitle.textContent = "Upload Something";
  if(documentsMeta) documentsMeta.textContent = submitterOnly ? "Upload a photo, receipt, PDF, spreadsheet, or file for the operations team. Uploading a receipt or proof helps route and review the expense, but does not replace any required accounting receipt process. Uploads go to Needs Review first." : "Upload a photo, receipt, PDF estimate or invoice, spreadsheet, or supporting file and link it to the right work. Uploading a receipt or proof helps route and review the expense, but does not replace any required accounting receipt process. Accounting routing can be added later if needed.";
  if(documentsListTitle) documentsListTitle.textContent = submitterOnly ? "My Uploads" : "Document Library";
}

function applyRoleVisibility(){
  const allowed = allowedViewsForRole();
  document.querySelectorAll(".tab").forEach(tab => {
    const viewId = tab.dataset.view;
    const visible = allowed.has(viewId);
    tab.classList.toggle("hidden", !visible);
    tab.hidden = !visible;
    tab.setAttribute?.("aria-hidden", visible ? "false" : "true");
    if(viewId === "importReview"){
      tab.textContent = canSubmitOnly() ? "Submit" : "Needs Review";
    }
    if(viewId === "documents"){
      tab.textContent = "Upload";
    }
    if(viewId === "fieldPortal"){
      tab.textContent = "My Home";
    }
    if(viewId === "assignedWork"){
      tab.textContent = "My Work";
    }
    if(false && viewId === "materials"){
      tab.textContent = canSubmitOnly() ? "Submit Materials" : "Materials / Inventory";
    }
    if(false && viewId === "assets"){
      tab.textContent = "Assets / Systems";
    }
    if(false && viewId === "vehicles"){
      tab.textContent = "Fleet / Mobile Assets";
    }
  });
  document.querySelectorAll(".nav-action").forEach(action => {
    const visible = isAuthenticated() && currentWorkspace && canManageOperations();
    action.classList.toggle("hidden", !visible);
    action.hidden = !visible;
    action.setAttribute?.("aria-hidden", visible ? "false" : "true");
  });
  const primaryAdd = document.getElementById("openAddNewBtn");
  if(primaryAdd){
    const visible = isAuthenticated() && currentWorkspace;
    primaryAdd.classList.toggle("hidden", !visible);
    primaryAdd.hidden = !visible;
    primaryAdd.textContent = canSubmitOnly() ? "+ Send" : "+ Add";
  }
  document.querySelectorAll(".nav-section-label").forEach(label => {
    const section = label.dataset.navSection;
    const hasVisibleItems = Boolean(document.querySelector(`.top-nav [data-nav-group="${section}"]:not(.hidden)`));
    label.classList.toggle("hidden", !hasVisibleItems);
    label.hidden = !hasVisibleItems;
  });
  renderPilotIndicator();
  renderDiagnostics();

  if(!canAccessView(activeViewId)){
    showView(defaultViewForRole(), { skipHistory:true });
  }
}

function renderPilotIndicator(){
  const indicator = document.getElementById("pilotIndicator");
  if(!indicator) return;
  const configFlag = Boolean(window.APP_CONFIG?.PILOT_MODE);
  const visible = canManageOperations() && configFlag;
  indicator.classList.toggle("hidden", !visible);
  indicator.hidden = !visible;
}

function renderBuildings(){
  const buildings = activeItems("buildings");
  document.getElementById("buildingList").innerHTML = buildings.length ? buildings.map((b)=>card(b.name,[b.address,b.notes],[b.code,b.status],tone(b.status)) + rowActions("buildings", b)).join("") : empty("No buildings yet.");
  const options = `<option value="">No building</option>` + buildings.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
  ["spaceBuilding","assetBuilding","taskBuilding","fileBuilding"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function renderSpaces(){
  const spaces = activeItems("spaces");
  document.getElementById("spaceList").innerHTML = spaces.length ? spaces.map((s)=>{ const building = app.buildings.find(b => b.id === s.buildingId); return card(s.name,[building ? `Building: ${building.name}` : "", s.notes],[s.spaceType,s.floor,s.status],tone(s.status)) + rowActions("spaces", s); }).join("") : empty("No spaces yet.");
  const options = `<option value="">No space</option>` + spaces.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  ["assetSpace","taskSpace","fileSpace"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function renderAssets(){
  const assets = activeItems("assets");
  document.getElementById("assetList").innerHTML = assets.length ? assets.map((a)=>{ const space = app.spaces.find(s => s.id === a.spaceId); return card(a.name,[space ? `Space: ${space.name}` : "", a.notes],[a.assetTag,a.category,a.status],tone(a.status)) + rowActions("assets", a) + assetStoryPanel(a); }).join("") : empty("No assets yet.");
  const options = `<option value="">No asset</option>` + assets.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  ["taskAsset","fileAsset"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function objectStoryRows(items, emptyText, formatter){
  return items.length ? items.slice(0,5).map(formatter).join("") + (items.length > 5 ? `<p>+ ${items.length - 5} more</p>` : "") : `<p>${esc(emptyText)}</p>`;
}

function assetStoryPanel(asset){
  const docs = activeItems("files").filter(file => file.relatedAssetId === asset.id);
  const work = activeItems("tasks").filter(task => task.assetId === asset.id);
  const openWork = work.filter(isOpenRecord);
  const history = work.filter(task => !isOpenRecord(task));
  const warranties = docs.filter(doc => /warranty|manual|title|registration/i.test(`${doc.fileType || ""} ${doc.fileName || ""} ${doc.notes || ""}`));
  const photos = docs.filter(doc => /photo|image|jpg|jpeg|png|heic/i.test(`${doc.fileType || ""} ${doc.fileName || ""}`));
  return `<details class="object-story">
    <summary>Overview, history, documents, photos, and open work</summary>
    <div class="object-story-grid">
      <section class="object-story-section"><h4>Overview</h4>${objectStoryRows([asset], "No overview yet.", item => `<p>${esc(compact([item.assetTag ? `Tag: ${item.assetTag}` : "", item.category, titleize(item.status), item.notes]).join(" | "))}</p>`)}</section>
      <section class="object-story-section"><h4>History</h4>${objectStoryRows(history, "No completed repairs yet.", item => `<p>${esc(compact([item.date, item.workOrderNumber, item.name]).join(" | "))}</p>`)}</section>
      <section class="object-story-section"><h4>Documents</h4>${objectStoryRows(docs, "No linked documents yet.", doc => `<p>${esc(doc.fileName)}</p>`)}</section>
      <section class="object-story-section"><h4>Warranties / Manuals</h4>${objectStoryRows(warranties, "No warranties or manuals linked yet.", doc => `<p>${esc(doc.fileName)}</p>`)}</section>
      <section class="object-story-section"><h4>Photos</h4>${objectStoryRows(photos, "No photos linked yet.", doc => `<p>${esc(doc.fileName)}</p>`)}</section>
      <section class="object-story-section"><h4>Open Work</h4>${objectStoryRows(openWork, "No open work linked.", item => `<p>${esc(compact([item.date, item.workOrderNumber, item.name]).join(" | "))}</p>`)}</section>
    </div>
  </details>`;
}

function isOpenRecord(item){
  return !["complete","completed","closed","archived","canceled"].includes(String(item.status || "").toLowerCase());
}

function renderVendors(){
  const vendors = activeItems("vendors");
  document.getElementById("vendorList").innerHTML = vendors.length ? vendors.map(v => card(v.name,[v.contactName, v.phone, v.email, v.notes],[v.vendorType, v.status, v.insuranceExpiresOn ? `Insurance: ${v.insuranceExpiresOn}` : ""],tone(v.status)) + rowActions("vendors", v)).join("") : empty("No vendors yet.");
  const options = `<option value="">No related vendor</option>` + vendors.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join("");
  ["taskVendorBid","fileBid","budgetVendor"].forEach(el => { if(document.getElementById(el)) document.getElementById(el).innerHTML = options; });
}

function rowActions(section, item){
  if(!canManageOperations()) return "";
  const archiveLabel = section === "tasks" ? "Archive this task" : "Archive";
  return `<div class="actions no-print"><button class="ghost" onclick="openEditModal('${section}',${app[section].indexOf(item)})">Edit</button><button class="ghost" onclick="deleteItem('${section}',${app[section].indexOf(item)})">${archiveLabel}</button></div>`;
}

const editConfig = {
  buildings:{ table:"field_ops_buildings", fields:[["name","Building name","text"],["code","Code","text"],["address","Address","text"],["status","Status","select:active|inactive|under_construction|archived"],["notes","Notes","textarea"]], toDb:Mappers.buildingEditPayload },
  spaces:{ table:"field_ops_spaces", fields:[["buildingId","Building","buildingSelect"],["name","Space name","text"],["spaceType","Type","text"],["floor","Floor / area","text"],["status","Status","select:active|inactive|needs_attention|archived"],["notes","Notes","textarea"]], toDb:Mappers.spaceEditPayload },
  assets:{ table:"field_ops_assets", fields:[["buildingId","Building","buildingSelect"],["spaceId","Space","spaceSelect"],["name","Asset name","text"],["assetTag","Asset tag","text"],["category","Category","text"],["status","Status","select:active|needs_service|out_of_service|retired|archived"],["notes","Notes","textarea"]], toDb:Mappers.assetEditPayload },
  ...window.FieldOps.Views.ProjectsBudget.editConfig,
  vendors:{ table:"field_ops_vendors", fields:[["name","Vendor name","text"],["vendorType","Type","text"],["contactName","Contact name","text"],["phone","Phone","text"],["email","Email","text"],["status","Status","select:active|needs_review|inactive|archived"],["insuranceExpiresOn","Insurance expires","date"],["notes","Notes","textarea"]], toDb:Mappers.vendorEditPayload },
  tasks:{ table:"field_ops_work_orders", fields:[["name","Work order","text"],["status","Status","select:open|scheduled|in_progress|waiting|complete|canceled|archived"],["priority","Priority","select:low|normal|high|urgent"],["date","Due date","date"],["projectId","Project","projectSelect"],["buildingId","Building","buildingSelect"],["spaceId","Space","spaceSelect"],["assetId","Asset","assetSelect"],["vehicleId","Vehicle","vehicleSelect"],["vendorBidId","Vendor","vendorSelect"],["location","Location/description","text"],["notes","Notes","textarea"]], toDb:Mappers.workOrderEditPayload },
  vehicles:{ table:"field_ops_vehicles", fields:[["name","Vehicle name","text"],["vehicleNumber","Vehicle number","text"],["plate","License plate","text"],["vin","VIN","text"],["mileage","Odometer","number"],["status","Status","select:active|due_for_service|overdue_for_service|in_maintenance|out_of_service|retired|archived"],["lastServiceDate","Last service date","date"],["serviceDate","Next service date","date"],["registration","Registration due","date"],["notes","Notes","textarea"]], toDb:Mappers.vehicleEditPayload },
  fuelReceipts:{ table:"field_ops_fuel_receipts", fields:[["vehicleId","Vehicle","vehicleSelect"],["date","Date","date"],["vendor","Gas station / vendor","text"],["gallons","Gallons","number"],["totalAmount","Total amount","number"],["pricePerGallon","Price per gallon","number"],["odometer","Odometer","number"],["notes","Notes","textarea"]], toDb:Mappers.fuelReceiptEditPayload },
  files:{ table:"field_ops_documents", fields:[["fileName","File name","text"],["fileType","Type","text"],["relatedBuildingId","Building","buildingSelect"],["relatedSpaceId","Space","spaceSelect"],["relatedAssetId","Asset","assetSelect"],["relatedProjectId","Project","projectSelect"],["relatedWorkItemId","Work order","workOrderSelect"],["relatedVehicleId","Vehicle","vehicleSelect"],["relatedVendorId","Vendor","vendorSelect"],["relatedFuelReceiptId","Fuel receipt","fuelReceiptSelect"],["relatedBudgetItemId","Budget item","budgetItemSelect"],["notes","Notes","textarea"]], toDb:Mappers.documentEditPayload }
};

function openEditModal(section,index){
  if(!requireOperationsPermission("edit operational records")) return;
  const item = app[section][index];
  const config = editConfig[section];
  if(!item || !config) return;
  AppState.setCurrentEdit(runtimeState, section, index);
  editModalTitle.textContent = `Edit ${titleize(section)}`;
  editForm.innerHTML = config.fields.map(([key,label,type]) => fieldHtml(key,label,type,item[key] ?? "")).join("") +
    `<div class="actions full"><button type="submit">Save Changes</button><button class="ghost" type="button" onclick="closeEditModal()">Cancel</button></div>`;
  editModal.classList.add("active");
}

function fieldHtml(key,label,type,value){
  const lists = { projectSelect:app.projects, vehicleSelect:app.vehicles, vendorSelect:app.vendors, buildingSelect:app.buildings, spaceSelect:app.spaces, assetSelect:app.assets, workOrderSelect:app.tasks, fuelReceiptSelect:app.fuelReceipts, budgetItemSelect:app.budgetItems };
  return window.FieldOps.Components.Forms.fieldHtml({ key, label, type, value, lists, esc, titleize, money });
}

function closeEditModal(){
  editModal.classList.remove("active");
  AppState.setCurrentEdit(runtimeState);
}

editForm.addEventListener("submit", async e => {
  e.preventDefault();
  const { section, index } = currentEdit;
  const config = editConfig[section];
  const item = app[section]?.[index];
  if(!config || !item) return;
  const formData = new FormData(editForm);
  config.fields.forEach(([key]) => { item[key] = formData.get(key) || ""; });
  try{
    if(section === "bids" && item.vendor){
      const vendor = await findOrCreateVendor(item.vendor);
      item.vendorId = vendor.id;
      await updateRecord(config.table, item.id, { ...config.toDb(item), vendor_id: vendor.id });
    } else {
      await updateRecord(config.table, item.id, config.toDb(item));
    }
    closeEditModal();
  }catch(err){ handleWriteError(err); }
});

async function deleteItem(section,index){
  if(!requireOperationsPermission("move records out of active work")) return;
  const item = app[section]?.[index];
  const config = editConfig[section];
  if(!item || !config) return;
  if(!confirm("Move this item out of active work? It will be hidden from active lists but kept for history.")) return;
  try{ await archiveRecord(config.table, item.id); }
  catch(err){ handleWriteError(err); }
}

async function approveSubmissionById(reviewId){
  const item = app.submissions.find(s => s.id === reviewId);
  if(!item) return;
  try{
    await ImportReviewService.approveReview({ reviewId, review:item, type:item.importTarget, data:item.importedRecord || {}, documentId:item.documentId, reviewerId:currentSession.user.id }, { app, insertRecord, updateRecord, archiveRecord, id });
  }catch(err){ handleWriteError(err); }
}

function renderSettings(){
  workspaceName.value = app.settings.workspaceName || "";
  workspaceNote.value = app.settings.workspaceNote || "";
  const settingsWorkspaceId = document.getElementById("settingsWorkspaceId");
  if(settingsWorkspaceId) settingsWorkspaceId.textContent = currentWorkspace ? `${currentWorkspace.name} (${currentWorkspace.id})` : "Not loaded";
  renderPendingQueueState();
  renderDiagnostics();
  refreshPeopleRoles(false);
}

function renderPeopleRoleList(members = []){
  const target = document.getElementById("peopleRoleList");
  const status = document.getElementById("peopleRoleStatus");
  if(!target) return;
  if(!isOwner()){
    target.innerHTML = empty("Owner access is required to manage people.");
    if(status) status.textContent = "Only Owners can manage people here.";
    return;
  }
  if(!members.length){
    target.innerHTML = empty("No people loaded yet.");
    return;
  }
  target.innerHTML = members.map(member => card(member.email || "Unknown email", [
    `Role: ${titleize(member.role || "member")}`,
    member.updated_at ? `Updated: ${new Date(member.updated_at).toLocaleString()}` : ""
  ], [member.role || "member"], member.role === "owner" ? "good" : "neutral")).join("");
}

async function refreshPeopleRoles(showErrors = true){
  const status = document.getElementById("peopleRoleStatus");
  if(!isAuthenticated() || !currentWorkspace || !isOwner()){
    renderPeopleRoleList([]);
    return;
  }
  try{
    if(status) status.textContent = "Loading people...";
    const { data, error } = await listWorkspaceMembers(workspaceId());
    if(error) throw error;
    renderPeopleRoleList(data || []);
    if(status) status.textContent = `${(data || []).length} person${(data || []).length === 1 ? "" : "s"} in this workspace.`;
  }catch(err){
    console.error(err);
    if(status) status.textContent = "People could not load. Check the owner-managed people setup first.";
    if(showErrors) alert("People could not load: " + err.message);
  }
}

async function savePeopleRole(event){
  event.preventDefault();
  if(!requireOwnerPermission("manage people and roles")) return;
  const email = document.getElementById("peopleRoleEmail")?.value.trim();
  const role = document.getElementById("peopleRoleSelect")?.value;
  const status = document.getElementById("peopleRoleStatus");
  if(!email || !role){
    if(status) status.textContent = "Enter an email and choose a role.";
    return;
  }
  try{
    if(status) status.textContent = "Saving person...";
    const { error } = await setMemberRoleByEmail(workspaceId(), email, role);
    if(error) throw error;
    if(status) status.textContent = `${email} is now ${titleize(role)}.`;
    document.getElementById("peopleRoleForm")?.reset();
    await refreshPeopleRoles(false);
  }catch(err){
    console.error(err);
    const message = String(err.message || "");
    const friendly = message.includes("does not exist")
      ? "That email is not an app user yet. Add or invite them in the account system first, then try again."
      : message;
    if(status) status.textContent = friendly;
    alert(friendly);
  }
}

function renderDiagnostics(){
  const panel = document.getElementById("diagnosticPanel");
  if(!panel) return;
  const visible = isAuthenticated() && currentWorkspace && canManageOperations();
  panel.classList.toggle("hidden", !visible);
  panel.hidden = !visible;
  const setText = (idValue, text) => {
    const el = document.getElementById(idValue);
    if(el) el.textContent = text;
  };
  setText("diagRole", currentRole() ? titleize(currentRole()) : "-");
  setText("diagWorkspaceId", currentWorkspace?.id || "-");
  setText("diagSessionEmail", currentSession?.user?.email || "-");
  setText("diagSyncStatus", document.getElementById("syncStatusText")?.textContent || "-");
  setText("diagPendingWrites", String(pendingWrites.length || 0));
  setText("diagSupabaseConnected", supabaseClient ? "Connected" : "Not connected");
  setText("diagLastLoadAt", lastWorkspaceLoadAt || "Never");
}

function printBoardReport(){ buildReport(false); window.print(); }
function downloadBackup(){ const blob = new Blob([JSON.stringify(app,null,2)], {type:"application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `field-ops-cache-${todayString()}.json`; a.click(); URL.revokeObjectURL(url); }
function uploadBackup(){ alert("Backups are read-only here. The shared workspace remains the source of truth."); }
function resetLocalData(){ AppState.resetRuntimeApp(runtimeState); render(); setStatus("Temporary cache cleared"); }
function setActiveView(id){
  activeViewId = id;
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".tab").forEach(b=>{
    const active = b.dataset.view===id;
    b.classList.toggle("active", active);
    b.setAttribute?.("aria-current", active ? "page" : "false");
    b.setAttribute?.("aria-selected", active ? "true" : "false");
  });
  updateBackButton();
  document.getElementById("mainContent")?.focus?.({ preventScroll:true });
  window.scrollTo({top:0,behavior:"smooth"});
}

function showView(id, options = {}){
  if(!document.getElementById(id)) return;
  if(!canAccessView(id)){
    if(!isAuthenticated()){
      setActiveView("login");
      return;
    }
    if(id !== activeViewId && !options.skipHistory){
      AppState.pushViewHistory(runtimeState, activeViewId);
    }
    showAccessDenied(id);
    return;
  }
  if(id !== activeViewId && !options.skipHistory){
    AppState.pushViewHistory(runtimeState, activeViewId);
  }
  setActiveView(id);
}

function setupFormDisclosure(){
  const collapsedForms = ["submissionForm","fileForm","projectForm","vendorForm","bidForm","materialForm","taskForm","buildingForm","spaceForm","assetForm","vehicleForm","fuelReceiptForm","budgetForm"];
  collapsedForms.forEach(formId => {
    const form = document.getElementById(formId);
    const panel = form?.closest?.(".panel");
    const title = panel?.querySelector?.(".panel-title");
    if(!form || !panel || !title || typeof title.appendChild !== "function" || panel.dataset.formDisclosureReady) return;
    panel.dataset.formCollapsed = "true";
    panel.dataset.formDisclosureReady = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost form-disclosure-btn";
    const defaultLabel = formId === "taskForm" ? "Create Work Order" : formId === "submissionForm" ? "Submit Request" : formId === "fileForm" ? "Upload File" : "Add / Edit";
    button.textContent = defaultLabel;
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const collapsed = panel.dataset.formCollapsed !== "false";
      panel.dataset.formCollapsed = collapsed ? "false" : "true";
      button.textContent = collapsed ? "Hide Form" : defaultLabel;
      button.setAttribute("aria-expanded", collapsed ? "true" : "false");
      if(collapsed) form.querySelector?.("input,select,textarea,button")?.focus?.();
    });
    title.appendChild(button);
  });
}


function setFormCollapsed(formId, collapsed){
  const form = document.getElementById(formId);
  const panel = form?.closest?.(".panel");
  if(!panel) return;
  panel.dataset.formCollapsed = collapsed ? "true" : "false";
  const button = panel.querySelector?.(".form-disclosure-btn");
  if(button){
    const defaultLabel = formId === "taskForm" ? "Create Work Order" : formId === "submissionForm" ? "Submit Request" : formId === "fileForm" ? "Upload File" : "Add / Edit";
    button.textContent = collapsed ? defaultLabel : "Hide Form";
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
}

function openSubmitRequest(){
  showView("importReview");
  setFormCollapsed("submissionForm", false);
}

function openMySubmissions(){
  showView("importReview");
  setFormCollapsed("submissionForm", true);
}

function openUploadFile(){
  showView("documents");
  setFormCollapsed("fileForm", false);
}

function openSupplyRequest(){
  showView("materials");
  setFormCollapsed("materialForm", false);
}

function showAssignedWorkUnavailable(){
  showView("assignedWork");
}

function goBackView(){
  const previous = AppState.popViewHistory(runtimeState);
  showView(previous || defaultViewForRole(), { skipHistory:true });
}

function updateBackButton(){
  const button = document.getElementById("appBackBtn");
  if(!button) return;
  button.classList.toggle("hidden", !viewHistory.length || activeViewId === defaultViewForRole());
}

function normalizeKey(key){ return String(key || "").toLowerCase().replace(/[^a-z0-9]/g,""); }
function getValue(row, possibleNames){ const lookup = {}; Object.keys(row).forEach(k => lookup[normalizeKey(k)] = row[k]); for(const name of possibleNames){ const found = lookup[normalizeKey(name)]; if(found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim(); } return ""; }

function inferImportType(headers){
  const joined = headers.map(normalizeKey).join(" ");
  if(joined.includes("frequency") && joined.includes("task") && (joined.includes("areasystem") || joined.includes("locationarea"))) return "recurring_schedule";
  if(joined.includes("vin") || joined.includes("plate") || joined.includes("odometer")) return "vehicle";
  if(joined.includes("gallons") || joined.includes("pricepergallon") || joined.includes("gasstation")) return "fuel_receipt";
  if(joined.includes("vendor") || joined.includes("contractor") || joined.includes("company")) {
    if(joined.includes("amount") || joined.includes("bid") || joined.includes("invoice")) return "budget_item";
    return "vendor";
  }
  if(joined.includes("asset") || joined.includes("tag") || joined.includes("serial")) return "asset";
  if(joined.includes("project") || joined.includes("budget")) return "project";
  return "work_order";
}

function targetFieldsForImport(type){
  const normalized = normalizeProposedType(type);
  if(type === "recurring_schedule") return ["frequency","area_system","title","assigned_to","timing","notes"];
  const fields = {
    work_order:["title","priority","date","location","notes"],
    project:["name","priority","date","location","amount","notes"],
    budget_item:["vendor","label","amount","date","notes"],
    vendor:["vendor","name","contact","phone","email","category","notes"],
    vehicle:["vehicle","name","plate","vin","mileage","date","notes"],
    fuel_receipt:["vehicle","vendor","date","gallons","amount","price_per_gallon","odometer","notes"],
    asset:["asset","name","tag","category","location","notes"]
  };
  return fields[normalized] || fields.work_order;
}

function guessHeaderForField(headers, field){
  const aliases = {
    frequency:["frequency"],
    area_system:["area/system","area","system","location/area","location area","location"],
    assigned_to:["assigned to","responsible","team","role"],
    timing:["timing","schedule","due logic"],
    title:["title","task","work order","scope","description"],
    name:["name","project","vehicle","asset"],
    vendor:["vendor","contractor","company","supplier","gas station","station"],
    vehicle:["vehicle","vehicle name","unit"],
    plate:["plate","license plate"],
    vin:["vin"],
    mileage:["mileage","odometer"],
    tag:["tag","asset tag","serial"],
    category:["category","type","service category"],
    contact:["contact","contact name"],
    phone:["phone","telephone"],
    email:["email"],
    amount:["amount","bid amount","cost","estimate","price","total"],
    date:["date","due date","service date","receipt date"],
    gallons:["gallons"],
    price_per_gallon:["price per gallon","price/gal","ppg"],
    odometer:["odometer","mileage"],
    priority:["priority","urgency"],
    location:["location","site","building","area","room"],
    notes:["notes","details","scope","comments","description"],
    label:["label","item","description","invoice","bid"]
  };
  const wanted = aliases[field] || [field];
  return headers.find(header => wanted.some(alias => normalizeKey(header) === normalizeKey(alias))) ||
    headers.find(header => wanted.some(alias => normalizeKey(header).includes(normalizeKey(alias)))) || "";
}

function renderMappingPanel(){
  const target = document.getElementById("mappingPanel");
  if(!target) return;
  if(!stagedImport.rows.length){
    target.innerHTML = empty("Upload an Excel or CSV file to preview rows and match columns.");
    return;
  }
  if(stagedImport.suggestedType === "recurring_schedule"){
    renderRecurringSchedulePreview(target);
    return;
  }
  if(stagedImport.suggestedType === "master_calendar_bundle"){
    renderMasterCalendarBundlePreview(target);
    return;
  }
  const fields = targetFieldsForImport(stagedImport.suggestedType);
  const options = `<option value="">Do not map</option>` + stagedImport.headers.map(header => `<option value="${esc(header)}">${esc(header)}</option>`).join("");
  target.innerHTML = `<article class="card"><h4>Suggested import: ${esc(titleize(stagedImport.suggestedType))}</h4><p>${stagedImport.rows.length} row${stagedImport.rows.length === 1 ? "" : "s"} ready to stage after review.</p><div class="form-grid">${fields.map(field => {
    const guess = guessHeaderForField(stagedImport.headers, field);
    return `<label>${esc(titleize(field))}<select data-map-field="${esc(field)}">${options.replace(`value="${esc(guess)}"`, `value="${esc(guess)}" selected`)}</select></label>`;
  }).join("")}</div></article>`;
}

function recurringCell(row, names){
  return getValue(row, names);
}

function recurringKey(row){
  return [
    recurringCell(row, ["Frequency"]),
    recurringCell(row, ["Area/System", "Location/Area", "Location"]),
    recurringCell(row, ["Task", "Title"])
  ].map(value => normalizeKey(value)).join("|");
}

function existingRecurringKeys(){
  const keys = new Set();
  activeItems("tasks").forEach(task => {
    const match = String(task.notes || "").match(/Recurring key:\s*([^\n]+)/i);
    if(match?.[1]) keys.add(match[1].trim());
    const legacy = [task.type, task.location, task.name].map(value => normalizeKey(value)).join("|");
    if(task.type === "maintenance" && task.name) keys.add(legacy);
  });
  activeItems("submissions").forEach(review => {
    const data = review.importedRecord || {};
    if(data.recurring_key) keys.add(data.recurring_key);
  });
  return keys;
}

function inferRecurringAnchor(row){
  const area = recurringCell(row, ["Area/System", "Location/Area", "Location"]);
  const normalized = normalizeKey(area);
  const findExact = collection => collection.find(item => normalizeKey(item.name) === normalized || normalizeKey(item.code) === normalized);
  const findLoose = collection => collection.find(item => normalizeKey(item.name).includes(normalized) || normalized.includes(normalizeKey(item.name)));
  const building = findExact(app.buildings) || findLoose(app.buildings);
  const space = findExact(app.spaces) || findLoose(app.spaces);
  const asset = findExact(app.assets) || findLoose(app.assets);
  return {
    area,
    buildingId: building?.id || space?.buildingId || asset?.buildingId || "",
    spaceId: space?.id || asset?.spaceId || "",
    assetId: asset?.id || "",
    label: asset ? `Asset/system: ${asset.name}` : space ? `Space: ${space.name}` : building ? `Building: ${building.name}` : "Missing details",
    needsAnchorReview: !(building || space || asset)
  };
}

function nextDateForTiming(frequency, timing){
  const today = new Date();
  const lower = `${frequency || ""} ${timing || ""}`.toLowerCase();
  const days = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
  const namedDay = Object.keys(days).find(day => lower.includes(day));
  if(namedDay){
    const target = new Date(today);
    const delta = (days[namedDay] - today.getDay() + 7) % 7;
    target.setDate(today.getDate() + delta);
    return target.toISOString().slice(0,10);
  }
  const target = new Date(today);
  if(lower.includes("daily")) target.setDate(today.getDate());
  else if(lower.includes("weekly")) target.setDate(today.getDate() + 7);
  else if(lower.includes("month")) target.setDate(today.getDate() + 14);
  else if(lower.includes("quarter")) target.setDate(today.getDate() + 30);
  else if(lower.includes("annual") || lower.includes("year")) target.setDate(today.getDate() + 45);
  else target.setDate(today.getDate() + 7);
  return target.toISOString().slice(0,10);
}

function recurringReviewData(row){
  const frequency = recurringCell(row, ["Frequency"]);
  const area = recurringCell(row, ["Area/System", "Location/Area", "Location"]);
  const title = recurringCell(row, ["Task", "Title"]);
  const assignedTo = recurringCell(row, ["Assigned To", "Responsible"]);
  const timing = recurringCell(row, ["Timing", "Schedule"]);
  const notes = recurringCell(row, ["Notes"]);
  const anchor = inferRecurringAnchor(row);
  const key = recurringKey(row);
  return {
    title,
    type:"maintenance",
    status:"open",
    priority:"normal",
    date:nextDateForTiming(frequency, timing),
    due_date:nextDateForTiming(frequency, timing),
    location:area,
    description:area,
    building_id:anchor.buildingId || null,
    space_id:anchor.spaceId || null,
    asset_id:anchor.assetId || null,
    recurrence_pattern:frequency,
    responsible_role:assignedTo,
    timing,
    source_sheet:row.__sourceSheet || "Recurring Schedule",
    source_row:row.__sourceRow,
    recurring_key:key,
    needs_anchor_review:anchor.needsAnchorReview,
    notes:compact([
      "Recurring template.",
      `Frequency: ${frequency}`,
      assignedTo ? `Responsible: ${assignedTo}` : "",
      timing ? `Timing: ${timing}` : "",
      anchor.needsAnchorReview ? `Missing details: ${area}` : `Anchor: ${anchor.label}`,
      `Source: ${row.__sourceSheet || "Recurring Schedule"} row ${row.__sourceRow}`,
      `Recurring key: ${key}`,
      notes
    ]).join("\n")
  };
}

function renderRecurringSchedulePreview(target){
  const keys = existingRecurringKeys();
  const rows = stagedImport.rows.filter(row => recurringCell(row, ["Task", "Title"]));
  target.innerHTML = `
    <article class="card recurring-import-summary">
      <h4>Recurring Schedule preview</h4>
      <p>${rows.length} row${rows.length === 1 ? "" : "s"} from <strong>Recurring Schedule</strong>. No other workbook sheets were read into this preview.</p>
      <p class="meta">Approve only the rows you want. Uncertain locations are marked as missing details.</p>
    </article>
    <div class="recurring-preview-list">
      ${rows.map((row, index) => {
        const data = recurringReviewData(row);
        const duplicate = keys.has(data.recurring_key);
        return `<label class="recurring-preview-card ${data.needs_anchor_review ? "needs-anchor" : ""} ${duplicate ? "duplicate" : ""}">
          <input type="checkbox" data-recurring-index="${index}" ${duplicate ? "" : "checked"} ${duplicate ? "disabled" : ""} />
          <span>
            <strong>${esc(data.title)}</strong>
            <em>${esc(data.recurrence_pattern)} · ${esc(data.location || "No area")} · ${esc(data.timing || "Timing TBD")}</em>
            <small>${esc(data.needs_anchor_review ? "Missing details" : "Anchor found")} · Source row ${esc(data.source_row || "")}${duplicate ? " · Duplicate skipped" : ""}</small>
          </span>
        </label>`;
      }).join("")}
    </div>
  `;
}

function selectedRecurringRows(){
  const rows = stagedImport.rows.filter(row => recurringCell(row, ["Task", "Title"]));
  return Array.from(document.querySelectorAll("[data-recurring-index]:checked"))
    .map(input => rows[Number(input.dataset.recurringIndex)])
    .filter(Boolean);
}

function cleanWorkbookText(value){
  return String(value || "")
    .replace(/â€¢/g, "-")
    .replace(/[•]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function calendarTitleParts(title){
  const cleaned = cleanWorkbookText(title);
  const match = cleaned.match(/^([^:]+):\s*(.+)$/);
  return {
    area:match ? match[1].trim() : "",
    task:match ? match[2].trim() : cleaned
  };
}

function masterImportKey(row){
  return [
    row.source_workbook,
    row.source_sheet,
    row.source_row,
    row.source_cell,
    row.route,
    row.due_date,
    row.title
  ].map(value => normalizeKey(value)).join("|");
}

function existingMasterImportKeys(){
  const keys = new Set();
  activeItems("tasks").forEach(task => {
    const match = String(task.notes || "").match(/Master import key:\s*([^\n]+)/i);
    if(match?.[1]) keys.add(match[1].trim());
  });
  activeItems("submissions").forEach(review => {
    const data = review.importedRecord || {};
    if(data.master_import_key) keys.add(data.master_import_key);
  });
  return keys;
}

function masterRowFromCalendarItem(item, sourceWorkbook){
  const parts = calendarTitleParts(item.title);
  const anchor = inferRecurringAnchor({ "Location/Area":parts.area || item.route || "" });
  const title = parts.task || cleanWorkbookText(item.title);
  const data = {
    title,
    type:item.route === "fleet_work" ? "fleet" : "maintenance",
    status:"open",
    priority:String(title).toLowerCase().includes("urgent") ? "urgent" : "normal",
    date:item.date,
    due_date:item.date,
    location:parts.area,
    description:parts.area,
    building_id:anchor.buildingId || null,
    space_id:anchor.spaceId || null,
    asset_id:anchor.assetId || null,
    source_workbook:sourceWorkbook,
    source_sheet:item.sourceSheet,
    source_row:item.sourceRow,
    source_cell:item.sourceCell,
    route:item.route,
    needs_anchor_review:anchor.needsAnchorReview,
    original_cell_text:item.originalCellText,
    notes:compact([
      `Scheduled from master calendar for ${item.date}.`,
      parts.area ? `Area/system: ${parts.area}` : "",
      anchor.needsAnchorReview ? `Missing details: ${parts.area || "No anchor listed"}` : `Anchor: ${anchor.label}`,
      `Source: ${item.sourceSheet} ${item.sourceCell}`,
      `Master import key: ${sourceWorkbook}|${item.sourceSheet}|${item.sourceCell}|${item.date}|${title}`
    ]).join("\n")
  };
  data.master_import_key = masterImportKey(data);
  data.notes = data.notes.replace(/Master import key:.*/, `Master import key: ${data.master_import_key}`);
  return {
    route:item.route || "scheduled_work",
    proposedType:"work_order",
    title,
    subtitle:`${item.date} - ${parts.area || "General"} - ${item.sourceSheet}`,
    confidence:anchor.needsAnchorReview ? "Missing details" : "Ready for review",
    data
  };
}

function masterRowFromFleetSchedule(row, sourceWorkbook){
  const task = cleanWorkbookText(row.Task);
  const appliesTo = cleanWorkbookText(row["Applies To"]);
  const timing = cleanWorkbookText(row["Suggested Timing"]);
  const frequency = cleanWorkbookText(row.Frequency);
  const data = {
    title:task,
    type:"fleet",
    status:"open",
    priority:"normal",
    due_date:nextDateForTiming(frequency, timing),
    location:appliesTo,
    description:appliesTo,
    recurrence_pattern:frequency,
    responsible_role:cleanWorkbookText(row["Assigned To"]),
    timing,
    source_workbook:sourceWorkbook,
    source_sheet:row.sourceSheet,
    source_row:row.sourceRow,
    route:"fleet_schedule",
    wear_tear_items:cleanWorkbookText(row["Wear/Tear Items"]),
    trigger:cleanWorkbookText(row.Trigger),
    notes:compact([
      "Fleet recurring schedule item.",
      frequency ? `Frequency: ${frequency}` : "",
      appliesTo ? `Applies to: ${appliesTo}` : "",
      timing ? `Timing: ${timing}` : "",
      row["Wear/Tear Items"] ? `Wear/tear: ${cleanWorkbookText(row["Wear/Tear Items"])}` : "",
      row.Trigger ? `Trigger: ${cleanWorkbookText(row.Trigger)}` : "",
      row.Notes ? cleanWorkbookText(row.Notes) : ""
    ]).join("\n")
  };
  data.master_import_key = masterImportKey(data);
  data.notes = compact([data.notes, `Source: ${row.sourceSheet} row ${row.sourceRow}`, `Master import key: ${data.master_import_key}`]).join("\n");
  return {
    route:"fleet_schedule",
    proposedType:"work_order",
    title:task || "Fleet schedule item",
    subtitle:`${frequency || "Schedule"} - ${appliesTo || "Fleet"}`,
    confidence:"Ready for review",
    data
  };
}

function masterRowFromFleetMaster(row, sourceWorkbook){
  const name = cleanWorkbookText(row.Vehicle);
  const plateVin = cleanWorkbookText(row["Plate/VIN"]);
  const notes = compact([
    row.Type ? `Type: ${cleanWorkbookText(row.Type)}` : "",
    row["Current Mileage"] ? `Current mileage: ${cleanWorkbookText(row["Current Mileage"])}` : "",
    row["Last Oil Change Mileage"] ? `Last oil change mileage: ${cleanWorkbookText(row["Last Oil Change Mileage"])}` : "",
    row["Next Oil Change Due"] ? `Next oil change due: ${cleanWorkbookText(row["Next Oil Change Due"])}` : "",
    row["Last Tire Rotation"] ? `Last tire rotation: ${cleanWorkbookText(row["Last Tire Rotation"])}` : "",
    row["Next Tire Rotation Due"] ? `Next tire rotation due: ${cleanWorkbookText(row["Next Tire Rotation Due"])}` : "",
    row["Last Service Date"] ? `Last service date: ${cleanWorkbookText(row["Last Service Date"])}` : "",
    row.Notes ? cleanWorkbookText(row.Notes) : ""
  ]).join("\n");
  const data = {
    name,
    vehicle:name,
    plate:plateVin,
    mileage:cleanWorkbookText(row["Current Mileage"]),
    status:cleanWorkbookText(row.Status) || "active",
    notes,
    source_workbook:sourceWorkbook,
    source_sheet:row.sourceSheet,
    source_row:row.sourceRow,
    route:"fleet_master"
  };
  data.master_import_key = masterImportKey({ ...data, title:name });
  data.notes = compact([notes, `Source: ${row.sourceSheet} row ${row.sourceRow}`, `Master import key: ${data.master_import_key}`]).join("\n");
  return {
    route:"fleet_master",
    proposedType:"vehicle",
    title:name || "Fleet vehicle",
    subtitle:plateVin ? `Plate/VIN: ${plateVin}` : "Vehicle details need review",
    confidence:plateVin ? "Ready for review" : "Needs vehicle details",
    data
  };
}

function masterRowFromWalkthrough(row, sourceWorkbook){
  const location = cleanWorkbookText(row.Location);
  const checkArea = cleanWorkbookText(row["Check Area"]);
  const item = cleanWorkbookText(row["Item to Inspect"]);
  const anchor = inferRecurringAnchor({ "Location/Area":location });
  const title = `Walkthrough: ${location || "Location"} - ${checkArea || item || "Inspection"}`;
  const data = {
    title,
    type:"inspection",
    status:"open",
    priority:"normal",
    location,
    description:item,
    building_id:anchor.buildingId || null,
    space_id:anchor.spaceId || null,
    asset_id:anchor.assetId || null,
    source_workbook:sourceWorkbook,
    source_sheet:row.sourceSheet,
    source_row:row.sourceRow,
    route:"walkthrough_checklist",
    notes:compact([
      "Walkthrough checklist item.",
      checkArea ? `Check area: ${checkArea}` : "",
      item ? `Inspect: ${item}` : "",
      anchor.needsAnchorReview ? `Missing details: ${location}` : `Anchor: ${anchor.label}`
    ]).join("\n")
  };
  data.master_import_key = masterImportKey(data);
  data.notes = compact([data.notes, `Source: ${row.sourceSheet} row ${row.sourceRow}`, `Master import key: ${data.master_import_key}`]).join("\n");
  return {
    route:"walkthrough_checklist",
    proposedType:"work_order",
    title,
    subtitle:item || "Checklist item",
    confidence:anchor.needsAnchorReview ? "Missing details" : "Ready for review",
    data
  };
}

function masterRowFromRecurring(row, sourceWorkbook){
  const recurringRow = {
    ...row,
    __sourceSheet:row.sourceSheet || "Recurring Schedule",
    __sourceRow:row.sourceRow
  };
  const data = recurringReviewData(recurringRow);
  data.source_workbook = sourceWorkbook;
  data.route = "recurring_schedule";
  data.master_import_key = masterImportKey({ ...data, source_cell:"", source_workbook:sourceWorkbook });
  data.notes = compact([data.notes, `Master import key: ${data.master_import_key}`]).join("\n");
  return {
    route:"recurring_schedule",
    proposedType:"work_order",
    title:data.title,
    subtitle:`${data.recurrence_pattern || "Recurring"} - ${data.location || "No area"}`,
    confidence:data.needs_anchor_review ? "Missing details" : "Ready for review",
    data
  };
}

function masterBundleRowsFromPayload(payload){
  const sourceWorkbook = payload.sourceWorkbook || "Meals_on_Wheels_Master_Calendar_May2026-Apr2027.xlsx";
  const rows = [];
  (payload.calendarItems || []).forEach(item => rows.push(masterRowFromCalendarItem(item, sourceWorkbook)));
  (payload.recurringSchedule || []).forEach(row => rows.push(masterRowFromRecurring(row, sourceWorkbook)));
  (payload.fleetSchedule || []).forEach(row => rows.push(masterRowFromFleetSchedule(row, sourceWorkbook)));
  (payload.fleetMaster || []).forEach(row => rows.push(masterRowFromFleetMaster(row, sourceWorkbook)));
  (payload.walkthroughChecklist || []).forEach(row => rows.push(masterRowFromWalkthrough(row, sourceWorkbook)));
  return rows.filter(row => row.title && row.data?.master_import_key);
}

function masterRouteLabel(route){
  const labels = {
    scheduled_work:"Scheduled maintenance",
    facility_work:"Facility work",
    asset_work:"Asset/system work",
    fleet_work:"Fleet dated work",
    recurring_schedule:"Recurring schedule",
    fleet_schedule:"Fleet schedule",
    fleet_master:"Fleet vehicles",
    walkthrough_checklist:"Walkthrough checklist"
  };
  return labels[route] || titleize(route);
}

function masterBundleCounts(rows){
  return rows.reduce((acc, row) => {
    acc[row.route] = (acc[row.route] || 0) + 1;
    return acc;
  }, {});
}

function isMasterRowAlreadyStaged(row, masterKeys = existingMasterImportKeys(), recurringKeys = existingRecurringKeys()){
  return masterKeys.has(row?.data?.master_import_key) || (row?.data?.recurring_key && recurringKeys.has(row.data.recurring_key));
}

function renderMasterCalendarBundlePreview(target){
  const rows = stagedImport.rows || [];
  const keys = existingMasterImportKeys();
  const recurringKeys = existingRecurringKeys();
  const counts = masterBundleCounts(rows);
  const newCount = rows.filter(row => !isMasterRowAlreadyStaged(row, keys, recurringKeys)).length;
  const visible = rows.slice(0, 160);
  target.innerHTML = `
    <article class="card recurring-import-summary">
      <h4>Master Calendar Waiting Room</h4>
      <p>${rows.length} calendar item${rows.length === 1 ? "" : "s"} found. They are waiting here so you can choose what becomes real work.</p>
      <p class="meta">Move a small batch to Needs Review first. Blank Mileage and Repair logs were ignored because they do not have entries yet.</p>
      <div class="quick-actions compact">
        ${Object.entries(counts).map(([route, count]) => `<span class="pill">${esc(masterRouteLabel(route))}: ${count}</span>`).join("")}
      </div>
      <div class="actions">
        <button type="button" id="masterCalendarBatchBtn" onclick="stageMasterCalendarRowsToReview(25)">Move next 25 to Needs Review</button>
      </div>
      <p class="meta small">${newCount} item${newCount === 1 ? "" : "s"} still waiting here. ${rows.length - visible.length > 0 ? `Showing the first ${visible.length} so the screen stays usable.` : "Showing all waiting items."}</p>
    </article>
    <div class="recurring-preview-list">
      ${visible.map(row => {
        const duplicate = isMasterRowAlreadyStaged(row, keys, recurringKeys);
        return `<article class="recurring-preview-card ${String(row.confidence).includes("Needs") ? "needs-anchor" : ""} ${duplicate ? "duplicate" : ""}">
          <span>
            <strong>${esc(row.title)}</strong>
            <em>${esc(masterRouteLabel(row.route))} - ${esc(row.subtitle || "")}</em>
            <small>${esc(row.confidence || "Ready for review")}${duplicate ? " - Already moved to review" : ""}</small>
          </span>
        </article>`;
      }).join("")}
    </div>
  `;
}

async function openCalendarWaitingRoom(){
  if(!requireOperationsPermission("load the master calendar")) return;
  showView("importCenter");
  await loadBundledMasterCalendarPreview();
  document.getElementById("mappingPanel")?.scrollIntoView({ behavior:"smooth", block:"start" });
}

async function loadBundledMasterCalendarPreview(){
  try{
    if(!requireOperationsPermission("preview full master calendar")) return;
    const response = await fetch("data/master-calendar-may2026-apr2027.json");
    if(!response.ok) throw new Error("Bundled master calendar file was not found.");
    const payload = await response.json();
    const rows = masterBundleRowsFromPayload(payload);
    AppState.setStagedImport(runtimeState, {
      rows,
      source:`Bundled: ${payload.sourceWorkbook || "Master Calendar"} / Full workbook`,
      documentId:null,
      headers:["title","route","due_date","location","notes"],
      suggestedType:"master_calendar_bundle",
      sourceSheet:"Full Master Calendar",
      summary:payload.summary || {}
    });
    if(typeof extractionPreview !== "undefined"){
      extractionPreview.value = JSON.stringify({
        sourceWorkbook:payload.sourceWorkbook,
        summary:payload.summary,
        preview:rows.slice(0, 20).map(row => ({ route:row.route, title:row.title, subtitle:row.subtitle, confidence:row.confidence }))
      }, null, 2);
    }
    renderMappingPanel();
    setStatus(`${rows.length} master calendar items are waiting for review.`);
    InteractionService?.showToast?.(`${rows.length} master calendar items loaded`, "saved");
  }catch(err){
    handleWriteError(err);
  }
}

function parseRecurringScheduleRows(workbook){
  const sheetName = workbook.SheetNames.find(name => normalizeKey(name) === "recurringschedule");
  if(!sheetName) throw new Error("Recurring Schedule sheet was not found.");
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header:1, defval:"", blankrows:false });
  const headerIndex = matrix.findIndex(row => row.map(normalizeKey).includes("frequency") && row.map(normalizeKey).includes("task"));
  if(headerIndex < 0) throw new Error("Recurring Schedule headers were not found.");
  const headers = matrix[headerIndex].map(value => String(value || "").trim());
  const rows = matrix.slice(headerIndex + 1).map((values, offset) => {
    const row = { __sourceSheet:sheetName, __sourceRow:headerIndex + offset + 2 };
    headers.forEach((header, index) => {
      if(header) row[header] = values[index] ?? "";
    });
    return row;
  }).filter(row => recurringCell(row, ["Frequency"]) || recurringCell(row, ["Task"]));
  return { rows, headers, sheetName };
}

async function loadBundledRecurringSchedulePreview(){
  try{
    if(!requireOperationsPermission("preview recurring schedule")) return;
    const response = await fetch("data/recurring-schedule-may2026.json");
    if(!response.ok) throw new Error("Bundled recurring schedule file was not found.");
    const payload = await response.json();
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    AppState.setStagedImport(runtimeState, {
      rows,
      source:`Bundled: ${payload.sourceWorkbook || "Master Calendar"} / ${payload.sourceSheet || "Recurring Schedule"}`,
      documentId:null,
      headers:payload.headers || ["Frequency","Area/System","Task","Assigned To","Timing","Notes"],
      suggestedType:"recurring_schedule",
      sourceSheet:payload.sourceSheet || "Recurring Schedule"
    });
    if(typeof spreadsheetImportType !== "undefined") spreadsheetImportType.value = "recurring_schedule";
    if(typeof extractionPreview !== "undefined") extractionPreview.value = JSON.stringify(rows.slice(0,12), null, 2);
    renderMappingPanel();
    setStatus(`${rows.length} recurring schedule rows ready to review.`);
    InteractionService?.showToast?.(`${rows.length} recurring rows ready to review`, "saved");
  }catch(err){
    handleWriteError(err);
  }
}

function getCurrentColumnMapping(){
  const mapping = {};
  document.querySelectorAll("[data-map-field]").forEach(select => {
    if(select.value) mapping[select.dataset.mapField] = select.value;
  });
  return mapping;
}

function mapRowWithColumns(row, mapping){
  const mapped = {};
  Object.entries(mapping).forEach(([field, header]) => {
    mapped[field] = row[header] ?? "";
  });
  return mapped;
}

async function rowsToReviewSubmissions(rows, type, source){
  let added = 0;
  for(const row of rows){
    if(!row || Object.values(row).every(v => v === null || v === undefined || String(v).trim() === "")) continue;
    const proposedType = normalizeProposedType(type);
    const proposed = {
      title:getValue(row,["task","work order","project","name","title","scope"]) || `Imported ${titleize(proposedType)}`,
      name:getValue(row,["vehicle","vehicle name","project","project name","name","title"]),
      vendor:getValue(row,["vendor","contractor","company","supplier","gas station"]),
      amount:getValue(row,["amount","bid amount","cost","estimate","price","total"]),
      date:getValue(row,["date","due date","service date","receipt date"]),
      gallons:getValue(row,["gallons"]),
      odometer:getValue(row,["odometer","mileage"]),
      plate:getValue(row,["plate","license plate"]),
      priority:getValue(row,["priority"]),
      location:getValue(row,["location","site","building","area"]),
      notes:getValue(row,["notes","description","scope","details"])
    };
    await createImportReview(source, proposedType, proposed, `Review imported ${titleize(proposedType)}: ${proposed.title || proposed.name || proposed.vendor || "Imported row"}`);
    added++;
  }
  return added;
}

async function extractFileText(file){
  const name = file.name.toLowerCase();
  if(name.endsWith(".csv")) return await file.text();
  if(name.endsWith(".pdf")) return await extractPdfText(file);
  return "";
}

async function createUploadedDocumentForImport(file, fileTypeValue, extractedText = "", extractionStatus = "pending"){
  if(!requireAuth(true)) throw new Error("Not signed in");
  const docId = id();
  const storagePath = await uploadDocumentToStorage(file, docId);
  await saveDocumentMetadata({
    docId,
    fileNameValue:file.name,
    fileTypeValue,
    storagePath,
    extractedText,
    extractionStatus,
    notes:"Uploaded through Import / Extraction Center"
  });
  return docId;
}

async function handleSpreadsheetFile(file){
  try{
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type:"array" });
    const wantsRecurringSchedule = spreadsheetImportType.value === "recurring_schedule";
    const parsedRecurring = wantsRecurringSchedule ? parseRecurringScheduleRows(workbook) : null;
    const rows = parsedRecurring ? parsedRecurring.rows : XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval:"" });
    const headers = parsedRecurring ? parsedRecurring.headers : rows[0] ? Object.keys(rows[0]) : [];
    const docId = await createUploadedDocumentForImport(file, file.name.toLowerCase().endsWith(".csv") ? "CSV Import" : "Excel Import", JSON.stringify(rows.slice(0,50), null, 2), "complete");
    const userType = spreadsheetImportType.value === "auto" ? "" : wantsRecurringSchedule ? "recurring_schedule" : normalizeProposedType(spreadsheetImportType.value);
    const suggestedType = userType || inferImportType(headers);
    AppState.setStagedImport(runtimeState, { rows, source:wantsRecurringSchedule ? `Spreadsheet: ${file.name} / Recurring Schedule` : `Spreadsheet: ${file.name}`, documentId:docId, headers, suggestedType, sourceSheet:parsedRecurring?.sheetName || workbook.SheetNames[0] });
    extractionPreview.value = JSON.stringify(rows.slice(0,12), null, 2);
    renderMappingPanel();
    await loadWorkspaceData();
    alert(wantsRecurringSchedule
      ? `${rows.length} recurring schedule row${rows.length === 1 ? "" : "s"} parsed from Recurring Schedule only. Review and approve selected rows.`
      : `${rows.length} row${rows.length === 1 ? "" : "s"} parsed. Review the preview, fix column matching, then stage rows to Needs Review.`);
  }catch(err){ handleWriteError(err); }
}

async function extractPdfText(file){
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const chunks = [];
  for(let i = 1; i <= pdf.numPages; i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    chunks.push(content.items.map(item => item.str).join(" "));
  }
  return chunks.join("\n\n").trim();
}

async function handlePdfFile(file){
  try{
    const text = await extractPdfText(file);
    const docId = await createUploadedDocumentForImport(file, "PDF Import", text, text ? "complete" : "not_supported");
    extractionPreview.value = text || "No readable text found.";
    const proposedType = normalizeProposedType(pdfImportType.value);
    await createImportReview(`PDF: ${file.name}`, proposedType, { file_name:file.name, extracted_text:text }, `Review extracted PDF text from ${file.name}`, docId);
    await loadWorkspaceData();
    alert("PDF staged in Needs Review.");
  }catch(err){ handleWriteError(err); }
}

async function stageMappedRows(){
  try{
    if(!stagedImport.rows.length){
      alert("Upload a spreadsheet first.");
      return;
    }
    if(stagedImport.suggestedType === "recurring_schedule"){
      await stageSelectedRecurringRowsToReview();
      return;
    }
    if(stagedImport.suggestedType === "master_calendar_bundle"){
      await stageMasterCalendarRowsToReview(25);
      return;
    }
    const mapping = getCurrentColumnMapping();
    if(!Object.keys(mapping).length){
      alert("Match at least one column before staging rows.");
      return;
    }
    const mappedRows = stagedImport.rows.map(row => mapRowWithColumns(row, mapping));
    let added = 0;
    for(const row of mappedRows){
      if(Object.values(row).every(value => value === null || value === undefined || String(value).trim() === "")) continue;
      await createImportReview(stagedImport.source, stagedImport.suggestedType, row, `Review imported ${titleize(stagedImport.suggestedType)}: ${row.title || row.name || row.vendor || row.label || "Imported row"}`, stagedImport.documentId);
      added++;
    }
    AppState.resetStagedImport(runtimeState);
    renderMappingPanel();
    await loadWorkspaceData();
    alert(`${added} row${added === 1 ? "" : "s"} staged in Needs Review.`);
  }catch(err){ handleWriteError(err); }
}

async function stageMasterCalendarRowsToReview(limit = 100){
  try{
    const batchButton = document.getElementById("masterCalendarBatchBtn");
    if(batchButton?.disabled) return;
    if(!stagedImport.rows.length || stagedImport.suggestedType !== "master_calendar_bundle"){
      alert("Preview the full master calendar first.");
      return;
    }
    if(!requireOperationsPermission("stage master calendar rows")) return;
    const keys = existingMasterImportKeys();
    const recurringKeys = existingRecurringKeys();
    const candidates = stagedImport.rows.filter(row => row?.data?.master_import_key && !isMasterRowAlreadyStaged(row, keys, recurringKeys));
    if(!candidates.length){
      alert("Everything from this master calendar has already been moved to Needs Review or active work.");
      return;
    }
    const batchSize = Math.min(25, Math.max(1, Number(limit) || 25));
    const batch = candidates.slice(0, batchSize);
    let added = 0;
    if(batchButton){
      batchButton.disabled = true;
      batchButton.textContent = "Moving...";
    }
    for(const row of batch){
      await createImportReview(
        stagedImport.source,
        row.proposedType || "work_order",
        row.data,
        `Review ${masterRouteLabel(row.route)}: ${row.title}`,
        stagedImport.documentId
      );
      keys.add(row.data.master_import_key);
      if(row.data.recurring_key) recurringKeys.add(row.data.recurring_key);
      added++;
      if(batchButton) batchButton.textContent = `Moving ${added} of ${batch.length}...`;
    }
    await loadWorkspaceData();
    renderMappingPanel();
    alert(`${added} calendar item${added === 1 ? "" : "s"} moved to Needs Review. Review those before loading a lot more.`);
  }catch(err){
    handleWriteError(err);
  }finally{
    const batchButton = document.getElementById("masterCalendarBatchBtn");
    if(batchButton){
      batchButton.disabled = false;
      batchButton.textContent = "Move next 25 to Needs Review";
    }
  }
}

async function stageSelectedRecurringRowsToReview(){
  try{
    if(!stagedImport.rows.length || stagedImport.suggestedType !== "recurring_schedule"){
      alert("Choose Recurring Schedule only and upload the workbook first.");
      return;
    }
    if(!requireOperationsPermission("stage recurring schedule rows")) return;
    const keys = existingRecurringKeys();
    const selected = selectedRecurringRows();
    if(!selected.length){
      alert("Select at least one recurring row first.");
      return;
    }
    let added = 0;
    for(const row of selected){
      const data = recurringReviewData(row);
      if(keys.has(data.recurring_key)) continue;
      await createImportReview(stagedImport.source, "work_order", data, `Review recurring task: ${data.title} (${data.source_sheet} row ${data.source_row})`, stagedImport.documentId);
      keys.add(data.recurring_key);
      added++;
    }
    await loadWorkspaceData();
    renderMappingPanel();
    alert(`${added} recurring row${added === 1 ? "" : "s"} sent to Needs Review.`);
  }catch(err){ handleWriteError(err); }
}

async function approveSelectedRecurringRows(){
  try{
    if(!stagedImport.rows.length || stagedImport.suggestedType !== "recurring_schedule"){
      alert("Choose Recurring Schedule only and upload the workbook first.");
      return;
    }
    if(!requireOperationsPermission("approve recurring schedule rows")) return;
    const keys = existingRecurringKeys();
    const selected = selectedRecurringRows();
    if(!selected.length){
      alert("Select at least one recurring row first.");
      return;
    }
    let added = 0;
    for(const row of selected){
      const data = recurringReviewData(row);
      if(keys.has(data.recurring_key)) continue;
      await insertRecord("field_ops_work_orders", Mappers.workOrderPayloadFromImport(data));
      keys.add(data.recurring_key);
      added++;
    }
    AppState.resetStagedImport(runtimeState);
    renderMappingPanel();
    await loadWorkspaceData();
    showView("dashboard");
    alert(`${added} recurring task${added === 1 ? "" : "s"} approved into scheduled work.`);
  }catch(err){ handleWriteError(err); }
}

function copyExtractionToClipboard(){ navigator.clipboard.writeText(extractionPreview.value || ""); }
function clearExtractionPreview(){ extractionPreview.value = ""; }

function loadDemoPilotData(){
  if(!DemoService?.loadDemoData(app, Mappers)) return;
  setStatus("Demo data loaded for this session only");
  InteractionService?.showToast?.("Demo data loaded for this session only", "saved");
  render();
}

function clearDemoPilotData(){
  DemoService?.clearDemoData(app);
  setStatus("Demo data cleared");
  InteractionService?.showToast?.("Demo data cleared", "saved");
  render();
}

function startSessionDemo(){
  currentSession = { user:{ id:"demo-session", email:"demo@session.local" } };
  currentWorkspace = { id:"demo-session", role:"owner", name:"Session Demo", isDemo:true };
  AppState.resetRuntimeApp(runtimeState);
  app.settings.workspaceName = "Field Operations Command Center";
  app.settings.workspaceNote = "Demo mode. Nothing saves to the shared workspace.";
  loadDemoPilotData();
  renderAuthState();
  showView("dashboard", { skipHistory:true });
}

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.getElementById("appBackBtn")?.addEventListener("click", goBackView);
document.getElementById("globalSearchInput")?.addEventListener("input", renderGlobalSearch);
document.getElementById("globalSearchInput")?.addEventListener("keydown", e => {
  if(e.key === "Escape"){
    e.currentTarget.value = "";
    renderGlobalSearch();
  }
});
document.getElementById("reviewBulkFilter")?.addEventListener("change", () => {
  if(typeof renderReviewQueue === "function") renderReviewQueue();
});
signInBtn.addEventListener("click", signInForSync);
passwordSignInBtn?.addEventListener("click", signInWithPasswordForSync);
signOutBtn.addEventListener("click", signOutForSync);
authEmail.addEventListener("keydown", e => { if(e.key === "Enter") signInForSync(); });
authPassword?.addEventListener("keydown", e => { if(e.key === "Enter") signInWithPasswordForSync(); });
loginSignInBtn?.addEventListener("click", () => {
  authEmail.value = loginEmail.value;
  signInForSync();
});
loginPasswordSignInBtn?.addEventListener("click", () => {
  authEmail.value = loginEmail.value;
  authPassword.value = loginPassword.value;
  signInWithPasswordForSync();
});
loginEmail?.addEventListener("keydown", e => {
  if(e.key === "Enter"){
    authEmail.value = loginEmail.value;
    signInForSync();
  }
});
loginPassword?.addEventListener("keydown", e => {
  if(e.key === "Enter"){
    authEmail.value = loginEmail.value;
    authPassword.value = loginPassword.value;
    signInWithPasswordForSync();
  }
});
loginDemoBtn?.addEventListener("click", startSessionDemo);
saveDisplayNameBtn?.addEventListener("click", saveDisplayName);
skipDisplayNameBtn?.addEventListener("click", hideDisplayNamePrompt);
displayNameInput?.addEventListener("keydown", e => {
  if(e.key === "Enter") saveDisplayName();
  if(e.key === "Escape") hideDisplayNamePrompt();
});
projectForm.addEventListener("submit", addProject);
bidForm.addEventListener("submit", addBid);
vendorForm.addEventListener("submit", addVendor);
taskForm.addEventListener("submit", addTask);
vehicleForm.addEventListener("submit", addVehicle);
fuelReceiptForm.addEventListener("submit", addFuelReceipt);
budgetForm.addEventListener("submit", addBudgetItem);
fileForm.addEventListener("submit", addFileRecord);
submissionForm.addEventListener("submit", addSubmission);
buildingForm.addEventListener("submit", addBuilding);
spaceForm.addEventListener("submit", addSpace);
assetForm.addEventListener("submit", addAsset);
workspaceName.addEventListener("change", async e => {
  if(!requireOwnerPermission("change workspace settings")) return;
  try{ await updateRecord("field_ops_workspaces", workspaceId(), { name:e.target.value }); }
  catch(err){ handleWriteError(err); }
});
workspaceNote.addEventListener("change", e => { app.settings.workspaceNote = e.target.value; renderSettings(); });
backupUpload.addEventListener("change", e=>{ if(e.target.files[0]) uploadBackup(e.target.files[0]); e.target.value=""; });
spreadsheetUpload.addEventListener("change", e=>{ if(e.target.files[0]) handleSpreadsheetFile(e.target.files[0]); e.target.value=""; });
pdfUpload.addEventListener("change", e=>{ if(e.target.files[0]) handlePdfFile(e.target.files[0]); e.target.value=""; });
document.getElementById("peopleRoleForm")?.addEventListener("submit", savePeopleRole);

if(window.pdfjsLib){
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

InteractionService?.init?.();
setupFormDisclosure();
initializeAuth();

