(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const WORK_ORDER_VISIBLE_LIMIT = 80;
  const SCHEDULED_WORK_VISIBLE_LIMIT = 120;
  let workOrderFilter = "all";
  let scheduledWorkFilter = "upcoming";
  let assignedWorkFilter = "attention";
  let selectedAssignedWorkId = "";

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

function currentAssigneeTokens(){
  const email = String(currentSession?.user?.email || "").toLowerCase();
  const display = String(currentWorkspace?.displayName || app.settings?.userDisplayName || "").toLowerCase();
  return [email, email.split("@")[0], display].map(value => value.trim()).filter(Boolean);
}

function taskAssignee(task){
  return task.assignedTo || assignedFromNotes(task.notes);
}

function isAssignedToCurrentUser(task){
  const assignee = String(taskAssignee(task) || "").toLowerCase().trim();
  if(!assignee) return false;
  return currentAssigneeTokens().some(token => assignee.includes(token) || token.includes(assignee));
}

function workOrderSearchValue(){
  return String(document.getElementById("workOrderSearchInput")?.value || "").trim().toLowerCase();
}

function workOrderTypeFilterValue(){
  return String(document.getElementById("workOrderTypeFilter")?.value || "all");
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
  const operationalIssue = !isScheduledWorkOrder(task);
  if(filter === "today") return operationalIssue && isOpenWorkOrder(task) && task.date === today;
  if(filter === "overdue") return operationalIssue && isOpenWorkOrder(task) && task.date && task.date < today;
  if(filter === "week") return operationalIssue && isOpenWorkOrder(task) && task.date && task.date >= today && task.date <= weekEnd;
  return operationalIssue;
}

function workOrderMatchesType(task, type){
  const haystack = workOrderHaystack(task);
  if(type === "fleet") return isOpenWorkOrder(task) && (haystack.includes("fleet") || haystack.includes("vehicle") || Boolean(task.vehicleId));
  if(type === "facility") return isOpenWorkOrder(task) && (haystack.includes("facility") || haystack.includes("building") || haystack.includes("valley") || haystack.includes("francis") || haystack.includes("excelsior"));
  if(type === "kitchen") return isOpenWorkOrder(task) && haystack.includes("kitchen");
  if(type === "walkthrough") return isOpenWorkOrder(task) && haystack.includes("walkthrough");
  if(type === "completed") return String(task.status || "").toLowerCase() === "complete";
  if(type === "missing_details") return isOpenWorkOrder(task) && /needs anchor review|missing details|needs details/i.test(haystack);
  return true;
}

function filteredWorkOrders(tasks){
  const query = workOrderSearchValue();
  const type = workOrderTypeFilterValue();
  const base = query
    ? tasks.filter(task => workOrderHaystack(task).includes(query))
    : tasks.filter(task => workOrderMatchesFilter(task, workOrderFilter));
  const typed = base.filter(task => workOrderMatchesType(task, type));
  return typed.sort((a,b) => {
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
  const type = workOrderTypeFilterValue();
  const typeLabel = type === "all" ? "" : `, ${workOrderFilterLabel(type)}`;
  const label = query ? `search for "${query}"${typeLabel}` : `${workOrderFilterLabel(workOrderFilter)}${typeLabel}`;
  const openCount = allTasks.filter(isOpenWorkOrder).length;
  target.textContent = `Showing ${shownTasks.length} of ${visibleTasks.length} for ${label}. ${openCount} open work order${openCount === 1 ? "" : "s"} total.`;
}

function workOrderFilterLabel(filter){
  const labels = {
    today:"today",
    overdue:"overdue",
    week:"this week",
    fleet:"fleet",
    facility:"facility",
    kitchen:"kitchen",
    walkthrough:"walkthrough",
    completed:"completed",
    missing_details:"missing details",
    all:"all"
  };
  return labels[filter] || "all";
}

function syncWorkOrderFilterControls(){
  document.querySelectorAll("[data-work-filter]").forEach(button => {
    const active = button.dataset.workFilter === workOrderFilter && !workOrderSearchValue();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  document.querySelectorAll("[data-manager-cleanup]").forEach(option => {
    option.hidden = !canManageOperations();
    option.disabled = !canManageOperations();
  });
}

function setWorkOrderFilter(filter){
  workOrderFilter = filter || "all";
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
    "Missing details";
}

function linkedIdFromNotes(notes, label){
  const match = String(notes || "").match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
  return match ? match[1].trim() : "";
}

function linkedWorkOrderForScheduledTask(task){
  const linkedId = linkedIdFromNotes(task.notes, "Linked work order");
  if(linkedId){
    const linked = app.tasks.find(item => item.id === linkedId);
    if(linked) return linked;
  }
  return app.tasks.find(item => item.id !== task.id && String(item.notes || "").includes(`Scheduled source task: ${task.id}`));
}

function linkedSupplyRequestForScheduledTask(task){
  const linkedId = linkedIdFromNotes(task.notes, "Linked supply request");
  if(linkedId){
    const linked = app.submissions.find(item => item.id === linkedId);
    if(linked) return linked;
  }
  return app.submissions.find(item => item.importedRecord?.scheduled_task_id === task.id);
}

function scheduledSourceLines(task){
  const notes = String(task.notes || "");
  return notes
    .split(/\r?\n/)
    .filter(line => /^(Source|Master import key|Area\/system|Frequency|Timing|Responsible):/i.test(line.trim()));
}

function scheduledLinkedStatus(task){
  const linkedWorkOrder = linkedWorkOrderForScheduledTask(task);
  const linkedSupply = linkedSupplyRequestForScheduledTask(task);
  return [
    linkedWorkOrder ? `<span class="scheduled-linked">Linked work order created</span>` : "",
    linkedSupply ? `<span class="scheduled-linked">Supply request in Needs Review</span>` : ""
  ].filter(Boolean).join("");
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
  const linkedWorkOrder = linkedWorkOrderForScheduledTask(task);
  const linkedSupply = linkedSupplyRequestForScheduledTask(task);
  const completeButton = String(task.status || "").toLowerCase() === "complete" ? "" : `<button class="ghost" type="button" onclick="markWorkOrderComplete('${task.id}')">Complete</button>`;
  return `<article class="scheduled-work-row">
    <div class="scheduled-date">${esc(task.date || "No date")}</div>
    <div>
      <strong>${esc(task.name || "Scheduled work")}</strong>
      <p class="meta">${esc(areaSystemForScheduledWork(task))}</p>
      ${scheduledLinkedStatus(task)}
    </div>
    <div class="scheduled-source">${esc(sourceMonthForScheduledWork(task))}</div>
    <div><span class="status-chip ${tone(task.status)}">${esc(titleize(task.status || "open"))}</span></div>
    <div class="actions scheduled-actions no-print">
      <button type="button" onclick="openWorkOrderDetail('${task.id}')">Open</button>
      ${completeButton}
      <button class="ghost" type="button" onclick="addNoteToScheduledTask('${task.id}')">Add Note</button>
      <button class="ghost" type="button" onclick="createWorkOrderFromScheduledTask('${task.id}')">${linkedWorkOrder ? "Open Linked Work" : "Create Work Order"}</button>
      <button class="ghost" type="button" onclick="createSupplyRequestFromScheduledTask('${task.id}')">${linkedSupply ? "Open Supply Request" : "Create Supply / Purchase Request"}</button>
      <button class="ghost" type="button" onclick="uploadDocumentForScheduledTask('${task.id}')">Upload Document / Receipt</button>
      <button class="ghost" type="button" disabled title="Reschedule is not available yet">Reschedule not available yet</button>
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

function assignedWorkSearchValue(){
  return String(document.getElementById("assignedWorkSearchInput")?.value || "").trim().toLowerCase();
}

function assignedSummary(){
  const today = todayStringLocal();
  const weekEnd = addDays(today, 7);
  const items = activeItems("tasks").filter(isAssignedToCurrentUser);
  return {
    all:items,
    overdue:items.filter(task => isOpenWorkOrder(task) && task.date && task.date < today),
    today:items.filter(task => isOpenWorkOrder(task) && task.date === today),
    week:items.filter(task => isOpenWorkOrder(task) && task.date && task.date >= today && task.date <= weekEnd),
    recent:items.filter(task => task.updatedAt || task.createdAt).slice().sort((a,b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).slice(0,5)
  };
}

function assignedWorkItems(){
  const today = todayStringLocal();
  const weekEnd = addDays(today, 7);
  const query = assignedWorkSearchValue();
  return activeItems("tasks")
    .filter(isAssignedToCurrentUser)
    .filter(task => {
      if(query) return workOrderHaystack(task).includes(query);
      if(assignedWorkFilter === "today") return isOpenWorkOrder(task) && task.date === today;
      if(assignedWorkFilter === "overdue") return isOpenWorkOrder(task) && task.date && task.date < today;
      if(assignedWorkFilter === "week") return isOpenWorkOrder(task) && task.date && task.date >= today && task.date <= weekEnd;
      if(assignedWorkFilter === "scheduled") return isOpenWorkOrder(task) && isScheduledWorkOrder(task);
      if(assignedWorkFilter === "recent") return true;
      return isOpenWorkOrder(task) && (!task.date || task.date <= weekEnd || isScheduledWorkOrder(task));
    })
    .sort((a,b) => {
      if(assignedWorkFilter === "recent") return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
      return String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")) || String(a.name || "").localeCompare(String(b.name || ""));
    });
}

function linkedDocsForTask(task){
  return activeItems("files").filter(file => file.relatedWorkItemId === task.id);
}

function linkedSupplyRequestsForTask(task){
  return activeItems("submissions").filter(review => {
    const data = review.importedRecord || {};
    return data.work_order_id === task.id || data.scheduled_task_id === task.id;
  });
}

function linkedScheduledTaskForWork(task){
  const linkedId = String(task.notes || "").match(/Scheduled source task:\s*([^\n]+)/i)?.[1]?.trim();
  return linkedId ? app.tasks.find(item => item.id === linkedId) : null;
}

function assignedContext(task){
  const asset = app.assets.find(item => item.id === task.assetId);
  const vehicle = app.vehicles.find(item => item.id === task.vehicleId);
  const space = app.spaces.find(item => item.id === task.spaceId);
  const building = app.buildings.find(item => item.id === task.buildingId);
  return asset ? `Asset: ${asset.name}` : vehicle ? `Vehicle: ${vehicle.name}` : space ? `Space: ${space.name}` : building ? `Building: ${building.name}` : task.location || "";
}

function assignedWorkCard(task){
  const docs = linkedDocsForTask(task);
  const supplyRequests = linkedSupplyRequestsForTask(task);
  const scheduledTask = isScheduledWorkOrder(task) ? task : linkedScheduledTaskForWork(task);
  const complete = String(task.status || "").toLowerCase() === "complete";
  return `<article class="assigned-work-card ${tone(task.priority || task.status)}">
    <div class="assigned-work-main">
      <h4>${esc(task.name || "Assigned work")}</h4>
      <div class="today-work-meta">
        <span>${esc(titleize(task.status || "open"))}</span>
        <span>${esc(titleize(task.priority || "normal"))}</span>
        <span>${esc(task.date ? `Due ${task.date}` : "No due date")}</span>
        ${assignedContext(task) ? `<span>${esc(assignedContext(task))}</span>` : ""}
        ${isScheduledWorkOrder(task) ? `<span>Scheduled</span>` : ""}
      </div>
      <p class="meta">${esc(compact([docs.length ? `${docs.length} linked document${docs.length === 1 ? "" : "s"}` : "", supplyRequests.length ? `${supplyRequests.length} supply request${supplyRequests.length === 1 ? "" : "s"}` : ""]).join(" | ") || "Ready for field update.")}</p>
    </div>
    <div class="actions assigned-actions no-print">
      <button type="button" onclick="openAssignedWorkItem('${task.id}')">Open</button>
      ${complete ? "" : `<button class="ghost" type="button" onclick="completeAssignedWorkItem('${task.id}')">Complete</button>`}
      <button class="ghost" type="button" onclick="addAssignedWorkNote('${task.id}')">Add Note</button>
      <button class="ghost" type="button" onclick="uploadDocumentForScheduledTask('${task.id}')">Upload Photo/Receipt</button>
      <button class="ghost" type="button" onclick="viewAssignedWorkDocuments('${task.id}')">View Documents</button>
      ${scheduledTask ? `<button class="ghost" type="button" onclick="viewLinkedScheduledTask('${scheduledTask.id}')">View Scheduled Task</button>` : ""}
    </div>
  </article>`;
}

function renderAssignedGroup(title, items){
  return `<section class="assigned-group"><div class="panel-title"><div><h3>${esc(title)}</h3><p class="meta">${items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "All clear"}</p></div></div>${items.length ? items.slice(0, 10).map(assignedWorkCard).join("") : empty(`No ${title.toLowerCase()} assigned work.`)}</section>`;
}

function renderAssignedWork(){
  const list = document.getElementById("assignedWorkList");
  if(!list) return;
  const summary = assignedSummary();
  const items = assignedWorkItems();
  const shown = items.slice(0, 40);
  Object.entries({
    portalAssignedCount:`${summary.all.length} assigned`,
    assignedOverdueCount:summary.overdue.length,
    assignedTodayCount:summary.today.length,
    assignedWeekCount:summary.week.length,
    assignedRecentCount:summary.recent.length
  }).forEach(([idValue, value]) => {
    const el = document.getElementById(idValue);
    if(el) el.textContent = value;
  });
  document.querySelectorAll("[data-assigned-filter]").forEach(button => {
    const active = button.dataset.assignedFilter === assignedWorkFilter && !assignedWorkSearchValue();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if(!assignedWorkSearchValue() && assignedWorkFilter === "attention"){
    const grouped = [
      renderAssignedGroup("Overdue", summary.overdue),
      renderAssignedGroup("Due Today", summary.today),
      renderAssignedGroup("This Week", summary.week.filter(item => !summary.today.includes(item))),
      renderAssignedGroup("Recently Updated", summary.recent)
    ].join("");
    list.innerHTML = summary.all.length ? grouped : empty("No tasks assigned yet.");
  }else{
    list.innerHTML = shown.length ? shown.map(assignedWorkCard).join("") + (items.length > shown.length ? empty(`Showing the first ${shown.length} of ${items.length}. Search to narrow this down.`) : "") : empty(assignedWorkSearchValue() ? "No assigned work matches that search." : "No tasks assigned yet.");
  }
  const status = document.getElementById("assignedWorkStatus");
  if(status){
    const label = assignedWorkSearchValue() ? `search for "${assignedWorkSearchValue()}"` : assignedWorkFilter.replace(/_/g, " ");
    status.textContent = `Showing ${shown.length} of ${items.length} for ${label}.`;
  }
}

function setAssignedWorkFilter(filter){
  assignedWorkFilter = filter || "attention";
  const search = document.getElementById("assignedWorkSearchInput");
  if(search) search.value = "";
  renderAssignedWork();
}

function handleAssignedWorkSearch(){
  renderAssignedWork();
}

function assignedTaskById(taskId){
  const task = app.tasks.find(item => item.id === taskId);
  if(!task) setStatus("Assigned work was not found");
  return task;
}

function openAssignedWorkItem(taskId){
  const task = assignedTaskById(taskId);
  if(!task) return;
  selectedAssignedWorkId = taskId;
  if(canManageOperations()){
    openWorkOrderDetail(taskId);
    return;
  }
  renderAssignedWorkDetail(task);
}

function renderAssignedWorkDetail(task){
  const target = document.getElementById("assignedWorkDetail");
  if(!target) return;
  const docs = linkedDocsForTask(task);
  const supplyRequests = linkedSupplyRequestsForTask(task);
  const scheduledTask = isScheduledWorkOrder(task) ? task : linkedScheduledTaskForWork(task);
  const historyLines = String(task.notes || "").split("\n").filter(Boolean).slice(-8);
  target.innerHTML = `<section class="detail-block assigned-inline-detail" tabindex="-1">
    <div class="panel-title"><div><h3>${esc(task.name || "Assigned work")}</h3><p class="meta">${esc(compact([titleize(task.status), titleize(task.priority), task.date ? `Due ${task.date}` : "No due date", assignedContext(task)]).join(" | "))}</p></div></div>
    <div class="object-story-grid assigned-context-strip" aria-label="Assigned work context">
      <span>${esc(assignedContext(task) || "No location set")}</span>
      <span>${docs.length} linked document${docs.length === 1 ? "" : "s"}</span>
      <span>${supplyRequests.length} supply request${supplyRequests.length === 1 ? "" : "s"}</span>
      <span>${scheduledTask ? "Connected to scheduled work" : "Field update ready"}</span>
    </div>
    <div class="actions no-print">
      <button type="button" onclick="completeAssignedWorkItem('${task.id}')">Complete</button>
      <button class="ghost" type="button" onclick="addAssignedWorkNote('${task.id}')">Add Note</button>
      <button class="ghost" type="button" onclick="uploadDocumentForScheduledTask('${task.id}')">Upload Photo/Receipt</button>
      ${scheduledTask ? `<button class="ghost" type="button" onclick="viewLinkedScheduledTask('${scheduledTask.id}')">View Scheduled Task</button>` : ""}
    </div>
    <div class="card-list">${docs.length ? docs.map(documentPreviewCard).join("") : empty("No linked documents yet.")}</div>
    <div class="timeline">${historyLines.length ? historyLines.map(line => `<article class="timeline-item"><p>${esc(line)}</p></article>`).join("") : empty("No visible history yet.")}</div>
  </section>`;
  target.querySelector(".assigned-inline-detail")?.focus();
}

async function updateAssignedWorkNotes(task, message, successMessage){
  const payload = { notes:appendHistory(task.notes, message) };
  try{
    setStatus("Saving assigned work...");
    const { data, error } = await updateRow("field_ops_work_orders", task.id, payload, workspaceId());
    if(error) throw withWorkspaceCallDetails(error, "field_ops_work_orders", "update assigned work", payload);
    if(!data) throw new Error("No row was updated. This account may not be allowed to update assigned work yet.");
    setStatus(successMessage);
    await loadWorkspaceData();
    const refreshed = app.tasks.find(item => item.id === task.id);
    if(refreshed && selectedAssignedWorkId === task.id) renderAssignedWorkDetail(refreshed);
  }catch(err){
    const message = permissionAwareErrorMessage(err);
    setStatus(message);
    InteractionService?.showToast?.(message, "failed");
  }
}

async function completeAssignedWorkItem(taskId){
  const task = assignedTaskById(taskId);
  if(!task) return;
  const payload = { status:"complete", notes:appendHistory(task.notes, "Marked complete from Assigned Work") };
  try{
    setStatus("Saving completion...");
    const { data, error } = await updateRow("field_ops_work_orders", task.id, payload, workspaceId());
    if(error) throw withWorkspaceCallDetails(error, "field_ops_work_orders", "complete assigned work", payload);
    if(!data) throw new Error("No row was updated. This account may not be allowed to complete this assigned work yet.");
    setStatus("Assigned work marked complete");
    InteractionService?.showConfirmation?.("Work completed", "This assigned item was marked complete and kept in the work history.", [
      { label:"Upload proof", run:() => uploadDocumentForScheduledTask(task.id) }
    ]);
    addOperationalNotification?.({ type:"work_completed", title:"Work completed", detail:task.name || "Assigned work was completed.", view:"assignedWork", recordId:task.id, role:"all" });
    await loadWorkspaceData();
  }catch(err){
    const message = permissionAwareErrorMessage(err);
    setStatus(message);
    InteractionService?.showToast?.(message, "failed");
  }
}

async function addAssignedWorkNote(taskId){
  const task = assignedTaskById(taskId);
  if(!task) return;
  const note = prompt("Add a note for this assigned work");
  if(!note?.trim()) return;
  await updateAssignedWorkNotes(task, note.trim(), "Assigned work note saved");
}

function viewAssignedWorkDocuments(taskId){
  const task = assignedTaskById(taskId);
  if(!task) return;
  if(canManageOperations()) showView("documents");
  else renderAssignedWorkDetail(task);
}

function viewLinkedScheduledTask(taskId){
  showView("scheduledWork");
  setTimeout(() => {
    const input = document.getElementById("scheduledWorkSearchInput");
    if(input) input.value = taskId;
    renderScheduledWork();
  }, 0);
}

function scheduledTaskById(taskId){
  const task = app.tasks.find(item => item.id === taskId);
  if(!task) setStatus("Scheduled task not found");
  return task;
}

function scheduledTaskContextNotes(task){
  return [
    `Scheduled source task: ${task.id}`,
    `Scheduled source title: ${task.name || "Scheduled work"}`,
    task.date ? `Scheduled due date: ${task.date}` : "",
    `Area/system: ${areaSystemForScheduledWork(task)}`,
    ...scheduledSourceLines(task),
    task.notes
  ].filter(Boolean).join("\n");
}

async function createWorkOrderFromScheduledTask(taskId){
  if(!requireOperationsPermission("create a work order from scheduled work")) return;
  const task = scheduledTaskById(taskId);
  if(!task) return;
  const existing = linkedWorkOrderForScheduledTask(task);
  if(existing){
    openWorkOrderDetail(existing.id);
    return;
  }
  try{
    const saved = await insertRecord("field_ops_work_orders", {
      title:task.name || "Scheduled work follow-up",
      type:task.type || "maintenance",
      status:"open",
      priority:task.priority || "normal",
      due_date:task.date || null,
      project_id:task.projectId || null,
      building_id:task.buildingId || null,
      space_id:task.spaceId || null,
      asset_id:task.assetId || null,
      vehicle_id:task.vehicleId || null,
      vendor_id:task.vendorBidId || null,
      description:task.location || areaSystemForScheduledWork(task),
      notes:scheduledTaskContextNotes(task)
    });
    if(saved?.id && !saved?._queued){
      await updateRecord("field_ops_work_orders", task.id, {
        notes:appendHistory(task.notes, `Linked work order created: ${saved.id}`)
      });
      setStatus("Linked work order created");
      InteractionService?.showConfirmation?.("Work order created", "The scheduled item now has a linked work order.", [
        { label:"Open work order", run:() => openWorkOrderDetail(saved.id) }
      ]);
      addOperationalNotification?.({ type:"work_created", title:"Scheduled work became active work", detail:task.name || "A linked work order was created.", view:"workOrderDetail", recordId:saved.id, role:"operations" });
      openWorkOrderDetail(saved.id);
    } else {
      setStatus("Linked work order queued until connection returns");
    }
  }catch(err){ handleWriteError(err); }
}

async function createSupplyRequestFromScheduledTask(taskId){
  if(!requireInsertPermission("field_ops_import_reviews", "create a supply or purchase request")) return;
  const task = scheduledTaskById(taskId);
  if(!task) return;
  const existing = linkedSupplyRequestForScheduledTask(task);
  if(existing){
    showView("importReview");
    setStatus("Supply request already exists in Needs Review");
    return;
  }
  try{
    const title = `Supplies for ${task.name || "scheduled work"}`;
    const proposedData = {
      title,
      work_order_id:task.id,
      scheduled_task_id:task.id,
      approval_status:"needs_review",
      line_items:[{
        description:`Supplies/materials for ${task.name || "scheduled work"}`,
        quantity:1,
        unit:"request",
        estimated_unit_cost:0,
        estimated_total:0,
        actual_cost:null,
        approval_status:"needs_review"
      }],
      estimated_total:0,
      notes:scheduledTaskContextNotes(task)
    };
    const review = await createImportReview("scheduled work", "materials", proposedData, `Review supply request from scheduled task: ${task.name || "Scheduled work"}`);
    if(review?.id && !review?._queued){
      await updateRecord("field_ops_work_orders", task.id, {
        notes:appendHistory(task.notes, `Linked supply request: ${review.id}`)
      });
    }
    setStatus("Supply request sent to Needs Review");
    InteractionService?.showConfirmation?.("Supply request sent", "It is waiting in Needs Review before becoming official work.", [
      { label:"Open Needs Review", run:() => showView("importReview") }
    ]);
    addOperationalNotification?.({ type:"supply_submitted", title:"Supply request sent", detail:title, view:"importReview", recordId:review?.id || "", role:"operations" });
    showView("importReview");
  }catch(err){ handleWriteError(err); }
}

async function addNoteToScheduledTask(taskId){
  if(!requireUpdatePermission("field_ops_work_orders", "add a note to scheduled work")) return;
  const task = scheduledTaskById(taskId);
  if(!task) return;
  const note = prompt("Add a note for this scheduled task");
  if(!note?.trim()) return;
  try{
    await updateRecord("field_ops_work_orders", task.id, {
      notes:appendHistory(task.notes, note.trim())
    });
    setStatus("Scheduled task note saved");
  }catch(err){ handleWriteError(err); }
}

function uploadDocumentForScheduledTask(taskId){
  const task = scheduledTaskById(taskId);
  if(!task) return;
  openUploadFile();
  setTimeout(() => {
    const connectionField = document.getElementById("uploadConnection");
    const recordField = document.getElementById("uploadConnectionRecord");
    const workOrderField = document.getElementById("fileWorkOrder");
    const buildingField = document.getElementById("fileBuilding");
    const spaceField = document.getElementById("fileSpace");
    const assetField = document.getElementById("fileAsset");
    const vehicleField = document.getElementById("fileVehicle");
    const notesField = document.getElementById("fileNotes");
    if(connectionField){
      connectionField.value = "work_order";
      connectionField.dispatchEvent(new Event("change"));
    }
    if(recordField){
      recordField.value = task.id;
      recordField.dispatchEvent(new Event("change"));
    }
    if(workOrderField) workOrderField.value = task.id;
    if(buildingField && task.buildingId) buildingField.value = task.buildingId;
    if(spaceField && task.spaceId) spaceField.value = task.spaceId;
    if(assetField && task.assetId) assetField.value = task.assetId;
    if(vehicleField && task.vehicleId) vehicleField.value = task.vehicleId;
    if(notesField && !notesField.value) notesField.value = `Related scheduled work: ${task.name || "Scheduled work"}\nScheduled task id: ${task.id}`;
  }, 0);
  setStatus("Upload will link to the scheduled task context");
}



function workOrderCardWithActions(t){
  if(!canManageOperations()) return workOrderCard(t);
  const index = app.tasks.indexOf(t);
  return `${workOrderCard(t)}<div class="actions no-print"><button type="button" onclick="openWorkOrderDetail('${t.id}')">Open</button><button class="ghost" type="button" onclick="openEditModal('tasks',${index})">Edit</button><button class="ghost" type="button" onclick="deleteItem('tasks',${index})">Archive this task</button></div>`;
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


function recurringPatternForWorkOrder(task){
  const words = String([task.name, task.type, task.location, task.notes].filter(Boolean).join(" ")).toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 4 && !["scheduled","complete","normal","priority","assigned","marked","source"].includes(word));
  const uniqueWords = Array.from(new Set(words)).slice(0, 8);
  const related = activeItems("tasks").filter(item => {
    if(item.id === task.id) return false;
    if(task.assetId && item.assetId === task.assetId) return true;
    if(task.vehicleId && item.vehicleId === task.vehicleId) return true;
    const haystack = String([item.name, item.type, item.location, item.notes].filter(Boolean).join(" ")).toLowerCase();
    return uniqueWords.some(word => haystack.includes(word));
  }).slice(0, 6);
  return related;
}



async function archiveWorkOrderById(workOrderId){
  if(!requireOperationsPermission("move work orders out of active work")) return;
  const ok = await InteractionService?.showConfirmDialog?.({
    title:"Archive this task?",
    detail:"It will leave the active work list, but the record will stay in history.",
    reassurance:"You can restore it later from Inactive Work Orders.",
    confirmLabel:"Archive task",
    cancelLabel:"Keep active",
    tone:"danger"
  });
  if(!ok) return;
  try{
    await archiveRecord("field_ops_work_orders", workOrderId);
    if(selectedWorkOrderId === workOrderId) selectedWorkOrderId = "";
    InteractionService?.showConfirmation?.("Task archived", "It left the active work list and can be restored from Inactive Work Orders.");
    showView("workOrders", { skipHistory:true });
  }catch(err){
    console.error(err);
    setWorkOrderDetailState(`Could not archive this task: ${err.message}`, "failed");
    setStatus("Archive failed");
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
  const recurringPattern = recurringPatternForWorkOrder(task);
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
    <section class="detail-block operational-memory-note">
      <p><strong>This record is part of the operational memory.</strong> Notes, files, related objects, and completed work stay connected here so the story is not lost.</p>
    </section>
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
      <details class="object-story">
        <summary>Recurring pattern check</summary>
        <div class="timeline compact-timeline">
          ${recurringPattern.length ? recurringPattern.map(item => `<article class="timeline-item"><strong>${esc(item.name || "Related work")}</strong><p>${esc([titleize(item.status), item.date, item.location].filter(Boolean).join(" | "))}</p></article>`).join("") : empty("No similar prior work stands out yet.")}
        </div>
      </details>
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
    if(error) throw withWorkspaceCallDetails(error, "field_ops_work_orders", "update completion", payload);
    if(!data) throw withWorkspaceCallDetails(new Error("No row was updated. This usually means permissions blocked the update, the record is archived, or the workspace did not match."), "field_ops_work_orders", "update completion", payload);
    setWorkOrderDetailState("Complete saved", "saved");
    InteractionService?.showConfirmation?.("Work completed", task.vehicleId ? "Vehicle work is complete. Upload a receipt, photo, or service document if you have one." : "This task was marked complete and kept in the work history.", [
      { label:"Upload proof", run:() => uploadDocumentForScheduledTask(task.id) }
    ]);
    addOperationalNotification?.({ type:"work_completed", title:"Work completed", detail:task.name || "A work order was completed.", view:"workOrderDetail", recordId:task.id, role:"all" });
    if(task.vehicleId){
      InteractionService?.showWorkflowPrompt?.({
        key:`vehicle-service:${task.id}`,
        title:"Update the service record?",
        detail:"Vehicle work is complete. Check the next service date, odometer, or receipt while it is fresh.",
        actions:[{ label:"Open vehicle", run:() => showView("vehicles") }]
      });
    } else if(isScheduledWorkOrder(task)){
      InteractionService?.showWorkflowPrompt?.({
        key:`scheduled-followup:${task.id}`,
        title:"Schedule follow-up?",
        detail:"If this recurring task needs another visit, keep the next step connected.",
        actions:[{ label:"Open Scheduled Work", run:() => showView("scheduledWork") }]
      });
    }
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
    if(workOrderResult.error) throw withWorkspaceCallDetails(workOrderResult.error, "field_ops_work_orders", "update detail", workOrderPayload);
    if(!workOrderResult.data) throw withWorkspaceCallDetails(new Error("No row was updated. This usually means permissions blocked the update, the record is archived, or the workspace did not match."), "field_ops_work_orders", "update detail", workOrderPayload);
    savedWorkOrder = true;
    if(existingDocumentId){
      const documentPayload = { work_order_id: task.id };
      setWorkOrderDetailState("Linking document...", "pending");
      const documentResult = await updateRow("field_ops_documents", existingDocumentId, documentPayload, workspaceId());
      if(documentResult.error) throw withWorkspaceCallDetails(documentResult.error, "field_ops_documents", "link document", documentPayload);
      if(!documentResult.data) throw withWorkspaceCallDetails(new Error("No document row was updated. This usually means permissions blocked the update, the document is archived, or the workspace did not match."), "field_ops_documents", "link document", documentPayload);
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
    InteractionService?.showConfirmation?.("Work order saved", "Your update was saved to the shared workspace.");
    if(assignedChanged && assignee){
      addOperationalNotification?.({ type:"work_assigned", title:"Work assigned", detail:`${task.name || "Work order"} assigned to ${assignee}.`, view:"workOrderDetail", recordId:task.id, role:"all" });
    }
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

function withWorkspaceCallDetails(error, table, action, payload){
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
    renderAssignedWork,
    setAssignedWorkFilter,
    handleAssignedWorkSearch,
    openAssignedWorkItem,
    completeAssignedWorkItem,
    addAssignedWorkNote,
    viewAssignedWorkDocuments,
    viewLinkedScheduledTask,
    createWorkOrderFromScheduledTask,
    createSupplyRequestFromScheduledTask,
    addNoteToScheduledTask,
    uploadDocumentForScheduledTask,
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
    renderAssignedWork,
    setAssignedWorkFilter,
    handleAssignedWorkSearch,
    openAssignedWorkItem,
    completeAssignedWorkItem,
    addAssignedWorkNote,
    viewAssignedWorkDocuments,
    viewLinkedScheduledTask,
    createWorkOrderFromScheduledTask,
    createSupplyRequestFromScheduledTask,
    addNoteToScheduledTask,
    uploadDocumentForScheduledTask,
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

