// Single source of truth for what Smart Entry can record. Each entry maps
// 1:1 to an `entry_type` value the DB check constraint accepts
// (supabase/migrations/20260914120000_smart_entry_engine.sql) and to the
// payload keys `fn_post_smart_entry` reads for that type — keep the two in
// sync when adding a field.

export const ENTRY_TYPES = [
  { value: "customer", label: "Customer", bulk: true },
  { value: "delivery", label: "Delivery", bulk: true },
  { value: "payment", label: "Payment", bulk: true },
  { value: "expense", label: "Expense", bulk: true },
  { value: "bottle", label: "Bottle Issue/Return", bulk: true },
  { value: "inventory_purchase", label: "Inventory Purchase", bulk: false },
  { value: "employee_salary", label: "Employee/Salary", bulk: false },
  { value: "invoice_adjustment", label: "Invoice/Adjustment", bulk: false },
  { value: "complaint_feedback", label: "Complaint/Feedback", bulk: false },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" }, { value: "bank", label: "Bank Transfer" },
  { value: "easypaisa", label: "Easypaisa" }, { value: "jazzcash", label: "JazzCash" },
  { value: "online_transfer", label: "Online Transfer" }, { value: "other", label: "Other" },
];

// field.type: text | number | date | month | textarea | select | customer | items
// field.optionsKey looks up an array on the `lookups` prop passed down from
// the server component: customers, products, zones, employees, cashAccounts,
// expenseCategories.
export const FIELDS = {
  customer: [
    { name: "name", label: "Customer Name", type: "text", required: true },
    { name: "mobile", label: "Mobile", type: "text", required: true },
    { name: "business_name", label: "Business Name", type: "text" },
    { name: "whatsapp_number", label: "WhatsApp Number", type: "text" },
    { name: "address", label: "Address", type: "text" },
    { name: "zone_id", label: "Zone", type: "select", optionsKey: "zones" },
    { name: "customer_type", label: "Type", type: "select", options: [{ value: "residential", label: "Residential" }, { value: "commercial", label: "Commercial" }], default: "residential" },
    { name: "opening_balance", label: "Opening Balance", type: "number", default: 0 },
    { name: "credit_limit", label: "Credit Limit", type: "number", default: 0 },
    { name: "payment_terms", label: "Payment Terms", type: "text" },
    { name: "product_id", label: "Product (for rate)", type: "select", optionsKey: "products" },
    { name: "rate", label: "Rate (optional)", type: "number" },
    { name: "regular_qty", label: "Regular Qty", type: "number" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  delivery: [
    { name: "customer_id", label: "Customer", type: "customer", required: true },
    { name: "delivery_date", label: "Delivery Date", type: "date", required: true, default: "today" },
    { name: "product_id", label: "Product", type: "select", optionsKey: "products", required: true },
    { name: "delivered_qty", label: "Delivered Qty", type: "number", required: true, min: 1 },
    { name: "empty_received", label: "Empty Bottles Received", type: "number", default: 0, min: 0 },
    { name: "rider_id", label: "Delivery Rider", type: "select", optionsKey: "riders" },
    { name: "unit_price", label: "Rate Override (optional)", type: "number" },
    { name: "rate_override_reason", label: "Reason for Rate Override", type: "text", showIf: (p) => p.unit_price !== "" && p.unit_price != null },
    { name: "amount_collected", label: "Cash Collected", type: "number", default: 0, min: 0 },
    { name: "payment_method", label: "Payment Mode", type: "select", options: PAYMENT_METHODS, default: "cash", showIf: (p) => Number(p.amount_collected) > 0 },
    { name: "cash_account_id", label: "Cash/Bank Account", type: "select", optionsKey: "cashAccounts", showIf: (p) => Number(p.amount_collected) > 0 },
  ],
  payment: [
    { name: "customer_id", label: "Customer", type: "customer", required: true },
    { name: "amount", label: "Amount (PKR)", type: "number", required: true, min: 0.01 },
    { name: "payment_date", label: "Payment Date", type: "date", required: true, default: "today" },
    { name: "method", label: "Payment Mode", type: "select", options: PAYMENT_METHODS, default: "cash", required: true },
    { name: "cash_account_id", label: "Cash/Bank Account", type: "select", optionsKey: "cashAccounts" },
    { name: "reference", label: "Reference / Invoice No.", type: "text" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  expense: [
    { name: "category_id", label: "Category", type: "select", optionsKey: "expenseCategories", required: true },
    { name: "description", label: "Description", type: "text" },
    { name: "amount", label: "Amount (PKR)", type: "number", required: true, min: 0.01 },
    { name: "expense_date", label: "Date", type: "date", required: true, default: "today" },
    { name: "payment_method", label: "Payment Mode", type: "select", options: PAYMENT_METHODS, default: "cash" },
    { name: "cash_account_id", label: "Cash/Bank Account", type: "select", optionsKey: "cashAccounts" },
    { name: "employee_id", label: "Employee (optional)", type: "select", optionsKey: "employees" },
    { name: "zone_id", label: "Zone (optional)", type: "select", optionsKey: "zones" },
    { name: "receipt_reference", label: "Receipt Reference (optional)", type: "text" },
  ],
  bottle: [
    { name: "customer_id", label: "Customer", type: "customer", required: true },
    { name: "product_id", label: "Product", type: "select", optionsKey: "products", required: true },
    { name: "txn_date", label: "Date", type: "date", required: true, default: "today" },
    { name: "delivered_qty", label: "Bottles Issued", type: "number", default: 0, min: 0 },
    { name: "returned_qty", label: "Empty Bottles Returned", type: "number", default: 0, min: 0 },
    { name: "damaged_qty", label: "Damaged", type: "number", default: 0, min: 0 },
    { name: "lost_qty", label: "Lost", type: "number", default: 0, min: 0 },
    { name: "adjustment_qty", label: "Adjustment (+/-)", type: "number", default: 0 },
    { name: "adjustment_reason", label: "Reason for Adjustment", type: "text", showIf: (p) => Number(p.adjustment_qty) !== 0 },
    { name: "remarks", label: "Remarks", type: "text" },
  ],
  inventory_purchase: [
    { name: "supplier_name", label: "Supplier Name", type: "text", required: true },
    { name: "purchase_date", label: "Purchase Date", type: "date", required: true, default: "today" },
    { name: "items", label: "Items", type: "items", itemFields: [
      { name: "inventory_item_id", label: "Item", type: "select", optionsKey: "inventoryItems", required: true },
      { name: "quantity", label: "Qty", type: "number", required: true, min: 0.01 },
      { name: "rate", label: "Rate", type: "number", required: true, min: 0 },
      { name: "discount", label: "Discount", type: "number", default: 0 },
    ] },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  employee_salary: [
    { name: "employee_id", label: "Employee", type: "select", optionsKey: "employees", required: true },
    { name: "period_month", label: "Salary Month", type: "month", required: true },
    { name: "base_salary", label: "Base Salary", type: "number", default: 0 },
    { name: "advances", label: "Advances Deducted", type: "number", default: 0 },
    { name: "deductions", label: "Other Deductions", type: "number", default: 0 },
    { name: "net_paid", label: "Net Paid (PKR)", type: "number", required: true, min: 0.01 },
    { name: "paid_date", label: "Paid Date", type: "date", default: "today" },
    { name: "payment_method", label: "Payment Mode", type: "select", options: PAYMENT_METHODS, default: "cash" },
    { name: "cash_account_id", label: "Cash/Bank Account", type: "select", optionsKey: "cashAccounts" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  invoice_adjustment: [
    { name: "customer_id", label: "Customer", type: "customer", required: true },
    { name: "adjustment_type", label: "Type", type: "select", options: [{ value: "invoice", label: "Invoice" }, { value: "credit_note", label: "Credit Note (reduces balance)" }], default: "invoice" },
    { name: "invoice_date", label: "Date", type: "date", required: true, default: "today" },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "items", label: "Line Items", type: "items", itemFields: [
      { name: "description", label: "Description", type: "text", required: true },
      { name: "product_id", label: "Product (optional)", type: "select", optionsKey: "products" },
      { name: "quantity", label: "Qty", type: "number", default: 1, min: 0.01 },
      { name: "rate", label: "Rate", type: "number", default: 0 },
      { name: "discount", label: "Discount", type: "number", default: 0 },
    ] },
    { name: "discount", label: "Overall Discount", type: "number", default: 0 },
    { name: "tax", label: "Tax", type: "number", default: 0 },
  ],
  complaint_feedback: [
    { name: "customer_id", label: "Customer", type: "customer", required: true },
    { name: "kind", label: "Type", type: "select", options: [{ value: "complaint", label: "Complaint" }, { value: "feedback", label: "Feedback" }], default: "complaint" },
    { name: "subject", label: "Subject", type: "text", showIf: (p) => (p.kind || "complaint") === "complaint", required: true },
    { name: "description", label: "Description", type: "textarea", showIf: (p) => (p.kind || "complaint") === "complaint" },
    { name: "overall_rating", label: "Overall Rating (1-5)", type: "number", min: 1, max: 5, showIf: (p) => p.kind === "feedback", required: true },
    { name: "delivery_rating", label: "Delivery Rating (1-5)", type: "number", min: 1, max: 5, showIf: (p) => p.kind === "feedback" },
    { name: "product_rating", label: "Product Rating (1-5)", type: "number", min: 1, max: 5, showIf: (p) => p.kind === "feedback" },
    { name: "timeliness_rating", label: "Timeliness Rating (1-5)", type: "number", min: 1, max: 5, showIf: (p) => p.kind === "feedback" },
    { name: "comment", label: "Comment", type: "textarea", showIf: (p) => p.kind === "feedback" },
  ],
};

// Columns shown in the bulk grid — a compact subset of FIELDS (no long
// text areas / item arrays in a spreadsheet cell).
export const BULK_COLUMNS = {
  customer: ["name", "mobile", "business_name", "zone_id", "opening_balance", "credit_limit"],
  delivery: ["customer_id", "delivery_date", "product_id", "delivered_qty", "empty_received", "amount_collected", "rider_id"],
  payment: ["customer_id", "amount", "payment_date", "method", "reference"],
  expense: ["category_id", "description", "amount", "expense_date", "payment_method"],
  bottle: ["customer_id", "product_id", "txn_date", "delivered_qty", "returned_qty", "damaged_qty", "lost_qty"],
};

export function defaultPayload(entryType) {
  const out = {};
  for (const f of FIELDS[entryType] || []) {
    if (f.type === "items") { out[f.name] = []; continue; }
    if (f.default === "today") out[f.name] = new Date().toISOString().slice(0, 10);
    else if (f.default !== undefined) out[f.name] = f.default;
    else out[f.name] = "";
  }
  return out;
}
