(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;
  const ImportReviewService = window.FieldOps.Services.importReview;
  const BULK_REVIEW_LIMIT = 40;
  const CONVERSATION_KEY = "field_ops_conversation_intake_v2";
  const conversationSteps = ["welcome", "category", "detail", "description", "photos", "location", "urgency", "review"];
  let conversationIndex = 0;

  const CATEGORY_OPTIONS = [
    ["Building", "Doors, rooms, heat, leaks, or facility issues.", "🏠"],
    ["Kitchen / Equipment", "Freezers, sinks, appliances, hood, or prep areas.", "🍳"],
    ["Vehicle", "Vans, trucks, mileage, plates, service, or damage.", "🚐"],
    ["Cleaning", "Spills, trash, supplies, or cleanup needs.", "🧹"],
    ["Safety", "Trip hazards, blocked access, urgent concerns.", "⚠️"],
    ["Supplies / Materials", "Materials, event needs, gifts, or purchases.", "📦"],
    ["Something unusual happened", "Use when it does not fit anywhere else.", "❓"]
  ];

  const DETAIL_OPTIONS = {
    "Building": [
      ["Plumbing", "Leaks, drains, water pressure, fixtures", "💧"],
      ["Electrical", "Outlets, lights, panels, or power", "⚡"],
      ["HVAC", "Heat, cooling, or ventilation", "❄️"],
      ["General maintenance", "Doors, walls, locks, or general repair", "🔧"],
      ["Other", "Something else in the building", "➕"]
    ],
    "Kitchen / Equipment": [
      ["Not cooling / heating", "Fridge, freezer, oven, or warmer trouble", "🧊"],
      ["Leak or water issue", "Sink, drain, or standing water", "💧"],
      ["Broken equipment", "Appliance or fixture not working", "🔧"],
      ["Cleaning / sanitation", "Cleanup or prep-area issue", "🧽"],
      ["Other", "Another kitchen or equipment issue", "➕"]
    ],
    "Vehicle": [
      ["Won't start / drive issue", "Vehicle may not be safe to use", "🚫"],
      ["Warning light or noise", "Needs inspection soon", "⚠️"],
      ["Body / interior damage", "Dents, glass, or interior issue", "💥"],
      ["Service or registration", "Maintenance, tags, or paperwork", "📅"],
      ["Other", "Another vehicle issue", "➕"]
    ],
    "Cleaning": [
      ["Spill or mess", "Needs cleanup now", "🧹"],
      ["Trash / supplies", "Bins, bags, or stock", "🗑️"],
      ["Scheduled cleaning help", "Extra cleanup support", "📋"],
      ["Other", "Another cleaning need", "➕"]
    ],
    "Safety": [
      ["Trip / fall hazard", "Floor, steps, or walkway", "⚠️"],
      ["Blocked access", "Door, exit, or path blocked", "🚧"],
      ["Fire / electrical concern", "Needs immediate review", "🔥"],
      ["Other", "Another safety concern", "➕"]
    ],
    "Supplies / Materials": [
      ["Need to order supplies", "Materials or consumables", "📦"],
      ["Need approval first", "Review before purchasing", "✅"],
      ["Not sure how to route", "Team can help place it", "❓"]
    ],
    "Something unusual happened": [
      ["Needs a human review", "Hard to categorize", "👀"],
      ["Might be urgent", "Could affect operations", "⚡"],
      ["Not sure yet", "That is okay", "❓"]
    ]
  };

  const PLUMBING_DETAILS = [
    ["Leak", "Water dripping or pooling"],
    ["Clog / drain issue", "Slow or blocked drain"],
    ["Broken fixture", "Sink, toilet, or faucet"],
    ["No water / low pressure", "Water not flowing normally"],
    ["Other", "Another plumbing issue"]
  ];

function conversationDraft(){
  try{ return JSON.parse(localStorage.getItem(CONVERSATION_KEY) || "{}"); }catch(_err){ return {}; }
}

function saveConversationDraft(patch){
  const next = { ...conversationDraft(), ...patch };
  try{ localStorage.setItem(CONVERSATION_KEY, JSON.stringify(next)); }catch(_err){}
  syncConversationToForm(next);
  renderConversationIntake();
}

function clearConversationDraft(){
  try{ localStorage.removeItem(CONVERSATION_KEY); }catch(_err){}
  conversationIndex = 0;
}

function urgencyForStorage(priority){
  const map = { Low:"Normal", Medium:"Normal", High:"High", Urgent:"Urgent", Normal:"Normal" };
  return map[priority] || "Normal";
}

function locationSummary(draft){
  const parts = [draft.buildingName, draft.floor, draft.room, draft.location, draft.object].filter(Boolean);
  return parts.join(" · ") || "";
}

function syncConversationToForm(draft = conversationDraft()){
  const set = (idValue, value) => {
    const el = document.getElementById(idValue);
    if(el && value !== undefined) el.value = value || "";
  };
  set("submissionCategory", draft.category || "Building");
  set("submissionUrgency", urgencyForStorage(draft.urgency || "Medium"));
  set("submissionLocation", locationSummary(draft));
  const detailLine = draft.issueDetail ? `Issue: ${draft.issueDetail}` : "";
  const subtypeLine = draft.issueSubtype ? `Specific issue: ${draft.issueSubtype}` : "";
  set("submissionDescription", [detailLine, subtypeLine, draft.description, draft.impact ? `Operations impact: ${draft.impact}` : ""].filter(Boolean).join("\n"));
  set("submissionSource", "Staff portal");
}

function choiceButton(label, detail, field, value, icon = ""){
  const active = conversationDraft()[field] === value;
  const iconMarkup = icon ? `<span class="conversation-choice-icon" aria-hidden="true">${icon}</span>` : "";
  return `<button class="conversation-choice ${active ? "active" : ""}" type="button" onclick="setConversationAnswer('${field}','${esc(value)}')">${iconMarkup}<span>${esc(label)}</span>${detail ? `<small>${esc(detail)}</small>` : ""}</button>`;
}

function priorityButton(label, detail, value, tone){
  const active = conversationDraft().urgency === value;
  return `<button class="conversation-choice priority-choice priority-${tone} ${active ? "active" : ""}" type="button" onclick="setConversationAnswer('urgency','${esc(value)}')"><span class="priority-dot" aria-hidden="true"></span><span>${esc(label)}</span><small>${esc(detail)}</small></button>`;
}

function reviewRow(label, value, stepName){
  return `<div class="conversation-review-row"><div><strong>${esc(label)}</strong><p>${esc(value || "Not added yet")}</p></div><button class="ghost conversation-edit" type="button" onclick="jumpToConversationStep('${stepName}')">Edit</button></div>`;
}

function conversationBuildingOptions(selected){
  const buildings = typeof activeItems === "function" ? activeItems("buildings") : [];
  const options = [`<option value="">Choose building</option>`].concat(buildings.map(b => `<option value="${esc(b.name)}" ${selected === b.name ? "selected" : ""}>${esc(b.name)}</option>`));
  return options.join("");
}

function conversationSpaceOptions(buildingName, selected){
  const spaces = typeof activeItems === "function" ? activeItems("spaces") : [];
  const building = (typeof app !== "undefined" ? app.buildings : []).find(b => b.name === buildingName);
  const filtered = building ? spaces.filter(s => s.buildingId === building.id) : spaces;
  const options = [`<option value="">Room / area (optional)</option>`].concat(filtered.map(s => `<option value="${esc(s.name)}" ${selected === s.name ? "selected" : ""}>${esc(s.name)}</option>`));
  return options.join("");
}

function updateConversationChrome(step, draft){
  const label = document.getElementById("conversationStepLabel");
  const backBtn = document.getElementById("conversationBackBtn");
  const nextBtn = document.getElementById("conversationNextBtn");
  const trustNote = document.querySelector(".conversation-trust-note");
  if(draft.submitted){
    if(label) label.textContent = "Submitted";
    if(backBtn) backBtn.classList.add("hidden");
    if(nextBtn) nextBtn.classList.add("hidden");
    if(trustNote) trustNote.classList.add("hidden");
    return;
  }
  const numberedSteps = conversationSteps.length - 1;
  const displayIndex = Math.max(1, conversationIndex);
  if(label) label.textContent = step === "welcome" ? "Quick & guided" : `Step ${displayIndex} of ${numberedSteps}`;
  const needsNext = ["description", "photos", "location"].includes(step);
  if(backBtn){
    backBtn.classList.toggle("hidden", step === "welcome");
  }
  if(nextBtn){
    nextBtn.classList.toggle("hidden", !needsNext);
    nextBtn.textContent = step === "photos" ? "Continue" : "Next";
  }
  if(trustNote) trustNote.classList.toggle("hidden", step === "review" || step === "welcome");
}

function renderConversationIntake(){
  const container = document.getElementById("conversationIntake");
  const target = document.getElementById("conversationStep");
  const bar = document.getElementById("conversationProgressBar");
  const form = document.getElementById("submissionForm");
  if(!container || !target || !bar || !form) return;
  const enabled = typeof canSubmitOnly === "function" && canSubmitOnly();
  container.classList.toggle("hidden", !enabled);
  form.classList.toggle("conversation-active", enabled);
  if(!enabled) return;
  const draft = conversationDraft();
  if(draft.submitted){
    syncConversationToForm(draft);
    bar.style.width = "100%";
    updateConversationChrome("done", draft);
    target.innerHTML = `<div class="conversation-done">
      <div class="conversation-done-icon" aria-hidden="true">✓</div>
      <h3>You're all set</h3>
      <p>Your request was sent to the operations team for review.</p>
      <div class="conversation-done-card">
        <strong>Request saved</strong>
        <p>${esc(draft.submittedRef || "We'll review it soon.")}</p>
        <p class="meta">We'll notify you when there is an update.</p>
      </div>
      <div class="conversation-done-actions">
        <button type="button" onclick="finishConversationRequest()">Done</button>
        <button class="ghost" type="button" onclick="startAnotherConversationRequest()">Submit another request</button>
      </div>
    </div>`;
    return;
  }
  syncConversationToForm(draft);
  const step = conversationSteps[conversationIndex] || "category";
  const progressIndex = Math.max(conversationIndex, 0);
  bar.style.width = `${Math.round((progressIndex / (conversationSteps.length - 1)) * 100)}%`;
  updateConversationChrome(step, draft);
  if(step === "welcome"){
    target.innerHTML = `<div class="conversation-welcome">
      <div class="conversation-welcome-icon" aria-hidden="true">🔧</div>
      <h3>Let's create your maintenance request</h3>
      <p>One question at a time. It only takes a couple of minutes.</p>
      <button class="conversation-start" type="button" onclick="nextConversationStep()">Start</button>
      <p class="meta">We'll guide you step by step.</p>
    </div>`;
  }else if(step === "category"){
    target.innerHTML = `<h3>What type of issue are you reporting?</h3><p>Choose the closest match.</p><div class="conversation-choice-grid category-grid">${CATEGORY_OPTIONS.map(([label, detail, icon]) => choiceButton(label, detail, "category", label, icon)).join("")}</div>`;
  }else if(step === "detail"){
    const category = draft.category || "Building";
    const choices = DETAIL_OPTIONS[category] || DETAIL_OPTIONS["Something unusual happened"];
    const plumbingFollowUp = category === "Building" && draft.issueDetail === "Plumbing";
    if(plumbingFollowUp){
      target.innerHTML = `<h3>What's the plumbing issue?</h3><p>This helps the team route it faster.</p><div class="conversation-choice-grid detail-grid">${PLUMBING_DETAILS.map(([label, detail]) => choiceButton(label, detail, "issueSubtype", label)).join("")}</div>`;
    }else{
      target.innerHTML = `<h3>Tell us a little more</h3><p>${esc(category)} — pick the closest issue.</p><div class="conversation-choice-grid detail-grid">${choices.map(([label, detail, icon]) => choiceButton(label, detail, "issueDetail", label, icon)).join("")}</div>`;
    }
  }else if(step === "description"){
    target.innerHTML = `<h3>Can you describe the issue?</h3><p>Any details you add will help us resolve it faster.</p><label class="conversation-field">Description<textarea placeholder="Example: There is a leak under the kitchen sink. It started this morning." oninput="setConversationAnswer('description', this.value, true)">${esc(draft.description || "")}</textarea></label>`;
  }else if(step === "photos"){
    target.innerHTML = `<h3>Add photos (optional)</h3><p>Photos help the operations team understand the issue better.</p>
      <div id="conversationDropZone" class="conversation-drop-zone" tabindex="0" role="button" onclick="document.getElementById('submissionUpload')?.click()">
        <span class="conversation-drop-icon" aria-hidden="true">📷</span>
        <strong>Tap to upload photos</strong>
        <p>or drag and drop a file here</p>
      </div>
      <div id="conversationUploadEcho" class="conversation-upload-echo">${document.getElementById("reviewUploadPreview")?.innerHTML || ""}</div>
      <button class="ghost conversation-skip-upload" type="button" onclick="nextConversationStep()">Skip for now</button>`;
  }else if(step === "location"){
    target.innerHTML = `<h3>Where is the issue located?</h3><p>Pick from the workspace when you can. Free text still works.</p>
      <label class="conversation-field">Building<select onchange="setConversationAnswer('buildingName', this.value, true); renderConversationIntake();">${conversationBuildingOptions(draft.buildingName)}</select></label>
      <label class="conversation-field">Floor (optional)<input value="${esc(draft.floor || "")}" placeholder="1st floor, basement, loading..." oninput="setConversationAnswer('floor', this.value, true)" /></label>
      <label class="conversation-field">Room / area<select onchange="setConversationAnswer('room', this.value, true)">${conversationSpaceOptions(draft.buildingName, draft.room)}</select></label>
      <label class="conversation-field">Extra detail (optional)<input value="${esc(draft.object || "")}" placeholder="Van 2, hallway, loading door..." oninput="setConversationAnswer('object', this.value, true)" /></label>`;
  }else if(step === "urgency"){
    target.innerHTML = `<h3>What's the priority?</h3><p>How urgent is this issue?</p><div class="conversation-choice-grid priority-grid">
      ${priorityButton("Low", "Not urgent", "Low", "low")}
      ${priorityButton("Medium", "Important but not urgent", "Medium", "medium")}
      ${priorityButton("High", "Needs attention soon", "High", "high")}
      ${priorityButton("Urgent", "Critical issue", "Urgent", "urgent")}
    </div>`;
  }else if(step === "review"){
    const photoNote = document.getElementById("reviewUploadPreview")?.textContent?.trim() ? "Photo or file attached" : "No photos added";
    target.innerHTML = `<h3>Review your request</h3><p>Make sure this looks right, then send it for review.</p><div class="conversation-review">
      ${reviewRow("Issue type", draft.category, "category")}
      ${reviewRow("Issue", [draft.issueDetail, draft.issueSubtype].filter(Boolean).join(" — "), "detail")}
      ${reviewRow("Description", draft.description, "description")}
      ${reviewRow("Location", locationSummary(draft), "location")}
      ${reviewRow("Priority", draft.urgency || "Medium", "urgency")}
      ${reviewRow("Photos", photoNote, "photos")}
    </div><button class="conversation-submit" type="button" onclick="submitConversationRequest()">Submit request</button>`;
  }
}

function jumpToConversationStep(stepName){
  const index = conversationSteps.indexOf(stepName);
  if(index >= 0) conversationIndex = index;
  renderConversationIntake();
}

function setConversationAnswer(field, value, quiet = false){
  const draft = conversationDraft();
  const patch = { [field]: value };
  if(field === "category"){
    patch.issueDetail = "";
    patch.issueSubtype = "";
  }
  if(field === "issueDetail" && value !== "Plumbing"){
    patch.issueSubtype = "";
  }
  if(field === "buildingName"){
    patch.room = "";
  }
  if(!quiet && conversationIndex < conversationSteps.length - 1){
    const step = conversationSteps[conversationIndex];
    if(step === "detail" && field === "issueDetail" && value === "Plumbing" && draft.issueDetail !== "Plumbing"){
      saveConversationDraft(patch);
      return;
    }
    conversationIndex += 1;
  }
  saveConversationDraft(patch);
}

function nextConversationStep(){
  if(conversationIndex < conversationSteps.length - 1) conversationIndex += 1;
  renderConversationIntake();
}

function previousConversationStep(){
  const draft = conversationDraft();
  if(draft.submitted) return;
  if(conversationIndex > 0) conversationIndex -= 1;
  renderConversationIntake();
}

function startAnotherConversationRequest(){
  clearConversationDraft();
  conversationIndex = 0;
  renderConversationIntake();
  if(typeof openSubmitRequest === "function") openSubmitRequest();
}

function finishConversationRequest(){
  clearConversationDraft();
  if(typeof openMySubmissions === "function") openMySubmissions();
  else renderConversationIntake();
}

function submitConversationRequest(){
  syncConversationToForm();
  const form = document.getElementById("submissionForm");
  if(!document.getElementById("submissionDescription")?.value.trim()){
    jumpToConversationStep("description");
    setInlineState("submissionSaveState", "Add a short description before sending.", "failed");
    return;
  }
  form?.requestSubmit?.();
}

function importReviewContext(){
  return { app, insertRecord, updateRecord, archiveRecord, id, currentUserId:() => currentSession?.user?.id || "" };
}

function renderReviewQueue(){
  if(typeof ensureDocumentPreviewUrls === "function") ensureDocumentPreviewUrls(activeItems("files"));
  const reviews = filteredReviewItems();
  const visibleReviews = reviews.slice(0, BULK_REVIEW_LIMIT);
  const status = document.getElementById("bulkReviewStatus");
  if(status && canManageOperations()){
    const waiting = reviews.filter(item => item.status === "Needs Review").length;
    status.textContent = waiting
      ? `${waiting} item${waiting === 1 ? "" : "s"} waiting. Open one, fix details, then approve it into work.`
      : "Nothing needs review right now.";
  }
  document.getElementById("submissionList").innerHTML = reviews.length ? visibleReviews.map(item => {
    const doc = item.documentId ? app.files.find(file => file.id === item.documentId) : null;
    const actions = item.status === "Needs Review" && canManageOperations() ? `<div class="actions no-print"><button type="button" onclick="openReviewDetail('${item.id}')">Open Review</button><button class="ghost archive-action" type="button" onclick="archiveSubmissionById('${item.id}')">Reject request</button></div>` : "";
    const select = item.status === "Needs Review" && canManageOperations()
      ? `<label class="bulk-review-select"><input type="checkbox" data-review-select="${item.id}" /> Select</label>`
      : "";
    const requestDetails = canSubmitOnly()
      ? [`Submitted ${requestSubmittedDate(item)}`, `Status: ${requestStatusLabel(item)}`, `Reference: ${requestReference(item.id)}`]
      : [item.importedRecord?.file_name, doc ? `Attached file: ${doc.fileName}` : item.documentId ? "Attached file" : "", item.convertedRecordId ? `Approved work order: ${requestReference(item.convertedRecordId)}` : "Waiting for review"];
    const requestTags = canSubmitOnly() ? [requestStatusLabel(item)] : [item.category, item.status, reviewRouteLabel(item)];
    return `<div class="bulk-review-row">${select}${card(item.description || "Review item", requestDetails, requestTags, tone(item.status))}${actions}</div>`;
  }).join("") + (reviews.length > visibleReviews.length ? empty(`Showing the first ${visibleReviews.length}. Use the filter or finish these before loading more.`) : "") : empty(canSubmitOnly() ? "No submitted requests yet." : "Nothing needs review right now.");
}

function requestReference(idValue){
  const compactId = String(idValue || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return compactId ? `SW-${compactId}` : "Pending";
}

function requestSubmittedDate(item){
  const date = item?.createdAt ? new Date(item.createdAt) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }) : "date unavailable";
}

