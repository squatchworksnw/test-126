const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
let source = fs.readFileSync(path.join(root, "app.js"), "utf8");
source = [
  "state/app-state.js",
  "components/cards.js",
  "components/forms.js",
  "auth/roles.js",
  "auth/session.js",
  "services/supabase-service.js",
  "services/mappers.js",
  "services/import-review-service.js",
  "services/materials-service.js",
  "services/demo-service.js",
  "services/interaction-service.js",
  "sync/pending-queue.js",
  "services/auth-service.js",
  "services/sync-service.js",
  "views/registry.js",
  "views/today-dashboard.js",
  "views/work-orders.js",
  "views/documents.js",
  "views/projects-budget.js",
  "views/materials.js",
  "views/review-queue.js",
  "views/fleet.js"
].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n") + "\n" + source;
source = source.replace(/\binitializeAuth\(\);\s*$/, "");

class FakeElement {
  constructor(id = "", tagName = "div") {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = "";
    this.textContent = "";
    this.className = "";
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.style = {};
    this.files = [];
    this.children = [];
    this.listeners = {};
    this.classList = {
      add: (...names) => names.forEach(name => this._classSet().add(name)),
      remove: (...names) => names.forEach(name => this._classSet().delete(name)),
      toggle: (name, force) => {
        const set = this._classSet();
        const shouldAdd = force === undefined ? !set.has(name) : Boolean(force);
        if (shouldAdd) set.add(name);
        else set.delete(name);
      }
    };
  }

