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
    const reviewItems = helpers.activeItems("submissions").filter(s => s.status === "Needs Review");
    return {
      urgentTasks: openTasks.filter(t => ["urgent","high"].includes(t.priority)),
      dueToday: openTasks.filter(t => t.date === today),
      overdue: openTasks.filter(t => t.date && t.date < today).sort((a,b) => String(a.date).localeCompare(String(b.date))),
      thisWeek: openTasks.filter(t => t.date && t.date > today && t.date <= weekEndString).sort((a,b) => String(a.date).localeCompare(String(b.date))),
      recentlyCompleted: activeTasks.filter(t => t.status === "complete").sort((a,b) => String(dateValue(b)).localeCompare(String(dateValue(a)))).slice(0,5),
      activeProjects: helpers.activeItems("projects").filter(p => p.status !== "complete"),
      openBids: helpers.activeItems("bids").filter(b => !["approved","rejected","paid"].includes(b.status)),
      blockedTasks: openTasks.filter(t => ["waiting","blocked"].includes(String(t.status || "").toLowerCase())),
      fleetAlerts: state.vehicleAlerts || [],
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

  function renderMiniItem(item, helpers, type){
    const title = item.name || item.title || item.fileName || item.vendor || "Untitled";
    const detail = compact([item.location, item.category, item.status, item.priority, item.fileType, item.date]).slice(0, 3);
    return helpers.card(title, detail, [type], helpers.tone(item.priority || item.status));
  }

  function getRecentActivity(state, helpers){
    return [
      ...helpers.activeItems("tasks").map(item => ({...item, _type:"Work order"})),
      ...helpers.activeItems("files").map(item => ({...item, _type:"Document"})),
      ...helpers.activeItems("submissions").map(item => ({...item, _type:"Review"})),
      ...helpers.activeItems("vehicles").map(item => ({...item, _type:"Vehicle"})),
      ...helpers.activeItems("assets").map(item => ({...item, _type:"Asset"}))
    ].sort((a,b) => String(dateValue(b)).localeCompare(String(dateValue(a)))).slice(0, 5);
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
    document.getElementById("dailyRhythmLines").innerHTML = [
      todayState.reviewCount ? `${todayState.reviewCount} waiting in Needs Review.` : "No pending review items.",
      todayState.overdue.length ? `${todayState.overdue.length} overdue item${todayState.overdue.length === 1 ? "" : "s"}.` : "Nothing overdue.",
      todayState.dueToday.length ? `${todayState.dueToday.length} due today.` : "Nothing due today.",
      todayState.fleetAlerts.length ? `${todayState.fleetAlerts.length} vehicle alert${todayState.fleetAlerts.length === 1 ? "" : "s"}.` : "Fleet is quiet."
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
      todayState.dueToday.length,
      todayState.overdue.length,
      todayState.thisWeek.length,
      todayState.fleetAlerts.length
    ];
    const quietBuckets = attentionBuckets.filter(count => !count).length;
    const priorityCounts = {
      todayReviewCount: todayState.reviewCount,
      todayOverdueCount: todayState.overdue.length,
      todayDueCount: todayState.dueToday.length,
      todayFleetCount: todayState.fleetAlerts.length,
      todayWeekCount: todayState.thisWeek.length,
      todayCompletedCount: todayState.recentlyCompleted.length,
      todayUrgentCount: todayState.urgentTasks.length,
      todayBlockedCount: todayState.blockedTasks.length,
      todayClearCount: quietBuckets,
      todayVendorCount: todayState.activeProjects.length + todayState.openBids.length
    };
    Object.entries(priorityCounts).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el) el.textContent = value;
    });
    const clearLabel = document.getElementById("todayClearLabel");
    if(clearLabel) clearLabel.textContent = quietBuckets === attentionBuckets.length ? "No active pressure points" : `${quietBuckets} quiet area${quietBuckets === 1 ? "" : "s"}`;

    const todayReviewList = document.getElementById("todayReviewList");
    if(todayReviewList) todayReviewList.innerHTML = todayState.reviewItems.length ? todayState.reviewItems.slice(0,5).map(item => renderMiniItem(item, helpers, "Needs Review")).join("") : helpers.empty("No pending review items.");
    const dueTodayList = document.getElementById("dueTodayList");
    if(dueTodayList) dueTodayList.innerHTML = todayState.dueToday.length ? todayState.dueToday.slice(0,5).map(t => helpers.workOrderCardWithActions(t)).join("") : helpers.empty("Nothing due today.");
    const overdueList = document.getElementById("overdueList");
    if(overdueList) overdueList.innerHTML = todayState.overdue.length ? todayState.overdue.slice(0,5).map(t => helpers.workOrderCardWithActions(t)).join("") : helpers.empty("Nothing overdue.");
    document.getElementById("weekList").innerHTML = todayState.thisWeek.length ? todayState.thisWeek.slice(0,5).map(t => helpers.workOrderCardWithActions(t)).join("") : helpers.empty("No upcoming work this week.");
    document.getElementById("fleetAlertList").innerHTML = todayState.fleetAlerts.length ? todayState.fleetAlerts.slice(0,5).map(helpers.renderVehicleAlertCard).join("") : helpers.empty("No active fleet alerts.");
    const recentCompletedList = document.getElementById("recentCompletedList");
    if(recentCompletedList) recentCompletedList.innerHTML = todayState.recentlyCompleted.length ? todayState.recentlyCompleted.slice(0,5).map(t => helpers.workOrderCardWithActions(t)).join("") : helpers.empty("No completed work yet.");
    document.getElementById("activeProjectList").innerHTML = todayState.activeProjects.length ? todayState.activeProjects.slice(0,5).map(helpers.projectCard).join("") : helpers.empty("No active projects.");
    document.getElementById("dashboardBidList").innerHTML = todayState.openBids.length ? todayState.openBids.slice(0,5).map(helpers.bidCard).join("") : helpers.empty("No open bids.");

    document.querySelectorAll("[data-hide-when-empty]").forEach(panel => {
      const key = panel.dataset.hideWhenEmpty;
      const count = key === "review" ? todayState.reviewCount :
        key === "dueToday" ? todayState.dueToday.length :
        key === "overdue" ? todayState.overdue.length :
        key === "thisWeek" ? todayState.thisWeek.length :
        key === "fleet" ? todayState.fleetAlerts.length :
        key === "recent" ? todayState.recentlyCompleted.length : 1;
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