function requestStatusLabel(item){
  if(item?.convertedRecordId){
    const linkedWork = [...(app?.tasks || []), ...(app?.archivedTasks || [])].find(work => work.id === item.convertedRecordId);
    if(String(linkedWork?.status || "").toLowerCase() === "complete") return "Completed";
    return "Approved";
  }
  if(String(item?.status || "").toLowerCase() === "approved") return "Approved";
  const status = String(item?.status || "").toLowerCase();
  if(status.includes("info")) return "Needs More Information";
  if(status.includes("complete") || status.includes("closed")) return "Completed";
  return "Pending Review";
}

function reviewRouteLabel(item){
  const data = item.importedRecord || {};
  return data.route || data.recurrence_pattern || item.importTarget || "";
}

function reviewFilterValue(){
  return document.getElementById("reviewBulkFilter")?.value || "all";
}

function filteredReviewItems(){
  const reviews = activeItems("submissions");
  const filter = reviewFilterValue();
  if(filter === "all") return reviews;
  return reviews.filter(item => {
    const data = item.importedRecord || {};
    const haystack = [
      item.source,
      item.category,
      item.importTarget,
      item.description,
      data.route,
      data.type,
      data.title,
      data.location,
      data.source_sheet,
      data.recurrence_pattern,
      data.notes
    ].join(" ").toLowerCase();
    if(filter === "info_requested") return String(item.status || "").toLowerCase() === "info requested";
    if(filter === "calendar") return haystack.includes("master calendar") || haystack.includes("scheduled") || haystack.includes("2026") || haystack.includes("2027");
    if(filter === "fleet") return haystack.includes("fleet") || haystack.includes("vehicle");
    if(filter === "recurring") return haystack.includes("recurring");
    if(filter === "walkthrough") return haystack.includes("walkthrough");
    if(filter === "facility") return haystack.includes("facility") || haystack.includes("building");
    if(filter === "asset") return haystack.includes("asset") || haystack.includes("system") || haystack.includes("equipment");
    return true;
  });
}

