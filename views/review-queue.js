(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;
  const ImportReviewService = window.FieldOps.Services.importReview;
  const BULK_REVIEW_LIMIT = 40;
  const CONVERSATION_KEY = "field_ops_conversation_intake_v1";
  const conversationSteps = ["category", "location", "description", "urgency", "photos", "review"];
  let conversationIndex = 0;

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

function syncConversationToForm(draft = conversationDraft()){
  const set = (idValue, value) => {
    const el = document.getElementById(idValue);
    if(el && value !== undefined) el.value = value || "";
  };
  set("submissionCategory", draft.category || "Building");
  set("submissionUrgency", draft.urgency || "Normal");
  set("submissionLocation", draft.location || "");
  set("submissionDescription", draft.description || "");
  set("submissionSource", "Staff portal");
}

function choiceButton(label, detail, field, value){
  const active = conversationDraft()[field] === value;
  return `<button class="conversation-choice ${active ? "active" : ""}" type="button" onclick="setConversationAnswer('${field}','${esc(value)}')"><span>${esc(label)}</span>${detail ? `<small>${esc(detail)}</small>` : ""}</button>`;
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
  syncConversationToForm(draft);
  const step = conversationSteps[conversationIndex] || "category";
  bar.style.width = `${Math.round(((conversationIndex + 1) / conversationSteps.length) * 100)}%`;
  if(step === "category"){
    target.innerHTML = `<h3>What do you need help with?</h3><p>Choose the closest match. If it is odd or hard to explain, that is okay.</p><div class="conversation-choice-grid">
      ${choiceButton("Building", "Doors, rooms, heat, leaks, or facility issues.", "category", "Building")}
      ${choiceButton("Kitchen / Equipment", "Freezers, sinks, appliances, hood, or prep areas.", "category", "Kitchen / Equipment")}
      ${choiceButton("Vehicle", "Vans, trucks, mileage, plates, service, or damage.", "category", "Vehicle")}
      ${choiceButton("Cleaning", "Spills, trash, supplies, or cleanup needs.", "category", "Cleaning")}
      ${choiceButton("Safety", "Trip hazards, blocked access, urgent concerns.", "category", "Safety")}
      ${choiceButton("Something unusual happened", "Use this when it does not fit anywhere else.", "category", "Something unusual happened")}
    </div>`;
  }else if(step === "location"){
    target.innerHTML = `<h3>Where is the issue?</h3><p>A room, building, vehicle, area, or simple clue is enough.</p><label class="conversation-field">Location<input value="${esc(draft.location || "")}" placeholder="Kitchen, Valley, Van 2, loading door..." oninput="setConversationAnswer('location', this.value, true)" /></label>`;
  }else if(step === "description"){
    target.innerHTML = `<h3>Can you describe what’s happening?</h3><p>Plain words are perfect. Include anything that feels important.</p><label class="conversation-field">Description<textarea placeholder="What happened? What should someone know?" oninput="setConversationAnswer('description', this.value, true)">${esc(draft.description || "")}</textarea></label>`;
  }else if(step === "urgency"){
    target.innerHTML = `<h3>How soon does this need attention?</h3><p>Choose what feels right. A manager will review it before it becomes active work.</p><div class="conversation-choice-grid">
      ${choiceButton("Normal", "Needs attention, but not immediate.", "urgency", "Normal")}
      ${choiceButton("High", "Important or time-sensitive.", "urgency", "High")}
      ${choiceButton("Urgent", "Safety, access, breakdown, or active damage.", "urgency", "Urgent")}
    </div>`;
  }else if(step === "photos"){
    target.innerHTML = `<h3>Would you like to add photos?</h3><p>Photos, receipts, PDFs, or notes help the operations team understand what happened.</p><div class="conversation-choice-grid">
      <button class="conversation-choice" type="button" onclick="document.getElementById('submissionUpload')?.click()"><span>Add photo or file</span><small>Optional, but helpful.</small></button>
      <button class="conversation-choice" type="button" onclick="nextConversationStep()"><span>Skip for now</span><small>You can submit without a file.</small></button>
    </div><div id="conversationUploadEcho">${document.getElementById("reviewUploadPreview")?.innerHTML || ""}</div>`;
  }else{
    target.innerHTML = `<h3>Review before sending</h3><p>Make sure this looks right. Then send it to Needs Review.</p><div class="conversation-review">
      <div><strong>Need</strong><p>${esc(draft.category || "Building")}</p></div>
      <div><strong>Where</strong><p>${esc(draft.location || "No location added yet")}</p></div>
      <div><strong>What is happening</strong><p>${esc(draft.description || "No description added yet")}</p></div>
      <div><strong>Urgency</strong><p>${esc(draft.urgency || "Normal")}</p></div>
    </div><div class="actions"><button type="button" onclick="submitConversationRequest()">Send request</button></div>`;
  }
}

function setConversationAnswer(field, value, quiet = false){
  if(!quiet && conversationIndex < conversationSteps.length - 1) conversationIndex += 1;
  saveConversationDraft({ [field]:value });
}

function nextConversationStep(){
  if(conversationIndex < conversationSteps.length - 1) conversationIndex += 1;
  renderConversationIntake();
}

function previousConversationStep(){
  if(conversationIndex > 0) conversationIndex -= 1;
  renderConversationIntake();
}

function submitConversationRequest(){
  syncConversationToForm();
  const form = document.getElementById("submissionForm");
  if(!document.getElementById("submissionDescription")?.value.trim()){
    conversationIndex = 2;
    renderConversationIntake();
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
    const actions = item.status === "Needs Review" && canManageOperations() ? `<div class="actions no-print"><button type="button" onclick="openReviewDetail('${item.id}')">Open Review</button><button class="ghost" type="button" onclick="archiveSubmissionById('${item.id}')">Don't approve this</button></div>` : "";
    const select = item.status === "Needs Review" && canManageOperations()
      ? `<label class="bulk-review-select"><input type="checkbox" data-review-select="${item.id}" /> Select</label>`
      : "";
    return `<div class="bulk-review-row">${select}${card(item.description || "Review item", [item.importedRecord?.file_name, doc ? `Attached file: ${doc.fileName}` : item.documentId ? "Attached file" : "", item.convertedRecordId ? `Approved work order: ${item.convertedRecordId}` : "Waiting for a human review"], [item.category, item.status, reviewRouteLabel(item)], tone(item.status))}${actions}</div>`;
  }).join("") + (reviews.length > visibleReviews.length ? empty(`Showing the first ${visibleReviews.length}. Use the filter or finish these before loading more.`) : "") : empty(canSubmitOnly() ? "No submitted requests yet." : "Nothing needs review right now.");
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
    title:`Approve ${ids.length} selected item${ids.length === 1 ? "" : "s"}?`,
    detail:"Each selected review item will become active work.",
    reassurance:"Items already approved will be skipped to prevent duplicates.",
    confirmLabel:"Approve into work",
    cancelLabel:"Review more first"
  });
  if(!ok) return;
  let approved = 0;
  let failed = 0;
  const failureMessages = [];
  for(const reviewId of ids){
    const review = app.submissions.find(item => item.id === reviewId);
    if(!review || review.convertedRecordId || review.status !== "Needs Review") continue;
    try{
      await ImportReviewService.approveReview({
        reviewId:review.id,
        review,
        type:"work_order",
        data:review.importedRecord || {},
        documentId:review.documentId,
        reviewerId:currentSession.user.id
      }, importReviewContext());
      approved++;
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
    title:`Don't approve ${ids.length} selected item${ids.length === 1 ? "" : "s"}?`,
    detail:"They will leave Needs Review but stay recoverable for history.",
    reassurance:"This does not delete the original record.",
    confirmLabel:"Don't approve selected",
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
    await createImportReview(submissionSource.value, "work_order", Mappers.submitterWorkOrderReviewData({ description:submissionDescription.value, urgency:submissionUrgency.value, location:submissionLocation.value, category:submissionCategory.value, name:submissionName.value, contact:submissionContact.value, documentId }), submissionDescription.value, documentId);
    if(typeof form?.reset === "function") form.reset();
    interactions?.clearDroppedReviewFile?.();
    clearConversationDraft();
    renderConversationIntake();
    setInlineState("submissionSaveState", "Saved - we'll take a look at it.", "saved");
    setStatus("Saved - we'll take a look at it.");
    InteractionService?.showConfirmation?.("Request sent", "Saved - we'll take a look at it.");
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
  title.textContent = data.title || data.name || "Review Submission";
  meta.textContent = compact(["Intake item", review.status, review.documentId ? "Document attached" : "No document", "Review before active work"]).join(" | ");
  form.innerHTML = `
    <div class="form-grid">
      <label class="full">Work order title<input name="title" required value="${esc(data.title || data.name || review.description || "")}" /></label>
      <label>Type / category<select name="type"><option value="general">General</option><option value="maintenance">Maintenance</option><option value="inspection">Inspection</option><option value="safety">Safety</option><option value="vehicle">Vehicle</option></select></label>
      <label>Status<select name="status"><option value="open">Open</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option></select></label>
      <label>Priority<select name="priority"><option value="normal" ${data.priority === "normal" ? "selected" : ""}>Normal</option><option value="high" ${data.priority === "high" ? "selected" : ""}>High</option><option value="urgent" ${data.priority === "urgent" ? "selected" : ""}>Urgent</option><option value="low" ${data.priority === "low" ? "selected" : ""}>Low</option></select></label>
      <label>Due date<input name="due_date" type="date" value="${esc(data.due_date || data.date || "")}" /></label>
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
  }
  if(rejectBtn){
    rejectBtn.textContent = "Reject and return";
    rejectBtn.onclick = () => archiveSubmissionById(review.id);
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
  try{
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
    archiveSubmissionById,
    filteredReviewItems,
    renderConversationIntake,
    setConversationAnswer,
    nextConversationStep,
    previousConversationStep,
    submitConversationRequest,
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
    archiveSubmissionById,
    filteredReviewItems,
    renderConversationIntake,
    setConversationAnswer,
    nextConversationStep,
    previousConversationStep,
    submitConversationRequest,
    selectVisibleReviewItems,
    approveSelectedReviewItems,
    archiveSelectedReviewItems
  });
})();

