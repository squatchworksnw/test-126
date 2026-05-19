(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const demoPrefix = "demo-";

  const demoRows = {
    buildings: [
      { id:"demo-building-francis", name:"Francis Center", code:"FR", address:"Demo campus", status:"active", notes:"Demo facilities hub.", updated_at:"2026-05-14" },
      { id:"demo-building-valley", name:"Valley Kitchen", code:"VK", address:"Demo kitchen", status:"active", notes:"Demo meal prep space.", updated_at:"2026-05-14" }
    ],
    spaces: [
      { id:"demo-space-kitchen", building_id:"demo-building-valley", name:"Kitchen", space_type:"Kitchen", floor:"1", status:"active", notes:"Demo hot line and prep area.", updated_at:"2026-05-14" },
      { id:"demo-space-restroom-2", building_id:"demo-building-francis", name:"Restroom 2", space_type:"Restroom", floor:"1", status:"active", notes:"Demo plumbing location.", updated_at:"2026-05-14" }
    ],
    assets: [
      { id:"demo-asset-sink", building_id:"demo-building-francis", space_id:"demo-space-restroom-2", name:"Restroom Sink", asset_tag:"FR-RR2-SINK", category:"Plumbing", status:"needs_service", notes:"Demo slow leak under basin.", updated_at:"2026-05-14" }
    ],
    projects: [
      { id:"demo-project-refresh", name:"Kitchen Refresh", status:"in_progress", priority:"high", target_date:"2026-05-28", estimated_cost:4200, approved_budget:5000, summary:"Demo finish and fixture work.", notes:"Used for board-ready reporting demo.", updated_at:"2026-05-14" }
    ],
    vendors: [
      { id:"demo-vendor-plumbing", name:"Excelsior Plumbing", vendor_type:"Plumbing", contact_name:"Demo Contact", phone:"", email:"", status:"active", insurance_expires_on:null, notes:"Demo vendor for sink repair.", updated_at:"2026-05-14" }
    ],
    workOrders: [
      { id:"demo-wo-sink", work_order_number:"DEMO-1001", title:"Fix sink leak in Restroom 2", type:"general", status:"open", priority:"urgent", due_date:"2026-05-15", project_id:"demo-project-refresh", building_id:"demo-building-francis", space_id:"demo-space-restroom-2", asset_id:"demo-asset-sink", vehicle_id:null, vendor_id:"demo-vendor-plumbing", description:"Water visible under sink after use.", notes:"Demo work order connected across building, space, asset, vendor, project, and document.", updated_at:"2026-05-14" }
    ],
    vehicles: [
      { id:"demo-vehicle-van-1", name:"Van 1", vehicle_number:"1", license_plate:"MOW-101", vin:"DEMO-VIN-0001", odometer:84210, status:"due_for_service", last_service_date:"2026-02-01", next_service_date:"2026-05-20", registration_due_date:"2026-06-15", notes:"Demo fleet record with upcoming service.", updated_at:"2026-05-14" }
    ],
    fuelReceipts: [
      { id:"demo-fuel-1", vehicle_id:"demo-vehicle-van-1", vendor_id:null, budget_item_id:"demo-budget-fuel", receipt_document_id:"demo-doc-fuel", receipt_date:"2026-05-13", gas_station:"Demo Fuel Stop", gallons:12.3, total_amount:47.25, price_per_gallon:3.841, odometer:84210, notes:"Demo gas receipt.", updated_at:"2026-05-14" }
    ],
    budgetItems: [
      { id:"demo-budget-fuel", project_id:null, work_order_id:null, vendor_id:null, fuel_receipt_id:"demo-fuel-1", label:"Fuel - Van 1", item_type:"fuel", status:"submitted", amount:47.25, date_received:"2026-05-13", notes:"Demo fuel budget item.", updated_at:"2026-05-14" },
      { id:"demo-budget-bid", project_id:"demo-project-refresh", work_order_id:"demo-wo-sink", vendor_id:"demo-vendor-plumbing", fuel_receipt_id:null, label:"Excelsior Plumbing", item_type:"bid", status:"submitted", amount:625, date_received:"2026-05-12", notes:"Demo bid for restroom sink repair.", updated_at:"2026-05-14" }
    ],
    documents: [
      { id:"demo-doc-fuel", file_name:"demo-fuel-receipt.pdf", file_type:"Fuel Receipt", storage_bucket:"demo", storage_path:"demo-only", extracted_text:"Demo fuel receipt text.", extraction_status:"complete", building_id:null, space_id:null, asset_id:null, project_id:null, work_order_id:null, vehicle_id:"demo-vehicle-van-1", vendor_id:null, fuel_receipt_id:"demo-fuel-1", budget_item_id:"demo-budget-fuel", notes:"Demo document, not uploaded to Supabase Storage.", updated_at:"2026-05-14" },
      { id:"demo-doc-sink", file_name:"restroom-2-sink-photo.jpg", file_type:"Photo", storage_bucket:"demo", storage_path:"demo-only", extracted_text:null, extraction_status:"not_supported", building_id:"demo-building-francis", space_id:"demo-space-restroom-2", asset_id:"demo-asset-sink", project_id:"demo-project-refresh", work_order_id:"demo-wo-sink", vehicle_id:null, vendor_id:"demo-vendor-plumbing", fuel_receipt_id:null, budget_item_id:null, notes:"Demo linked work order photo.", updated_at:"2026-05-14" }
    ],
    submissions: [
      { id:"demo-review-1", document_id:"demo-doc-sink", source:"Demo staff portal", proposed_record_type:"work_order", proposed_data:{ title:"Restroom 2 sink leaking", priority:"urgent", building_id:"demo-building-francis", space_id:"demo-space-restroom-2", asset_id:"demo-asset-sink", vendor_id:"demo-vendor-plumbing", project_id:"demo-project-refresh", description:"Submitted from the field as demo data." }, status:"needs_review", notes:"Demo item waiting for Import Review.", created_record_id:null, created_record_table:null, created_at:"2026-05-14", updated_at:"2026-05-14" }
    ]
  };

  function withoutDemo(items){
    return (items || []).filter(item => !String(item.id || "").startsWith(demoPrefix));
  }

  function appendDemo(target, mapped){
    const existing = new Set((target || []).map(item => item.id));
    mapped.forEach(item => {
      if(!existing.has(item.id)) target.push(item);
    });
  }

  function loadDemoData(app, mappers){
    if(!app || !mappers) return false;
    appendDemo(app.buildings, demoRows.buildings.map(mappers.fromBuilding));
    appendDemo(app.spaces, demoRows.spaces.map(mappers.fromSpace));
    appendDemo(app.assets, demoRows.assets.map(mappers.fromAsset));
    appendDemo(app.projects, demoRows.projects.map(mappers.fromProject));
    appendDemo(app.vendors, demoRows.vendors.map(mappers.fromVendor));
    appendDemo(app.budgetItems, demoRows.budgetItems.map(mappers.fromBudgetItem));
    appendDemo(app.bids, demoRows.budgetItems.filter(row => row.item_type === "bid").map(row => mappers.fromBudgetBid(row, app.vendors)));
    appendDemo(app.tasks, demoRows.workOrders.map(mappers.fromWorkOrder));
    appendDemo(app.vehicles, demoRows.vehicles.map(mappers.fromVehicle));
    appendDemo(app.fuelReceipts, demoRows.fuelReceipts.map(mappers.fromFuelReceipt));
    appendDemo(app.files, demoRows.documents.map(mappers.fromDocument));
    appendDemo(app.submissions, demoRows.submissions.map(mappers.fromImportReview));
    return true;
  }

  function clearDemoData(app){
    if(!app) return;
    ["buildings", "spaces", "assets", "projects", "vendors", "budgetItems", "bids", "tasks", "archivedTasks", "vehicles", "fuelReceipts", "files", "submissions"].forEach(key => {
      app[key] = withoutDemo(app[key]);
    });
  }

  window.FieldOps.Services.demo = {
    loadDemoData,
    clearDemoData
  };
})();

