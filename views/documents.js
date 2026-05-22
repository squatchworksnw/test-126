(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;
  const previewUrlCache = new Map();

function uploadKindToFileType(kind){
  return {
    photo:"Photo",
    receipt:"Fuel Receipt",
    warranty:"Warranty / Manual",
    title:"Vehicle Title / Registration",
    estimate:"Estimate",
    other:"Other / Not sure"
  }[kind] || "Other / Not sure";
}

function applyUploadKind(){
  const kind = document.getElementById("uploadKind")?.value || "other";
  if(document.getElementById("fileType")) fileType.value = uploadKindToFileType(kind);
  const guidance = document.getElementById("uploadGuidance");
  if(!guidance) return;
  guidance.textContent = kind === "receipt"
    ? "Receipts go to Needs Review first. Uploading proof helps route the expense, but does not replace any required accounting receipt process."
    : kind === "photo"
      ? "Photos can support a request, work order, vehicle, asset, or uncertain review item."
      : kind === "warranty"
        ? "Warranty/manual uploads are easiest to find later when linked to a vehicle or asset/system."
        : kind === "title"
          ? "Vehicle title/registration uploads are easiest to find later when linked to a vehicle."
          : kind === "estimate"
            ? "Estimates and invoices go to Needs Review before becoming official budget/accounting work."
            : "If you are not sure where this belongs, leave it as Not sure and the team can review it.";
}

function uploadConnectionCollections(){
  return {
    vehicle: activeItems("vehicles").map(item => ({ id:item.id, label:item.name })),
    place: [
      ...activeItems("buildings").map(item => ({ id:`building:${item.id}`, label:`Building: ${item.name}` })),
      ...activeItems("spaces").map(item => ({ id:`space:${item.id}`, label:`Space: ${item.name}` }))
    ],
    asset: activeItems("assets").map(item => ({ id:item.id, label:item.name })),
    work_order: activeItems("tasks").map(item => ({ id:item.id, label:item.workOrderNumber ? `${item.workOrderNumber} - ${item.name}` : item.name })),
    project: activeItems("projects").map(item => ({ id:item.id, label:item.name }))
  };
}

function clearUploadQuickLinkFields(){
  ["fileBuilding","fileSpace","fileAsset","fileProject","fileWorkOrder","fileVehicle"].forEach(idValue => {
    const el = document.getElementById(idValue);
    if(el) el.value = "";
  });
}

function applyUploadConnection(clearLinks = true){
  const connection = document.getElementById("uploadConnection")?.value || "not_sure";
  const label = document.getElementById("uploadRecordLabel");
  const record = document.getElementById("uploadConnectionRecord");
  const previousValue = record?.value || "";
  if(clearLinks) clearUploadQuickLinkFields();
  if(!label || !record) return;
  const items = uploadConnectionCollections()[connection] || [];
  label.classList.toggle("hidden", !items.length || connection === "not_sure");
  record.innerHTML = `<option value="">Choose one</option>` + items.map(item => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join("");
  if(previousValue && items.some(item => item.id === previousValue)) record.value = previousValue;
}

function applyUploadRecordLink(){
  const connection = document.getElementById("uploadConnection")?.value || "not_sure";
  const value = document.getElementById("uploadConnectionRecord")?.value || "";
  clearUploadQuickLinkFields();
  if(!value) return;
  if(connection === "vehicle" && document.getElementById("fileVehicle")) fileVehicle.value = value;
  if(connection === "asset" && document.getElementById("fileAsset")) fileAsset.value = value;
  if(connection === "work_order" && document.getElementById("fileWorkOrder")) fileWorkOrder.value = value;
  if(connection === "project" && document.getElementById("fileProject")) fileProject.value = value;
  if(connection === "place"){
    const [type, idValue] = value.split(":");
    if(type === "building" && document.getElementById("fileBuilding")) fileBuilding.value = idValue;
    if(type === "space" && document.getElementById("fileSpace")) fileSpace.value = idValue;
  }
}

async function saveDocumentMetadata({ docId, fileNameValue, fileTypeValue, storagePath, extractedText = "", extractionStatus = "not_supported", links = {}, notes = "" }){
  if(!requireInsertPermission("field_ops_documents", "upload documents")) throw new Error("Role cannot upload documents");
  const wid = workspaceId();
  const userId = currentSession?.user?.id || "";
  if(!wid || !userId) throw new Error("Upload blocked by permissions. Confirm workspace access or role.");
  const { error } = await insertDocumentMetadata(Mappers.documentMetadataPayload({ docId, workspaceId:wid, createdBy:userId, fileNameValue, fileTypeValue, storagePath, bucket:DOCUMENT_BUCKET, extractedText, extractionStatus, links, notes }));
  if(error) throw error;
  return docId;
}

async function uploadDocumentToStorage(file, docId){
  if(!requireAuth(true)) throw new Error("Upload blocked by permissions. Confirm workspace access or role.");
  const wid = workspaceId();
  if(!wid) throw new Error("Upload blocked by permissions. Confirm workspace access or role.");
  if(!navigator.onLine){
    setStatus("File not uploaded - offline");
    throw new Error("This file is not uploaded yet because the device is offline. Reconnect and try the upload again.");
  }
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const storagePath = `${wid}/${docId}/${safeName}`;
  const { error } = await uploadDocument(storagePath, file);
  if(error) throw error;
  return storagePath;
}



async function addFileRecord(e){
  e.preventDefault();
  try{
    if(!requireInsertPermission("field_ops_documents", "upload documents")) return;
    applyUploadKind();
    applyUploadRecordLink();
    setInlineState("fileSaveState", "Uploading...", "pending");
    setStatus("Uploading document...");
    const upload = document.getElementById("documentUpload").files[0];
    const docId = id();
    const fileNameValue = fileName.value || upload?.name || "document";
    let storagePath = `${workspaceId()}/${docId}/${fileNameValue.replace(/[^\w.\- ]+/g, "_")}`;
    let extractedText = "";
    let extractionStatus = "pending";

    if(upload){
      storagePath = await uploadDocumentToStorage(upload, docId);
      extractedText = await extractFileText(upload);
      extractionStatus = extractedText ? "complete" : "not_supported";
    } else {
      storagePath = fileNameValue;
      extractionStatus = "not_supported";
    }

    await saveDocumentMetadata({
      docId,
      fileNameValue,
      fileTypeValue:fileType.value,
      storagePath,
      extractedText,
      extractionStatus,
      links:{
        buildingId:fileBuilding.value,
        spaceId:fileSpace.value,
        assetId:fileAsset.value,
        projectId:fileProject.value,
        workOrderId:fileWorkOrder.value,
        vehicleId:fileVehicle.value,
        vendorId:fileBid.value,
        fuelReceiptId:fileFuelReceipt.value,
        budgetItemId:fileBudgetItem.value
      },
      notes:fileNotes.value
    });

    const uploadKind = document.getElementById("uploadKind")?.value || "";
    const uncertainUpload = (document.getElementById("uploadConnection")?.value || "not_sure") === "not_sure";
    if(extractedText || uncertainUpload){
      await createImportReview("document", typeToImportTarget(fileType.value), { file_name:fileNameValue, extracted_text:extractedText }, `Review extracted ${fileType.value} from ${fileNameValue}`, docId);
    }

    e.target.reset();
    setInlineState("fileSaveState", "Saved", "saved");
    setStatus("Document saved");
    const uploadDetail = uncertainUpload
      ? "It is waiting in Needs Review so the team can place it correctly."
      : uploadKind === "warranty" || uploadKind === "title"
        ? "The file was saved and will be easier to find from the linked vehicle, asset, or system."
        : "The file was saved and linked to the selected record.";
    InteractionService?.showConfirmation?.("Upload submitted", uploadDetail, uncertainUpload ? [
      { label:"Open Needs Review", run:() => showView("importReview") }
    ] : []);
    await refreshAfterWrite?.("Document saved");
  }catch(err){
    setInlineState("fileSaveState", `Upload failed: ${permissionAwareErrorMessage(err)}`, "failed");
    handleWriteError(err);
  }
}



function typeToImportTarget(type){
  if(type === "Fuel Receipt") return "fuel_receipt";
  if(type === "Vehicle Title / Registration") return "vehicle";
  if(type === "Warranty / Manual") return "asset";
  if(["Contract","Bid","Estimate","Invoice"].includes(type)) return "budget_item";
  if(type === "Inspection") return "work_order";
  return "work_order";
}



function renderFiles(){
  const files = activeItems("files");
  applyUploadKind();
  applyUploadConnection(false);
  ensureDocumentPreviewUrls(files);
  document.getElementById("fileList").innerHTML = files.length ? files.map(f => {
    const building = app.buildings.find(b => b.id === f.relatedBuildingId);
    const space = app.spaces.find(s => s.id === f.relatedSpaceId);
    const asset = app.assets.find(a => a.id === f.relatedAssetId);
    const project = app.projects.find(p => p.id === f.relatedProjectId);
    const workOrder = app.tasks.find(t => t.id === f.relatedWorkItemId);
    const vehicle = app.vehicles.find(v => v.id === f.relatedVehicleId);
    const vendor = app.vendors.find(v => v.id === f.relatedVendorId);
    const budgetItem = app.budgetItems.find(b => b.id === f.relatedBudgetItemId);
    const anchor = asset ? `Asset/System anchor: ${asset.name}` : vehicle ? `Vehicle anchor: ${vehicle.name}` : space ? `Space anchor: ${space.name}` : building ? `Building anchor: ${building.name}` : "";
    const linkedLines = [anchor, building ? `Building: ${building.name}` : "", space ? `Space: ${space.name}` : "", asset ? `Asset/System: ${asset.name}` : "", project ? `Project: ${project.name}` : "", workOrder ? `Work order: ${workOrder.workOrderNumber || workOrder.name}` : "", vehicle ? `Vehicle: ${vehicle.name}` : "", vendor ? `Vendor: ${vendor.name}` : "", budgetItem ? `Budget: ${budgetItem.label}` : ""];
    return documentPreviewCard({ ...f, contextLabel:documentContextLabel(f), notes:compact([...linkedLines, f.notes]).join("\n") }) + rowActions("files", f);
  }).join("") : empty("No documents linked yet.");
  renderLinkedDocumentPanels();
}

function documentContextLabel(file){
  if(file.relatedWorkItemId) return "Linked to work order";
  if(file.relatedProjectId) return "Linked to project";
  if(file.relatedVehicleId) return "Linked to vehicle";
  if(file.relatedAssetId) return "Linked to asset/system";
  if(file.relatedSpaceId) return "Linked to space";
  if(file.relatedBuildingId) return "Linked to building";
  if(file.relatedVendorId) return "Linked to vendor";
  if(file.relatedFuelReceiptId) return "Linked to fuel receipt";
  if(file.relatedBudgetItemId) return "Linked to budget";
  return "Attached file";
}

function ensureDocumentPreviewUrls(files){
  if(!Array.isArray(files) || typeof createDocumentPreviewUrl !== "function") return;
  const pending = files.filter(file => file.storagePath && file.source === DOCUMENT_BUCKET && !file.previewUrl && !file.previewUrlPending && !file.previewUrlError);
  if(!pending.length) return;
  pending.forEach(file => {
    const cached = previewUrlCache.get(file.storagePath);
    if(cached){
      file.previewUrl = cached;
      return;
    }
    file.previewUrlPending = true;
    createDocumentPreviewUrl(file.storagePath)
      .then(({ data, error }) => {
        if(error) throw error;
        file.previewUrl = data?.signedUrl || "";
        if(file.previewUrl) previewUrlCache.set(file.storagePath, file.previewUrl);
        else file.previewUrlError = true;
      })
      .catch(err => {
        console.error("File preview link failed", err);
        file.previewUrlError = true;
      })
      .finally(() => {
        file.previewUrlPending = false;
        renderFiles();
      });
  });
}



function renderLinkedDocumentPanels(){
  const configs = [
    ["buildingList", "buildings", f => f.relatedBuildingId, "buildings"],
    ["spaceList", "spaces", f => f.relatedSpaceId, "spaces"],
    ["assetList", "assets", f => f.relatedAssetId, "assets"],
    ["projectList", "projects", f => f.relatedProjectId, "projects"],
    ["vehicleList", "vehicles", f => f.relatedVehicleId, "vehicles"],
    ["vendorList", "vendors", f => f.relatedVendorId, "vendors"],
    ["fuelReceiptList", "fuelReceipts", f => f.relatedFuelReceiptId, "fuelReceipts"],
    ["budgetList", "budgetItems", f => f.relatedBudgetItemId, "budgetItems"]
  ];
  configs.forEach(([containerId, section, getDocumentLink]) => {
    const container = document.getElementById(containerId);
    if(!container || !activeItems(section).length) return;
    container.querySelectorAll("[data-linked-docs-for]").forEach(el => el.remove());
    activeItems(section).forEach(item => {
      const docs = activeItems("files").filter(file => getDocumentLink(file) === item.id);
      if(!docs.length) return;
      const itemIndex = activeItems(section).indexOf(item);
      const block = document.createElement("div");
      block.className = "linked-doc-strip";
      block.dataset.linkedDocsFor = item.id;
      block.innerHTML = `<strong>Linked documents</strong>${docs.map(doc => `<span>${esc(doc.fileName)}</span>`).join("")}`;
      const cards = container.querySelectorAll(".card");
      cards[itemIndex]?.insertAdjacentElement("afterend", block);
    });
  });
}



  Object.assign(window.FieldOps.Views, {
    saveDocumentMetadata,
    uploadDocumentToStorage,
    addFileRecord,
    typeToImportTarget,
    renderFiles,
    renderLinkedDocumentPanels,
    ensureDocumentPreviewUrls,
    documentContextLabel
  });
  Object.assign(globalThis, {
    saveDocumentMetadata,
    uploadDocumentToStorage,
    addFileRecord,
    typeToImportTarget,
    renderFiles,
    renderLinkedDocumentPanels,
    ensureDocumentPreviewUrls,
    documentContextLabel
  });
  document.getElementById("uploadKind")?.addEventListener("change", applyUploadKind);
  document.getElementById("uploadConnection")?.addEventListener("change", applyUploadConnection);
  document.getElementById("uploadConnectionRecord")?.addEventListener("change", applyUploadRecordLink);
})();

