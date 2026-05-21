(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const WORK_ORDER_VISIBLE_LIMIT = 80;
  const SCHEDULED_WORK_VISIBLE_LIMIT = 120;
  let workOrderFilter = "attention";
  let scheduledWorkFilter = "upcoming";

function renderTasks(){
  const tasks = activeItems("tasks");
  syncWorkOrderFilterControls();
  const visibleTasks = filteredWorkOrders(tasks);
  const shownTasks = visibleTasks.slice(0, WORK_ORDER_VISIBLE_LIMIT);
  const list = document.getElementById("taskList");
  if(list){
    list.innerHTML = shownTasks.length
      ? shownTasks.map(t => workOrderCardWithActions(t)).join("") + (visibleTasks.length > shownTasks.length ? empty(`Showing the first ${shownTasks.length} of ${visibleTasks.length}. Search or choose a tighter filter to narrow this down.`) : "")
      : empty(workOrderSearchValue() ? "No work orders match that search." : "No work orders in this view.");
  }
  renderWorkOrderFilterStatus(tasks, visibleTasks, shownTasks);
  const archivedList = document.getElementById("archivedTaskList");
  if(archivedList){
    const archived = app.archivedTasks || [];
    archivedList.innerHTML = archived.length ? archived.map(t => `${workOrderCard(t)}<div class="actions no-print"><button class="ghost" type="button" onclick="restoreWorkOrder('${t.id}')">Restore</button></div>`).join("") : empty("No inactive work orders.");
  }
  const options = `<option value="">No related work order</option>` + tasks.map(t => `<option value="${t.id}">${esc(t.workOrderNumber ? `${t.workOrderNumber} - ${t.name}` : t.name)}</option>`).join("");
  if(document.getElementById("budgetWorkOrder")) document.getElementById("budgetWorkOrder").innerHTML = options;
  if(document.getElementById("fileWorkOrder")) document.getElementById("fileWorkOrder").innerHTML = options;
}

function todayStringLocal(){
  return typeof todayString === "function" ? todayString() : new Date().toISOString().slice(0,10);
}

function addDays(dateString, days){
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0,10);
}

function monthString(dateString){
  return String(dateString || "").slice(0,7);
}

function isOpenWorkOrder(task){
  return String(task.status || "").toLowerCase() !== "complete";
}

function workOrderSearchValue(){
  return String(document.getElementById("workOrderSearchInput")?.value || "").trim().toLowerCase();
}

function workOrderHaystack(task){
  const related = [
    app.projects.find(p => p.id === task.projectId)?.name,
    app.buildings.find(b => b.id === task.buildingId)?.name,
    app.spaces.find(s => s.id === task.spaceId)?.name,
    app.assets.find(a => a.id === task.assetId)?.name,
    app.vehicles.find(v => v.id === task.vehicleId)?.name,
    app.vendors.find(v => v.id === task.vendorBidId)?.name
  ];
  return [
    task.workOrderNumber,
    task.name,
    task.type,
    task.status,
    task.priority,
    task.date,
    task.location,
    task.notes,
    ...related
  ].filter(Boolean).join(" ").toLowerCase();
}

function workOrderMatchesFilter(task, filter){
  const today = todayStringLocal();
  const weekEnd = addDays(today, 7);
  const currentMonth = monthString(today);
  const haystack = workOrderHaystack(task);
  const operationalIssue = !isScheduledWorkOrder(task);
  if(filter === "today") return operationalIssue && isOpenWorkOrder(task) && task.date === today;
  if(filter === "overdue") return operationalIssue && isOpenWorkOrder(task) && task.date && task.date < today;
  if(filter === "week") return operationalIssue && isOpenWorkOrder(task) && task.date && task.date >= today && task.date <= weekEnd;
  if(filter === "month") return operationalIssue && isOpenWorkOrder(task) && monthString(task.date) === currentMonth;
  if(filter === "fleet") return isOpenWorkOrder(task) && (haystack.includes("fleet") || haystack.includes("vehicle") || Boolean(task.vehicleId));
  if(filter === "facility") return isOpenWorkOrder(task) && (haystack.includes("facility") || haystack.includes("building") || haystack.includes("valley") || haystack.includes("francis") || haystack.includes("excelsior"));
  if(filter === "kitchen") return isOpenWorkOrder(task) && haystack.includes("kitchen");
  if(filter === "walkthrough") return isOpenWorkOrder(task) && haystack.includes("walkthrough");
  if(filter === "completed") return String(task.status || "").toLowerCase() === "complete";
  if(filter === "anchor") return isOpenWorkOrder(task) && haystack.includes("needs anchor review");
  return isOpenWorkOrder(task) && !isScheduledWorkOrder(task) && task.date && task.date <= weekEnd;
}

