(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Auth = window.FieldOps.Auth || {};

  const VIEW_ACCESS = {
    owner: ["dashboard","assignedWork","workOrders","scheduledWork","workOrderDetail","reviewDetail","projects","materials","buildings","spaces","assets","vehicles","fuelReceipts","vendors","budget","documents","importReview","importCenter","reports","inbox","settings"],
    admin: ["dashboard","assignedWork","workOrders","scheduledWork","workOrderDetail","reviewDetail","projects","materials","vehicles","fuelReceipts","vendors","documents","importReview","importCenter","reports","inbox","settings"],
    submitter: ["fieldPortal","assignedWork","importReview","materials","documents","inbox"],
    "signed-out": ["login"]
  };

  const SUBMITTER_INSERT_TABLES = new Set(["field_ops_import_reviews", "field_ops_documents"]);

  window.FieldOps.Auth.roles = { VIEW_ACCESS, SUBMITTER_INSERT_TABLES };
})();

