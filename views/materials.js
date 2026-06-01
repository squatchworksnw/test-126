(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};

  const MaterialsService = window.FieldOps.Services.materials;

  function materialsContext(){
    return {
      app,
      insertRecord,
      updateRecord,
      archiveRecord,
      id,
      currentUserId:() => currentSession?.user?.id || null
    };
  }

  function materialReviews(){
    return activeItems("submissions").filter(MaterialsService.isMaterialReview);
  }

  function renderMaterialOptions(){
    const projectOptions = `<option value="">No project yet</option>` + activeItems("projects").map(project => `<option value="${project.id}">${esc(project.name)}</option>`).join("");
    const workOrderOptions = `<option value="">No work order yet</option>` + activeItems("tasks").map(task => `<option value="${task.id}">${esc(task.workOrderNumber ? `${task.workOrderNumber} - ${task.name}` : task.name)}</option>`).join("");
    const vendorOptions = `<option value="">No vendor yet</option>` + activeItems("vendors").map(vendor => `<option value="${vendor.id}">${esc(vendor.name)}</option>`).join("");
    const documentOptions = `<option value="">No document/receipt</option>` + activeItems("files").map(file => `<option value="${file.id}">${esc(file.fileName)}</option>`).join("");
    [["materialProject", projectOptions], ["materialWorkOrder", workOrderOptions], ["materialVendor", vendorOptions], ["materialDocument", documentOptions]].forEach(([idValue, options]) => {
      const el = document.getElementById(idValue);
      if(el) el.innerHTML = options;
    });
  }

  function materialReviewCard(review){
    const data = review.importedRecord || {};
    const lines = Array.isArray(data.line_items) ? data.line_items : [];
    const project = app.projects.find(item => item.id === data.project_id);
    const workOrder = app.tasks.find(item => item.id === data.work_order_id);
    const vendor = app.vendors.find(item => item.id === data.vendor_id);
    const actions = canManageOperations() && review.status === "Needs Review"
      ? `<div class="actions no-print"><button type="button" onclick="approveMaterialReviewById('${review.id}')">Approve to Budget</button><button class="ghost" type="button" onclick="archiveSubmissionById('${review.id}')">Don't approve this</button></div>`
      : "";
    return card(data.title || review.description || "Supply / material request", [
      lines.length ? `${lines.length} line item${lines.length === 1 ? "" : "s"}` : "No line items",
      `Estimated total: ${money(data.estimated_total || MaterialsService.materialListTotal(lines))}`,
      project ? `Project: ${project.name}` : "",
      workOrder ? `Work order: ${workOrder.workOrderNumber || workOrder.name}` : "",
      vendor ? `Vendor: ${vendor.name}` : "",
      data.notes
    ], [review.status, data.approval_status || "needs_review", review.source], tone(review.status)) + actions;
  }

  function renderMaterials(){
    renderMaterialOptions();
    const reviews = materialReviews();
    const list = document.getElementById("materialReviewList");
    if(list) list.innerHTML = reviews.length ? reviews.map(materialReviewCard).join("") : empty("No supply or material requests waiting yet.");
  }

  async function addMaterialList(e){
    e.preventDefault();
    try{
      if(!requireInsertPermission("field_ops_import_reviews", "submit supply or material requests")) return;
      setInlineState("materialSaveState", "Sending supply / material request...", "pending");
      const review = await MaterialsService.submitMaterialList({
        title:materialTitle.value,
        projectId:materialProject.value,
        workOrderId:materialWorkOrder.value,
        vendorId:materialVendor.value,
        documentId:materialDocument.value,
        lines:materialLines.value,
        notes:materialNotes.value,
        source:canSubmitOnly() ? "purchase / supply request" : "supplies / materials workspace"
      }, materialsContext());
      e.target.reset();
      setInlineState("materialSaveState", "Supply / material request sent for review", "saved");
      InteractionService?.showConfirmation?.("Supply request sent", "The request was preserved with its project, work order, vendor, and document context. It is waiting in Needs Review before becoming official budget or work.", [
        { label:"Open Needs Review", run:() => showView("importReview") }
      ]);
      addOperationalNotification?.({ type:"supply_submitted", title:"Supply request sent", detail:"It is waiting in Needs Review.", view:"importReview", recordId:review?.id || "", role:"all" });
      await refreshAfterWrite?.("Supply / material request sent for review");
    }catch(err){
      setInlineState("materialSaveState", `Could not send: ${err.message}`, "failed");
      handleWriteError(err);
    }
  }

  async function approveMaterialReviewById(reviewId){
    if(!requireOperationsPermission("approve material lists")) return;
    const review = app.submissions.find(item => item.id === reviewId);
    if(!review) return;
    try{
      await MaterialsService.approveMaterialReview(review, materialsContext());
      setStatus("Supply / material request approved to budget");
      InteractionService?.showConfirmation?.("Supply request approved", "The reviewed request was saved to budget tracking.");
      addOperationalNotification?.({ type:"supply_approved", title:"Supply request approved", detail:review.description || "The request was approved.", view:"materials", recordId:review.id, role:"all" });
      InteractionService?.showWorkflowPrompt?.({
        key:`delivery-work:${review.id}`,
        title:"Create a delivery work order?",
        detail:"If someone needs to pick up, deliver, or install these supplies, create follow-up work.",
        actions:[{ label:"Create work order", run:() => showView("workOrders") }]
      });
      await refreshAfterWrite?.("Supply / material request approved to budget");
    }catch(err){ handleWriteError(err); }
  }

  const form = document.getElementById("materialForm");
  if(form) form.addEventListener("submit", addMaterialList);

  Object.assign(window.FieldOps.Views, {
    renderMaterials,
    addMaterialList,
    approveMaterialReviewById
  });
  Object.assign(globalThis, {
    renderMaterials,
    addMaterialList,
    approveMaterialReviewById
  });
})();

