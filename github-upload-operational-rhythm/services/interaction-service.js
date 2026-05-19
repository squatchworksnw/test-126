(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const adminAddNewOptions = [
    { label:"Work Order", view:"workOrders", detail:"Repair, inspection, service call, or follow-up tied to an asset, system, space, building, or vehicle." },
    { label:"Document / Receipt", view:"documents", detail:"Upload a photo, receipt, PDF, spreadsheet, invoice, or supporting file." },
    { label:"Vehicle", view:"vehicles", detail:"Mobile asset record with VIN, plate, mileage, service dates, and documents." },
    { label:"Project", view:"projects", detail:"Repair, remodel, approval, or contractor scope." },
    { label:"Vendor", view:"vendors", detail:"Subcontractor, service vendor, bid contact, or supplier." }
  ];
  const ownerAddNewOptions = [
    ...adminAddNewOptions,
    { label:"Building / Space / Asset", view:"buildings", detail:"Facility anchors, rooms, equipment, systems, or field locations." }
  ];
  const submitterAddNewOptions = [
    { label:"Submit Request", view:"importReview", action:"openSubmitRequest", detail:"Send location, urgency, notes, and an optional file." },
    { label:"Upload File", view:"documents", detail:"Photo, PDF, spreadsheet, estimate, or supporting document. Uploads go to Needs Review first." },
    { label:"Upload Receipt", view:"documents", detail:"Gas, supply, invoice, or purchase receipt. This helps route review, but does not replace any required accounting receipt process." },
    { label:"Purchase / Supply Request", view:"materials", action:"openSupplyRequest", detail:"Materials, supplies, event needs, gifts, marketing items, or other purchase/order requests." }
  ];

  function currentAddNewOptions(){
    if(typeof window.canSubmitOnly === "function" && window.canSubmitOnly()) return submitterAddNewOptions;
    if(typeof window.isOwner === "function" && window.isOwner()) return ownerAddNewOptions;
    return adminAddNewOptions;
  }

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[char]));
  }

  function showToast(message, state = "saved"){
    const body = document.body;
    if(!body || typeof body.appendChild !== "function" || typeof document.createElement !== "function") return;
    const existing = typeof document.querySelector === "function" ? document.querySelector(".toast-message") : null;
    if(existing && typeof existing.remove === "function") existing.remove();
    const toast = document.createElement("div");
    toast.className = `toast-message ${state}`;
    toast.textContent = message;
    body.appendChild(toast);
    if(typeof window.setTimeout === "function"){
      window.setTimeout(() => {
        if(typeof toast.remove === "function") toast.remove();
      }, 2600);
    }
  }

  function renderAddNewOptions(){
    const grid = document.getElementById("addNewGrid");
    if(!grid) return;
    grid.innerHTML = currentAddNewOptions().map(option => `
      <button class="add-new-option" type="button" data-target-view="${esc(option.view)}" data-target-action="${esc(option.action || "")}">
        <strong>${esc(option.label)}</strong>
        <span>${esc(option.detail)}</span>
      </button>
    `).join("");
  }

  function openAddNew(){
    const modal = document.getElementById("addNewModal");
    if(!modal) return;
    renderAddNewOptions();
    modal.classList.remove("hidden");
    const first = document.querySelector?.(".add-new-option");
    if(first && typeof first.focus === "function") first.focus();
  }

  function closeAddNew(){
    document.getElementById("addNewModal")?.classList.add("hidden");
  }

  function handleAddNewSelection(event){
    const button = event.target?.closest?.("[data-target-view]");
    if(!button) return;
    const view = button.dataset.targetView;
    const action = button.dataset.targetAction;
    closeAddNew();
    if(action && typeof window[action] === "function") window[action]();
    else if(typeof window.showView === "function") window.showView(view);
  }

  function initAddNewModal(){
    document.querySelectorAll?.("[data-open-add-new]").forEach(button => {
      button.addEventListener("click", openAddNew);
    });
    document.getElementById("openAddNewBtn")?.addEventListener("click", openAddNew);
    document.getElementById("closeAddNewBtn")?.addEventListener("click", closeAddNew);
    document.getElementById("addNewGrid")?.addEventListener("click", handleAddNewSelection);
    document.getElementById("addNewModal")?.addEventListener("click", event => {
      if(event.target?.id === "addNewModal") closeAddNew();
    });
    document.addEventListener?.("keydown", event => {
      if(event.key === "Escape") closeAddNew();
    });
  }

  function filePreviewMarkup(file){
    const isImage = /^image\//.test(file?.type || "");
    let image = "";
    if(isImage && window.URL && typeof window.URL.createObjectURL === "function"){
      image = `<img alt="" src="${esc(window.URL.createObjectURL(file))}" />`;
    }
    return `
      <div class="upload-preview-card">
        ${image}
        <div>
          <strong>${esc(file?.name || "Selected file")}</strong>
          <p class="meta">${esc(file?.type || "Unknown file type")} ${file?.size ? `- ${Math.round(file.size / 1024)} KB` : ""}</p>
        </div>
      </div>
    `;
  }

  function setDroppedReviewFile(file){
    window.FieldOps.Services.interactions.droppedReviewFile = file || null;
    const preview = document.getElementById("reviewUploadPreview");
    if(preview) preview.innerHTML = file ? filePreviewMarkup(file) : "";
  }

  function clearDroppedReviewFile(){
    setDroppedReviewFile(null);
  }

  function initReviewDropZone(){
    const zone = document.getElementById("reviewDropZone");
    const input = document.getElementById("submissionUpload");
    if(!zone) return;

    ["dragenter", "dragover"].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.add("active");
    }));
    ["dragleave", "drop"].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.remove("active");
    }));
    zone.addEventListener("drop", event => {
      const file = event.dataTransfer?.files?.[0];
      if(file){
        setDroppedReviewFile(file);
        showToast("File staged for Needs Review", "pending");
      }
    });
    zone.addEventListener("click", () => input?.click());
    zone.addEventListener("keydown", event => {
      if(event.key === "Enter" || event.key === " ") input?.click();
    });
    input?.addEventListener("change", event => {
      setDroppedReviewFile(event.target.files?.[0] || null);
    });
  }

  function init(){
    initAddNewModal();
    initReviewDropZone();
  }

  window.FieldOps.Services.interactions = {
    addNewOptions: adminAddNewOptions,
    currentAddNewOptions,
    droppedReviewFile: null,
    showToast,
    openAddNew,
    closeAddNew,
    initAddNewModal,
    initReviewDropZone,
    setDroppedReviewFile,
    clearDroppedReviewFile,
    init
  };
})();

