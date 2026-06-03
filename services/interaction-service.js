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
  const DISMISSED_PROMPTS_KEY = "field_ops_dismissed_prompts";
  const NOTIFICATIONS_KEY = "field_ops_notifications";

  function readJson(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key) || ""); }catch(_err){ return fallback; }
  }

  function writeJson(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_err){}
  }

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

  function showConfirmation(title, detail = "", actions = []){
    const body = document.body;
    if(!body || typeof body.appendChild !== "function" || typeof document.createElement !== "function") return;
    const existing = typeof document.querySelector === "function" ? document.querySelector(".success-screen-backdrop") : null;
    if(existing && typeof existing.remove === "function") existing.remove();
    const dialog = document.createElement("section");
    dialog.className = "success-screen-backdrop";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "successScreenTitle");
    dialog.innerHTML = `
      <div class="success-screen" role="document">
        <div class="success-icon" aria-hidden="true">✓</div>
        <div>
          <p class="eyebrow">Saved</p>
          <h2 id="successScreenTitle">${esc(title)}</h2>
          ${detail ? `<p>${esc(detail)}</p>` : ""}
        </div>
        <div class="success-actions">
          ${actions.map((action, index) => `<button type="button" class="${index ? "ghost" : ""}" data-confirm-action="${index}">${esc(action.label)}</button>`).join("")}
          <button type="button" class="ghost" data-confirm-done>Done</button>
        </div>
      </div>
    `;
    const close = () => dialog.remove();
    dialog.querySelectorAll("[data-confirm-action]")?.forEach(button => {
      button.addEventListener("click", () => {
        const action = actions[Number(button.dataset.confirmAction)];
        if(typeof action?.run === "function") action.run();
        close();
      });
    });
    dialog.querySelector("[data-confirm-done]")?.addEventListener("click", close);
    dialog.addEventListener("click", event => {
      if(event.target === dialog) close();
    });
    const escapeHandler = event => {
      if(event.key === "Escape"){
        close();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);
    body.appendChild(dialog);
    dialog.querySelector("[data-confirm-done]")?.focus();
    showToast(title, "saved");
  }

  function showConfirmDialog({
    title = "Are you sure?",
    detail = "This can be changed later if needed.",
    confirmLabel = "Continue",
    cancelLabel = "Cancel",
    reassurance = "",
    tone = "normal"
  } = {}){
    const body = document.body;
    if(!body || typeof body.appendChild !== "function" || typeof document.createElement !== "function"){
      return Promise.resolve(false);
    }
    return new Promise(resolve => {
      const existing = typeof document.querySelector === "function" ? document.querySelector(".confirm-dialog-backdrop") : null;
      if(existing && typeof existing.remove === "function") existing.remove();
      const dialog = document.createElement("section");
      dialog.className = "confirm-dialog-backdrop";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "confirmDialogTitle");
      dialog.innerHTML = `
        <div class="confirm-dialog" role="document">
          <div>
            <p class="eyebrow">Please confirm</p>
            <h2 id="confirmDialogTitle">${esc(title)}</h2>
            <p>${esc(detail)}</p>
            ${reassurance ? `<p class="meta">${esc(reassurance)}</p>` : ""}
          </div>
          <div class="confirm-actions">
            <button type="button" class="ghost" data-confirm-cancel>${esc(cancelLabel)}</button>
            <button type="button" class="${tone === "danger" ? "danger" : ""}" data-confirm-accept>${esc(confirmLabel)}</button>
          </div>
        </div>
      `;
      const finish = value => {
        dialog.remove();
        document.removeEventListener("keydown", escapeHandler);
        resolve(value);
      };
      const escapeHandler = event => {
        if(event.key === "Escape") finish(false);
      };
      dialog.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => finish(false));
      dialog.querySelector("[data-confirm-accept]")?.addEventListener("click", () => finish(true));
      dialog.addEventListener("click", event => {
        if(event.target === dialog) finish(false);
      });
      document.addEventListener("keydown", escapeHandler);
      body.appendChild(dialog);
      dialog.querySelector("[data-confirm-cancel]")?.focus();
    });
  }

  function dismissedPromptKeys(){
    return new Set(readJson(DISMISSED_PROMPTS_KEY, []));
  }

  function dismissWorkflowPrompt(key){
    const keys = dismissedPromptKeys();
    keys.add(key);
    writeJson(DISMISSED_PROMPTS_KEY, Array.from(keys));
    document.querySelector?.(`[data-workflow-prompt="${esc(key)}"]`)?.remove();
  }

  function showWorkflowPrompt({ key, title, detail = "", actions = [] }){
    if(!key || dismissedPromptKeys().has(key)) return;
    const dock = document.getElementById("workflowPromptDock");
    if(!dock) return;
    const existing = dock.querySelector(`[data-workflow-prompt="${CSS.escape(key)}"]`);
    if(existing) existing.remove();
    const prompt = document.createElement("article");
    prompt.className = "workflow-prompt";
    prompt.dataset.workflowPrompt = key;
    prompt.innerHTML = `
      <div>
        <p class="eyebrow">What next?</p>
        <h3>${esc(title)}</h3>
        ${detail ? `<p>${esc(detail)}</p>` : ""}
      </div>
      <div class="workflow-prompt-actions">
        ${actions.map((action, index) => `<button type="button" class="${index ? "ghost" : ""}" data-workflow-action="${index}">${esc(action.label)}</button>`).join("")}
        <button type="button" class="ghost" data-workflow-dismiss>Not now</button>
      </div>
    `;
    prompt.querySelectorAll("[data-workflow-action]")?.forEach(button => {
      button.addEventListener("click", () => {
        const action = actions[Number(button.dataset.workflowAction)];
        if(typeof action?.run === "function") action.run();
        dismissWorkflowPrompt(key);
      });
    });
    prompt.querySelector("[data-workflow-dismiss]")?.addEventListener("click", () => dismissWorkflowPrompt(key));
    dock.prepend(prompt);
    dock.classList.remove("hidden");
  }

  function notifications(){
    return readJson(NOTIFICATIONS_KEY, []);
  }

  function addNotification({ type = "update", title, detail = "", view = "", recordId = "", role = "all" }){
    if(!title) return;
    const items = notifications();
    const idValue = `${type}:${recordId || title}:${Date.now()}`;
    items.unshift({
      id:idValue,
      type,
      title,
      detail,
      view,
      recordId,
      role,
      read:false,
      createdAt:new Date().toISOString()
    });
    writeJson(NOTIFICATIONS_KEY, items.slice(0, 80));
    if(typeof window.renderNotifications === "function") window.renderNotifications();
  }

  function markNotificationRead(idValue){
    const items = notifications().map(item => item.id === idValue ? { ...item, read:true } : item);
    writeJson(NOTIFICATIONS_KEY, items);
    if(typeof window.renderNotifications === "function") window.renderNotifications();
  }

  function clearNotifications(){
    writeJson(NOTIFICATIONS_KEY, []);
    if(typeof window.renderNotifications === "function") window.renderNotifications();
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
    const first = document.querySelector?.(".add-new-option");
    if(typeof window.openManagedModal === "function") window.openManagedModal(modal, first);
    else {
      modal.classList.remove("hidden");
      if(first && typeof first.focus === "function") first.focus();
    }
  }

  function closeAddNew(){
    const modal = document.getElementById("addNewModal");
    if(typeof window.closeManagedModal === "function") window.closeManagedModal(modal);
    else modal?.classList.add("hidden");
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
    showConfirmation,
    showConfirmDialog,
    showWorkflowPrompt,
    dismissWorkflowPrompt,
    notifications,
    addNotification,
    markNotificationRead,
    clearNotifications,
    openAddNew,
    closeAddNew,
    initAddNewModal,
    initReviewDropZone,
    setDroppedReviewFile,
    clearDroppedReviewFile,
    init
  };
})();