function selectedReviewIds(){
  return Array.from(document.querySelectorAll("[data-review-select]:checked"))
    .map(input => input.dataset.reviewSelect)
    .filter(Boolean);
}

function reviewApprovalErrorText(error){
  const call = error?.fieldOpsCall;
  const parts = [];
  if(call?.action || call?.table) parts.push(`${call.action || "save"} on workspace records`);
  if(error?.message) parts.push(error.message);
  if(error?.details) parts.push(error.details);
  if(error?.hint) parts.push(error.hint);
  if(error?.code) parts.push(`code ${error.code}`);
  return parts.filter(Boolean).join(" - ") || "Unknown save error";
}

function selectVisibleReviewItems(checked){
  document.querySelectorAll("[data-review-select]").forEach(input => { input.checked = Boolean(checked); });
  const status = document.getElementById("bulkReviewStatus");
  if(status) status.textContent = checked ? `${selectedReviewIds().length} selected.` : "Selection cleared.";
}

async function approveSelectedReviewItems(){
  if(!requireOperationsPermission("approve selected review items")) return;
  const ids = selectedReviewIds();
  const status = document.getElementById("bulkReviewStatus");
  if(!ids.length){
    if(status) status.textContent = "Select at least one item first.";
    return;
  }
  if(ids.length > 40){
    if(status) status.textContent = `Approve ${BULK_REVIEW_LIMIT} or fewer at a time so the app stays responsive.`;
    alert(`Approve ${BULK_REVIEW_LIMIT} or fewer at a time.`);
    return;
  }
  const ok = await InteractionService?.showConfirmDialog?.({
    title:`Approve ${ids.length} selected item${ids.length === 1 ? "" : "s"} into active work?`,
    detail:`You are about to approve ${ids.length} item${ids.length === 1 ? "" : "s"} into active work.`,
    reassurance:"Items already approved will be skipped to prevent duplicates.",
    confirmLabel:`Approve ${ids.length} item${ids.length === 1 ? "" : "s"}`,
    cancelLabel:"Review more first"
  });
  if(!ok) return;
  let approved = 0;
  let failed = 0;
  const failureMessages = [];
  const createdReferences = [];
  for(const reviewId of ids){
    const review = app.submissions.find(item => item.id === reviewId);
    if(!review || review.convertedRecordId || review.status !== "Needs Review") continue;
    try{
      const created = await ImportReviewService.approveReview({
        reviewId:review.id,
        review,
        type:"work_order",
        data:review.importedRecord || {},
        documentId:review.documentId,
        reviewerId:currentSession.user.id
      }, importReviewContext());
      approved++;
      if(created?.id) createdReferences.push(requestReference(created.id));
      if(status) status.textContent = `Approved ${approved} of ${ids.length}...`;
    }catch(err){
      failed++;
      failureMessages.push(reviewApprovalErrorText(err));
      console.error("Bulk approval failed", reviewId, err);
    }
  }
  await loadWorkspaceData();
  renderReviewQueue();
  if(status){
    const firstFailure = Array.from(new Set(failureMessages))[0];
    status.textContent = failed
      ? `Approved ${approved}. ${failed} could not be approved. ${firstFailure ? `First issue: ${firstFailure}` : ""}`
      : `Approved ${approved} item${approved === 1 ? "" : "s"} into work orders.`;
  }
  if(approved) addOperationalNotification?.({ type:"request_approved", title:"Review items approved", detail:`${approved} item${approved === 1 ? "" : "s"} became active work.`, view:"workOrders", role:"operations" });
  if(approved) InteractionService?.showConfirmation?.(
    `${approved} item${approved === 1 ? "" : "s"} approved`,
    `${approved} item${approved === 1 ? " is" : "s are"} now active work.${createdReferences.length ? ` References: ${createdReferences.slice(0, 4).join(", ")}${createdReferences.length > 4 ? ", and more" : ""}.` : ""} Assignments and updates can continue from Work Orders.`,
    [{ label:"Open Work Orders", run:() => showView("workOrders") }]
  );
}