  _classSet() {
    const set = new Set(String(this.className || "").split(/\s+/).filter(Boolean));
    const originalAdd = set.add.bind(set);
    const originalDelete = set.delete.bind(set);
    set.add = value => { originalAdd(value); this.className = [...set].join(" "); return set; };
    set.delete = value => { originalDelete(value); this.className = [...set].join(" "); return true; };
    return set;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    const idMatches = [...this._innerHTML.matchAll(/<(input|select|textarea|button|div|p|h[1-6])[^>]*\sid="([^"]+)"/g)];
    for (const [, tag, id] of idMatches) {
      const el = document.getElementById(id);
      el.tagName = tag.toUpperCase();
      if (tag === "select") {
        const selectMarkup = this._innerHTML.slice(this._innerHTML.lastIndexOf("<select", this._innerHTML.indexOf(`id="${id}"`)));
        const selected = selectMarkup.match(/<option value="([^"]+)" selected/i) || selectMarkup.match(/<option value="([^"]+)"/i);
        if (selected) el.value = selected[1];
      }
      const valueMatch = this._innerHTML.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`, "i"));
      if (valueMatch) el.value = valueMatch[1].replaceAll("&quot;", "\"").replaceAll("&#039;", "'");
    }
    const nameMatches = [...this._innerHTML.matchAll(/<(input|select|textarea)[^>]*\sname="([^"]+)"[^>]*>([\s\S]*?)(?:<\/\1>)?/g)];
    this.namedControls = nameMatches.map(([, tag, name, body]) => {
      const el = new FakeElement("", tag);
      el.name = name;
      const valueMatch = body.match(/value="([^"]*)"/) || this._innerHTML.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i"));
      const textareaMatch = tag === "textarea" ? body.match(/^([\s\S]*?)<\/textarea>/) : null;
      el.value = valueMatch ? valueMatch[1] : textareaMatch ? textareaMatch[1] : "";
      if (tag === "select") {
        const selectStart = this._innerHTML.lastIndexOf("<select", this._innerHTML.indexOf(`name="${name}"`));
        const selectEnd = this._innerHTML.indexOf("</select>", this._innerHTML.indexOf(`name="${name}"`));
        const selectMarkup = this._innerHTML.slice(selectStart, selectEnd);
        const selected = selectMarkup.match(/<option value="([^"]+)" selected/i) || selectMarkup.match(/<option value="([^"]+)"/i);
        el.value = selected ? selected[1] : "";
      }
      return el;
    });
  }

  get innerHTML() { return this._innerHTML || ""; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  reset() { this.value = ""; this.files = []; }
  closest() { return this; }
  scrollIntoView() {}
  focus() {}
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  insertAdjacentElement() {}
  prepend() {}
}

const elements = new Map();
const document = {
  body: new FakeElement("body", "body"),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  },
  querySelectorAll(selector) {
    if (selector === ".tab") return [...elements.values()].filter(el => el.className.includes("tab"));
    if (selector === ".view") return [...elements.values()].filter(el => el.className.includes("view"));
    if (selector === "[data-admin-only]") return [];
    return [];
  },
  querySelector() { return null; },
  createElement(tag) { return new FakeElement("", tag); },
  addEventListener() {}
};

for (const match of html.matchAll(/<([a-zA-Z0-9]+)[^>]*\sid="([^"]+)"[^>]*>/g)) {
  const [, tag, id] = match;
  const el = document.getElementById(id);
  el.tagName = tag.toUpperCase();
  const cls = match[0].match(/class="([^"]+)"/);
  if (cls) el.className = cls[1];
}
for (const match of html.matchAll(/<button[^>]*class="([^"]*\btab\b[^"]*)"[^>]*data-view="([^"]+)"/g)) {
  const el = new FakeElement("", "button");
  el.className = match[1];
  el.dataset.view = match[2];
  elements.set(`tab-${match[2]}`, el);
}

class FakeFormData {
  constructor(form) {
    this.map = new Map();
    for (const control of form.namedControls || []) {
      this.map.set(control.name, control.value);
    }
  }
  get(name) { return this.map.get(name) || ""; }
}

const tables = {
  field_ops_import_reviews: [],
  field_ops_documents: [],
  field_ops_work_orders: [],
  field_ops_fuel_receipts: [],
  field_ops_budget_items: [],
  field_ops_vehicles: []
};

const makeRow = row => ({ id: row.id || `id-${Math.random().toString(36).slice(2)}`, updated_at: new Date().toISOString(), archived_at: null, ...row });

const supabaseClient = {
  lastRpcCall: null,
  rpc(name, payload) {
    supabaseClient.lastRpcCall = { name, payload };
    if(name !== "field_ops_create_fuel_receipt_with_budget"){
      return Promise.resolve({ data:null, error:new Error(`Unexpected RPC ${name}`) });
    }
    const receipt = makeRow({
      workspace_id: payload.p_workspace_id,
      vehicle_id: payload.p_vehicle_id,
      receipt_date: payload.p_receipt_date || "2026-05-15",
      gas_station: payload.p_gas_station,
      gallons: payload.p_gallons,
      total_amount: payload.p_total_amount,
      price_per_gallon: payload.p_price_per_gallon,
      odometer: payload.p_odometer,
      notes: payload.p_notes
    });
    const budget = makeRow({
      workspace_id: payload.p_workspace_id,
      fuel_receipt_id: receipt.id,
      label: "Fuel - test",
      item_type: "fuel",
      status: "submitted",
      amount: payload.p_total_amount,
      date_received: receipt.receipt_date
    });
    receipt.budget_item_id = budget.id;
    tables.field_ops_fuel_receipts.push(receipt);
    tables.field_ops_budget_items.push(budget);
    return Promise.resolve({ data:{ status:"success", fuelReceipt:receipt, budgetItem:budget }, error:null });
  },
  from(table) {
    if (!tables[table]) tables[table] = [];
    let operation = {};
    const builder = {
      insert(row) { operation = { type: "insert", row: makeRow(row) }; return builder; },
      update(payload) { operation = { type: "update", payload }; return builder; },
      select() { if (!operation.type) operation = { type: "select", filters: [] }; return builder; },
      single() {
        if (operation.type === "insert") {
          if (supabaseClient.failNextInsertTable === table) {
            supabaseClient.failNextInsertTable = "";
            return Promise.resolve({ data: null, error: new Error("insert failed by test") });
          }
          if (supabaseClient.failNextInsert) {
            supabaseClient.failNextInsert = false;
            return Promise.resolve({ data: null, error: new Error("permission denied by test") });
          }
          tables[table].push(operation.row);
          return Promise.resolve({ data: operation.row, error: null });
        }
        if (operation.type === "update") {
          const row = tables[table].find(item => item.id === operation.id);
          Object.assign(row, operation.payload, { updated_at: new Date().toISOString() });
          return Promise.resolve({ data: row, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve, reject) {
        const result = operation.type === "select"
          ? { data: tables[table].filter(row => {
              return (operation.filters || []).every(filter => {
                if (filter.kind === "eq") return row[filter.column] === filter.value;
                if (filter.kind === "is") return row[filter.column] === filter.value;
                if (filter.kind === "notArchived") return row[filter.column] !== null && row[filter.column] !== undefined;
                return true;
              });
            }), error: null }
          : operation.type === "insert"
          ? (tables[table].push(operation.row), { data: null, error: null })
          : operation.type === "update"
            ? (Object.assign(tables[table].find(item => item.id === operation.id), operation.payload, { updated_at: new Date().toISOString() }), { data: null, error: null })
            : { data: null, error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
      eq(column, value) {
        if (column === "id") operation.id = value;
        operation.filters = operation.filters || [];
        operation.filters.push({ kind: "eq", column, value });
        return builder;
      },
      is(column, value) {
        operation.filters = operation.filters || [];
        operation.filters.push({ kind: "is", column, value });
        return builder;
      },
      not(column) {
        operation.filters = operation.filters || [];
        operation.filters.push({ kind: "notArchived", column });
        return builder;
      },
      order() { return builder; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); }
    };
    return builder;
  },
  storage: {
    from() {
      return { upload: () => Promise.resolve({ error: null }) };
    }
  },
  auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) }
};

const context = {
  console,
  document,
  window: {
    supabase: { createClient: () => supabaseClient },
    scrollTo() {},
    addEventListener() {},
    pdfjsLib: null
  },
  navigator: { onLine: true, clipboard: { writeText: async () => {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  crypto: { randomUUID: () => `uuid-${Math.random().toString(36).slice(2)}` },
  FormData: FakeFormData,
  Blob: class {},
  URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  alert: message => { throw new Error(`Unexpected alert: ${message}`); },
  confirm: () => true,
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout,
  supabaseClient,
  tables,
  makeRow
};
context.globalThis = context;
for (const [id, el] of elements) {
  if (/^[A-Za-z_$][\w$]*$/.test(id)) context[id] = el;
}
vm.createContext(context);
vm.runInContext(`${source}

async function __acceptanceFlow(){
  renderAuthState();
  if (!canAccessView("login")) throw new Error("Signed-out user cannot see login");
  if (canAccessView("dashboard")) throw new Error("Signed-out user can see dashboard");
  if (canAccessView("workOrders")) throw new Error("Signed-out user can see work orders");
  if (activeViewId !== "login") throw new Error("Signed-out user was not routed to login");
  renderDiagnostics();
  if (!document.getElementById("diagnosticPanel")?.hidden) throw new Error("Signed-out diagnostic panel rendered");

  startSessionDemo();
  if (!currentWorkspace?.isDemo) throw new Error("Session demo did not mark workspace as demo");
  if (!app.tasks.some(item => String(item.id).startsWith("demo-"))) throw new Error("Session demo did not load demo data");
  if (tables.field_ops_work_orders.length) throw new Error("Session demo wrote to Supabase tables");
  await signOutForSync();

  currentSession = { user:{ id:"admin-1", email:"admin@example.com" } };
  currentWorkspace = { id:"workspace-1", role:"owner", name:"Test Workspace" };
  renderAuthState();
  if (!canAccessView("budget")) throw new Error("Owner cannot see budget");
  if (!canAccessView("settings")) throw new Error("Owner cannot see settings");
  renderAuthState();
  const navViews = () => document.querySelectorAll(".tab").map(tab => tab.dataset.view);
  if (navViews().includes("budget")) throw new Error("Owner budget should not be a first-level nav item");
  if (document.getElementById("tab-workOrders")?.textContent !== "Work") throw new Error("Owner nav did not collapse Work Orders into Work");
  if (document.getElementById("tab-importReview")?.textContent !== "Needs Review") throw new Error("Owner nav did not use Needs Review wording");
  if (document.getElementById("openAddNewBtn")?.hidden) throw new Error("Owner Add New hidden");
  renderSettings();
  if (document.getElementById("diagnosticPanel")?.hidden) throw new Error("Owner diagnostic panel hidden");
  if (document.getElementById("diagWorkspaceId")?.textContent !== "workspace-1") throw new Error("Owner diagnostic workspace id missing");

  currentWorkspace = { id:"workspace-1", role:"admin", name:"Test Workspace" };
  renderAuthState();
  if (!canAccessView("dashboard")) throw new Error("Admin cannot see dashboard");
  if (!canAccessView("workOrders")) throw new Error("Admin cannot see work orders");
  if (canAccessView("budget")) throw new Error("Admin can see budget");
  if (canAccessView("buildings")) throw new Error("Admin can see owner building inventory nav");
  if (!canAccessView("settings")) throw new Error("Admin cannot see limited settings");
  if (navViews().includes("budget")) throw new Error("Admin budget nav rendered");
  if (navViews().includes("buildings")) throw new Error("Admin buildings nav rendered");
  if (document.getElementById("openAddNewBtn")?.hidden) throw new Error("Admin Add New hidden");
  renderSettings();
  if (document.getElementById("diagnosticPanel")?.hidden) throw new Error("Admin diagnostic panel hidden");

  currentWorkspace = { id:"workspace-1", role:"submitter", name:"Test Workspace" };
  renderAuthState();
  if (!canSubmitOnly()) throw new Error("Submitter role did not activate");
  if (defaultViewForRole() !== "fieldPortal") throw new Error("Submitter default is not field portal");
  if (!canAccessView("fieldPortal")) throw new Error("Submitter cannot see field portal");
  if (canAccessView("workOrders")) throw new Error("Submitter can see work orders");
  for (const blocked of ["vendors", "budget", "vehicles", "reports", "settings"]) {
    if (canAccessView(blocked)) throw new Error("Submitter can see " + blocked);
  }
  if (!document.getElementById("tab-dashboard")?.hidden) throw new Error("Submitter admin Today nav rendered");
  if (!document.getElementById("tab-workOrders")?.hidden) throw new Error("Submitter work order nav rendered");
  if (document.getElementById("tab-fieldPortal")?.hidden) throw new Error("Submitter home nav hidden");
  if (document.getElementById("openAddNewBtn")?.hidden) throw new Error("Submitter guided Add hidden");
  if (document.getElementById("openAddNewBtn")?.textContent !== "+ Send") throw new Error("Submitter Add button did not become guided send");
  renderSettings();
  if (!document.getElementById("diagnosticPanel")?.hidden) throw new Error("Submitter diagnostic panel rendered");
  showView("reports");
  if (activeViewId !== "accessDenied") throw new Error("Submitter direct admin route did not show access guidance");

  submissionName.value = "Field Staff";
  submissionContact.value = "field@example.com";
  submissionUrgency.value = "Urgent";
  submissionLocation.value = "Kitchen sink";
  submissionSource.value = "Staff portal";
  submissionDescription.value = "Water leaking under prep sink.";
  submissionUpload.files = [{ name:"leak-photo.jpg" }];
  await addSubmission({ preventDefault(){}, target:submissionForm });
  if (tables.field_ops_import_reviews.length !== 1) throw new Error("Submission did not create import review");
  if (tables.field_ops_documents.length !== 1) throw new Error("Submission file did not create document");

  currentWorkspace.role = "admin";
  app.submissions = tables.field_ops_import_reviews.map(fromImportReview);
  app.files = tables.field_ops_documents.map(fromDocument);

  tables.field_ops_vehicles.push(makeRow({
    id:"vehicle-1",
    workspace_id:"workspace-1",
    name:"Pilot Van",
    status:"active"
  }));
  app.vehicles = tables.field_ops_vehicles.map(fromVehicle);
  fuelVehicle.value = "vehicle-1";
  fuelDate.value = "2026-05-15";
  fuelVendor.value = "Pilot Fuel";
  fuelGallons.value = "7.5";
  fuelTotal.value = "31.25";
  fuelPrice.value = "4.167";
  fuelOdometer.value = "120345";
  fuelNotes.value = "Role flow fuel receipt.";
  await addFuelReceipt({ preventDefault(){}, currentTarget:fuelReceiptForm, target:fuelReceiptForm });
  if (supabaseClient.lastRpcCall?.name !== "field_ops_create_fuel_receipt_with_budget") throw new Error("Fuel receipt did not use transaction RPC");
  if (tables.field_ops_fuel_receipts.length !== 1) throw new Error("Fuel receipt RPC did not create receipt");
  if (tables.field_ops_budget_items.length !== 1) throw new Error("Fuel receipt RPC did not create budget item");
  if (tables.field_ops_fuel_receipts[0].budget_item_id !== tables.field_ops_budget_items[0].id) throw new Error("Fuel receipt RPC did not link budget item");
  renderAuthState();
  if (!canAccessView("importReview")) throw new Error("Admin cannot see import review");

  const today = todayString();
  taskName.value = "Inspect freezer compressor";
  taskLocation.value = "Francis kitchen";
  taskDate.value = today;
  taskAssigned.value = "Facilities lead";
  taskPriority.value = "Urgent";
  taskStatus.value = "Open";
  taskNotes.value = "Compressor cycling loudly.";
  await addTask({ preventDefault(){}, target:taskForm });
  const directWorkOrder = tables.field_ops_work_orders.find(row => row.title === "Inspect freezer compressor");
  if (!directWorkOrder) throw new Error("Admin create did not persist work order");
  if (taskSaveState.dataset.state !== "saved") throw new Error("Work order create did not show saved state");
  if (!app.tasks.find(item => item.id === directWorkOrder.id)) throw new Error("Created work order did not reload from Supabase");
  render();
  if (String(todayUrgentCount.textContent) !== "1") throw new Error("Today urgent count did not include created work order");
  if (String(todayDueCount.textContent) !== "1") throw new Error("Today due count did not include created work order");
  AppState.resetRuntimeApp(runtimeState);
  await loadWorkspaceData();
  if (!app.tasks.find(item => item.id === directWorkOrder.id)) throw new Error("Refresh did not preserve Supabase work order");
  selectedWorkOrderId = directWorkOrder.id;
  renderWorkOrderDetail();
  document.getElementById("workOrderDetailStatus").value = "in_progress";
  document.getElementById("workOrderDetailNote").value = "Real loop note.";
  await saveWorkOrderDetailUpdates();
  if (tables.field_ops_work_orders.find(row => row.id === directWorkOrder.id).status !== "in_progress") throw new Error("Detail status update did not persist");
  if (!tables.field_ops_work_orders.find(row => row.id === directWorkOrder.id).notes.includes("Real loop note.")) throw new Error("Detail note did not persist");
  await markWorkOrderComplete(directWorkOrder.id);
  if (tables.field_ops_work_orders.find(row => row.id === directWorkOrder.id).status !== "complete") throw new Error("Complete action did not persist");
  render();
  if (String(todayUrgentCount.textContent) !== "0") throw new Error("Completed work order stayed in Today urgent count");
  supabaseClient.failNextInsert = true;
  taskName.value = "Failed save test work order";
  taskPriority.value = "High";
  await addTask({ preventDefault(){}, target:taskForm });
  if (taskSaveState.dataset.state !== "failed") throw new Error("Failed work order save did not show failed state");

  selectedReviewId = app.submissions[0].id;
  renderImportReviewDetail();
  reviewDetailForm.namedControls.find(c => c.name === "title").value = "Fix prep sink leak";
  reviewDetailForm.namedControls.find(c => c.name === "type").value = "maintenance";
  reviewDetailForm.namedControls.find(c => c.name === "priority").value = "urgent";
  reviewDetailForm.namedControls.find(c => c.name === "description").value = "Kitchen sink";
  reviewDetailForm.namedControls.find(c => c.name === "notes").value = "Tighten supply line and check cabinet.";
  await approveReviewDetail();
  const created = tables.field_ops_work_orders.find(row => row.title === "Fix prep sink leak");
  if (!created) throw new Error("Approval did not create work order");
  if (created.type !== "maintenance") throw new Error("Corrected work order type did not persist");
  if (tables.field_ops_documents[0].work_order_id !== created.id) throw new Error("Document was not linked to work order");
  const approvedReview = tables.field_ops_import_reviews.find(row => row.id === app.submissions[0].id);
  if (approvedReview.status !== "approved") throw new Error("Review was not marked approved");
  if (approvedReview.created_record_id !== created.id) throw new Error("Review did not store converted work order id");
  const countAfterApproval = tables.field_ops_work_orders.length;
  await loadWorkspaceData();
  selectedReviewId = approvedReview.id;
  renderImportReviewDetail();
  await approveReviewDetail();
  if (tables.field_ops_work_orders.length !== countAfterApproval) throw new Error("Duplicate approval created another work order");
  render();
  if (!urgentList.innerHTML.includes("Fix prep sink leak")) throw new Error("Converted work order did not appear in Today Mode");

  tables.field_ops_import_reviews.push(makeRow({
    id:"review-fail",
    workspace_id:"workspace-1",
    document_id:null,
    source:"Failure test",
    proposed_record_type:"work_order",
    proposed_data:{ title:"Do not partially convert", priority:"urgent" },
    status:"needs_review",
    notes:"Failure test"
  }));
  await loadWorkspaceData();
  selectedReviewId = "review-fail";
  renderImportReviewDetail();
  supabaseClient.failNextInsertTable = "field_ops_work_orders";
  const beforeFailureCount = tables.field_ops_work_orders.length;
  await approveReviewDetail();
  if (tables.field_ops_work_orders.length !== beforeFailureCount) throw new Error("Failed approval created partial duplicate work order");
  if (tables.field_ops_import_reviews.find(row => row.id === "review-fail").status === "approved") throw new Error("Failed approval marked review approved");
  if (reviewDetailSaveState.dataset.state !== "failed") throw new Error("Failed approval did not show failed state");

  app.tasks = tables.field_ops_work_orders.map(fromWorkOrder);
  app.files = tables.field_ops_documents.map(fromDocument);
  selectedWorkOrderId = created.id;
  renderWorkOrderDetail();
  if (workOrderDetailTitle.textContent !== "Fix prep sink leak") throw new Error("Work order detail did not render: " + workOrderDetailTitle.textContent);

  const existingDocId = tables.field_ops_documents[0].id;
  document.getElementById("workOrderExistingDocument").value = existingDocId;
  document.getElementById("workOrderDetailNote").value = "Checked on site and fixed.";
  await saveWorkOrderDetailUpdates();
  if (!tables.field_ops_work_orders.find(row => row.id === created.id).notes.includes("Checked on site and fixed")) throw new Error("Note was not saved to work order history");

  await markWorkOrderComplete(created.id);
  if (tables.field_ops_work_orders.find(row => row.id === created.id).status !== "complete") throw new Error("Work order was not marked complete");

  currentWorkspace.role = "submitter";
  renderAuthState();
  taskName.value = "Submitter direct work order attempt";
  let blockedDirectCreate = false;
  try {
    await addTask({ preventDefault(){}, target:taskForm });
  } catch (_err) {
    blockedDirectCreate = true;
  }
  if (!blockedDirectCreate) throw new Error("Submitter direct work order create was not blocked");

  return {
    review: tables.field_ops_import_reviews[0],
    document: tables.field_ops_documents[0],
    workOrder: created
  };
}
globalThis.__acceptanceFlow = __acceptanceFlow;
`, context, { filename: "app-under-test.js" });

context.__acceptanceFlow().then(result => {
  assert.equal(result.review.status, "approved");
  assert.equal(result.workOrder.status, "complete");
  assert.equal(result.document.work_order_id, result.workOrder.id);
  assert.match(css, /@media\s*\(max-width:780px\)/);
  assert.match(css, /\.quick-action-bar\{grid-template-columns:1fr 1fr\}/);
  assert.match(css, /button,input,select,textarea\{min-height:44px\}/);
  console.log("PASS role flow acceptance test");
}).catch(err => {
  console.error(err);
  process.exitCode = 1;
});
