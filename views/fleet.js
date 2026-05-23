(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Views = window.FieldOps.Views || {};
  const Mappers = window.FieldOps.Services.mappers;

  function daysUntil(dateValue){
    if(!dateValue) return null;
    const today = new Date(todayString());
    const target = new Date(dateValue);
    if(Number.isNaN(target.getTime())) return null;
    return Math.ceil((target - today) / 86400000);
  }

  function serviceDueState(vehicle){
    const days = daysUntil(vehicle.serviceDate);
    if(days === null) return { state:"not_scheduled", label:"No service date", tone:"" };
    if(days < 0) return { state:"overdue", label:`Service overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, tone:"danger" };
    if(days <= 14) return { state:"due_soon", label:`Service due in ${days} day${days === 1 ? "" : "s"}`, tone:"warning" };
    return { state:"scheduled", label:`Next service: ${vehicle.serviceDate}`, tone:"ok" };
  }

  function registrationAlertState(vehicle){
    const days = daysUntil(vehicle.registration);
    if(days === null) return { state:"not_tracked", label:"No registration date", tone:"" };
    if(days < 0) return { state:"expired", label:`Registration overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, tone:"danger" };
    if(days <= 30) return { state:"due_soon", label:`Registration due in ${days} day${days === 1 ? "" : "s"}`, tone:"warning" };
    return { state:"current", label:`Registration: ${vehicle.registration}`, tone:"ok" };
  }

  function fleetDocumentsForVehicle(vehicle){
    return activeItems("files").filter(file => file.relatedVehicleId === vehicle.id);
  }

  function fleetDocumentsForFuelReceipt(receipt){
    return activeItems("files").filter(file => file.relatedFuelReceiptId === receipt.id);
  }

  function vehicleDetailLines(vehicle){
    return [
      `Vehicle #: ${vehicle.vehicleNumber || "Not entered"}`,
      `Plate: ${vehicle.plate || "Not entered"}`,
      `VIN: ${vehicle.vin || "Not entered"}`,
      `Odometer: ${vehicle.mileage || "Not entered"}`,
      vehicle.notes
    ];
  }

  function vehicleTags(vehicle){
    return [
      titleize(vehicle.status),
      vehicle.lastServiceDate ? `Last service: ${vehicle.lastServiceDate}` : "",
      vehicle.serviceDate ? `Next service: ${vehicle.serviceDate}` : "",
      vehicle.registration ? `Registration: ${vehicle.registration}` : ""
    ];
  }

  function renderVehicleCard(vehicle){
    return card(vehicle.name, vehicleDetailLines(vehicle), vehicleTags(vehicle), tone(vehicle.status)) + vehicleStoryPanel(vehicle);
  }

  function renderVehicleDetail(vehicle){
    const service = serviceDueState(vehicle);
    const registration = registrationAlertState(vehicle);
    const docs = fleetDocumentsForVehicle(vehicle);
    return card(
      vehicle.name,
      [...vehicleDetailLines(vehicle), service.label, registration.label, docs.length ? `Linked documents: ${docs.length}` : ""],
      [...vehicleTags(vehicle), service.state !== "not_scheduled" ? service.label : "", registration.state !== "not_tracked" ? registration.label : ""],
      service.tone || registration.tone || tone(vehicle.status)
    );
  }

  function renderVehicleAlertCard(alert){
    return card(
      alert.name,
      [`Plate: ${alert.license_plate || "Not entered"}`, `Odometer: ${alert.odometer || "Not entered"}`],
      [titleize(alert.alert_state), alert.next_service_date, alert.registration_due_date],
      tone(alert.alert_state)
    );
  }

  function renderFuelReceiptCard(receipt){
    const vehicle = app.vehicles.find(v => v.id === receipt.vehicleId);
    const docs = fleetDocumentsForFuelReceipt(receipt);
    return card(
      vehicle?.name || "Fuel receipt",
      [
        `Station/vendor: ${receipt.vendor || "Not entered"}`,
        receipt.gallons ? `Gallons: ${receipt.gallons}` : "",
        receipt.pricePerGallon ? `Price/gal: ${money(receipt.pricePerGallon)}` : "",
        receipt.odometer ? `Odometer: ${receipt.odometer}` : "",
        docs.length ? `Linked documents: ${docs.length}` : "",
        receipt.notes
      ],
      [receipt.date, money(receipt.totalAmount)],
      ""
    );
  }

  function storyRows(items, emptyText, formatter){
    return items.length ? items.slice(0,5).map(formatter).join("") + (items.length > 5 ? `<p>+ ${items.length - 5} more</p>` : "") : `<p>${esc(emptyText)}</p>`;
  }

  function vehicleContinuitySummary(work, docs){
    const completed = work.filter(item => !isOpenRecord(item));
    const recurring = work.filter(item => /service|repair|scheduled from master calendar|recurring|master import key:/i.test(`${item.notes || ""} ${item.type || ""} ${item.name || ""}`));
    return `<section class="object-story-section"><h4>Continuity</h4>
      <p>${esc(`${completed.length} completed vehicle record${completed.length === 1 ? "" : "s"}`)}</p>
      <p>${esc(`${docs.length} linked upload${docs.length === 1 ? "" : "s"} or document${docs.length === 1 ? "" : "s"}`)}</p>
      <p>${esc(recurring.length > 1 ? "Recurring service pattern visible" : "Service pattern still building")}</p>
    </section>`;
  }

  function activityLine(action, item){
    const date = item?.updatedAt || item?.createdAt || item?.date || "time not recorded";
    return `<p>${esc(action)} — workspace — ${esc(date)}</p>`;
  }

  function isOpenRecord(item){
    return !["complete","completed","closed","archived","canceled"].includes(String(item.status || "").toLowerCase());
  }

  function vehicleStoryPanel(vehicle){
    const docs = fleetDocumentsForVehicle(vehicle);
    const work = activeItems("tasks").filter(task => task.vehicleId === vehicle.id);
    const openWork = work.filter(isOpenRecord);
    const history = work.filter(task => !isOpenRecord(task));
    const recurring = work.filter(task => /scheduled from master calendar|recurring|master import key:/i.test(`${task.notes || ""} ${task.type || ""}`));
    const titles = docs.filter(doc => /title|registration|warranty|manual/i.test(`${doc.fileType || ""} ${doc.fileName || ""} ${doc.notes || ""}`));
    const photos = docs.filter(doc => /photo|image|jpg|jpeg|png|heic/i.test(`${doc.fileType || ""} ${doc.fileName || ""}`));
    return `<details class="object-story">
      <summary>Story: ${docs.length} file${docs.length === 1 ? "" : "s"}, ${history.length} completed, ${openWork.length} open</summary>
      <div class="object-story-grid">
        <section class="object-story-section"><h4>Overview</h4>${storyRows([vehicle], "No overview yet.", item => `<p>${esc(compact([item.vehicleNumber ? `Vehicle #: ${item.vehicleNumber}` : "", item.plate ? `Plate: ${item.plate}` : "", item.vin ? `VIN: ${item.vin}` : "", item.mileage ? `Odometer: ${item.mileage}` : "", titleize(item.status)]).join(" | "))}</p>`)}</section>
        <section class="object-story-section"><h4>History</h4>${storyRows(history, "No completed vehicle repairs yet.", item => `<p>${esc(compact([item.date, item.workOrderNumber, item.name]).join(" | "))}</p>`)}</section>
        <section class="object-story-section"><h4>Documents</h4>${storyRows(docs, "No linked documents yet.", doc => `<p>${esc(doc.fileName)}</p>`)}</section>
        <section class="object-story-section"><h4>Warranties / Titles</h4>${storyRows(titles, "No titles, registration, warranties, or manuals linked yet.", doc => `<p>${esc(doc.fileName)}</p>`)}</section>
        <section class="object-story-section"><h4>Photos</h4>${storyRows(photos, "No photos linked yet.", doc => `<p>${esc(doc.fileName)}</p>`)}</section>
        <section class="object-story-section"><h4>Open Work</h4>${storyRows(openWork, "No open work linked.", item => `<p>${esc(compact([item.date, item.workOrderNumber, item.name]).join(" | "))}</p>`)}</section>
        <section class="object-story-section"><h4>Recurring Maintenance</h4>${storyRows(recurring, "No recurring maintenance linked yet.", item => `<p>${esc(compact([item.date, item.name]).join(" | "))}</p>`)}</section>
        ${vehicleContinuitySummary(work, docs)}
        <section class="object-story-section"><h4>Activity</h4>${storyRows(work.slice().sort((a,b) => String(b.updatedAt || b.date || "").localeCompare(String(a.updatedAt || a.date || ""))), "No activity recorded yet.", item => activityLine(titleize(item.status || "Updated"), item))}</section>
      </div>
    </details>`;
  }

  async function addVehicle(e){
    e.preventDefault();
    try{
      await insertRecord("field_ops_vehicles", Mappers.vehiclePayloadFromForm({ name:vehicleName.value, vehicleNumber:vehicleNumber.value, plate:vehiclePlate.value, vin:vehicleVin.value, mileage:vehicleMileage.value, status:vehicleStatus.value, lastServiceDate:vehicleLastService.value, serviceDate:vehicleService.value, registration:vehicleRegistration.value, warranty:vehicleWarranty.value, notes:vehicleNotes.value }));
      e.target.reset();
      InteractionService?.showConfirmation?.("Vehicle added", "This vehicle is now available for service history, receipts, documents, and assigned work.");
    }catch(err){ handleWriteError(err); }
  }

  async function addFuelReceipt(e){
    e.preventDefault();
    const form = e.currentTarget || e.target;
    const submitButton = form?.querySelector?.("button[type='submit']");
    const originalText = submitButton?.textContent || "Add Fuel Receipt";
    try{
      if(!requireOperationsPermission("create fuel receipts")) return;
      if(!fuelVehicle.value){
        setInlineState("fuelReceiptSaveState", "Choose a vehicle before saving.", "failed");
        return;
      }
      if(submitButton){
        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
      }
      setInlineState("fuelReceiptSaveState", "Saving fuel receipt and budget item...", "pending");
      setStatus("Saving fuel receipt...");
      const payload = {
        p_workspace_id: workspaceId(),
        p_vehicle_id: fuelVehicle.value,
        p_receipt_date: fuelDate.value || null,
        p_gas_station: fuelVendor.value || null,
        p_gallons: fuelGallons.value === "" ? null : Number(fuelGallons.value),
        p_total_amount: fuelTotal.value === "" ? 0 : Number(fuelTotal.value),
        p_price_per_gallon: fuelPrice.value === "" ? null : Number(fuelPrice.value),
        p_odometer: fuelOdometer.value === "" ? null : Number(fuelOdometer.value),
        p_notes: [fuelReceiptFile.value ? `Receipt/link: ${fuelReceiptFile.value}` : "", fuelNotes.value].filter(Boolean).join("\n") || null
      };
      const { data, error } = await createFuelReceiptWithBudget(payload);
      if(error) throw withFuelReceiptCallDetails(error, payload);
      if(data?.status !== "success") throw withFuelReceiptCallDetails(new Error("Fuel receipt transaction did not return success."), payload);
      form.reset();
      setInlineState("fuelReceiptSaveState", "Fuel receipt saved with budget item.", "saved");
      await refreshAfterWrite?.("Fuel receipt saved with budget item");
    }catch(err){
      console.error(err);
      setInlineState("fuelReceiptSaveState", `Fuel receipt save failed: ${fuelReceiptErrorMessage(err)}`, "failed");
      handleWriteError(err);
    }finally{
      if(submitButton){
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  function withFuelReceiptCallDetails(error, payload){
    error.fieldOpsCall = { rpc:"field_ops_create_fuel_receipt_with_budget", payload };
    return error;
  }

  function fuelReceiptErrorMessage(err){
    const base = permissionAwareErrorMessage(err);
    return err?.fieldOpsCall ? `${base} (${err.fieldOpsCall.rpc})` : base;
  }

  function renderFleet(){
    const vehicles = activeItems("vehicles");
    document.getElementById("vehicleList").innerHTML = vehicles.length ? vehicles.map(v => renderVehicleCard(v) + rowActions("vehicles", v)).join("") : empty("No vehicles yet.");
    const options = `<option value="">No related vehicle</option>` + vehicles.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join("");
    document.getElementById("fileVehicle").innerHTML = options;
    document.getElementById("taskVehicle").innerHTML = options;
    document.getElementById("fuelVehicle").innerHTML = `<option value="">Select vehicle</option>` + vehicles.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join("");
  }

  function renderFuelReceipts(){
    const receipts = activeItems("fuelReceipts");
    document.getElementById("fileFuelReceipt").innerHTML = `<option value="">No related fuel receipt</option>` + receipts.map(r => `<option value="${r.id}">${esc([r.date, money(r.totalAmount)].join(" - "))}</option>`).join("");
    if(document.getElementById("budgetFuelReceipt")) document.getElementById("budgetFuelReceipt").innerHTML = `<option value="">No related fuel receipt</option>` + receipts.map(r => `<option value="${r.id}">${esc([r.date, money(r.totalAmount)].join(" - "))}</option>`).join("");
    document.getElementById("fuelReceiptList").innerHTML = receipts.length ? receipts.map(r => renderFuelReceiptCard(r) + rowActions("fuelReceipts", r)).join("") : empty("No fuel receipts yet.");
  }

  const FleetWorkspace = {
    addVehicle,
    addFuelReceipt,
    daysUntil,
    serviceDueState,
    registrationAlertState,
    fleetDocumentsForVehicle,
    fleetDocumentsForFuelReceipt,
    renderVehicleCard,
    renderVehicleDetail,
    renderVehicleAlertCard,
    renderFuelReceiptCard,
    renderFleet,
    renderFuelReceipts
  };

  window.FieldOps.Views.FleetWorkspace = FleetWorkspace;

  Object.assign(window.FieldOps.Views, {
    addVehicle,
    addFuelReceipt,
    renderFleet,
    renderFuelReceipts
  });
  Object.assign(globalThis, {
    addVehicle,
    addFuelReceipt,
    renderFleet,
    renderFuelReceipts
  });
})();