function filteredWorkOrders(tasks){
  const query = workOrderSearchValue();
  const base = query
    ? tasks.filter(task => workOrderHaystack(task).includes(query))
    : tasks.filter(task => workOrderMatchesFilter(task, workOrderFilter));
  return base.sort((a,b) => {
    const aComplete = String(a.status || "").toLowerCase() === "complete";
    const bComplete = String(b.status || "").toLowerCase() === "complete";
    if(aComplete !== bComplete) return aComplete ? 1 : -1;
    return String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")) ||
      String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function renderWorkOrderFilterStatus(allTasks, visibleTasks, shownTasks){
  const target = document.getElementById("workOrderFilterStatus");
  if(!target) return;
  const query = workOrderSearchValue();
  const label = query ? `search for "${query}"` : workOrderFilterLabel(workOrderFilter);
  const openCount = allTasks.filter(isOpenWorkOrder).length;
  target.textContent = `Showing ${shownTasks.length} of ${visibleTasks.length} for ${label}. ${openCount} open work order${openCount === 1 ? "" : "s"} total.`;
}

function workOrderFilterLabel(filter){
  const labels = {
    attention:"attention",
    upcoming:"upcoming",
    today:"today",
    overdue:"overdue",
    week:"this week",
    month:"this month",
    fleet:"fleet",
    facility:"facility",
    kitchen:"kitchen",
    walkthrough:"walkthrough",
    completed:"completed",
    anchor:"needs anchor review",
    all:"all scheduled"
  };
  return labels[filter] || "attention";
}

function syncWorkOrderFilterControls(){
  document.querySelectorAll("[data-work-filter]").forEach(button => {
    const active = button.dataset.workFilter === workOrderFilter && !workOrderSearchValue();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setWorkOrderFilter(filter){
  workOrderFilter = filter || "attention";
  const search = document.getElementById("workOrderSearchInput");
  if(search) search.value = "";
  renderTasks();
}

function handleWorkOrderSearch(){
  syncWorkOrderFilterControls();
  renderTasks();
}

function isScheduledWorkOrder(task){
  const haystack = workOrderHaystack(task);
  return haystack.includes("master import key:") ||
    haystack.includes("scheduled from master calendar") ||
    haystack.includes("recurring template") ||
    haystack.includes("fleet recurring schedule item") ||
    haystack.includes("walkthrough checklist item");
}

function sourceMonthForScheduledWork(task){
  const notes = String(task.notes || "");
  const source = notes.match(/Source:\s*([A-Za-z]{3,9}\s+\d{4})/i)?.[1];
  if(source) return source;
  if(task.date){
    return new Date(`${task.date}T12:00:00`).toLocaleDateString(undefined, { month:"short", year:"numeric" });
  }
  return "No source month";
}

function areaSystemForScheduledWork(task){
  const notes = String(task.notes || "");
  return notes.match(/Area\/system:\s*([^\n]+)/i)?.[1]?.trim() ||
    notes.match(/Applies to:\s*([^\n]+)/i)?.[1]?.trim() ||
    notes.match(/Needs anchor review:\s*([^\n]+)/i)?.[1]?.trim() ||
    task.location ||
    "Needs anchor review";
}

function scheduledWorkSearchValue(){
  return String(document.getElementById("scheduledWorkSearchInput")?.value || "").trim().toLowerCase();
}

function scheduledWorkMatchesFilter(task, filter){
  const today = todayStringLocal();
  const currentMonth = monthString(today);
  const haystack = workOrderHaystack(task);
  if(filter === "today") return isOpenWorkOrder(task) && task.date === today;
  if(filter === "overdue") return isOpenWorkOrder(task) && task.date && task.date < today;
  if(filter === "month") return isOpenWorkOrder(task) && monthString(task.date) === currentMonth;
  if(filter === "fleet") return isOpenWorkOrder(task) && (haystack.includes("fleet") || haystack.includes("vehicle") || Boolean(task.vehicleId));
  if(filter === "walkthrough") return isOpenWorkOrder(task) && haystack.includes("walkthrough");
  if(filter === "completed") return String(task.status || "").toLowerCase() === "complete";
  if(filter === "all") return true;
  return isOpenWorkOrder(task) && (!task.date || task.date >= today);
}

function filteredScheduledWork(){
  const query = scheduledWorkSearchValue();
  return activeItems("tasks")
    .filter(isScheduledWorkOrder)
    .filter(task => query ? workOrderHaystack(task).includes(query) : scheduledWorkMatchesFilter(task, scheduledWorkFilter))
    .sort((a,b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")) || String(a.name || "").localeCompare(String(b.name || "")));
}

function scheduledWorkRow(task){
  return `<article class="scheduled-work-row">
    <div class="scheduled-date">${esc(task.date || "No date")}</div>
    <div>
      <strong>${esc(task.name || "Scheduled work")}</strong>
      <p class="meta">${esc(areaSystemForScheduledWork(task))}</p>
    </div>
    <div class="scheduled-source">${esc(sourceMonthForScheduledWork(task))}</div>
    <div><span class="status-chip ${tone(task.status)}">${esc(titleize(task.status || "open"))}</span></div>
    <div class="actions no-print">
      <button type="button" onclick="openWorkOrderDetail('${task.id}')">Open</button>
      ${String(task.status || "").toLowerCase() === "complete" ? "" : `<button class="ghost" type="button" onclick="markWorkOrderComplete('${task.id}')">Complete</button>`}
    </div>
  </article>`;
}

function renderScheduledWork(){
  const list = document.getElementById("scheduledWorkList");
  if(!list) return;
  syncScheduledWorkFilterControls();
  const items = filteredScheduledWork();
  const shown = items.slice(0, SCHEDULED_WORK_VISIBLE_LIMIT);
  list.innerHTML = shown.length
    ? shown.map(scheduledWorkRow).join("") + (items.length > shown.length ? empty(`Showing the first ${shown.length} of ${items.length}. Search or choose a tighter filter to narrow this down.`) : "")
    : empty(scheduledWorkSearchValue() ? "No scheduled work matches that search." : "No scheduled work in this view.");
  const status = document.getElementById("scheduledWorkStatus");
  if(status){
    const label = scheduledWorkSearchValue() ? `search for "${scheduledWorkSearchValue()}"` : workOrderFilterLabel(scheduledWorkFilter);
    status.textContent = `Showing ${shown.length} of ${items.length} for ${label}.`;
  }
}

function syncScheduledWorkFilterControls(){
  const searching = Boolean(scheduledWorkSearchValue());
  document.querySelectorAll("[data-scheduled-filter]").forEach(button => {
    const active = button.dataset.scheduledFilter === scheduledWorkFilter && !searching;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setScheduledWorkFilter(filter){
  scheduledWorkFilter = filter || "upcoming";
  const search = document.getElementById("scheduledWorkSearchInput");
  if(search) search.value = "";
  renderScheduledWork();
}



function workOrderCardWithActions(t){
  if(!canManageOperations()) return workOrderCard(t);
  const index = app.tasks.indexOf(t);
  return `${workOrderCard(t)}<div class="actions no-print"><button type="button" onclick="openWorkOrderDetail('${t.id}')">Open</button><button class="ghost" type="button" onclick="openEditModal('tasks',${index})">Edit</button><button class="ghost" type="button" onclick="deleteItem('tasks',${index})">Move out of active work</button></div>`;
}


function workOrderCard(t){
  const project = app.projects.find(p => p.id === t.projectId);
  const building = app.buildings.find(b => b.id === t.buildingId);
  const space = app.spaces.find(s => s.id === t.spaceId);
  const asset = app.assets.find(a => a.id === t.assetId);
  const vehicle = app.vehicles.find(v => v.id === t.vehicleId);
  const vendor = app.vendors.find(v => v.id === t.vendorBidId);
  const anchor = asset ? `Asset/System: ${asset.name}` : vehicle ? `Vehicle: ${vehicle.name}` : space ? `Space: ${space.name}` : building ? `Building: ${building.name}` : "";
  return card(t.name,[t.workOrderNumber, anchor, t.location, project ? `Project: ${project.name}` : "", building ? `Building: ${building.name}` : "", space ? `Space: ${space.name}` : "", asset ? `Asset/System: ${asset.name}` : "", vehicle ? `Vehicle: ${vehicle.name}` : "", vendor ? `Vendor: ${vendor.name}` : "", t.notes],[titleize(t.status),titleize(t.priority),t.date],tone(t.priority || t.status));
}



function anchorMemoryForWorkOrder(task){
  const buildingDocs = activeItems("files").filter(f => task.buildingId && f.relatedBuildingId === task.buildingId);
  const spaceDocs = activeItems("files").filter(f => task.spaceId && f.relatedSpaceId === task.spaceId);
  const assetDocs = activeItems("files").filter(f => task.assetId && f.relatedAssetId === task.assetId);
  const vehicleDocs = activeItems("files").filter(f => task.vehicleId && f.relatedVehicleId === task.vehicleId);
  const assetHistory = activeItems("tasks").filter(t => t.id !== task.id && task.assetId && t.assetId === task.assetId);
  const vehicleHistory = activeItems("tasks").filter(t => t.id !== task.id && task.vehicleId && t.vehicleId === task.vehicleId);
  return {
    buildingDocs,
    spaceDocs,
    assetDocs,
    vehicleDocs,
    assetHistory,
    vehicleHistory,
    totalDocs: new Set([...buildingDocs, ...spaceDocs, ...assetDocs, ...vehicleDocs].map(doc => doc.id)).size,
    totalHistory: assetHistory.length + vehicleHistory.length
  };
}



async function archiveWorkOrderById(workOrderId){
  if(!requireOperationsPermission("move work orders out of active work")) return;
  if(!confirm("Move this work order out of active work? It will leave the active list but stay recoverable.")) return;
  try{
    await archiveRecord("field_ops_work_orders", workOrderId);
    if(selectedWorkOrderId === workOrderId) selectedWorkOrderId = "";
    showView("workOrders", { skipHistory:true });
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Could not move out of active work: ${err.message}`, "failed");
    setStatus("Move out of active work failed");
  }
}



async function restoreWorkOrder(workOrderId){
  if(!requireOperationsPermission("restore work orders")) return;
  try{
    await restoreRecord("field_ops_work_orders", workOrderId);
    setStatus("Work order restored");
    renderTasks();
  }catch(err){
    console.error(err);
    setStatus("Restore failed");
  }
}



function openWorkOrderDetail(workOrderId){
  if(!requireOperationsPermission("view full work orders")) return;
  selectedWorkOrderId = workOrderId;
  renderWorkOrderDetail();
  showView("workOrderDetail");
}



function selectedWorkOrder(){
  return app.tasks.find(t => t.id === selectedWorkOrderId);
}



function renderWorkOrderDetail(){
  const title = document.getElementById("workOrderDetailTitle");
  const meta = document.getElementById("workOrderDetailMeta");
  const body = document.getElementById("workOrderDetailBody");
  if(!title || !meta || !body) return;
  const task = selectedWorkOrder();
  if(!task){
    title.textContent = "Work Order";
    meta.textContent = "Choose a work order from the list.";
    body.innerHTML = empty("No work order selected.");
    return;
  }

  const project = app.projects.find(p => p.id === task.projectId);
  const building = app.buildings.find(b => b.id === task.buildingId);
  const space = app.spaces.find(s => s.id === task.spaceId);
  const asset = app.assets.find(a => a.id === task.assetId);
  const vehicle = app.vehicles.find(v => v.id === task.vehicleId);
  const vendor = app.vendors.find(v => v.id === task.vendorBidId);
  const documents = activeItems("files").filter(f => f.relatedWorkItemId === task.id);
  const attachableDocuments = activeItems("files").filter(f => !f.relatedWorkItemId || f.relatedWorkItemId !== task.id);
  const anchorMemory = anchorMemoryForWorkOrder(task);
  const budgetItems = activeItems("budgetItems").filter(item => item.workOrderId === task.id);
  const budgetTotal = budgetItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const assignedTo = task.assignedTo || assignedFromNotes(task.notes);
  const historyLines = String(task.notes || "").split("\n").filter(line => line.trim());
  const relatedCards = [
    relatedSummaryCard("Project", project, [project?.summary, project?.notes], [titleize(project?.status || ""), titleize(project?.priority || "")]),
    relatedSummaryCard("Building", building, [building?.address, building?.notes], [titleize(building?.status || "")]),
    relatedSummaryCard("Space", space, [space?.spaceType, space?.floor ? `Floor: ${space.floor}` : "", space?.notes], [titleize(space?.status || "")]),
    relatedSummaryCard("Asset / System", asset, [asset?.assetTag ? `Tag: ${asset.assetTag}` : "", asset?.category ? `System/category: ${asset.category}` : "", asset?.notes], [titleize(asset?.status || "")]),
    relatedSummaryCard("Vehicle / Mobile Asset", vehicle, [vehicle?.vehicleNumber ? `Vehicle #: ${vehicle.vehicleNumber}` : "", vehicle?.plate ? `Plate: ${vehicle.plate}` : "", vehicle?.vin ? `VIN: ${vehicle.vin}` : "", vehicle?.mileage ? `Odometer: ${vehicle.mileage}` : ""], [titleize(vehicle?.status || "")]),
    relatedSummaryCard("Vendor", vendor, [vendor?.contactName, vendor?.phone, vendor?.email, vendor?.notes], [titleize(vendor?.vendorType || ""), titleize(vendor?.status || "")])
  ].filter(Boolean).join("");

  title.textContent = task.name || "Work Order";
  meta.textContent = compact([task.workOrderNumber, titleize(task.status), titleize(task.priority), task.date ? `Due ${task.date}` : "No due date"]).join(" | ");
  body.innerHTML = `
    <div class="field-status-strip">
      <span class="status-chip ${tone(task.status)}">${esc(titleize(task.status || "open"))}</span>
      <span class="status-chip ${tone(task.priority)}">${esc(titleize(task.priority || "normal"))}</span>
      <span class="status-chip">${esc(task.date ? `Due ${task.date}` : "No due date")}</span>
      <span class="status-chip">${esc(assignedTo || "Unassigned")}</span>
    </div>
    <section class="asset-memory-strip">
      <div>
        <span>Operational anchor</span>
        <strong>${esc(asset?.name || vehicle?.name || space?.name || building?.name || "No asset anchor yet")}</strong>
        <p class="meta">${esc(asset ? "Asset/system memory" : vehicle ? "Vehicle/mobile asset memory" : space ? "Space memory" : building ? "Building memory" : "Link a building, space, asset/system, or vehicle to keep history together.")}</p>
      </div>
      <div><span>Related documents</span><strong>${anchorMemory.totalDocs}</strong></div>
      <div><span>Related work history</span><strong>${anchorMemory.totalHistory}</strong></div>
    </section>
    <div class="grid three">
      ${detailRow("Status", titleize(task.status))}
      ${detailRow("Priority", titleize(task.priority))}
      ${detailRow("Due date", task.date)}
      ${detailRow("Assigned", assignedTo)}
    </div>
    <div class="quick-action-bar no-print">
      <button type="button" onclick="markWorkOrderComplete('${task.id}')">Mark Complete</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailDueDate')">Reschedule</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailStatus')">Change Status</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailAssignee')">Assign</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailUpload')">Attach File</button>
      <button class="ghost" type="button" onclick="focusWorkOrderField('workOrderDetailNote')">Add Note</button>
    </div>
    <div class="detail-block">
      <div class="panel-title"><h3>Linked Records</h3></div>
      <div class="actions">
        ${linkedButton("Project", project?.name, "projects")}
        ${linkedButton("Building", building?.name, "buildings")}
        ${linkedButton("Space", space?.name, "spaces")}
        ${linkedButton("Asset / System", asset?.name, "assets")}
        ${linkedButton("Vehicle / Mobile Asset", vehicle?.name, "vehicles")}
        ${linkedButton("Vendor", vendor?.name, "vendors")}
      </div>
      <div class="grid two">${relatedCards}</div>
      ${!relatedCards ? empty("No linked records yet.") : ""}
    </div>
    <section class="detail-block">
      <div class="panel-title"><h3>Anchor Memory</h3><p class="meta">Documents and prior work connected through this building, space, asset/system, or vehicle.</p></div>
      <div class="grid two">
        ${card("Documents on this anchor", [
          `${anchorMemory.buildingDocs.length} building document${anchorMemory.buildingDocs.length === 1 ? "" : "s"}`,
          `${anchorMemory.spaceDocs.length} space document${anchorMemory.spaceDocs.length === 1 ? "" : "s"}`,
          `${anchorMemory.assetDocs.length} asset/system document${anchorMemory.assetDocs.length === 1 ? "" : "s"}`,
          `${anchorMemory.vehicleDocs.length} vehicle document${anchorMemory.vehicleDocs.length === 1 ? "" : "s"}`
        ], ["Institutional memory"], "")}
        ${card("Prior related work", [
          `${anchorMemory.assetHistory.length} prior asset/system work order${anchorMemory.assetHistory.length === 1 ? "" : "s"}`,
          `${anchorMemory.vehicleHistory.length} prior vehicle work order${anchorMemory.vehicleHistory.length === 1 ? "" : "s"}`
        ], ["Timeline context"], "")}
      </div>
    </section>
    <div class="grid two">
      <section class="detail-block">
        <div class="panel-title"><h3>Notes</h3></div>
        ${card(task.location || "Location not set", [task.notes || "No notes yet."], [], "")}
      </section>
      <section class="detail-block">
        <div class="panel-title"><h3>Cost Snapshot</h3></div>
        <div class="grid two">
          ${detailRow("Budget items", String(budgetItems.length))}
          ${detailRow("Total tracked", money(budgetTotal))}
        </div>
      </section>
    </div>
    <section class="detail-block">
      <div class="panel-title"><h3>Documents</h3><button class="ghost" type="button" onclick="showView('documents')">Upload / Link Document</button></div>
      <div class="card-list">${documents.length ? documents.map(doc => `${documentPreviewCard(doc)}<div class="actions no-print"><button class="ghost" type="button" onclick="unlinkDocumentFromWorkOrder('${doc.id}')">Unlink</button></div>`).join("") : empty("No documents linked to this work order yet.")}</div>
    </section>
    <section class="detail-block no-print">
      <div class="panel-title"><h3>Field Update</h3><p class="meta" id="workOrderDetailSaveState">Ready</p></div>
      <div class="form-grid">
        <label>Status<select id="workOrderDetailStatus"><option value="open">Open</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option><option value="complete">Complete</option><option value="canceled">Canceled</option></select></label>
        <label>Priority<select id="workOrderDetailPriority"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label>Due date<input id="workOrderDetailDueDate" type="date" value="${esc(task.date || "")}" /></label>
        <label>Assigned person<input id="workOrderDetailAssignee" value="${esc(assignedTo)}" placeholder="Name, team, or vendor" /></label>
        <label>Attach existing document<select id="workOrderExistingDocument"><option value="">Choose existing document</option>${attachableDocuments.map(f => `<option value="${esc(f.id)}">${esc(f.fileName)}</option>`).join("")}</select></label>
        <label class="full">Add note<textarea id="workOrderDetailNote" placeholder="Add a field note, status update, or follow-up..."></textarea></label>
        <label>Attach document<input id="workOrderDetailUpload" type="file" accept=".pdf,.csv,.xlsx,.xls,image/*" /></label>
      </div>
      <div class="actions"><button type="button" onclick="saveWorkOrderDetailUpdates()">Save Update</button></div>
    </section>
    <section class="detail-block">
      <div class="panel-title"><h3>History</h3></div>
      <div class="timeline">${historyLines.length ? historyLines.map(line => `<article class="timeline-item"><p>${esc(line)}</p></article>`).join("") : empty("No visible history yet.")}</div>
    </section>
  `;

  const editBtn = document.getElementById("workOrderDetailEditBtn");
  const completeBtn = document.getElementById("workOrderDetailCompleteBtn");
  const archiveBtn = document.getElementById("workOrderDetailArchiveBtn");
  const taskIndex = app.tasks.indexOf(task);
  if(editBtn) editBtn.onclick = () => openEditModal("tasks", taskIndex);
  if(completeBtn) completeBtn.onclick = () => markWorkOrderComplete(task.id);
  if(archiveBtn) archiveBtn.onclick = () => archiveWorkOrderById(task.id);
  const statusSelect = document.getElementById("workOrderDetailStatus");
  if(statusSelect) statusSelect.value = task.status || "open";
  const prioritySelect = document.getElementById("workOrderDetailPriority");
  if(prioritySelect) prioritySelect.value = task.priority || "normal";
}



function focusWorkOrderField(idValue){
  const field = document.getElementById(idValue);
  if(!field) return;
  field.scrollIntoView({ behavior:"smooth", block:"center" });
  field.focus();
}



async function markWorkOrderComplete(workOrderId){
  if(!requireOperationsPermission("complete work orders")) return;
  const task = app.tasks.find(t => t.id === workOrderId);
  if(!task){
    setWorkOrderDetailState("Completion failed: work order was not found in the current workspace.", "failed");
    return;
  }
  const payload = { status:"complete", notes:appendHistory(task.notes, "Marked complete") };
  try{
    setWorkOrderDetailState("Saving completion...", "pending");
    const { data, error } = await updateRow("field_ops_work_orders", workOrderId, payload, workspaceId());
    if(error) throw withSupabaseCallDetails(error, "field_ops_work_orders", "update completion", payload);
    if(!data) throw withSupabaseCallDetails(new Error("No row was updated. This usually means RLS blocked the update, the record is archived, or the workspace_id did not match."), "field_ops_work_orders", "update completion", payload);
    setWorkOrderDetailState("Complete saved", "saved");
    loadWorkspaceData().catch(err => {
      console.error("Completion saved, but workspace refresh failed", err);
      setWorkOrderDetailState(`Complete saved, but refresh failed: ${permissionAwareErrorMessage(err)}`, "saved");
    });
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Completion failed: ${completionErrorMessage(err)}`, "failed");
    setStatus("Completion failed");
  }
}



async function unlinkDocumentFromWorkOrder(documentId){
  if(!requireOperationsPermission("unlink work order documents")) return;
  try{
    setWorkOrderDetailState("Unlinking document...", "pending");
    await updateRecord("field_ops_documents", documentId, { work_order_id:null });
    setWorkOrderDetailState("Document unlinked", "saved");
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Unlink failed: ${err.message}`, "failed");
    setStatus("Unlink failed");
  }
}



async function saveWorkOrderDetailUpdates(){
  const task = selectedWorkOrder();
  if(!task || !requireOperationsPermission("update work orders")) return;
  let savedWorkOrder = false;
  try{
    const status = document.getElementById("workOrderDetailStatus")?.value || task.status;
    const priority = document.getElementById("workOrderDetailPriority")?.value || task.priority || "normal";
    const dueDate = document.getElementById("workOrderDetailDueDate")?.value || null;
    const assignee = document.getElementById("workOrderDetailAssignee")?.value.trim();
    const existingDocumentId = document.getElementById("workOrderExistingDocument")?.value || "";
    const note = document.getElementById("workOrderDetailNote")?.value.trim();
    const upload = document.getElementById("workOrderDetailUpload")?.files?.[0];
    const statusChanged = status !== task.status;
    const priorityChanged = priority !== (task.priority || "normal");
    const dueChanged = dueDate !== (task.date || null);
    const assignedChanged = assignee !== (task.assignedTo || assignedFromNotes(task.notes));
    let notes = replaceAssignedInNotes(task.notes, assignee);
    if(statusChanged) notes = appendHistory(notes, `Status changed from ${titleize(task.status)} to ${titleize(status)}`);
    if(priorityChanged) notes = appendHistory(notes, `Priority changed from ${titleize(task.priority || "normal")} to ${titleize(priority)}`);
    if(dueChanged) notes = appendHistory(notes, `Due date changed from ${task.date || "not set"} to ${dueDate || "not set"}`);
    if(assignedChanged) notes = appendHistory(notes, `Assigned to ${assignee || "not set"}`);
    if(note) notes = appendHistory(notes, note);
    const workOrderPayload = { status, priority, due_date:dueDate, notes: notes || null };
    setWorkOrderDetailState("Saving work order...", "pending");
    const workOrderResult = await updateRow("field_ops_work_orders", task.id, workOrderPayload, workspaceId());
    if(workOrderResult.error) throw withSupabaseCallDetails(workOrderResult.error, "field_ops_work_orders", "update detail", workOrderPayload);
    if(!workOrderResult.data) throw withSupabaseCallDetails(new Error("No row was updated. This usually means RLS blocked the update, the record is archived, or the workspace_id did not match."), "field_ops_work_orders", "update detail", workOrderPayload);
    savedWorkOrder = true;
    if(existingDocumentId){
      const documentPayload = { work_order_id: task.id };
      setWorkOrderDetailState("Linking document...", "pending");
      const documentResult = await updateRow("field_ops_documents", existingDocumentId, documentPayload, workspaceId());
      if(documentResult.error) throw withSupabaseCallDetails(documentResult.error, "field_ops_documents", "link document", documentPayload);
      if(!documentResult.data) throw withSupabaseCallDetails(new Error("No document row was updated. This usually means RLS blocked the update, the document is archived, or the workspace_id did not match."), "field_ops_documents", "link document", documentPayload);
    }
    if(upload){
      setWorkOrderDetailState("Uploading attachment...", "pending");
      const docId = id();
      const storagePath = await uploadDocumentToStorage(upload, docId);
      const extractedText = await extractFileText(upload);
      setWorkOrderDetailState("Saving attachment record...", "pending");
      await saveDocumentMetadata({
        docId,
        fileNameValue: upload.name,
        fileTypeValue: fileTypeFromName(upload.name),
        storagePath,
        extractedText,
        extractionStatus: extractedText ? "complete" : "not_supported",
        links:{ workOrderId:task.id },
        notes:`Attached from work order ${task.workOrderNumber || task.name}`
      });
    }
    setStatus("Work order saved");
    setWorkOrderDetailState("Saved", "saved");
    loadWorkspaceData().catch(err => {
      console.error("Work order saved, but workspace refresh failed", err);
      setWorkOrderDetailState(`Saved, but refresh failed: ${permissionAwareErrorMessage(err)}`, "saved");
    });
  }catch(err){
    console.error(err);
    const prefix = savedWorkOrder ? "Work order saved, but final step failed" : "Save failed";
    setWorkOrderDetailState(`${prefix}: ${completionErrorMessage(err)}`, savedWorkOrder ? "saved" : "failed");
    setStatus(prefix);
  }
}

function withSupabaseCallDetails(error, table, action, payload){
  error.fieldOpsCall = { table, action, payload };
  return error;
}

function completionErrorMessage(err){
  const call = err?.fieldOpsCall;
  const base = permissionAwareErrorMessage(err);
  if(!call) return base;
  return `${base} (${call.action} on ${call.table})`;
}



  Object.assign(window.FieldOps.Views, {
    renderTasks,
    setWorkOrderFilter,
    handleWorkOrderSearch,
    renderScheduledWork,
    setScheduledWorkFilter,
    workOrderCardWithActions,
    workOrderCard,
    archiveWorkOrderById,
    restoreWorkOrder,
    openWorkOrderDetail,
    selectedWorkOrder,
    renderWorkOrderDetail,
    focusWorkOrderField,
    markWorkOrderComplete,
    unlinkDocumentFromWorkOrder,
    saveWorkOrderDetailUpdates
  });
  Object.assign(globalThis, {
    renderTasks,
    setWorkOrderFilter,
    handleWorkOrderSearch,
    renderScheduledWork,
    setScheduledWorkFilter,
    workOrderCardWithActions,
    workOrderCard,
    archiveWorkOrderById,
    restoreWorkOrder,
    openWorkOrderDetail,
    selectedWorkOrder,
    renderWorkOrderDetail,
    focusWorkOrderField,
    markWorkOrderComplete,
    unlinkDocumentFromWorkOrder,
    saveWorkOrderDetailUpdates
  });
})();

