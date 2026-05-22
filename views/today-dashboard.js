(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};

  function getNeedsAttentionToday(state, helpers){
    const today = helpers.todayString();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndString = weekEnd.toISOString().slice(0,10);
    const activeTasks = helpers.activeItems("tasks");
    const openTasks = activeTasks.filter(t => t.status !== "complete");
    const operationalOpenTasks = openTasks.filter(t => !isScheduledWork(t));
    const reviewItems = helpers.activeItems("submissions").filter(s => s.status === "Needs Review");
    const urgentTasks = operationalOpenTasks.filter(t => ["urgent","high"].includes(t.priority));
    const dueToday = operationalOpenTasks.filter(t => t.date === today);
    const overdue = operationalOpenTasks.filter(t => t.date && t.date < today).sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const thisWeek = operationalOpenTasks.filter(t => t.date && t.date > today && t.date <= weekEndString).sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const blockedTasks = operationalOpenTasks.filter(t => ["waiting","blocked"].includes(String(t.status || "").toLowerCase()));
    const urgentDue = uniqueById([...blockedTasks, ...urgentTasks, ...overdue, ...dueToday]);
    const assignedWork = openTasks
      .filter(t => t.assignedTo || assignedFromNotes(t.notes))
      .sort((a,b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")));
    const assignedToday = assignedWork.filter(t => !t.date || t.date <= weekEndString);
    const scheduledUpcoming = openTasks
      .filter(t => isScheduledWork(t) && t.date && t.date >= today && t.date <= weekEndString)
      .sort((a,b) => String(a.date).localeCompare(String(b.date)));
    return {
      urgentTasks,
      dueToday,
      overdue,
      thisWeek,
      blockedTasks,
      urgentDue,
      assignedWork,
      assignedToday,
      scheduledUpcoming,
      recentlyCompleted: activeTasks.filter(t => t.status === "complete").sort((a,b) => String(dateValue(b)).localeCompare(String(dateValue(a)))).slice(0,5),
      activeProjects: helpers.activeItems("projects").filter(p => p.status !== "complete"),
      openBids: helpers.activeItems("bids").filter(b => !["approved","rejected","paid"].includes(b.status)),
      fleetAlerts: state.vehicleAlerts || [],
      recentActivity:getRecentActivity(state, helpers),
      reviewItems,
      reviewCount: reviewItems.length
    };
  }

  function compact(items){
    return items.filter(Boolean);
  }

  function dateValue(item){
    return item.updatedAt || item.createdAt || item.date || item.submittedAt || "";
  }

  function activityDateValue(item){
    return item.updatedAt || item.createdAt || item.submittedAt || "";
  }

  function assignedFromNotes(notes){
    const match = String(notes || "").match(/(?:^|\n)Assigned:\s*([^\n]+)/i);
    return match ? match[1].trim() : "";
  }

  function isScheduledWork(item){
    const haystack = [
      item.type,
      item.status,
      item.location,
      item.notes,
      item.name,
      item.title
    ].join(" ").toLowerCase();
    return haystack.includes("master import key:") ||
      haystack.includes("scheduled from master calendar") ||
      haystack.includes("recurring template") ||
      haystack.includes("fleet recurring schedule item") ||
      haystack.includes("source: recurring schedule");
  }

  function uniqueById(items){
    const seen = new Set();
    return items.filter(item => {
      const key = item.id || `${item.name || item.title}-${item.date || ""}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderMiniItem(item, helpers, type){
    const title = item.name || item.title || item.fileName || item.vendor || "Untitled";
    const detail = compact([item.location, item.category, item.fileType, item.date]).slice(0, 2);
    return helpers.card(title, detail, [type], helpers.tone(item.priority || item.status));
  }

  function workAnchor(task, state){
    const asset = state.assets.find(a => a.id === task.assetId);
    const vehicle = state.vehicles.find(v => v.id === task.vehicleId);
    const space = state.spaces.find(s => s.id === task.spaceId);
    const building = state.buildings.find(b => b.id === task.buildingId);
    const project = state.projects.find(p => p.id === task.projectId);
    return asset ? `Asset: ${asset.name}` :
      vehicle ? `Vehicle: ${vehicle.name}` :
      space ? `Space: ${space.name}` :
      building ? `Building: ${building.name}` :
      project ? `Project: ${project.name}` :
      task.location || "";
  }

  function renderTodayWorkCard(task, state, helpers){
    const status = task.status || "open";
    const priority = task.priority || "normal";
    const due = task.date ? `Due ${task.date}` : "No due date";
    const anchor = workAnchor(task, state);
    const completeAction = String(status).toLowerCase() === "complete"
      ? ""
      : `<button class="ghost" type="button" onclick="markWorkOrderComplete('${helpers.esc(task.id)}')" aria-label="Complete ${helpers.esc(task.name || "work order")}">Complete</button>`;
    return `<article class="today-work-card ${helpers.tone(priority || status)}">
      <div class="today-work-main">
        <h4>${helpers.esc(task.name || "Untitled work")}</h4>
        <div class="today-work-meta">
          <span>${helpers.esc(titleize(status))}</span>
          <span>${helpers.esc(titleize(priority))}</span>
          <span>${helpers.esc(due)}</span>
          ${anchor ? `<span>${helpers.esc(anchor)}</span>` : ""}
        </div>
      </div>
      <div class="today-work-actions no-print">
        ${completeAction}
        <button type="button" onclick="openWorkOrderDetail('${helpers.esc(task.id)}')" aria-label="Open ${helpers.esc(task.name || "work order")}">Open</button>
      </div>
    </article>`;
  }

  function renderTodayWorkList(items, state, helpers, emptyMessage){
    return items.length
      ? items.slice(0, 5).map(item => renderTodayWorkCard(item, state, helpers)).join("")
      : helpers.empty(emptyMessage);
  }

  function plural(count, one, many){
    return `${count} ${count === 1 ? one : many}`;
  }

  function namedPriorityLine(items, fallback, suffix){
    if(!items.length) return fallback;
    const first = items[0];
    const title = first.name || first.title || first.fileName || "One item";
    return `${title}${suffix ? ` ${suffix}` : ""}${items.length > 1 ? `, plus ${plural(items.length - 1, "more item", "more items")}` : ""}.`;
  }

  function getRecentActivity(state, helpers){
    return [
      ...helpers.activeItems("tasks").map(item => ({...item, _type:"Work order"})),
      ...helpers.activeItems("files").map(item => ({...item, _type:"Document"})),
      ...helpers.activeItems("submissions").map(item => ({...item, _type:"Review"})),
      ...helpers.activeItems("vehicles").map(item => ({...item, _type:"Vehicle"})),
      ...helpers.activeItems("assets").map(item => ({...item, _type:"Asset"}))
    ].filter(activityDateValue).sort((a,b) => String(activityDateValue(b)).localeCompare(String(activityDateValue(a)))).slice(0, 5);
  }

  function getCalendarItems(state, helpers){
    const items = [];
    helpers.activeItems("tasks").forEach(t => { if(t.date) items.push({date:t.date,title:t.name,type:"Work order",detail:t.workOrderNumber,tone:helpers.tone(t.priority)}); });
    helpers.activeItems("projects").forEach(p => { if(p.date) items.push({date:p.date,title:p.name,type:"Project target",detail:p.summary,tone:helpers.tone(p.priority)}); });
    helpers.activeItems("vehicles").forEach(v => {
      if(v.serviceDate) items.push({date:v.serviceDate,title:`${v.name} service`,type:"Fleet service",detail:v.plate,tone:helpers.tone(v.status)});
      if(v.registration) items.push({date:v.registration,title:`${v.name} registration`,type:"Fleet registration",detail:v.plate,tone:helpers.tone(v.status)});
    });
    return items.sort((a,b) => a.date.localeCompare(b.date));
  }

  function render(state, helpers){
    const todayState = getNeedsAttentionToday(state, helpers);
    const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
    document.getElementById("dailyGreeting").textContent = `${greeting}${state.settings.userDisplayName ? `, ${state.settings.userDisplayName}` : ""}.`;
    const pressureCount = todayState.reviewCount + todayState.overdue.length + todayState.dueToday.length + todayState.fleetAlerts.length;
    document.getElementById("dailyRhythmLines").innerHTML = [
      pressureCount ? `${plural(pressureCount, "thing", "things")} deserve attention today.` : "All clear for the daily rhythm.",
      todayState.reviewCount ? `${plural(todayState.reviewCount, "approval", "approvals")} waiting.` : "No approvals waiting.",
      namedPriorityLine(todayState.dueToday, "No tasks due today.", "is due today"),
      todayState.overdue.length ? namedPriorityLine(todayState.overdue, "", "is overdue") : "No overdue work.",
      todayState.fleetAlerts.length ? namedPriorityLine(todayState.fleetAlerts, "", "needs a fleet check") : "No urgent fleet issues."
    ].filter(Boolean).map(line => `<p>${helpers.esc(line)}</p>`).join("");

    document.getElementById("reviewQueueCount").textContent = `${todayState.reviewCount} waiting`;
    document.getElementById("workspaceProjectCount").textContent = `${todayState.activeProjects.length} active`;
    document.getElementById("workspaceMaintenanceCount").textContent = `${todayState.dueToday.length} due today`;
    document.getElementById("workspaceFleetCount").textContent = `${todayState.fleetAlerts.length} to check`;
    document.getElementById("workspaceFuelCount").textContent = `${helpers.activeItems("fuelReceipts").length} receipts`;
    document.getElementById("workspaceBidCount").textContent = `${todayState.openBids.length} open`;
    document.getElementById("workspaceFileCount").textContent = `${helpers.activeItems("files").length} linked`;
    document.getElementById("workspaceCalendarCount").textContent = `${todayState.thisWeek.length} this week`;
    document.getElementById("urgentCount").textContent = todayState.urgentTasks.length;
    document.getElementById("projectCount").textContent = todayState.activeProjects.length;
    document.getElementById("bidCount").textContent = todayState.openBids.length;
    const attentionBuckets = [
      todayState.reviewCount,
      todayState.overdue.length,
      todayState.dueToday.length,
      todayState.thisWeek.length,
      todayState.fleetAlerts.length,
      todayState.recentlyCompleted.length,
      todayState.recentActivity.length
    ];
    const quietBuckets = attentionBuckets.filter(count => !count).length;
    const priorityCounts = {
      todayReviewCount: todayState.reviewCount,
      todayOverdueCount: todayState.overdue.length,
      todayDueCount: todayState.assignedToday.length || todayState.dueToday.length,
      todayUrgentDueCount: todayState.urgentDue.length,
      todayFleetCount: todayState.fleetAlerts.length,
      todayWeekCount: todayState.thisWeek.length,
      todayCompletedCount: todayState.recentlyCompleted.length,
      todayScheduledCount: todayState.scheduledUpcoming.length,
      todayAssignedCount: todayState.assignedToday.length,
      todayRecentCount: todayState.recentActivity.length,
      todayUrgentCount: todayState.urgentTasks.length,
      todayBlockedCount: todayState.blockedTasks.length,
      todayClearCount: quietBuckets,
      todayVendorCount: todayState.activeProjects.length + todayState.openBids.length
    };
    const calmCount = value => value ? String(value) : "All clear";
    Object.entries(priorityCounts).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el) el.textContent = ["todayReviewCount","todayOverdueCount","todayDueCount","todayFleetCount"].includes(id) ? calmCount(value) : value;
    });
    const scheduledSummary = document.getElementById("todayScheduledSummary");
    if(scheduledSummary) scheduledSummary.textContent = `Recurring work this week: ${todayState.scheduledUpcoming.length}`;
    const clearLabel = document.getElementById("todayClearLabel");
    if(clearLabel) clearLabel.textContent = quietBuckets === attentionBuckets.length ? "No active pressure points" : `${quietBuckets} quiet area${quietBuckets === 1 ? "" : "s"}`;

    const todayReviewList = document.getElementById("todayReviewList");
    if(todayReviewList) todayReviewList.innerHTML = todayState.reviewItems.length ? todayState.reviewItems.slice(0,5).map(item => renderMiniItem(item, helpers, "Needs Review")).join("") : helpers.empty("No pending review items.");
    const urgentDueList = document.getElementById("urgentDueList");
    if(urgentDueList) urgentDueList.innerHTML = renderTodayWorkList(todayState.urgentDue, state, helpers, "Nothing urgent right now.");
    const dueTodayList = document.getElementById("dueTodayList");
    if(dueTodayList) dueTodayList.innerHTML = renderTodayWorkList(todayState.dueToday, state, helpers, "Nothing due today.");
    const overdueList = document.getElementById("overdueList");
    if(overdueList) overdueList.innerHTML = renderTodayWorkList(todayState.overdue, state, helpers, "Nothing overdue.");
    const weekList = document.getElementById("weekList");
    if(weekList) weekList.innerHTML = renderTodayWorkList(todayState.thisWeek, state, helpers, "No upcoming work this week.");
    const fleetAlertList = document.getElementById("fleetAlertList");
    if(fleetAlertList) fleetAlertList.innerHTML = todayState.fleetAlerts.length ? todayState.fleetAlerts.slice(0,5).map(helpers.renderVehicleAlertCard).join("") : helpers.empty("No active fleet alerts.");
    const todayAssignedList = document.getElementById("todayAssignedList");
    if(todayAssignedList) todayAssignedList.innerHTML = renderTodayWorkList(todayState.assignedToday, state, helpers, "No assigned work waiting.");
    const scheduledTodayList = document.getElementById("scheduledTodayList");
    if(scheduledTodayList) scheduledTodayList.innerHTML = renderTodayWorkList(todayState.scheduledUpcoming, state, helpers, "No scheduled work this week.");
    const recentActivityList = document.getElementById("recentActivityList");
    if(recentActivityList) recentActivityList.innerHTML = todayState.recentActivity.length ? todayState.recentActivity.slice(0,5).map(item => renderMiniItem(item, helpers, item._type || "Updated")).join("") : helpers.empty("No recent changes yet.");
    const recentCompletedList = document.getElementById("recentCompletedList");
    if(recentCompletedList) recentCompletedList.innerHTML = renderTodayWorkList(todayState.recentlyCompleted, state, helpers, "No completed work yet.");
    const activeProjectList = document.getElementById("activeProjectList");
    if(activeProjectList) activeProjectList.innerHTML = todayState.activeProjects.length ? todayState.activeProjects.slice(0,5).map(helpers.projectCard).join("") : helpers.empty("No active projects.");
    const dashboardBidList = document.getElementById("dashboardBidList");
    if(dashboardBidList) dashboardBidList.innerHTML = todayState.openBids.length ? todayState.openBids.slice(0,5).map(helpers.bidCard).join("") : helpers.empty("No open bids.");

    document.querySelectorAll("[data-hide-when-empty]").forEach(panel => {
      const key = panel.dataset.hideWhenEmpty;
      const count = key === "review" ? todayState.reviewCount :
        key === "dueToday" ? todayState.dueToday.length :
        key === "overdue" ? todayState.overdue.length :
        key === "urgentDue" ? todayState.urgentDue.length :
        key === "assigned" ? todayState.assignedToday.length :
        key === "scheduled" ? todayState.scheduledUpcoming.length :
        key === "thisWeek" ? todayState.thisWeek.length :
        key === "fleet" ? todayState.fleetAlerts.length :
        key === "completed" ? todayState.recentlyCompleted.length :
        key === "recent" ? todayState.recentActivity.length : 1;
      panel.classList.toggle("hidden", !count);
    });
  }

  function renderCalendar(state, helpers){
    const target = document.getElementById("calendarList");
    if(!target) return;
    const items = getCalendarItems(state, helpers);
    const today = helpers.todayString();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndString = weekEnd.toISOString().slice(0,10);
    document.getElementById("calendarTodayCount").textContent = items.filter(i => i.date === today).length;
    document.getElementById("calendarWeekCount").textContent = items.filter(i => i.date >= today && i.date <= weekEndString).length;
    document.getElementById("calendarTotalCount").textContent = items.length;
    target.innerHTML = items.length ? items.map(i => helpers.card(i.title,[i.detail],[i.type,i.date],i.tone)).join("") : helpers.empty("No dated work yet.");
  }

  window.FieldOps.Views.TodayDashboard = {
    render,
    renderCalendar,
    getCalendarItems,
    getRecentActivity,
    getNeedsAttentionToday
  };

  globalThis.renderCalendar = function(){
    window.FieldOps.Views.TodayDashboard.renderCalendar(globalThis.app, globalThis.createViewHelpers());
  };
})();

