(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;
  const ImportReviewService = window.FieldOps.Services.importReview;

function importReviewContext(){
  return { app, insertRecord, updateRecord, archiveRecord, id, currentUserId:() => currentSession?.user?.id || "" };
}

function renderReviewQueue(){
  if(typeof ensureDocumentPreviewUrls === "function") ensureDocumentPreviewUrls(activeItems("files"));
  const reviews = activeItems("submissions");
  document.getElementById("submissionList").innerHTML = reviews.length ? reviews.map(item => {
    const doc = item.documentId ? app.files.find(file => file.id === item.documentId) : null;
    const actions = item.status === "Needs Review" && canManageOperations() ? `<div class="actions no-print"><button type="button" onclick="openReviewDetail('${item.id}')">Open Review</button><button class="ghost" type="button" onclick="archiveSubmissionById('${item.id}')">Move out of active work</button></div>` : "";
    return card(item.description || "Review item", [item.importedRecord?.file_name, doc ? `Attached file: ${doc.fileName}` : item.documentId ? "Attached file" : "", item.convertedRecordId ? `Approved work order: ${item.convertedRecordId}` : ""], [item.category, item.status, item.source], tone(item.status)) + actions;
  }).join("") : empty(canSubmitOnly() ? "No submitted requests yet." : "Nothing needs review right now.");
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
    setInlineState("submissionSaveState", "Saved - we'll take a look at it.", "saved");
    setStatus("Saved - we'll take a look at it.");
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
  meta.textContent = compact([review.source, review.status, review.documentId ? "Document attached" : "No document"]).join(" | ");
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
  if(rejectBtn) rejectBtn.onclick = () => archiveSubmissionById(review.id);
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
    const refreshed = await refreshAfterWrite?.("Approved into work order");
    if(refreshed !== false) showView("workOrderDetail");
    else setInlineState("reviewDetailSaveState", "Approved into a work order, but the workspace refresh failed. Refresh before opening the work order.", "saved");
  }catch(err){
    setInlineState("reviewDetailSaveState", `Approval failed: ${err.message}`, "failed");
    handleWriteError(err);
  }
}



async function archiveSubmissionById(reviewId){
  try{ await ImportReviewService.archiveReview(reviewId, importReviewContext()); }
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
    archiveSubmissionById
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
    archiveSubmissionById
  });
})();