async function archiveSelectedReviewItems(){
  if(!requireOperationsPermission("close selected review items")) return;
  const ids = selectedReviewIds();
  const status = document.getElementById("bulkReviewStatus");
  if(!ids.length){
    if(status) status.textContent = "Select at least one item first.";
    return;
  }
  if(ids.length > 40){
    if(status) status.textContent = `Close ${BULK_REVIEW_LIMIT} or fewer at a time so the app stays responsive.`;
    alert(`Close ${BULK_REVIEW_LIMIT} or fewer at a time.`);
    return;
  }
  const ok = await InteractionService?.showConfirmDialog?.({
    title:`Reject ${ids.length} selected item${ids.length === 1 ? "" : "s"}?`,
    detail:"They will leave Needs Review without becoming active work.",
    reassurance:"This does not delete the original record.",
    confirmLabel:"Reject selected",
    cancelLabel:"Keep reviewing",
    tone:"danger"
  });
  if(!ok) return;
  let moved = 0;
  let failed = 0;
  for(const reviewId of ids){
    try{
      await ImportReviewService.archiveReview(reviewId, importReviewContext());
      moved++;
      if(status) status.textContent = `Closed ${moved} of ${ids.length}...`;
    }catch(err){
      failed++;
      console.error("Bulk archive failed", reviewId, err);
    }
  }
  await loadWorkspaceData();
  renderReviewQueue();
  if(status) status.textContent = failed ? `Closed ${moved}. ${failed} could not be closed.` : `Closed ${moved} review item${moved === 1 ? "" : "s"}.`;
  if(moved) InteractionService?.showConfirmation?.("Review items closed", "They were not approved into active work and stay recoverable.");
  if(moved) addOperationalNotification?.({ type:"request_rejected", title:"Review items closed", detail:`${moved} item${moved === 1 ? "" : "s"} moved out of Needs Review.`, view:"importReview", role:"operations" });
}



async function addSubmission(e){
  e.preventDefault();
  const form = document.getElementById("submissionForm");
  const submitButton = typeof form?.querySelector === "function" ? form.querySelector("button[type='submit']") : null;
  const originalButtonText = submitButton?.textContent || "Submit Request";
  let currentStep = "starting request";
  try{
    if(!requireInsertPermission("field_ops_import_reviews", "submit requests")) return;
    if(submitButton){
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }
    setInlineState("submissionSaveState", "Sending request...", "pending");
    const interactions = window.FieldOps.Services.interactions;
    const upload = document.getElementById("submissionUpload")?.files?.[0] || interactions?.droppedReviewFile;
    let documentId = null;
    if(upload){
      currentStep = "uploading file";
      setInlineState("submissionSaveState", "Uploading attached file...", "pending");
      documentId = id();
      const storagePath = await uploadDocumentToStorage(upload, documentId);
      currentStep = "reading file preview";
      const extractedText = await extractFileText(upload);
      currentStep = "saving document record";
      setInlineState("submissionSaveState", "Saving attached file record...", "pending");
      await saveDocumentMetadata({
        docId: documentId,
        fileNameValue: upload.name,
        fileTypeValue: fileTypeFromName(upload.name),
        storagePath,
        extractedText,
        extractionStatus: extractedText ? "complete" : "not_supported",
        notes: `Submitted with request: ${submissionDescription.value}`
      });
    }
    currentStep = "saving review request";
    setInlineState("submissionSaveState", "Saving request for review...", "pending");
    const summary = submissionDescription.value.trim();
    const createdReview = await createImportReview(submissionSource.value, "work_order", Mappers.submitterWorkOrderReviewData({ description:submissionDescription.value, urgency:submissionUrgency.value, location:submissionLocation.value, category:submissionCategory.value, name:submissionName.value, contact:submissionContact.value, documentId }), submissionDescription.value, documentId);
    if(typeof form?.reset === "function") form.reset();
    interactions?.clearDroppedReviewFile?.();
    const useConversation = typeof canSubmitOnly === "function" && canSubmitOnly();
    if(useConversation){
      saveConversationDraft({
        submitted: true,
        submittedRef: summary ? summary.slice(0, 100) : "We'll review it soon."
      });
    }else{
      clearConversationDraft();
      renderConversationIntake();
    }
    setInlineState("submissionSaveState", "Saved - we'll take a look at it.", "saved");
    setStatus("Saved - we'll take a look at it.");
    InteractionService?.showConfirmation?.(
      "Request received",
      `The operations team will review it next. Reference: ${requestReference(createdReview?.id)}.`,
      [{ label:"View My Requests", run:() => openMySubmissions() }]
    );
    addOperationalNotification?.({ type:"request_submitted", title:"Request sent", detail:submissionDescription.value.slice(0, 120), view:"importReview", role:"submitter" });
    loadWorkspaceData().catch(err => console.error("Submission saved, but refresh failed", err));
  }catch(err){
    setInlineState("submissionSaveState", `Could not send while ${currentStep}: ${permissionAwareErrorMessage(err)}`, "failed");
    handleWriteError(err);
  }finally{
    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = canSubmitOnly() ? "Submit Request" : originalButtonText;
    }
  }
}



function fileTypeFromName(name){
  const lower = String(name || "").toLowerCase();
  if(lower.endsWith(".pdf")) return "PDF";
  if(lower.endsWith(".csv")) return "CSV";
  if(lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "Excel";
  if(lower.match(/\.(png|jpg|jpeg|gif|webp|heic)$/)) return "Photo";
  return "Other";
}



async function createImportReview(source, proposedType, proposedData, notes, documentId = null){
  return ImportReviewService.createImportReview({ source, proposedType, proposedData, notes, documentId }, importReviewContext());
}



function openReviewDetail(reviewId){
  if(!requireOperationsPermission("review submitted requests")) return;
  selectedReviewId = reviewId;
  renderImportReviewDetail();
  showView("reviewDetail");
}



function selectedReview(){
  return app.submissions.find(s => s.id === selectedReviewId);
}



function renderImportReviewDetail(){
  const title = document.getElementById("reviewDetailTitle");
  const meta = document.getElementById("reviewDetailMeta");
  const form = document.getElementById("reviewDetailForm");
  if(!title || !meta || !form) return;
  const review = selectedReview();
  if(!review){
    title.textContent = "Review Submission";
    meta.textContent = "Choose a submitted item from Needs Review.";
    form.innerHTML = empty("No submitted item selected.");
    return;
  }
  const data = review.importedRecord || {};
  const doc = review.documentId ? app.files.find(file => file.id === review.documentId) : null;
  const converted = Boolean(review.convertedRecordId) || String(review.status || "").toLowerCase() === "approved";
  const infoRequested = String(review.status || "").toLowerCase().includes("info");
  title.textContent = data.title || data.name || "Review Submission";
  meta.textContent = compact(["Intake item", review.status, review.documentId ? "Document attached" : "No document", "Review before active work"]).join(" | ");
  form.innerHTML = `
    ${infoRequested && data.info_requested_note ? `<section class="detail-block full"><h3>More information requested</h3><p>${esc(data.info_requested_note)}</p>${canSubmitOnly() ? `<label class="full">Response<textarea name="submitter_response" placeholder="Add the missing detail for review">${esc(data.info_response || "")}</textarea></label>` : data.info_response ? `<p class="meta">Submitter response: ${esc(data.info_response)}</p>` : `<p class="meta">Waiting for submitter response.</p>`}</section>` : ""}
    <div class="form-grid">
      <label class="full">Work order title<input name="title" required value="${esc(data.title || data.name || review.description || "")}" /></label>
      <label>Type / category<select name="type"><option value="general">General</option><option value="maintenance">Maintenance</option><option value="inspection">Inspection</option><option value="safety">Safety</option><option value="vehicle">Vehicle</option></select></label>
      <label>Status<select name="status"><option value="open">Open</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option></select></label>
      <label>Priority<select name="priority"><option value="normal" ${data.priority === "normal" ? "selected" : ""}>Normal</option><option value="high" ${data.priority === "high" ? "selected" : ""}>High</option><option value="urgent" ${data.priority === "urgent" ? "selected" : ""}>Urgent</option><option value="low" ${data.priority === "low" ? "selected" : ""}>Low</option></select></label>
      <label>Due date<input name="due_date" type="date" value="${esc(data.due_date || data.date || "")}" /></label>
      <label>Assigned person<input name="assigned_person" value="${esc(data.assigned_person || data.assignedTo || data.responsible_role || "")}" placeholder="Name, team, or vendor" /></label>
      ${fieldHtml("project_id","Project","projectSelect",data.project_id || "")}
      ${fieldHtml("building_id","Building","buildingSelect",data.building_id || "")}
      ${fieldHtml("space_id","Space / Room","spaceSelect",data.space_id || "")}
      ${fieldHtml("asset_id","Asset","assetSelect",data.asset_id || "")}
      ${fieldHtml("vehicle_id","Vehicle","vehicleSelect",data.vehicle_id || "")}
      ${fieldHtml("vendor_id","Vendor","vendorSelect",data.vendor_id || "")}
      ${doc ? `<div class="full">${documentPreviewCard({ ...doc, contextLabel:"Attached to this review" })}</div>` : review.documentId ? `<p class="meta full">Attached file will remain linked when this is approved.</p>` : ""}
      <label class="full">Location / description<textarea name="description">${esc(data.description || data.location || "")}</textarea></label>
      <label class="full">Notes / history<textarea name="notes">${esc(data.notes || data.extracted_text || review.description || "")}</textarea></label>
    </div>
    ${window.operationalTimelineSection?.("maintenance_request", review.id, data.notes || review.description || "") || ""}
  `;
  const approveBtn = document.getElementById("reviewApproveBtn");
  const rejectBtn = document.getElementById("reviewRejectBtn");
  const saveState = document.getElementById("reviewDetailSaveState");
  if(saveState){
    saveState.textContent = converted ? `Already approved as work order ${review.convertedRecordId || ""}` : "Ready";
    saveState.dataset.state = converted ? "saved" : "";
  }
  if(approveBtn){
    approveBtn.disabled = converted;
    approveBtn.textContent = converted ? "Already Approved" : "Approve Work Order";
    approveBtn.onclick = () => approveReviewDetail();
  }
  const actionRow = document.getElementById("reviewDetailActions");
  if(actionRow){
    let projectBtn = actionRow.querySelector("[data-review-project]");
    if(!projectBtn){
      projectBtn = document.createElement("button");
      projectBtn.type = "button";
      projectBtn.className = "ghost";
      projectBtn.dataset.reviewProject = "true";
      actionRow.insertBefore(projectBtn, rejectBtn || null);
    }
    projectBtn.textContent = "Convert to Project";
    projectBtn.disabled = converted;
    projectBtn.onclick = () => convertReviewToProject();
    let infoBtn = actionRow.querySelector("[data-review-info]");
    if(!infoBtn){
      infoBtn = document.createElement("button");
      infoBtn.type = "button";
      infoBtn.className = "ghost";
      infoBtn.dataset.reviewInfo = "true";
      actionRow.insertBefore(infoBtn, rejectBtn || null);
    }
    infoBtn.textContent = "Need more info";
    infoBtn.disabled = converted;
    infoBtn.onclick = () => requestMoreInfoForReview();
    let responseBtn = actionRow.querySelector("[data-review-response]");
    if(!responseBtn){
      responseBtn = document.createElement("button");
      responseBtn.type = "button";
      responseBtn.className = "ghost";
      responseBtn.dataset.reviewResponse = "true";
      actionRow.insertBefore(responseBtn, rejectBtn || null);
    }
    responseBtn.textContent = "Submit response";
    responseBtn.hidden = !canSubmitOnly() || !infoRequested || converted;
    responseBtn.disabled = converted;
    responseBtn.onclick = () => submitMoreInfoResponse();
  }
  if(rejectBtn){
    rejectBtn.textContent = "Reject request";
    rejectBtn.onclick = () => archiveSubmissionById(review.id);
  }
}

async function submitMoreInfoResponse(){
  const review = selectedReview();
  if(!review) return;
  const form = document.getElementById("reviewDetailForm");
  const response = String(new FormData(form).get("submitter_response") || "").trim();
  if(!response){
    setInlineState("reviewDetailSaveState", "Add a response before sending this back to review.", "failed");
    return;
  }
  const existing = review.importedRecord || {};
  const payload = {
    status:"needs_review",
    proposed_data:{ ...existing, info_response:response, info_response_at:new Date().toISOString(), info_response_by:currentSession?.user?.id || null }
  };
  try{
    setInlineState("reviewDetailSaveState", "Sending response...", "pending");
    await updateRecord("field_ops_import_reviews", review.id, payload);
    InteractionService?.showConfirmation?.("Response sent", "This request is back in Needs Review with your added information.");
    addOperationalNotification?.({ type:"more_info_response", title:"More information received", detail:response.slice(0, 120), view:"importReview", recordId:review.id, role:"operations" });
    await loadWorkspaceData();
    showView("importReview");
  }catch(err){
    setInlineState("reviewDetailSaveState", `Response failed: ${permissionAwareErrorMessage(err)}`, "failed");
    handleWriteError(err);
  }
}



function reviewWorkOrderPayload(){
  const form = document.getElementById("reviewDetailForm");
  const formData = new FormData(form);
  return Mappers.reviewWorkOrderPayloadFromForm(formData);
}



async function approveReviewDetail(){
  const review = selectedReview();
  if(!review || !requireOperationsPermission("approve submitted requests")) return;
  try{
    if(review.convertedRecordId || String(review.status || "").toLowerCase() === "approved"){
      setInlineState("reviewDetailSaveState", "This item was already approved into a work order", "saved");
      selectedWorkOrderId = review.convertedRecordId || "";
      if(selectedWorkOrderId) showView("workOrderDetail");
      return;
    }
    setInlineState("reviewDetailSaveState", "Approving into work order...", "pending");
    const payload = reviewWorkOrderPayload();
    if(typeof window.recordTimelineEvent === "function"){
      await window.recordTimelineEvent({ recordType:"maintenance_request", recordId:review.id, eventType:"reviewed", note:`${window.timelineActor?.() || "Someone"} reviewed this request.` });
    }
    const created = await ImportReviewService.approveReview({ reviewId:review.id, review, type:"work_order", data:payload, documentId:review.documentId, reviewerId:currentSession.user.id }, importReviewContext());
    selectedWorkOrderId = created.id;
    setInlineState("reviewDetailSaveState", created.alreadyConverted ? "Already approved" : "Approved into work order", "saved");
    InteractionService?.showConfirmation?.("Work order created", created.alreadyConverted ? "This review item was already approved." : "The review item is now an active work order.");
    addOperationalNotification?.({ type:"request_approved", title:"Request approved", detail:payload.title || "Approved into a work order.", view:"workOrderDetail", recordId:created.id, role:"all" });
    if(!created.alreadyConverted){
      InteractionService?.showWorkflowPrompt?.({
        key:`assign-approved-work:${created.id}`,
        title:"Assign this work now?",
        detail:"Assigning it helps the right person see it in their work list.",
        actions:[{ label:"Open work order", run:() => openWorkOrderDetail(created.id) }]
      });
    }
    const refreshed = await refreshAfterWrite?.("Approved into work order");
    if(refreshed !== false) showView("workOrderDetail");
    else setInlineState("reviewDetailSaveState", "Approved into a work order, but the workspace refresh failed. Refresh before opening the work order.", "saved");
  }catch(err){
    setInlineState("reviewDetailSaveState", `Approval failed: ${err.message}`, "failed");
    handleWriteError(err);
  }
}


async function convertReviewToProject(){
  const review = selectedReview();
  if(!review || !requireOperationsPermission("convert submitted requests to projects")) return;
  try{
    if(review.convertedRecordId || String(review.status || "").toLowerCase() === "approved"){
      setInlineState("reviewDetailSaveState", "This item was already approved", "saved");
      return;
    }
    const payload = reviewWorkOrderPayload();
    const projectData = {
      title:payload.title,
      name:payload.title,
      status:"planning",
      priority:payload.priority || "normal",
      target_date:payload.due_date || null,
      location:payload.description || "",
      summary:payload.description || "",
      notes:payload.notes || ""
    };
    setInlineState("reviewDetailSaveState", "Converting into project...", "pending");
    const created = await ImportReviewService.approveReview({ reviewId:review.id, review, type:"project", data:projectData, documentId:review.documentId, reviewerId:currentSession.user.id }, importReviewContext());
    setInlineState("reviewDetailSaveState", "Approved into project", "saved");
    InteractionService?.showConfirmation?.("Project created", "The review item is now a project, with attached files preserved.");
    addOperationalNotification?.({ type:"request_approved", title:"Request approved as project", detail:projectData.title || "A review item became a project.", view:"projects", recordId:created.id, role:"operations" });
    await refreshAfterWrite?.("Approved into project");
    showView("projects");
  }catch(err){
    setInlineState("reviewDetailSaveState", `Project conversion failed: ${err.message}`, "failed");
    handleWriteError(err);
  }
}


async function requestMoreInfoForReview(){
  const review = selectedReview();
  if(!review || !requireOperationsPermission("request more information")) return;
  const note = prompt("What information is needed?");
  if(note === null) return;
  const existing = review.importedRecord || {};
  const payload = {
    status:"Info requested",
    proposed_data:{ ...existing, info_requested_note:note.trim() },
    reviewed_by:currentSession.user.id,
    reviewed_at:new Date().toISOString()
  };
  try{
    setInlineState("reviewDetailSaveState", "Saving information request...", "pending");
    if(typeof window.recordTimelineEvent === "function"){
      await window.recordTimelineEvent({ recordType:"maintenance_request", recordId:review.id, eventType:"reviewed", note:`${window.timelineActor?.() || "Someone"} reviewed this request.` });
    }
    await updateRecord("field_ops_import_reviews", review.id, payload);
    InteractionService?.showConfirmation?.("More information requested", "This item stays out of active work until the details are clarified.");
    addOperationalNotification?.({ type:"more_info_requested", title:"More information needed", detail:note.trim() || "A manager requested more information.", view:"importReview", recordId:review.id, role:"all" });
    await loadWorkspaceData();
    renderImportReviewDetail();
  }catch(err){
    setInlineState("reviewDetailSaveState", `Could not request more information: ${err.message}`, "failed");
    handleWriteError(err);
  }
}



async function archiveSubmissionById(reviewId){
  const ok = await InteractionService?.showConfirmDialog?.({
    title:"Reject this request?",
    detail:"It will leave Needs Review without becoming active work.",
    reassurance:"The request stays in history and is not deleted.",
    confirmLabel:"Reject request",
    cancelLabel:"Keep reviewing",
    tone:"danger"
  });
  if(!ok) return;
  try{
    if(typeof window.recordTimelineEvent === "function"){
      await window.recordTimelineEvent({ recordType:"maintenance_request", recordId:reviewId, eventType:"reviewed", note:`${window.timelineActor?.() || "Someone"} reviewed this request.` });
    }
    await ImportReviewService.archiveReview(reviewId, importReviewContext());
    InteractionService?.showConfirmation?.("Review item closed", "It was not approved into active work and can be found in history if needed.");
    addOperationalNotification?.({ type:"request_rejected", title:"Request was not approved", detail:"It was moved out of Needs Review and kept for history.", view:"importReview", recordId:reviewId, role:"all" });
    await loadWorkspaceData();
  }
  catch(err){ handleWriteError(err); }
}

  Object.assign(window.FieldOps.Views, {
    renderReviewQueue,
    addSubmission,
    fileTypeFromName,
    createImportReview,
    openReviewDetail,
    selectedReview,
    renderImportReviewDetail,
    reviewWorkOrderPayload,
    approveReviewDetail,
    convertReviewToProject,
    requestMoreInfoForReview,
    submitMoreInfoResponse,
    archiveSubmissionById,
    filteredReviewItems,
    renderConversationIntake,
    setConversationAnswer,
    nextConversationStep,
    previousConversationStep,
    submitConversationRequest,
    jumpToConversationStep,
    finishConversationRequest,
    startAnotherConversationRequest,
    selectVisibleReviewItems,
    approveSelectedReviewItems,
    archiveSelectedReviewItems
  });
  Object.assign(globalThis, {
    renderReviewQueue,
    addSubmission,
    fileTypeFromName,
    createImportReview,
    openReviewDetail,
    selectedReview,
    renderImportReviewDetail,
    reviewWorkOrderPayload,
    approveReviewDetail,
    convertReviewToProject,
    requestMoreInfoForReview,
    submitMoreInfoResponse,
    archiveSubmissionById,
    filteredReviewItems,
    renderConversationIntake,
    setConversationAnswer,
    nextConversationStep,
    previousConversationStep,
    submitConversationRequest,
    jumpToConversationStep,
    finishConversationRequest,
    startAnotherConversationRequest,
    selectVisibleReviewItems,
    approveSelectedReviewItems,
    archiveSelectedReviewItems
  });
})();
